/**
 * 翻译内核：`t()`、词典协议与复数选择。
 *
 * 词典是 `lib/locale/<id>.json`（懒加载数据源，客户端 bundle 不含翻译），所以这里
 * 直接读磁盘上的真实文件来校验：键集合、占位符、复数形态数。复数规则由
 * `Intl.PluralRules` 提供，覆盖 en/ru/ja/ko/zh-TW，而不是手写分支。
 *
 * 中文是源语言：`zh` 没有词典文件，客户端用 en 的键生成 identity（key === value），
 * fallback 链因此先命中中文原文。
 */
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindTranslate, pluralCategoriesOf, selectPluralForm, t } from '../lib/src/i18n.js'

const readDictionary = (id) => JSON.parse(readFileSync(new URL(`../lib/locale/${id}.json`, import.meta.url), 'utf8'))
const dicts = Object.fromEntries(['en', 'ru', 'zh-TW', 'ja', 'ko'].map((id) => [id, readDictionary(id)]))
const DICTIONARY_IDS = Object.keys(dicts)

/** 用某种语言的词典模拟 Host 翻译器（真实 Host 还会填占位符，t() 会再填一遍）。 */
const translatorFor = (id) => (key) => dicts[id][key] ?? key

test('t：未绑定翻译器时原样返回中文键，并展开占位符', () => {
  assert.equal(t('工具'), '工具')
  assert.equal(t('{0} 个工具', [3]), '3 个工具')
  assert.equal(t('{0} {1}', ['a', 'b']), 'a b')
  assert.equal(t('没有占位符'), '没有占位符')
})

test('t：绑定英文翻译器后输出英文，并按 n 选择复数形式', () => {
  bindTranslate(translatorFor('en'), () => 'en')
  assert.equal(t('{0} 个工具', { 0: 1, n: 1 }), '1 tool')
  assert.equal(t('{0} 个工具', { 0: 2, n: 2 }), '2 tools')
  assert.equal(t('{0} 个工具', { 0: 0, n: 0 }), '0 tools')
  bindTranslate(null)
  assert.equal(t('工具'), '工具', '解绑后回到中文键')
})

test('t：俄语三形态由 Intl.PluralRules 的 one/few/many 选择', () => {
  bindTranslate(translatorFor('ru'), () => 'ru')
  assert.equal(t('{0} 个工具', { 0: 1, n: 1 }), '1 инструмент')
  assert.equal(t('{0} 个工具', { 0: 3, n: 3 }), '3 инструмента')
  assert.equal(t('{0} 个工具', { 0: 5, n: 5 }), '5 инструментов')
  assert.equal(t('{0} 个工具', { 0: 21, n: 21 }), '21 инструмент')
  assert.equal(t('{0} 个工具', { 0: 11, n: 11 }), '11 инструментов')
  bindTranslate(null)
})

test('t：日语/韩语/繁体中文没有复数屈折，同一形态用于任意 n', () => {
  for (const id of ['ja', 'ko', 'zh-TW']) {
    bindTranslate(translatorFor(id), () => id)
    const key = '{0} 个工具'
    assert.equal(t(key, { 0: 3, n: 3 }), dicts[id][key].replace('{0}', '3'), id)
    assert.equal(t(key, { 0: 1, n: 1 }), dicts[id][key].replace('{0}', '1'), id)
    assert.ok(!dicts[id][key].includes('|'), `${id} 的复数键不应含 |`)
  }
  bindTranslate(null)
})

test('selectPluralForm：按语言类别选择，形态数按 Intl 的固定类别顺序排列', () => {
  assert.deepEqual(pluralCategoriesOf('en'), ['one', 'other'])
  assert.deepEqual(pluralCategoriesOf('ru'), ['one', 'few', 'many'])
  assert.deepEqual(pluralCategoriesOf('ja'), ['other'])
  assert.deepEqual(pluralCategoriesOf('zh-TW'), ['other'])
  assert.equal(selectPluralForm('en', 1, ['one', 'other']), 'one')
  assert.equal(selectPluralForm('en', 2, ['one', 'other']), 'other')
  assert.equal(selectPluralForm('ru', 2, ['one', 'few', 'many']), 'few')
  assert.equal(selectPluralForm('ru', 5, ['one', 'few', 'many']), 'many')
  assert.equal(selectPluralForm('ru', 1, ['one', 'few', 'many']), 'one')
  assert.equal(selectPluralForm('ja', 5, ['only']), 'only')
  assert.equal(selectPluralForm('en', 2, ['only']), 'only', '单形态语言不做复数切换')
})

test('t：已绑定时占位符仍由翻译结果二次填充（Host 先填一遍也没事）', () => {
  bindTranslate((key) => (key === '剩余 {0} 秒' ? 'Remaining {0}s' : key), () => 'en')
  assert.equal(t('剩余 {0} 秒', [12]), 'Remaining 12s')
  bindTranslate(null)
})

test('词典：五种语言键集合一致、占位符不丢失、复数形态数符合 Intl 规则', () => {
  const placeholders = (text) => new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))
  const enKeys = Object.keys(dicts.en)
  assert.deepEqual(enKeys, Object.keys(dicts.ru), 'en/ru 键序应一致')
  for (const id of DICTIONARY_IDS) {
    assert.deepEqual(Object.keys(dicts[id]), enKeys, `${id} 的键集合/顺序必须与 en 一致`)
    for (const key of enKeys) {
      const value = dicts[id][key]
      assert.equal(typeof value, 'string', `${id} 缺少值：${key}`)
      assert.ok(value.length > 0, `${id} 空值：${key}`)
      const sourcePlaceholders = placeholders(key)
      const targetPlaceholders = placeholders(value)
      for (const name of sourcePlaceholders) {
        assert.ok(targetPlaceholders.has(name), `${id} 丢了 {${name}}：${key}`)
      }
      for (const name of targetPlaceholders) {
        assert.ok(sourcePlaceholders.has(name), `${id} 多出 {${name}}：${key}`)
      }
      if (!value.includes('|')) continue
      const forms = value.split('|').length
      const expected = pluralCategoriesOf(id).length
      assert.equal(forms, expected, `${id} 的复数形态数应与 Intl 类别数一致：${key}`)
    }
  }
  for (const id of ['ja', 'ko', 'zh-TW']) {
    const piped = Object.entries(dicts[id]).filter(([, value]) => value.includes('|'))
    assert.deepEqual(piped, [], `${id} 不应包含复数形态`)
  }
})
