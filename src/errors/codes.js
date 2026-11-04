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
  'write-failed': '写入失败：{error}',
  'backup-failed': '覆盖前备份失败，已放弃写入：{error}',

  // ── 技能名校验 / 技能写盘（src/skills/write.js）──────────────────────────
  'name-empty': '名字不能为空',
  'name-too-long': '名字不能超过 64 个字符',
  'name-slash': '名字不能包含斜杠',
  'name-dot': '名字不能以点开头，也不能是 . 或 ..',
  'name-control': '名字不能包含控制字符',
  'skill-create-exists': '「{name}」已存在，请换一个名字',
  'skill-missing': '「{name}」不存在',
  'skill-rename-target-exists': '「{name}」已存在，不会覆盖',

  // ── 回收站（src/skills/trash.js）─────────────────────────────────────────
  'trash-entry-missing': '缺少技能名称或路径',
  'trash-readonly': '外部 Agent 目录只读，不能删除',
  'trash-roots-missing-move': '缺少允许的写盘根，拒绝移动（内部错误）',
  'trash-path-outside-move': '路径不在允许的写盘根内，已拒绝移动：{path}',
  'trash-source-gone': '该技能已不在磁盘上',
  'trash-move-failed': '移动失败：{error}',
  'trash-record-incomplete': '回收站记录不完整',
  'trash-roots-missing-restore': '缺少允许的写盘根，拒绝恢复（内部错误）',
  'trash-path-outside-restore': '路径不在允许的写盘根内，已拒绝恢复：{path}',
  'trash-file-gone': '回收站里的文件已经不在了',
  'trash-restore-target-exists': '原位置已经有同名技能，未覆盖',
  'trash-restore-failed': '恢复失败：{error}',
  'trash-purge-outside': '拒绝删除回收站目录之外的路径',
  'trash-purge-failed': '彻底删除失败：{error}',

  // ── GitHub 技能仓库（src/skills/repositories.js）──────────────────────────
  'repo-input-empty': '请填写仓库地址',
  'repo-url-invalid': '只支持 GitHub 仓库地址，形如 https://github.com/owner/repo',
  'repo-owner-invalid': '仓库地址里的 owner / repo 不合法',
  'repo-download-failed': '下载失败：{error}',
  'repo-not-found': '仓库不存在，或是私有仓库（本插件只读公开仓库）',
  'repo-rate-limited': 'GitHub 拒绝了这次下载（可能触发限流，稍后再试）',
  'repo-download-http': '下载失败：HTTP {status}',
  'repo-archive-empty': '下载到的压缩包是空的',
  'repo-too-large': '仓库太大（{size} MB），超过 32 MB 上限',
  'repo-unzip-failed': '压缩包无法解开：{error}',

  // ── 仓库技能安装/更新/回滚（src/skills/repository-install.js）────────────
  'repo-dest-project-missing': '选了项目级就必须指定工作区',
  'repo-dest-unwritable': '这个目标位置不可写',
  'repo-install-target-exists': '目标位置已经有同名技能，未覆盖（可先卸载或换个位置）',
  'repo-cache-missing': '仓库缓存不见了，请先刷新这个仓库',
  'repo-skill-files-missing': '压缩包里找不到这个技能的文件，请刷新仓库',
  'repo-skill-missing': '压缩包里找不到这个技能',
  'repo-backup-aborted': '备份失败，已中止更新：{error}',
  'repo-path-outside-root': '安装记录里的路径不在允许的根内，已拒绝删除：{path}',
  'repo-update-rolled-back': '更新失败，已回滚到更新前：{error}',
  'repo-rollback-missing': '这个技能没有可回滚的备份',
  'repo-rollback-failed': '回滚失败：{error}',

  // ── 导入技能（src/skills/import.js）──────────────────────────────────────
  'import-base64-empty': '没有收到文件内容',
  'import-base64-invalid': '文件内容不是合法的 base64',
  'import-base64-empty-bytes': '解出来的文件是空的',
  'import-zip-too-large': '技能包太大（{size} KB），上限 {max} MB',
  'import-name-undetermined': '无法确定技能名：请填写一个 kebab-case 名字（小写字母、数字、连字符）',
  'import-zip-unzip-failed': '压缩包无法解开：{error}',
  'import-zip-no-skill': '压缩包里没有 SKILL.md，无法识别为技能',
  'import-zip-multiple-skills': '压缩包里有 {count} 个 SKILL.md，一次只能导入一个技能',
  'import-zip-skill-empty': '压缩包里这个技能没有文件',
  'import-target-exists': '目标位置已经有同名技能，未覆盖',
  'import-markdown-empty': 'SKILL.md 内容为空',
  'import-markdown-too-large': 'SKILL.md 太大（超过 256 KB）',
  'import-folder-path-missing': '请填写技能目录的绝对路径',
  'import-folder-missing': '这个路径不存在',
  'import-folder-not-directory': '这个路径不是目录',
  'import-folder-no-skill': '这个目录里没有 SKILL.md，无法识别为技能',
  'import-folder-same': '源目录就是目标目录，无需导入',
  'import-folder-target-inside': '目标位置在源目录里面，不能这样导入',
  'import-folder-copy-failed': '复制失败：{error}',

  // ── OAuth（src/mcp/oauth/*）与其它路由 ───────────────────────────────────
  'oauth-client-id-missing': '缺少 client_id：明文例外要求先用动态注册（或手填）拿到客户端信息',
  'oauth-pkce-missing': '缺少 PKCE code_verifier：授权流程可能已过期，请重新点一次「授权」',
  'oauth-sdk-refresh-missing': 'SDK 没有导出 refreshAuthorization',
  'oauth-sdk-redirect-no-url': 'SDK 返回 REDIRECT 但没有交回授权 URL',
  'oauth-sdk-unexpected-result': 'SDK 返回 {result}',
  'oauth-insecure-endpoint-unneeded': '该端点不需要明文例外（{url}）',
  'oauth-access-token-missing': 'access_token 缺失或不是字符串',
  'oauth-sdk-export-missing': 'exports["."].import.default 缺失',
  'oauth-sdk-version-unparsable': '版本不可解析：{version}',
  'oauth-not-installed': 'OAuth 支持未安装',
  'patch-parse-failed': 'patch 解析失败',
  'patch-read-failed': 'patch 读取失败',

  // ── MCP 行 / 重连 / 技能扫描（src/index.js）──────────────────────────────
  'mcp-server-not-found': '找不到服务器 {name}',
  'mcp-server-name-missing': '请求里没有服务器名',
  'mcp-no-session-for-project-server': '没有会话正在使用项目级服务器 {name}，无需重连',
  'mcp-profile-row-missing': 'profile 里找不到服务器 {name} 对应的行',
  'mcp-server-disabled': '服务器 {name} 处于停用状态，先在面板里启用它',
  'mcp-reload-timeout': '停用后未等到 Loader 卸载该行，已重新启用，请再试一次',
  'oauth-unknown-action': '未知的 OAuth 操作：{action}',
  'skill-read-not-this-route': 'read 不走此路由',
  'skill-path-missing': '缺少 path',
  'skill-not-in-scan': '该技能不在当前扫描结果里',
  'skill-not-in-scan-stale': '该技能不在当前扫描结果里（可能已被移动或删除）',
  'category-source-missing': '缺少 source',
  'category-create-invalid': '分类名无效、为空或已存在',
  'category-rename-failed': '改名失败：原名不存在、新名为空或已存在',
  'category-not-found': '分类不存在',
  'trash-record-not-found': '回收站里没有这条记录',
  'repo-id-missing': '缺少仓库 id',
  'repo-not-in-state': '没有这个仓库',
  'repo-skill-not-in-repo': '这个仓库里没有该技能',
  'repo-install-record-missing': '没有这条安装记录',
  'skills-unknown-operation': '未知操作「{op}」',
  'update-current-version-unreadable': '读不到本插件版本',
  'market-unknown-operation': '未知市场操作「{op}」',
  'import-unknown-type': '未知导入类型「{op}」',

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
 * @param {'reason' | 'detail' | 'error' | 'message' | 'text'} [field]
 */
export function errorFields(code, params = {}, field = 'reason') {
  return { code, params, [field]: renderError(code, params) }
}
