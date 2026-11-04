/**
 * Scanning one source for importable MCP servers: resolve the file list, parse
 * each file (loose JSON), adapt the entries this source uses, and report both
 * the importable servers and the files that could not be read.
 */
import { existsSync, readFileSync } from 'node:fs'
import { adaptImportedEntry, importFilePath, parseJsonLoose } from './sources.js'
import { IMPORT_SOURCES } from './sources.js'
import { errorFields } from '../errors/codes.js'

export function scanImportSource(scope, project, sourceId) {
  const source = IMPORT_SOURCES.find((item) => item.id === sourceId)
  if (source === undefined) return { files: [], servers: [], ...errorFields('import-source-unknown', { id: sourceId }, 'error') }
  const paths = (scope === 'global' ? source.global : source.project) ?? []
  if (paths.length === 0) {
    const code = scope === 'global' ? 'import-source-no-user-config' : 'import-source-no-project-config'
    return { files: [], servers: [], ...errorFields(code, { source: source.label }, 'error') }
  }
  if (source.supported === false) return {
    files: paths.map((path) => ({ path, exists: existsSync(importFilePath(path, project)), servers: [], unsupported: 0, error: '' })),
    servers: [],
    ...errorFields('import-source-toml-only', { source: source.label }, 'error'),
  }
  const files = []
  const servers = []
  const taken = new Set()
  for (const relative of paths) {
    const file = importFilePath(relative, project)
    const report = { path: relative, exists: existsSync(file), servers: [], unsupported: 0, error: '' }
    if (report.exists) {
      try {
        const document = parseJsonLoose(readFileSync(file, 'utf8'))
        for (const key of source.keys) {
          const table = document?.[key]
          if (table === null || typeof table !== 'object' || Array.isArray(table)) continue
          for (const [name, spec] of Object.entries(table)) {
            const adapted = adaptImportedEntry(name, spec, source.shape ?? 'default')
            if (adapted === null || !/^[A-Za-z0-9_-]{1,32}$/.test(adapted.serverName) || taken.has(adapted.serverName)) {
              report.unsupported += 1
              continue
            }
            taken.add(adapted.serverName)
            report.servers.push(adapted.serverName)
            servers.push({
              scope: scope === 'global' ? 'global' : project,
              id: adapted.serverName, serverName: adapted.serverName,
              enabled: true, runtime: 'auto',
              source: relative, transport: adapted.transport, url: adapted.url, command: adapted.command,
              args: adapted.args, env: adapted.env, headers: adapted.headers,
            })
          }
        }
      } catch (error) {
        report.error = String(error?.message ?? error)
      }
    }
    files.push(report)
  }
  return { files, servers }
}

/** Translate one panel entry into the shipped mcp-client config, or null when unusable. */
