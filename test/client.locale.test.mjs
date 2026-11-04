/**
 * `apply()` 的本地化接线。
 *
 * 这里守的不是语法，而是两个很容易在真实界面上才暴露的契约：
 *   1. `zh` 必须注册一份 identity 词典 —— 内置 zh 的 fallback 是 en，只注册 en
 *      会让中文界面的面板变成英文；
 *   2. `ru` 是语言包，必须 addLanguage 才可能被选中，否则词典永远用不上。
 * `bootPanel` 默认不带 locale；这里显式传入桩，观察 apply 发出的调用。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootPanel, emptyDoc, skipWithoutBundle } from '../scripts/lib/client-harness.mjs'
import { en } from '../lib/src/i18n/dict.en.js'
import { ru } from '../lib/src/i18n/dict.ru.js'

test('apply：注册 zh（identity）/ en / ru 词典，并把 ru 加入语言列表后绑定翻译器', { skip: skipWithoutBundle() }, async () => {
  const calls = []
  const disposers = []
  const locale = {
    register: (ns, localeId, dict) => {
      calls.push({ op: 'register', ns, localeId, dict })
      return () => {}
    },
    addLanguage: (definition) => {
      calls.push({ op: 'addLanguage', definition })
      return () => {}
    },
    bind: (ns) => {
      calls.push({ op: 'bind', ns })
      return (key) => key
    },
  }
  const panel = await bootPanel(emptyDoc(), {
    locale,
    effect: (fn) => {
      const disposition = fn()
      disposers.push(disposition)
      return () => {}
    },
  })

  const addLanguage = calls.find((call) => call.op === 'addLanguage')
  assert.ok(addLanguage, '必须调用 addLanguage 注册 ru 语言包')
  assert.deepEqual(addLanguage.definition, { id: 'ru', label: 'Русский', fallback: 'en' })

  const registrations = calls.filter((call) => call.op === 'register')
  assert.deepEqual(registrations.map((call) => call.localeId).sort(), ['en', 'ru', 'zh'])
  for (const registration of registrations) assert.equal(registration.ns, 'dsh-skills-mcp-manager')

  const zh = registrations.find((call) => call.localeId === 'zh').dict
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort(), 'zh 词典的键必须与 en 相同')
  for (const [key, value] of Object.entries(zh)) assert.equal(value, key, `zh 必须是 identity 映射：${key}`)
  assert.deepEqual(registrations.find((call) => call.localeId === 'en').dict, en)
  assert.deepEqual(registrations.find((call) => call.localeId === 'ru').dict, ru)

  const bind = calls.find((call) => call.op === 'bind')
  assert.ok(bind, '必须把 Host 翻译器绑定给 t()')
  assert.equal(bind.ns, 'dsh-skills-mcp-manager')

  assert.ok(disposers.length >= 4, '词典/语言注册都应登记为 effect 以便卸载')
  panel.restore()
})
