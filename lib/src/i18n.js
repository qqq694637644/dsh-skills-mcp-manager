/**
 * Panel localisation.
 *
 * Keys are the Chinese source strings themselves (gettext-style msgid): the text
 * that used to be inlined in the components is now the lookup key, so a missing
 * translation falls back to the original instead of an opaque identifier, and
 * the diff of a wording change stays readable.
 *
 * Components import `t` directly because they are plain functions, not slot
 * outlets: threading a `t` prop through every helper would add a parameter to
 * dozens of signatures without buying anything. `bindTranslate` is called once
 * from the client entry with the Host's bound translator; before that call (and
 * in tests) `t` returns the key unchanged, which keeps the Chinese copy as the
 * default.
 */
import { en } from './i18n/dict.en.js'
import { ru } from './i18n/dict.ru.js'

/** Dictionaries registered under the plugin's own locale namespace. */
export const dictionaries = { en, ru }

let translate = null

/**
 * Bind the Host translator (usually `ctx.locale.bind(NS)`).
 * @param {((key: string, params?: Record<string, unknown>) => string) | null} fn
 */
export function bindTranslate(fn) {
  translate = typeof fn === 'function' ? fn : null
}

/**
 * Pick a plural form. Two forms mean "one | other" (English); three mean the
 * Russian rule "one | few | many".
 * @param {number} n
 * @param {string[]} forms
 * @returns {string}
 */
function pluralForm(n, forms) {
  const abs = Math.abs(n)
  if (forms.length === 2) return abs === 1 ? forms[0] : forms[1]
  const a = abs % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

/**
 * Fill `{name}` placeholders. Safe to run twice: the Host translator already
 * substitutes, and a second pass over a string without placeholders is a no-op.
 * @param {string} text
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
function interpolate(text, params) {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name) => (
    params[name] === undefined ? match : String(params[name])
  ))
}

/**
 * Translate a source string.
 *
 * Plural forms are written in the dictionary as `one|few|many` (or `one|other`
 * for English) and selected by `params.n`; the number itself still comes from a
 * `{0}`-style placeholder, so the Host translator can fill it before the form is
 * picked.
 *
 * @param {string} key - Chinese source text, optionally with `{name}` placeholders.
 * @param {Record<string, unknown>} [params] - placeholder values; `n` selects a plural form.
 * @returns {string}
 */
export function t(key, params) {
  let out = translate ? translate(key, params) : key
  if (params && params.n !== undefined && out.includes('|')) {
    out = pluralForm(Number(params.n), out.split('|'))
  }
  return interpolate(out, params)
}
