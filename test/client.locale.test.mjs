/**
 * `apply()` 的本地化接线。
 *
 * `installI18n()` 做四件事，这里全部观察/断言：
 *   1. 绑定 Host 翻译器，并把「当前语言」读取器交给 t()（复数选择要用）；
 *   2. 注册语言包定义（ru / zh-TW / ja / ko），否则设置里选不到；
 *   3. 按需从 `/<NS>/locale?lang=` 拉词典（harness 返回真实 JSON），只拉需要的语言；
 *   4. 用 en 的键生成并注册 zh identity 词典 —— 内置 zh 的 fallback 是 en，没有它
 *      中文界面的面板就会变成英文。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootPanel, emptyDoc, skipWithoutBundle } from '../scripts/lib/client-harness.mjs'

const tick = async (panel, rounds = 24) => {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve()
    panel.runtime.render()
  }
}

const registersById = (registrations, id) => registrations.filter((call) => call.id === id).at(-1)?.dict

test('apply：绑定翻译器、注册语言包、按需加载词典并补 zh identity', { skip: skipWithoutBundle() }, async () => {
  const calls = []
  const dictionaries = new Map()
  const listeners = new Set()
  const state = { active: 'en' }
  const locale = {
    register: (namespace, id, dict) => {
      calls.push({ op: 'register', namespace, id, dict })
      dictionaries.set(id, dict)
      return () => dictionaries.delete(id)
    },
    addLanguage: (definition) => {
      calls.push({ op: 'addLanguage', definition })
      return () => {}
    },
    bind: (namespace) => {
      calls.push({ op: 'bind', namespace })
      return (key) => {
        const dict = dictionaries.get(state.active) ?? dictionaries.get('en') ?? {}
        return dict[key] ?? key
      }
    },
    getLocale: () => ({ active: state.active }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  const panel = await bootPanel(emptyDoc(), {
    locale,
    effect: (fn) => {
      const disposition = fn()
      return typeof disposition === 'function' ? disposition : () => {}
    },
  })
  await tick(panel)

  // 1) 语言包定义先注册，ru/zh-TW/ja/ko 都必须在列表里。
  const added = calls.filter((call) => call.op === 'addLanguage').map((call) => call.definition)
  assert.deepEqual(added, [
    { id: 'ru', label: 'Русский', fallback: 'en' },
    { id: 'zh-TW', label: '繁體中文', fallback: 'zh' },
    { id: 'ja', label: '日本語', fallback: 'en' },
    { id: 'ko', label: '한국어', fallback: 'en' },
  ])

  // 2) 当前语言与回退语言都是 en：去重后只请求一次。
  const fetchLog = panel.doc.localeFetches ?? []
  assert.ok(fetchLog.includes('en'), `应请求 en 词典：${JSON.stringify(fetchLog)}`)
  assert.equal(fetchLog.filter((id) => id === 'en').length, 1, 'en 不应重复请求')

  // 3) 绑定 + 注册 en + 由 en 生成的 zh identity。
  const bind = calls.find((call) => call.op === 'bind')
  assert.ok(bind, '必须绑定 Host 翻译器')
  assert.equal(bind.namespace, 'dsh-skills-mcp-manager')
  const registrations = () => calls.filter((call) => call.op === 'register')
  assert.ok(registersById(registrations(), 'en'), '应注册 en 词典')
  const enDict = registersById(registrations(), 'en')
  const zhDict = registersById(registrations(), 'zh')
  assert.ok(zhDict, '应注册 zh identity 词典')
  assert.deepEqual(Object.keys(zhDict).sort(), Object.keys(enDict).sort(), 'zh 键必须与 en 一致')
  for (const [key, value] of Object.entries(zhDict)) assert.equal(value, key)

  // 4) 切到日语：订阅回调触发补载，ja 词典到达。
  state.active = 'ja'
  for (const listener of listeners) listener()
  await tick(panel)
  assert.ok(registersById(registrations(), 'ja'), '切到日语后应加载 ja 词典')
  assert.ok((panel.doc.localeFetches ?? []).includes('ja'), '应请求 ja 词典')

  panel.restore()
})
