/**
 * 面板本地化：翻译状态与复数选择。
 *
 * ## 键就是中文原文
 *
 * 词典用 gettext 风格的 msgid：组件里原本内联的中文文案就是查找键，缺译时回退到
 * 原文而不是不透明的标识符，改一句文案在 diff 里也仍然可读。
 *
 * ## 词典不在 bundle 里
 *
 * `lib/locale/<id>.json` 是唯一数据源，由 Host 的 `/locale` 路由按需返回；客户端只
 * 保留「当前语言 + en 回退」几份词典，不为每种语言付包体成本。词典注册后
 * `dsh-client-locale` 会推进 revision，槽位随语言切换重渲染。
 *
 * ## 复数交给 Intl.PluralRules
 *
 * 手写规则只能覆盖「英文 2 形态 / 俄语 3 形态」，日语、韩语、中文没有复数屈折，
 * 波兰语、阿拉伯语又是另一套规则。这里按 BCP 47 locale 用 `Intl.PluralRules`
 * 取类别，再按固定顺序（zero/one/two/few/many/other）在词典的 `|` 分隔形态里选。
 * 词典形态数必须与该语言的类别数一致；不一致时退化为「单数取第一个、其余取最后一个」。
 */

/** `Intl.PluralRules` 类别固定顺序；词典的 `|` 形态按这个顺序排列。 */
export const PLURAL_CATEGORY_ORDER = Object.freeze(['zero', 'one', 'two', 'few', 'many', 'other'])

/** @type {Map<string, { rules: Intl.PluralRules, order: string[] } | null>} */
const pluralPlanCache = new Map()

/** 当前语言的复数规则；运行时没有 Intl 或 locale 非法时返回 null。 */
function pluralPlan(locale) {
  const key = String(locale ?? 'en')
  if (pluralPlanCache.has(key)) return pluralPlanCache.get(key)
  let plan = null
  try {
    const rules = new Intl.PluralRules(key)
    const available = new Set(rules.resolvedOptions().pluralCategories)
    // 词典按「整数 n 会出现的类别」写形态：俄语的 other 只用于 1.5 这类小数，
    // 面板里的计数全是整数，所以词典是 one|few|many 三形态而不是四形态。
    const integerCategories = new Set()
    for (let n = 0; n <= 200; n += 1) integerCategories.add(rules.select(n))
    plan = {
      rules,
      all: PLURAL_CATEGORY_ORDER.filter((category) => available.has(category)),
      order: PLURAL_CATEGORY_ORDER.filter((category) => integerCategories.has(category)),
    }
  } catch {
    plan = null
  }
  pluralPlanCache.set(key, plan)
  return plan
}

/**
 * 一种语言在「整数计数」下使用的复数类别（按固定顺序），也就是词典的 `|` 形态顺序。
 *
 * @param {string} locale
 * @returns {string[]}
 */
export function pluralCategoriesOf(locale) {
  return pluralPlan(locale)?.order ?? []
}

/**
 * 从 `|` 分隔的形态里，按 `Intl.PluralRules(locale).select(n)` 选一个。
 *
 * 形态与类别按 `PLURAL_CATEGORY_ORDER` 对齐；小数（如 1.5）落在整数类别之外时，
 * 退回最后一个形态，不抛错。
 *
 * @param {string} locale
 * @param {number} n
 * @param {string[]} forms
 * @returns {string}
 */
export function selectPluralForm(locale, n, forms) {
  const list = Array.isArray(forms) ? forms : []
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  const plan = pluralPlan(locale)
  if (plan !== null) {
    const order = list.length === plan.order.length
      ? plan.order
      : list.length === plan.all.length ? plan.all : null
    if (order !== null) {
      const category = plan.rules.select(Number(n))
      const index = order.indexOf(category)
      return list[index >= 0 ? index : list.length - 1]
    }
  }
  // 词典与运行时规则对不上（漏译/旧词典）：给一个不炸的近似解，测试会兜住真实错误。
  const abs = Math.abs(Number(n))
  if (list.length === 2) return abs === 1 ? list[0] : list[1]
  const a = abs % 100
  const b = a % 10
  if (a > 10 && a < 20) return list[list.length - 1]
  if (b > 1 && b < 5) return list[1] ?? list[list.length - 1]
  if (b === 1) return list[0]
  return list[list.length - 1]
}

/** @type {((key: string, params?: Record<string, unknown>) => string) | null} */
let translate = null

/** @type {() => string} */
let currentLocale = () => 'en'

/**
 * 绑定 Host 翻译器（通常是 `ctx.locale.bind(NS)`）与「当前语言」读取器。
 *
 * 复数选择需要知道当前语言，而 `locale.bind()` 只返回翻译函数；所以第二个参数是
 * 读取 active locale 的函数。传 null 取消绑定（回退到「键原样返回」）。
 *
 * @param {((key: string, params?: Record<string, unknown>) => string) | null} fn
 * @param {(() => string) | null} [getLocale]
 */
export function bindTranslate(fn, getLocale) {
  translate = typeof fn === 'function' ? fn : null
  currentLocale = typeof getLocale === 'function' ? getLocale : () => 'en'
}

/**
 * 填充 `{name}` 占位符。数组也可以：`'0' in array` 是 true，所以 `t(key, [n])` 成立。
 *
 * @param {string} text
 * @param {Record<string, unknown> | readonly unknown[]} [params]
 * @returns {string}
 */
function interpolate(text, params) {
  if (!params) return String(text)
  return String(text).replace(/\{(\w+)\}/g, (match, name) => (
    name in params ? String(params[name]) : match
  ))
}

/**
 * 翻译一个中文源字符串。
 *
 * 词典值里含 `|` 的是复数形态，由 `params.n` 选择；形态里的 `{0}` 等占位符在选定
 * 形态之后再填充。未绑定翻译器时返回原键（测试与首帧渲染都依赖这个契约）。
 *
 * @param {string} key
 * @param {Record<string, unknown> | readonly unknown[]} [params]
 * @returns {string}
 */
export function t(key, params) {
  let out = translate ? translate(key, params) : key
  if (params && params.n !== undefined && typeof out === 'string' && out.includes('|')) {
    out = selectPluralForm(currentLocale(), Number(params.n), out.split('|'))
  }
  return interpolate(out, params)
}
