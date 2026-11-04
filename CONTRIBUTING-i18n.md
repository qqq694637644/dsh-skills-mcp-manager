# 翻译贡献指南（i18n）

面板跟随 DSH 的全局语言（设置 → 通用设置 → 语言），插件没有自己的语言开关。当前提供
**简体中文（源语言）、English、Русский、繁體中文（台灣）、日本語、한국어** 六种。

## 词典在哪、长什么样

唯一数据源是 `lib/locale/<id>.json`。它**不在客户端 bundle 里**：Host 的
`GET /<NS>/locale?lang=<id>`（`src/locale/route.js`）按需返回，客户端 `lib/src/i18n/load.js`
只加载「当前语言 + en 回退」并注册到 `dsh-client-locale`。

词典是扁平 JSON，**键是简体中文原文**（gettext 风格的 msgid），值是目标语言：

```json
{
  "工具": "Tools",
  "{0} 个工具": "{0} tool|{0} tools"
}
```

规则：

- 键一个字都不能改，顺序与 `en.json` 保持一致；值不能为空。
- 占位符 `{0}` / `{1}` / `{name}` 原样保留，不能翻译、不能增删（复数形态里可以重复出现，
  但集合必须一致）。
- 值里的 `|` 只用来分隔**复数形态**，普通文案里不能出现 `|`。
- 中文（`zh`）没有词典文件：客户端在 en 到达后用它的键生成 identity 词典
  （key === value）。这样内置 `zh` 的 `zh → en` 回退链会先命中中文原文。

## 复数形态怎么排

复数选择在 `lib/src/i18n.js`，用 `Intl.PluralRules(locale)`，不写死语言分支。词典的 `|`
形态按 `Intl` 类别在**整数计数**下出现的固定顺序排列：

| 语言 | 整数类别（词典形态顺序） | 例子 |
| --- | --- | --- |
| en | one \| other | `{0} tool\|{0} tools` |
| ru | one \| few \| many | `{0} инструмент\|{0} инструмента\|{0} инструментов` |
| ja / ko / zh-TW | other（单形态，无 `\|`） | `{0}개 도구` |

俄语的 `other` 只用于 1.5 这类小数，面板计数全是整数，所以词典写三形态即可。测试
（`test/i18n.test.mjs`）会按 `pluralCategoriesOf(id)` 校验形态数，多了少了都会失败。

## 新增一种语言

1. 在 `lib/locale/` 放 `<id>.json`，键/序从 `en.json` 复制后只改值；`id` 用 BCP 47
   （`ja`、`zh-TW`、`pt-BR`……）。
2. 在 `lib/src/i18n/languages.js` 的 `LANGUAGE_PACKS` 里加
   `{ id, label: '原生标签', fallback: 'en' }`；`DICTIONARY_IDS` 同步加 id。
   `fallback` 链必须最终落到 `en`；`zh-TW` 可以回退 `zh`。
3. 在 `src/locale/route.js` 的 `SHIPPED_LANGUAGES` 加 id（Host 只服务白名单文件）。
4. 跑 `npm test`：词典键集合、占位符、复数形态数、路由白名单都会被校验。
5. 同步 README「界面语言」一节的清单；`locale/en.json`、`locale/zh.json` 是**插件管理器**
   里的标题/说明，与面板语言是两套文件，新增语言时按需追加。

## 质量要求

- **不接受纯机器翻译直接合并**：机器稿可以做起点，但合入前需要母语者过一遍措辞与术语。
  当前六种词典由维护者与社区协作产出，欢迎母语者提 PR 修正。
- 术语保持一致：技能 / 服务器 / 项目 / 全局 / 启用 / 停用 / 保存 / 回收站 / 仓库 / 工具 /
  会话 / 凭据 / 授权（各语言的对应词见既有词典）。
- 只改文案，不要顺手改键、键序或代码；一个翻译 PR 尽量只碰 `lib/locale/*.json`。
- Host 的错误/结果消息也走同一套词典：`src/errors/codes.js` 里的中文模板就是键，Host 返回
  `code + params`，客户端用 `t(模板, params)` 渲染。新增 code 必须同时在六种词典里补模板译文，
  `test/locale.coverage.test.mjs` 会逐条校验覆盖率与占位符一致性。
