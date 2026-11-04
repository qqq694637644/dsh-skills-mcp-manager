/**
 * 客户端 Host 错误码映射：code/params 优先，旧 Host 的中文 reason 兜底。
 *
 * 词典翻译未绑定（测试默认）时 `t()` 返回模板原文，所以这里能直接断言「用的是
 * code 对应的模板」而不是 Host 的 reason；翻译覆盖率在词典测试里另行校验。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindTranslate } from '../lib/src/i18n.js'
import { hasHostErrorCode, hostErrorMessage } from '../lib/src/host-error.js'

test('hostErrorMessage：已知 code 用模板 + params 渲染，忽略旧的中文 reason', () => {
  const message = hostErrorMessage({
    ok: false,
    code: 'update-check-failed',
    params: { npm: 'network error', github: 'HTTP 404', packageJson: 'no version' },
    reason: '检查不到可用版本：npm（请求 npm registry失败：offline）；GitHub（HTTP 404）；package.json（HTTP 500）',
  }, '检查插件更新失败')
  assert.equal(message, '检查不到可用版本：npm（network error）；GitHub（HTTP 404）；package.json（no version）')
})

test('hostErrorMessage：绑定翻译器后走当前语言的词典（这里是模拟的英文）', () => {
  bindTranslate((key) => {
    if (key === '不知道当前版本') return 'Current version is unknown'
    return key
  }, () => 'en')
  assert.equal(hostErrorMessage({ ok: false, code: 'update-check-current-missing', reason: '不知道当前版本' }), 'Current version is unknown')
  bindTranslate(null)
})

test('hostErrorMessage：未知 code / 旧 Host 走 reason 兜底，再不行用调用方 fallback', () => {
  assert.equal(hostErrorMessage({ ok: false, code: 'future-code', reason: '旧版中文原因' }), '旧版中文原因')
  assert.equal(hostErrorMessage({ ok: false, reason: '', detail: '详细原因' }), '详细原因')
  assert.equal(hostErrorMessage(null, '检查插件更新失败'), '检查插件更新失败')
  assert.equal(hostErrorMessage({ ok: false }), '')
})

test('hasHostErrorCode：只认表里存在的 code', () => {
  assert.equal(hasHostErrorCode({ code: 'update-check-failed' }), true)
  assert.equal(hasHostErrorCode({ code: 'nope' }), false)
  assert.equal(hasHostErrorCode({}), false)
})
