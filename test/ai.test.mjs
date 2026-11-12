import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openStore } from '../lib/db.js'
import { createApi } from '../lib/api.js'
import { createAi, buildAnalyzePrompt, parseCards, parseCard, selectBlocks } from '../lib/ai.js'
import { groupItems, cleanPageText } from '../lib/pdftext.js'

const BLOCKS = [
  { id: 'b1', heading: true, text: '1 行业' },
  { id: 'b2', heading: false, text: '2027 年冷板式渗透率 38%，市场空间 268 亿元。' },
  { id: 'b3', heading: true, text: '2 技术' },
  { id: 'b4', heading: false, text: '冷板与浸没的 TCO 交叉点在 1.2kW/柜。' },
  { id: 'b5', heading: false, text: '集成商净利率 6–8%，快接头与 CDU 挤压毛利。' },
  { id: 'b6', heading: false, text: '2025–2027 年收入 CAGR 约 41%。' },
  { id: 'b7', heading: false, text: '预计 2028 年浸没式窗口打开。' },
]

function card(board, evidence) {
  return {
    board,
    title: board + '的判断',
    thesis: '基于原文的总结性判断。',
    points: ['支撑点一', '支撑点二'],
    evidence,
    gaps: ['待补一条'],
  }
}

function payload() {
  return JSON.stringify({
    cards: [
      card('行业逻辑与框架', ['b2']),
      card('技术原理', ['b4']),
      card('商业逻辑', ['b5']),
      card('财务框架与预测', ['b6']),
      card('技术发展前景', ['b7']),
    ],
  })
}

test('groupItems rebuilds lines by y coordinate', () => {
  const text = groupItems([
    { str: '第二行', transform: [1, 0, 0, 1, 0, 100], width: 30 },
    { str: '第一行', transform: [1, 0, 0, 1, 0, 200], width: 30 },
    { str: '续', transform: [1, 0, 0, 1, 32, 200], width: 10 },
  ])
  assert.equal(text.split('\n')[0], '第一行续')
  assert.equal(text.split('\n')[1], '第二行')
})

test('groupItems merges vertical CJK titles instead of one char per line', () => {
  const items = [
    { str: '宏', transform: [10, 0, 0, 10, 10, 800], width: 10 },
    { str: '观', transform: [10, 0, 0, 10, 10, 789], width: 10 },
    { str: '研', transform: [10, 0, 0, 10, 10, 778], width: 10 },
    { str: '究', transform: [10, 0, 0, 10, 10, 767], width: 10 },
    { str: '正文第一行', transform: [10, 0, 0, 10, 60, 700], width: 60 },
  ]
  const text = groupItems(items)
  assert.match(text, /宏观研究/)
  assert.match(text, /正文第一行/)
  assert.equal(text.split('\n').filter((line) => line.length === 1).length, 0)
})

test('selectBlocks keeps every heading and stays within the character budget', () => {
  const picked = selectBlocks(BLOCKS, 200, 10)
  assert.ok(picked.length >= 2)
  assert.ok(picked.some((block) => block.heading))
})

test('buildAnalyzePrompt lists five boards and block ids', () => {
  const { prompt } = buildAnalyzePrompt(BLOCKS, '测试研报', '')
  assert.match(prompt, /行业逻辑与框架/)
  assert.match(prompt, /技术发展前景/)
  assert.match(prompt, /\[b2\]/)
})

test('parseCards maps evidence ids and skips unknown boards', () => {
  const cards = parseCards(payload(), BLOCKS)
  assert.equal(cards.length, 5)
  assert.equal(cards[0].evidence[0].blockId, 'b2')
  assert.ok(cards[0].points.length >= 2)
  assert.throws(() => parseCards(JSON.stringify({ cards: [{ ...card('不存在的板块', ['b2']) }] }), BLOCKS), /证据/)
})

test('parseCard rejects cards without valid evidence', () => {
  assert.throws(() => parseCard(JSON.stringify({ card: card('技术原理', ['zzz']) }), BLOCKS), /证据/)
})

test('createAi streams a model response and parses cards', async () => {
  const ctx = {
    get(key) {
      if (key === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'deepseek', model: 'deepseek-chat' }) }
      if (key === 'llm') {
        return {
          async *stream(options) {
            assert.equal(options.provider, 'deepseek')
            assert.equal(options.model, 'deepseek-chat')
            const text = payload()
            yield { type: 'text-delta', index: 0, text: text.slice(0, 40) }
            yield { type: 'text-delta', index: 0, text: text.slice(40) }
            yield { type: 'finish', reason: { kind: 'stop' } }
          },
          async listProviders() {
            return []
          },
          async listModels() {
            return []
          },
        }
      }
      return undefined
    },
  }
  const ai = createAi(ctx)
  assert.equal(ai.info().available, true)
  const cards = await ai.analyze({ title: '测试', blocks: BLOCKS })
  assert.equal(cards.length, 5)
  assert.equal(cards[0].evidence[0].blockId, 'b2')
})

test('api: AI analyze and revise endpoints', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'invest-ai-'))
  const store = openStore(dir)
  const ai = {
    info: () => ({ available: true, provider: 'fake', model: 'fake' }),
    analyze: async () => [
      {
        board: '技术原理',
        title: 'AI 总结',
        thesis: 'AI 生成的总结。',
        points: ['证据一'],
        gaps: [],
        evidence: [{ blockId: 'b2', quote: '2027 年冷板式渗透率 38%' }],
      },
    ],
    revise: async (card) => ({
      board: card.board,
      title: '重写后的卡片',
      thesis: '按驳回原因重写。',
      points: ['修正点'],
      gaps: [],
      evidence: [{ blockId: 'b2', quote: '2027 年冷板式渗透率 38%' }],
    }),
  }
  const server = http.createServer(createApi(store, ai))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = 'http://127.0.0.1:' + server.address().port + '/invest/api'
  try {
    const source = (
      await (
        await fetch(base + '/sources', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'paste', title: '测试', text: BLOCKS.map((block) => block.text).join('\n') }),
        })
      ).json()
    ).source
    const analyzed = await (await fetch(base + '/sources/' + source.id + '/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ engine: 'ai' }),
    })).json()
    assert.equal(analyzed.engine, 'ai')
    assert.equal(analyzed.cards[0].title, 'AI 总结')

    const revised = await (await fetch(base + '/cards/' + analyzed.cards[0].id + '/revise', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: '口径不对' }),
    })).json()
    assert.equal(revised.card.title, '重写后的卡片')
    assert.equal(revised.card.status, 'ai_draft')

    const health = await (await fetch(base + '/health')).json()
    assert.equal(health.ai.available, true)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    store.close()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('cleanPageText drops boilerplate, credentials and chart internals', () => {
  const text = [
    '下载日志已记录，仅供内部参考',
    '宏观研究',
    '赵伟 A0230524070010',
    'zhaowei@swsresearch.com',
    '正文第一段',
    '图表 2：示例图表',
    '10 20 30 150%',
    '资料来源：测试',
    '正文第二段',
    '请务必仔细阅读正文之后的各项信息披露与声明 第 7 页 共 28 页 有信仰 敢担当 守正创新 追求卓越',
  ].join('\n')
  const cleaned = cleanPageText(text)
  assert.match(cleaned, /正文第一段/)
  assert.match(cleaned, /正文第二段/)
  assert.match(cleaned, /图表 2：示例图表/)
  assert.doesNotMatch(cleaned, /下载日志|zhaowei|A023|10 20 30|资料来源|请务必/)
})

test('cleanPageText skips chart table-of-contents pages', () => {
  const text = ['图表目录', '图表 1：A..........1', '图表 2：B..........2', '图表 3：C..........3'].join('\n')
  assert.equal(cleanPageText(text), '')
})

