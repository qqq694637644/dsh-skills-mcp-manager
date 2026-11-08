/**
 * Resolve the active DSH workspace without confusing it with a Git project root.
 *
 * Workspace membership is owned by the workspace registry's sessionIds ledger.
 * Agent insertion order and a session's mutable working directory are not
 * reliable substitutes: a host may keep several live sessions at once, and a
 * session may change cwd after it was attached to its original workspace.
 */
function pathKey(value) {
  if (typeof value !== 'string' || value.trim() === '') return ''
  const raw = value.trim()
  const windowsPath = /^[a-z]:[\\/]/i.test(raw) || /^\\\\/.test(raw)
  const normalized = windowsPath
    ? raw.replace(/\//g, '\\').replace(/\\+/g, '\\').replace(/\\+$/, '')
    : raw.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, '')
  return windowsPath ? normalized.toLowerCase() : normalized
}

/**
 * Return the one workspace that owns a live agent, or an empty string when the
 * live agents span multiple workspaces (there is no global notion of a focused
 * session in the Host plugin context, so choosing the first one would be a lie).
 *
 * Older workspace-registry projections did not expose sessionIds. Only in that
 * compatibility case do we fall back to the immutable SessionHeader.cwd, and
 * we require an exact workspace-path match rather than promoting it to a Git
 * ancestor.
 */
export function currentWorkspacePath(workspaces, agents) {
  const rows = Array.isArray(workspaces) ? workspaces : []
  const liveAgents = Array.isArray(agents) ? agents : []
  if (rows.length === 0 || liveAgents.length === 0) return ''

  const hasSessionLedger = rows.some((workspace) => Array.isArray(workspace?.sessionIds))
  if (hasSessionLedger) {
    const sessionIds = new Set(liveAgents
      .map((agent) => String(agent?.id ?? agent?.session?.id ?? ''))
      .filter((id) => id !== ''))
    const paths = new Set()
    for (const workspace of rows) {
      const path = String(workspace?.path ?? '')
      if (path === '') continue
      if ((workspace.sessionIds ?? []).some((id) => sessionIds.has(String(id)))) paths.add(path)
    }
    return paths.size === 1 ? [...paths][0] : ''
  }

  const cwdKeys = new Set(liveAgents
    .map((agent) => pathKey(agent?.session?.header?.cwd))
    .filter((key) => key !== ''))
  const paths = new Set(rows
    .filter((workspace) => cwdKeys.has(pathKey(workspace?.path)))
    .map((workspace) => String(workspace?.path ?? ''))
    .filter((path) => path !== ''))
  return paths.size === 1 ? [...paths][0] : ''
}
