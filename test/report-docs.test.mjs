import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openStore } from '../lib/db.js'
import { createApi } from '../lib/api.js'
import { buildBlocks } from '../lib/parse.js'

test('report generation accepts selected uploaded documents without cards', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'invest-docs-report-'))
  const store = openStore(dir)
  const text = '# 测试文档\n冷板式液冷单柜价值量约 8–12 万元。'
  const source = store.createSource({
    kind: 'file',
    title: '测试上传文档',
    fileName: 'test.pdf',
    text,
    blocks: buildBlocks(text),
    pageCount: 3,
  })
  const fakeAi = {
    info: () => ({ available: true, provider: 'fake', model: 'fake' }),
    async generate({ title, documents }) {
      assert.equal(documents.length, 1)
      assert.match(documents[0].text, /8–12 万元/)
      return '# ' + title + '\n\n依据上传文档，冷板式单柜价值量约 8–12 万元。（来源：测试上传文档）\n'
    },
  }
  const server = http.createServer(createApi(store, fakeAi))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = 'http://127.0.0.1:' + server.address().port + '/invest/api'
  try {
    const res = await fetch(base + '/reports/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '文档生成测试', cardIds: [], sourceIds: [source.id], allowWebSearch: false }),
    })
    const body = await res.json()
    assert.equal(res.status, 200)
    assert.equal(body.report.kind, 'ai')
    assert.equal(body.materials.documents, 1)
    assert.match(body.report.content, /8–12 万元/)
    assert.ok(body.report.citations.some((item) => item.cardId === 'doc:' + source.id))
    await fetch(base + '/reports/' + body.report.id, { method: 'DELETE' })
  } finally {
    await new Promise((resolve) => server.close(resolve))
    store.close()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
