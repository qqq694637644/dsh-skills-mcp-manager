/**
 * Locale dictionary transport.
 *
 * The client bundle deliberately contains no translations: `lib/locale/<id>.json`
 * is the single source of truth, read from disk on first use and served to the
 * panel so it can fetch just the active language + English fallback.
 *
 * Read-only, allow-listed, and path-traversal proof: the language id must be one
 * of the shipped files, so it is never interpolated into a path unchecked.
 */
import { readFile } from 'node:fs/promises'
import { NAME } from '../identity.js'

export const LOCALE_PATH = `/${NAME}/locale`

/** Every language the client may ask for (zh is generated client-side from en). */
export const SHIPPED_LANGUAGES = Object.freeze(['en', 'ru', 'zh-TW', 'ja', 'ko'])

/** Parsed dictionaries are small (~25–36 KB each); keep them after the first read. */
const cache = new Map()

/**
 * Read one shipped dictionary.
 *
 * @param {string} language
 * @returns {Promise<Record<string, string> | null>} null for an unknown language
 */
export async function readDictionary(language) {
  const id = String(language ?? '')
  if (!SHIPPED_LANGUAGES.includes(id)) return null
  const cached = cache.get(id)
  if (cached !== undefined) return cached
  // dist/locale/route.js → package/lib/locale/<id>.json (same depth from src).
  const file = new URL(`../../lib/locale/${id}.json`, import.meta.url)
  const parsed = JSON.parse(await readFile(file, 'utf8'))
  cache.set(id, parsed)
  return parsed
}

/**
 * Register `GET /<NS>/locale?lang=<id>`.
 *
 * The same connection guard as every other Host route: this route is only
 * reachable from the authenticated panel, and it returns no user data.
 *
 * @param {any} ctx
 */
export function registerLocaleRoute(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: LOCALE_PATH,
    handler: async (req, res) => {
      const rejection = ctx.connection.requestRejection(req)
      if (rejection !== undefined) {
        res.statusCode = rejection
        res.end()
        return
      }
      res.setHeader('cache-control', 'no-store')
      if (req.method !== 'GET') {
        res.statusCode = 405
        res.setHeader('allow', 'GET')
        res.end()
        return
      }
      let language = ''
      try {
        language = new URL(String(req.url ?? '/'), 'http://localhost').searchParams.get('lang') ?? ''
      } catch {
        language = ''
      }
      res.setHeader('content-type', 'application/json; charset=utf-8')
      let dictionary = null
      try {
        dictionary = await readDictionary(language)
      } catch (error) {
        ctx.logger.warn('dsh-skills-mcp-manager: locale read failed: %s', String(error?.message ?? error))
        res.statusCode = 503
        res.end(JSON.stringify({ error: 'locale-unavailable' }))
        return
      }
      if (dictionary === null) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'unknown-language' }))
        return
      }
      res.statusCode = 200
      res.end(JSON.stringify({ ok: true, id: language, dict: dictionary }))
    },
  }))
}
