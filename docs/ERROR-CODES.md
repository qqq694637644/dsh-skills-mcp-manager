# Host 错误码化（0.6.5）

## 为什么

插件 UI 分两半：Client（React 面板）与 Host（Node 侧）。0.6.4 的 i18n 覆盖了 Client
的静态文案，但很多错误/结果文案是在 Host 里拼好中文再返回的，Client 只是原样显示；
非中文界面在失败路径上会中英混排。

0.6.5 起，Host 对用户可见的错误统一返回 **稳定错误码 + 参数**：

```json
{ "ok": false, "code": "server-not-found", "params": { "name": "github" }, "reason": "找不到服务器 github" }
```

- `code` 是稳定标识，不随文案改动；
- `params` 只放**语言中性**的值（名字、路径、HTTP 状态、底层技术信息），不得放已本地化句子；
- `reason` 保留中文，作为旧客户端 / 未知 code / 词典未加载时的兜底。

客户端 `lib/src/host-error.js` 的 `hostErrorMessage(result, fallback)` 按 `code` 查
`src/errors/codes.js` 的模板，再用当前 locale 的 `t(模板, params)` 渲染；模板本身
就是 i18n 键（与 `lib/locale/*.json` 的键完全一致）。

## 新增一个错误码

1. 在 `src/errors/codes.js` 的 `ERROR_TEMPLATES` 加 `'feature-code': '中文模板 {param}'`；
2. Host 响应处用 `errorResponse(code, params)`（`{ok:false}` 形状）或
   `errorFields(code, params, 'reason'|'detail'|'error')`（既有对象里附加字段）；
3. 在全部六种 `lib/locale/*.json` 里加同一条中文模板键与译文；
4. `npm test` 会校验：模板非空、code 唯一、词典覆盖率（每个模板在六种语言里都有值）、
   占位符一致。

## 迁移进度

| 文件 | 盘点条数 | 状态 |
| --- | ---: | --- |
| `src/update.js` | 8 | ✅ 已迁移 |
| `src/import/scan.js` | 2（+1 条英文 unknown source） | ✅ 已迁移 |
| `src/index.js` | 32 | ✅ 已迁移 |
| `src/mcp/oauth/flow.js` | 5 | ✅ 已迁移 |
| `src/mcp/oauth/insecure.js` | 2 | ✅ 已迁移 |
| `src/mcp/oauth/sdk.js` | 2 | ✅ 已迁移 |
| `src/mcp/toolsSync.js` | 1 | ✅ 已迁移 |
| `src/patch/readRows.js` | 1 | ✅ 已迁移 |
| `src/skills/import.js` | 21 | ✅ 已迁移 |
| `src/skills/repositories.js` | 11 | ✅ 已迁移 |
| `src/skills/repository-install.js` | 16 | ✅ 已迁移 |
| `src/skills/trash.js` | 17 | ✅ 已迁移 |
| `src/skills/write.js` | 12 | ✅ 已迁移 |
| 合计 | **130** | 已迁移 130（Host 响应面完成） |

## 客户端接入进度

- ✅ 插件更新失败文案（`hostErrorMessage`）
- ⬜ MCP 行/重连/技能写读/仓库/分类/回收站/导入扫描/OAuth 的展示位置（约 89 处
  `result.reason` / `detail` 直接渲染点，逐个换成 `hostErrorMessage`）

## 风险与约束

- 模板是 i18n 键：改中文措辞等于改键，必须同步六种词典；测试会挡住漏改。
- `params` 里不要塞中文句子（否则译文里夹中文）；技术异常信息可以原样放（通常是英文）。
- `reason` 必须继续生成，兼容尚未更新的旧客户端；新客户端只在没有可用 code 时才读它。
