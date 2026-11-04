/**
 * Host 错误码 → 当前语言的文案。
 *
 * Host 侧返回 `{ code, params, reason }`：`code` 是稳定错误码，`params` 只放语言中性的
 * 值（名字/路径/HTTP 状态/技术信息）；`reason` 是中文兜底，给旧 Host、未知 code 或
 * 词典还没加载时用。
 *
 * 翻译键就是 `src/errors/codes.js` 里的那句中文本模板（gettext 风格），因此
 * `lib/locale/*.json` 要为每个模板提供译文；`test/errors.codes.test.mjs` 校验覆盖率。
 */
import { ERROR_TEMPLATES } from '../../src/errors/codes.js'
import { t } from './i18n.js'

/**
 * @param {{ code?: unknown, params?: unknown, reason?: unknown, detail?: unknown }} result
 * @param {string} [fallback]
 * @returns {string}
 */
export function hostErrorMessage(result, fallback = '') {
  const code = typeof result?.code === 'string' ? result.code : ''
  if (code !== '' && Object.prototype.hasOwnProperty.call(ERROR_TEMPLATES, code)) {
    const template = ERROR_TEMPLATES[code]
    const params = result?.params !== null && typeof result?.params === 'object' ? result.params : {}
    return t(template, params)
  }
  for (const value of [result?.reason, result?.detail]) {
    if (typeof value === 'string' && value !== '') return value
  }
  return String(fallback ?? '')
}

/**
 * 结果里是否带着已知错误码（用于决定是否显示「技术详情」）。
 *
 * @param {{ code?: unknown }} result
 */
export function hasHostErrorCode(result) {
  return typeof result?.code === 'string' && Object.prototype.hasOwnProperty.call(ERROR_TEMPLATES, result.code)
}
