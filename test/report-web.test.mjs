import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openStore } from '../lib/db.js'
import { createApi } from '../lib/api.js'

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'invest-web-report-'))
}

test('report generation can use confirmed web search and refuses no-source requests', async () => {
  const dir = tempDir()
  const store = openStore(dir)
  const fakeAi = {
    info: () => ({ available: true, provider: 'fake', model: 'fake', web: true }),
    async searchWeb({ query }) {
      return {
        query,
        content: '公开检索摘要：AI4S 市场正在增长。',
        sources: [{ url: 'https://example.com/report', title: '示例公开来源', snippet: '公开摘要' }],
      }
    },
    async generate({ title, web }) {
      assert.ok(web && web.sources.length)
      return '# ' + title + '\n\n## 0 结论\n\n公开信息显示行业正在增长。[W1]\n\n## 公开来源与链接\n\n[W1] 示例公开来源 — https://example.com/report\n'
    },
  }
  const server = http.createServer(createApi(store, fakeAi))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = 'http://127.0.0.1:' + server.address().port + '/invest/api'
  try {
    const blocked = await fetch(base + '/reports/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '无来源测试', useMaterials: false, allowWebSearch: false }),
    })
    assert.equal(blocked.status, 400)
    assert.equal((await blocked.json()).error.code, 'materials_required')

    const generatedRes = await fetch(base + '/reports/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '公开网络生成测试', useMaterials: false, allowWebSearch: true, query: 'AI4S 市场' }),
    })
    const generated = await generatedRes.json()
    assert.equal(generatedRes.status, 200)
    assert.equal(generated.report.kind, 'ai')
    assert.match(generated.report.content, /公开信息显示/)
    assert.equal(generated.webSources[0].url, 'https://example.com/report')
    assert.ok(generated.report.citations.some((item) => item.url === 'https://example.com/report'))

    const deleted = await fetch(base + '/reports/' + generated.report.id, { method: 'DELETE' })
    assert.equal(deleted.status, 200)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    store.close()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
