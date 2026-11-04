/**
 * Host 侧的词典路由：只读、allow-list、未知语言 404、非 GET 405、先过连接守卫。
 * 这条路由是懒加载的数据源，客户端 bundle 里不含任何翻译。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LOCALE_PATH, SHIPPED_LANGUAGES, readDictionary, registerLocaleRoute } from '../src/locale/route.js'

function harness(options = {}) {
  let route
  let disposed = false
  registerLocaleRoute({
    effect: (fn) => fn(),
    webServer: { register: (value) => { route = value; return () => { disposed = true } } },
    connection: { requestRejection: () => options.rejection },
    logger: { warn() {} },
  })
  const request = async (method = 'GET', url = `${LOCALE_PATH}?lang=en`) => {
    const headers = {}
    let body = ''
    const res = { statusCode: 0, setHeader: (key, value) => { headers[key] = value }, end: (value = '') => { body = value } }
    await route.handler({ method, url }, res)
    return { status: res.statusCode, headers, body: body === '' ? null : JSON.parse(body) }
  }
  return { route, request, dispose: () => disposed }
}

test('locale route：路径与 allow-list', () => {
  const h = harness()
  assert.equal(h.route.path, LOCALE_PATH)
  assert.deepEqual([...SHIPPED_LANGUAGES], ['en', 'ru', 'zh-TW', 'ja', 'ko'])
})

test('locale route：连接守卫优先于读盘', async () => {
  const h = harness({ rejection: 401 })
  assert.equal((await h.request()).status, 401)
})

test('locale route：返回词典 JSON，禁缓存；未知语言 404；非 GET 405', async () => {
  const h = harness()
  const en = await h.request('GET', `${LOCALE_PATH}?lang=en`)
  assert.equal(en.status, 200)
  assert.equal(en.headers['cache-control'], 'no-store')
  assert.match(String(en.headers['content-type']), /application\/json/)
  assert.equal(en.body.ok, true)
  assert.equal(en.body.id, 'en')
  assert.ok(Object.keys(en.body.dict).length > 300)

  const ja = await h.request('GET', `${LOCALE_PATH}?lang=ja`)
  assert.equal(ja.status, 200)
  assert.equal(ja.body.id, 'ja')

  assert.equal((await h.request('GET', `${LOCALE_PATH}?lang=../../etc/passwd`)).status, 404)
  assert.equal((await h.request('GET', `${LOCALE_PATH}?lang=zh`)).status, 404, 'zh 由客户端生成 identity，不等于文件')
  assert.equal((await h.request('POST', `${LOCALE_PATH}?lang=en`)).status, 405)
})

test('readDictionary：五种语言都能读，未知语言返回 null', async () => {
  for (const id of SHIPPED_LANGUAGES) {
    const dict = await readDictionary(id)
    assert.equal(typeof dict, 'object')
    assert.ok(Object.keys(dict).length > 300, `${id} 词条过少`)
  }
  assert.equal(await readDictionary('zh'), null)
  assert.equal(await readDictionary('../en'), null)
})
