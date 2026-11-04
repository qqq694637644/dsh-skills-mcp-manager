/**
 * 本插件提供的语言清单。
 *
 * `zh` / `en` 是 DSH 内置语言，不需要（也不能）`addLanguage`；其余是 language pack：
 * 必须用 `ctx.locale.addLanguage({ id, label, fallback })` 注册定义，语言才会出现在
 * 设置 → 通用设置 → 语言里、也才会被 `navigator.languages` 匹配到。
 *
 * `fallback` 的链条必须最终落到 `en`：zh-TW 缺译时先回退中文（zh），再回退英文。
 */

/** 非内置语言：id / 原生标签 / 回退语言。 */
export const LANGUAGE_PACKS = Object.freeze([
  Object.freeze({ id: 'ru', label: 'Русский', fallback: 'en' }),
  Object.freeze({ id: 'zh-TW', label: '繁體中文', fallback: 'zh' }),
  Object.freeze({ id: 'ja', label: '日本語', fallback: 'en' }),
  Object.freeze({ id: 'ko', label: '한국어', fallback: 'en' }),
])

/** Host `/locale` 路由可返回的词典 id（zh 由 en 的键生成 identity，不需要文件）。 */
export const DICTIONARY_IDS = Object.freeze(['en', 'ru', 'zh-TW', 'ja', 'ko'])

/** DSH 内置语言；它们的定义不归插件管。 */
export const BUILTIN_LOCALES = Object.freeze(['zh', 'en'])
