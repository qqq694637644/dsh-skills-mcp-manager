/**
 * 运行时词典加载：按需向 Host 要 `lib/locale/<id>.json`，注册到 dsh-client-locale。
 *
 * 为什么不在 bundle 里静态 import：五种语言 × 约 350 条词条 ≈ 250 KB 源码，
 * 而任一时刻只有「当前语言 + 英文回退」两份真正需要。词典改由 Host 的
 * `GET /<NS>/locale?lang=<id>` 返回，客户端首屏只请求需要的那几份，后续切换语言
 * 时再补；注册会推进 locale revision，槽位自动重渲染。
 *
 * 中文是源语言：客户端不请求 zh 词典，等 en 到达后用它生成 identity 词典
 * （key === value）注册给 zh。这样内置 zh 的 `zh → en` 回退链会先命中中文原文，
 * 不会因为 en 已注册而把中文界面变成英文。
 */
import { bindTranslate } from '../i18n.js'
import { BUILTIN_LOCALES, DICTIONARY_IDS, LANGUAGE_PACKS } from './languages.js'

/** 把 BCP 47 标签收敛到我们支持的语言 id；不支持返回空串。 */
export function matchSupportedLocale(tag) {
  const value = String(tag ?? '').trim()
  if (value === '') return ''
  if (value === 'zh') return 'zh'
  if (DICTIONARY_IDS.includes(value)) return value
  const lower = value.toLowerCase()
  if (lower === 'zh-hant' || lower.startsWith('zh-hant-') || lower === 'zh-tw' || lower.startsWith('zh-tw-') || lower === 'zh-hk' || lower.startsWith('zh-hk-')) {
    return 'zh-TW'
  }
  const primary = lower.split('-')[0]
  if (primary === 'zh') return 'zh'
  return DICTIONARY_IDS.includes(primary) ? primary : ''
}

/** 读取当前 active locale；不同 DSH 版本的 locale 服务暴露的名字不同。 */
function readActive(locale) {
  try {
    const snapshot = locale.getLocale?.() ?? locale.getSnapshot?.() ?? null
    return typeof snapshot?.active === 'string' ? snapshot.active : 'en'
  } catch {
    return 'en'
  }
}

/** 用 en 词典的键生成中文 identity 词典（中文值就是键本身）。 */
function identityDictionary(dict) {
  return Object.fromEntries(Object.keys(dict).map((key) => [key, key]))
}

/**
 * 接线：绑定翻译器、注册语言包定义、按需加载词典，并跟随语言切换补载。
 *
 * 所有注册都通过 `ctx.effect` 持有，插件卸载时由 cordis 统一 dispose；没有 `effect`
 * 的极简测试上下文里退化为直接持有 disposer。
 *
 * @param {any} ctx client 插件上下文
 * @param {string} namespace 插件命名空间（路由前缀与 locale 命名空间是同一个）
 */
export function installI18n(ctx, namespace) {
  const locale = ctx?.locale
  if (!namespace || !locale || typeof locale.bind !== 'function') return

  /** @type {Array<() => void>} */
  const disposers = []
  const own = (off, label) => {
    if (typeof off !== 'function') return
    if (typeof ctx.effect === 'function') ctx.effect(() => off, label)
    else disposers.push(off)
  }

  // 先绑定：首帧会显示中文键，词典到达后注册推进 revision，槽位重渲染。
  bindTranslate(locale.bind(namespace), () => readActive(locale))

  // 语言定义先注册，让「已存偏好 / 浏览器语言」有机会解析到该语言。
  if (typeof locale.addLanguage === 'function') {
    for (const pack of LANGUAGE_PACKS) {
      try {
        own(locale.addLanguage({ ...pack }), `skills-mcp: ${pack.id} language`)
      } catch (error) {
        console.warn(`[skills-mcp] cannot add the ${pack.id} language:`, error)
      }
    }
  }

  /** @type {Set<string>} */
  const loaded = new Set()
  /** @type {Map<string, Promise<void>>} */
  const pending = new Map()

  const register = (id, dict) => {
    try {
      own(locale.register(namespace, id, dict), `skills-mcp: ${id} dictionary`)
      loaded.add(id)
    } catch (error) {
      console.warn(`[skills-mcp] cannot register the ${id} dictionary:`, error)
    }
  }

  /** @type {(id: string) => Promise<void>} */
  const load = (id) => {
    if (id === 'zh' || !DICTIONARY_IDS.includes(id) || loaded.has(id)) return Promise.resolve()
    const inflight = pending.get(id)
    if (inflight !== undefined) return inflight
    const run = (async () => {
      try {
        const response = await fetch(`/${namespace}/locale?lang=${encodeURIComponent(id)}`)
        if (response?.ok !== true) return
        const payload = await response.json()
        const dict = payload?.dict ?? payload
        if (dict === null || typeof dict !== 'object' || Array.isArray(dict)) return
        register(id, dict)
        // en 是回退语言，也是中文 identity 词典的键来源。
        if (id === 'en') register('zh', identityDictionary(dict))
      } catch {
        // 离线/路由缺失时保持「键原样返回」：中文可读，其余语言回退中文，不炸面板。
      } finally {
        pending.delete(id)
      }
    })()
    pending.set(id, run)
    return run
  }

  const request = (tag) => {
    const id = matchSupportedLocale(tag)
    if (id === '') return
    if (id === 'zh') {
      void load('en')
      return
    }
    void load(id)
  }

  // 当前语言、英文回退、浏览器首选语言都可能需要；去重由 load 自己处理。
  request(readActive(locale))
  request('en')
  const browserLanguages = typeof navigator !== 'undefined' && Array.isArray(navigator.languages)
    ? navigator.languages
    : []
  for (const tag of browserLanguages) request(tag)

  // 语言切换：词典可能还没加载过（例如用户从下拉里选了 ja）。locale.subscribe 在
  // 注册词典/切换语言时都会触发，load 会去重，不会重复请求。
  if (typeof locale.subscribe === 'function') {
    try {
      own(locale.subscribe(() => request(readActive(locale))), 'skills-mcp: locale subscription')
    } catch {
      // 忽略：没有订阅能力时至少当前语言仍可加载。
    }
  } else if (typeof ctx.on === 'function') {
    try {
      own(ctx.on('locale/change', () => request(readActive(locale))), 'skills-mcp: locale change')
    } catch {
      // 同上。
    }
  }

  // 内置语言清单在这里只用于文档/测试，防止「以为 zh 也需要 addLanguage」。
  void BUILTIN_LOCALES
}
