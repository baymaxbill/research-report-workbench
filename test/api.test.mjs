import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openStore } from '../lib/db.js'
import { createApi } from '../lib/api.js'
import { buildBlocks, answerQuestion, analyzeBlocks } from '../lib/parse.js'

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'invest-wb-'))
}

async function start() {
  const dir = tempDir()
  const store = openStore(dir)
  const server = http.createServer(createApi(store))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = 'http://127.0.0.1:' + server.address().port + '/invest/api'
  return {
    dir,
    store,
    base,
    async close() {
      await new Promise((resolve) => server.close(resolve))
      store.close()
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

test('buildBlocks keeps headings and paragraphs distinct', () => {
  const blocks = buildBlocks('# 1 行业定义\n液冷是用液体带走热量的方式。\n\n# 2 需求\nGB300 单柜功率约 120kW。')
  assert.equal(blocks.length, 4)
  assert.equal(blocks[0].heading, true)
  assert.equal(blocks[1].heading, false)
  assert.equal(blocks[2].heading, true)
  assert.match(blocks[3].text, /120kW/)
})

test('answerQuestion cites a block and admits when there is no evidence', () => {
  const blocks = buildBlocks('冷板式单柜价值量约 8–12 万元。\n浸没式要到 1.8kW 才具备经济性。')
  const hit = answerQuestion(blocks, '单柜价值量是多少', '')
  assert.equal(hit.evidence.length > 0, true)
  assert.match(hit.answer, /8–12 万元/)
  const miss = answerQuestion(blocks, '光伏组件价格', '')
  assert.equal(miss.evidence.length, 0)
  assert.match(miss.answer, /没有找到直接依据/)
})

test('analyzeBlocks returns five-board drafts with evidence', () => {
  const blocks = buildBlocks(
    [
      '# 行业',
      '2027 年冷板式渗透率 38%，市场空间 268 亿元。',
      '# 技术',
      '冷板与浸没的 TCO 交叉点在 1.2kW/柜。',
      '# 商业',
      '集成商毛利被快接头与 CDU 挤压，净利率 6–8%。',
      '# 财务',
      '2025–2027 年收入 CAGR 约 41%，测算口径为不含税。',
      '# 前景',
      '预计 2028 年浸没式窗口打开。',
    ].join('\n'),
  )
  const cards = analyzeBlocks(blocks)
  assert.equal(cards.length, 5)
  for (const card of cards) {
    assert.ok(card.board)
    assert.ok(card.evidence.length > 0)
    assert.ok(card.evidence.every((item) => item.blockId))
  }
})

test('api: create source, ask, analyze, confirm, report', async () => {
  const app = await start()
  try {
    const created = await fetch(app.base + '/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'paste',
        title: '测试研报',
        org: '测试机构',
        text: '# 需求\nGB300 单柜功率约 120kW，冷板式成为主力。\n# 空间\n2027 年市场空间 268 亿元。',
      }),
    })
    assert.equal(created.status, 200)
    const { source } = await created.json()
    assert.ok(source.id)
    assert.equal(source.blocks.length, 4)

    const asked = await fetch(app.base + '/sources/' + source.id + '/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '2027 年市场空间多少' }),
    })
    const askedBody = await asked.json()
    assert.ok(askedBody.qa.evidence.length > 0)

    const analyzed = await fetch(app.base + '/sources/' + source.id + '/analyze', { method: 'POST' })
    const analyzedBody = await analyzed.json()
    assert.ok(analyzedBody.cards.length >= 2)

    const card = analyzedBody.cards[0]
    const patched = await fetch(app.base + '/cards/' + card.id, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    })
    const patchedBody = await patched.json()
    assert.equal(patchedBody.card.status, 'confirmed')

    const reportRes = await fetch(app.base + '/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '液冷深度', mode: 'deep' }),
    })
    const { report } = await reportRes.json()
    assert.equal(report.title, '液冷深度')

    const saved = await fetch(app.base + '/reports/' + report.id, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '结论：冷板式先过成本线。', status: 'reviewing' }),
    })
    const savedBody = await saved.json()
    assert.equal(savedBody.report.status, 'reviewing')

    const freeRes = await fetch(app.base + '/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '自由撰写测试', kind: 'free' }),
    })
    const free = (await freeRes.json()).report
    assert.equal(free.kind, 'free')
    const freeSave = await fetch(app.base + '/reports/' + free.id, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '自由撰写正文，可随时保存。' }),
    })
    assert.match((await freeSave.json()).report.content, /自由撰写正文/)
    const freeDelete = await fetch(app.base + '/reports/' + free.id, { method: 'DELETE' })
    assert.equal(freeDelete.status, 200)
    assert.equal((await (await fetch(app.base + '/reports/' + free.id)).json()).error.code, 'report_not_found')

    const generatedRes = await fetch(app.base + '/reports/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'AI 自动生成测试', mode: 'quick' }),
    })
    const generated = await generatedRes.json()
    assert.equal(generated.report.kind, 'ai')
    assert.match(generated.report.content, /AI 自动生成测试/)
    assert.ok(generated.report.citations.length > 0)
    await fetch(app.base + '/reports/' + generated.report.id, { method: 'DELETE' })

    const overview = await (await fetch(app.base + '/overview')).json()
    assert.equal(overview.counts.sources, 1)
    assert.equal(overview.counts.confirmed, 1)

    const health = await (await fetch(app.base + '/health')).json()
    assert.equal(health.ok, true)
    assert.equal(health.plugin, 'research-report-workbench')
  } finally {
    await app.close()
  }
})
