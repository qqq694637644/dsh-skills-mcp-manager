/**
 * Host 错误码表的契约。
 *
 * 这里只测 Host 侧的 code/params/reason 形状；「每个 code 在六种字典里都有译文」
 * 由词典覆盖率测试在翻译落地后补齐（见 test/locale.coverage.test.mjs）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ERROR_TEMPLATES, errorFields, errorResponse, renderError } from '../src/errors/codes.js'

test('ERROR_TEMPLATES：code 命名稳定、模板非空', () => {
  const codes = Object.keys(ERROR_TEMPLATES)
  assert.ok(codes.length > 0)
  for (const code of codes) {
    assert.match(code, /^[a-z][a-z0-9-]*$/, `code 必须 kebab-case：${code}`)
    assert.equal(typeof ERROR_TEMPLATES[code], 'string')
    assert.ok(ERROR_TEMPLATES[code].length > 0, `模板不能为空：${code}`)
  }
})

test('renderError：填充 {name} 占位符，缺参数时保留占位符（便于测试发现漏传）', () => {
  assert.equal(renderError('update-check-failed', { npm: 'network error', github: 'HTTP 404', packageJson: 'no version' }),
    '检查不到可用版本：npm（network error）；GitHub（HTTP 404）；package.json（no version）')
  assert.match(renderError('update-check-failed', {}), /\{npm\}/)
  assert.match(renderError('update-check-failed', { npm: 'x' }), /\{github\}/)
})

test('renderError：未知 code 原样返回，方便兜底与日志定位', () => {
  assert.equal(renderError('not-a-real-code'), 'not-a-real-code')
})

test('errorResponse / errorFields：同时给出 code、params 与中文兜底', () => {
  const response = errorResponse('import-source-toml-only', { source: 'Claude Code' })
  assert.deepEqual(response, {
    ok: false,
    code: 'import-source-toml-only',
    params: { source: 'Claude Code' },
    reason: 'Claude Code 目前只有 TOML 配置，暂不支持自动导入',
  })

  const fields = errorFields('import-source-unknown', { id: 'x' }, 'error')
  assert.deepEqual(fields, {
    code: 'import-source-unknown',
    params: { id: 'x' },
    error: '未知的导入来源「x」',
  })
})
