/**
 * Host 侧用户可见错误/结果的稳定错误码表（0.6.5 起）。
 *
 * ## 为什么
 *
 * Host 在 Node 侧生成错误文案，它不知道当前 UI locale；如果直接返回中文句子，
 * 非中文界面就会中英混排。这里把每条消息收敛成 **code + params**：
 *
 *   `{ ok:false, code:'server-not-found', params:{ name }, reason:'找不到服务器 x' }`
 *
 * 新客户端优先用 code 查本地化文案（`lib/src/host-error.js` 把模板当作 i18n 键），
 * `reason` 仍保留中文，供旧客户端/未知 code 兜底。params 里只放**语言中性**的值
 * （名字、路径、HTTP 状态、底层 technique 文本），不要把已经本地化的句子塞进来。
 *
 * ## 模板就是 i18n 键
 *
 * 模板中文与 `lib/locale/*.json` 的键完全一致：客户端用 `t(模板, params)` 渲染。
 * 新增 code 必须同时补六种语言的词典，`test/errors.codes.test.mjs` 会校验覆盖率。
 */

/**
 * code → 中文模板。`{name}` 形式的占位符由 `renderError` 填充。
 */
export const ERROR_TEMPLATES = Object.freeze({
  // ── 通用 ──────────────────────────────────────────────────────────────────
  'env-fetch-missing': '当前环境没有 fetch',
  'request-json-required': '需要 application/json',

  // ── 自更新检查（src/update.js）────────────────────────────────────────────
  'update-check-current-missing': '不知道当前版本',
  'update-check-package-name-missing': '没有配置包名',
  'update-check-repository-missing': '没有配置更新源仓库',
  'update-check-failed': '检查不到可用版本：npm（{npm}）；GitHub（{github}）；package.json（{packageJson}）',

  // ── 导入扫描（src/import/scan.js）────────────────────────────────────────
  'import-source-unknown': '未知的导入来源「{id}」',
  'import-source-no-user-config': '{source} 目前没有已知的用户级 MCP 配置文件（该工具把 MCP 配置放在别处或仅支持全局）',
  'import-source-no-project-config': '{source} 目前没有已知的项目级 MCP 配置文件（该工具把 MCP 配置放在别处或仅支持全局）',
  'import-source-toml-only': '{source} 目前只有 TOML 配置，暂不支持自动导入',
})

/**
 * 把模板里的 `{name}` 占位符替换成 params 里的值；缺失的占位符保持原样，
 * 方便测试在漏传参数时发现，而不是静默输出 `undefined`。
 *
 * @param {string} code
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function renderError(code, params = {}) {
  const template = ERROR_TEMPLATES[code]
  if (template === undefined) return String(code)
  return template.replace(/\{(\w+)\}/g, (match, name) => (
    params[name] === undefined ? match : String(params[name])
  ))
}

/**
 * 标准失败响应：`{ ok:false, code, params, reason }`。
 *
 * @param {string} code
 * @param {Record<string, unknown>} [params]
 */
export function errorResponse(code, params = {}) {
  return { ok: false, code, params, reason: renderError(code, params) }
}

/**
 * 给已有响应对象附加 code/params 与指定字段的中文文案（不覆盖其它字段）。
 *
 * 适合 `{ ok:false, error: '...' }` 这类不能直接换成 `errorResponse` 的形状。
 *
 * @param {string} code
 * @param {Record<string, unknown>} [params]
 * @param {'reason' | 'detail' | 'error' | 'message'} [field]
 */
export function errorFields(code, params = {}, field = 'reason') {
  return { code, params, [field]: renderError(code, params) }
}
