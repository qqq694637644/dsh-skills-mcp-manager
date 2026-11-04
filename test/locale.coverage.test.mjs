/**
 * 错误码文案覆盖率：Host 的每个 `ERROR_TEMPLATES` 中文模板都必须在六种词典里出现
 * 且带同构的占位符。0.6.5 的核心不变量 —— 新增一个 code 却漏了某种语言，会在 CI 里
 * 直接失败，而不是等用户切到该语言才发现夹着中文。
 */
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ERROR_TEMPLATES } from '../src/errors/codes.js'

const LOCALES = ['en', 'ru', 'zh-TW', 'ja', 'ko']
const dictionaries = Object.fromEntries(LOCALES.map((id) => [
  id,
  JSON.parse(readFileSync(new URL(`../lib/locale/${id}.json`, import.meta.url), 'utf8')),
]))
const placeholders = (text) => new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))

test('错误码：每条模板在六种语言里都有译文，且占位符不增不减', () => {
  const templates = Object.values(ERROR_TEMPLATES)
  assert.ok(templates.length > 100, '错误码表不应是空壳')
  for (const template of templates) {
    const source = placeholders(template)
    for (const id of LOCALES) {
      const value = dictionaries[id][template]
      assert.equal(typeof value, 'string', `${id} 缺少错误文案：${template}`)
      assert.ok(value.length > 0, `${id} 错误文案为空：${template}`)
      const target = placeholders(value)
      for (const name of source) assert.ok(target.has(name), `${id} 丢了 {${name}}：${template}`)
      for (const name of target) assert.ok(source.has(name), `${id} 多出 {${name}}：${template}`)
    }
  }
})

test('六种词典的键集合完全一致（错误码文案不能只加到部分语言）', () => {
  const reference = Object.keys(dictionaries.en).sort()
  assert.ok(reference.length >= 450, `词典键数偏少：${reference.length}`)
  for (const id of LOCALES) {
    assert.deepEqual(Object.keys(dictionaries[id]).sort(), reference, `${id} 的键集合与 en 不一致`)
  }
})
