/**
 * `t()` / dictionary contract.
 *
 * The Chinese source strings are the dictionary keys, so `t()` must:
 *   - return the key untouched until a translator is bound (tests and the
 *     browser before `apply()` run);
 *   - interpolate `{name}` placeholders; arrays work because numeric indexes
 *     are properties too;
 *   - pick a plural form from `one|few|many` after the translator returns, so
 *     language-specific form counts stay in the dictionary;
 *   - keep the Chinese source as `zh` (identity) rather than falling back to
 *     English, and expose both shipped dictionaries.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindTranslate, dictionaries, t } from '../lib/src/i18n.js'
import { en } from '../lib/src/i18n/dict.en.js'
import { ru } from '../lib/src/i18n/dict.ru.js'

test('t：未绑定翻译器时原样返回中文键，并展开占位符', () => {
  assert.equal(t('工具'), '工具')
  assert.equal(t('{0} 个工具', [3]), '3 个工具')
  assert.equal(t('{0} {1}', ['a', 'b']), 'a b')
  assert.equal(t('没有占位符'), '没有占位符')
})

test('t：绑定英文翻译器后输出英文，并按 n 选择复数形式', () => {
  bindTranslate((key) => en[key] ?? key)
  assert.equal(t('{0} 个工具', { 0: 1, n: 1 }), '1 tool')
  assert.equal(t('{0} 个工具', { 0: 2, n: 2 }), '2 tools')
  assert.equal(t('{0} 个工具', { 0: 0, n: 0 }), '0 tools')
  bindTranslate(null)
  assert.equal(t('工具'), '工具', '解绑后回到中文键')
})

test('t：俄语三形态（one / few / many）由 params.n 选择', () => {
  bindTranslate((key) => ru[key] ?? key)
  assert.equal(t('{0} 个工具', { 0: 1, n: 1 }), '1 инструмент')
  assert.equal(t('{0} 个工具', { 0: 3, n: 3 }), '3 инструмента')
  assert.equal(t('{0} 个工具', { 0: 5, n: 5 }), '5 инструментов')
  assert.equal(t('{0} 个工具', { 0: 21, n: 21 }), '21 инструмент')
  assert.equal(t('{0} 个工具', { 0: 11, n: 11 }), '11 инструментов')
  bindTranslate(null)
})

test('t：已绑定时占位符仍由翻译结果二次填充（Host 翻译器先填一遍也没事）', () => {
  bindTranslate((key) => (key === '剩余 {0} 秒' ? 'Remaining {0}s' : key))
  assert.equal(t('剩余 {0} 秒', [12]), 'Remaining 12s')
  bindTranslate(null)
})

test('词典：中英文键集合一致，且占位符不丢失', () => {
  const keys = Object.keys(en)
  assert.deepEqual([...keys].sort(), [...Object.keys(ru)].sort(), 'en/ru 的键集合必须一致')
  assert.ok(keys.length > 200, '词典不应是空壳')
  const placeholders = (text) => new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))
  for (const key of keys) {
    const expected = placeholders(key)
    for (const [name, dict] of [['en', en], ['ru', ru]]) {
      assert.ok(dict[key] !== undefined, `${name} 缺少键：${key}`)
      const actual = placeholders(dict[key])
      for (const name of expected) assert.ok(actual.has(name), `${name} 丢了 {${name}}：${key}`)
      for (const name of actual) assert.ok(expected.has(name), `${name} 多出 {${name}}：${key}`)
    }
  }
  assert.deepEqual(Object.keys(dictionaries.en), keys)
  assert.deepEqual(Object.keys(dictionaries.ru), Object.keys(ru))
})
