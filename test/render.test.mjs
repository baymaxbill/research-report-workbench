import test from 'node:test'
import assert from 'node:assert/strict'

let captured = null
globalThis.window = {
  __ModuleLoader__: {
    load(options) {
      captured = options
    },
  },
}

await import('../lib/client.js')

class FakeComponent {}

const fakeReact = {
  Component: FakeComponent,
  createElement(type, props, ...children) {
    return { type, props: props || {}, children }
  },
  useState(value) {
    const initial = typeof value === 'function' ? value() : value
    return [initial, () => {}]
  },
  useEffect() {},
  useRef(value) {
    return { current: value === undefined ? null : value }
  },
  useCallback(fn) {
    return fn
  },
}

const mod = captured.factory((name) => {
  if (name === 'react') return fakeReact
  throw new Error('unexpected module ' + name)
})

function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function render(node) {
  if (node === null || node === undefined || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return esc(node)
  if (Array.isArray(node)) return node.map(render).join('')
  if (typeof node.type === 'function') {
    return render(node.type({ ...node.props, children: node.children }))
  }
  const tag = node.type
  const props = node.props || {}
  let attrs = ''
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || key === 'ref' || typeof value === 'function') continue
    if (value === null || value === undefined || value === false) continue
    if (key === 'className') attrs += ' class="' + esc(value) + '"'
    else if (key === 'style' && typeof value === 'object') {
      attrs += ' style="' + esc(Object.entries(value).map(([k, v]) => k + ':' + v).join(';')) + '"'
    } else if (value === true) attrs += ' ' + key
    else attrs += ' ' + key + '="' + esc(value) + '"'
  }
  return '<' + tag + attrs + '>' + node.children.map(render).join('') + '</' + tag + '>'
}

const demoSource = {
  id: 's1',
  title: '冷板式液冷：2027 年的渗透拐点',
  org: '某券商研究所',
  kind: 'file',
  pageCount: 48,
  createdAt: '2026-11-11T00:00:00.000Z',
  blocks: [
    { id: 'b1', heading: true, text: '1 行业定义与边界' },
    { id: 'b2', heading: false, text: '冷板式单柜价值量约 8–12 万元，不含 CDU。' },
  ],
  cards: [
    {
      id: 'c1',
      board: '技术原理',
      title: 'TCO 交叉点在 1.2kW/柜',
      thesis: '超过 1.2kW/柜后冷板式更经济。',
      evidence: [{ blockId: 'b2', quote: '8–12 万元' }],
      status: 'ai_draft',
      updatedAt: '2026-11-11T00:00:00.000Z',
    },
  ],
  qa: [
    {
      id: 'q1',
      question: '单柜价值量多少？',
      answer: '原文：8–12 万元。',
      evidence: [{ blockId: 'b2', quote: '8–12 万元' }],
    },
  ],
}

const demoReport = {
  id: 'r1',
  title: '液冷：从主题到订单',
  mode: 'deep',
  status: 'draft',
  content: '## 0 结论与投资含义\n\n冷板式先过成本线。',
  outline: '0 结论与投资含义\n1 行业定义与边界',
  citations: [],
  updatedAt: '2026-11-11T00:00:00.000Z',
}

const demoCards = [
  {
    id: 'c1',
    board: '技术原理',
    title: 'TCO 交叉点在 1.2kW/柜',
    thesis: '超过 1.2kW/柜后冷板式更经济。',
    evidence: [{ blockId: 'b2', quote: '8–12 万元' }],
    status: 'confirmed',
    sourceTitle: '冷板式液冷',
    updatedAt: '2026-11-11T00:00:00.000Z',
  },
]

test('client bundle registers main + sidebar and exports components', () => {
  assert.ok(captured, 'module loader called')
  assert.equal(captured.id, 'research-report-workbench')
  assert.ok(mod.__components.App)
  assert.deepEqual(mod.inject, ['slots'])
})

test('home renders with empty overview and with data', () => {
  const C = mod.__components
  const empty = render(fakeReact.createElement(C.Home, { overview: null, onImport() {}, onNewReport() {}, onDemo() {}, onOpenSource() {}, onOpenReport() {} }))
  assert.match(empty, /研读台/)
  assert.match(empty, /还没有资料/)
  const filled = render(
    fakeReact.createElement(C.Home, {
      overview: {
        counts: { sources: 1, cards: 1, pending: 1, reports: 1 },
        sources: [demoSource],
        pendingCards: demoSource.cards,
        reports: [{ id: 'r1', title: demoReport.title, mode: 'deep', words: 120, status: 'draft' }],
      },
      onImport() {}, onNewReport() {}, onDemo() {}, onOpenSource() {}, onOpenReport() {},
    }),
  )
  assert.match(filled, /冷板式液冷/)
})

test('reader renders three panes and evidence', () => {
  const html = render(
    fakeReact.createElement(mod.__components.Reader, {
      source: { ...demoSource, hasFile: true },
      onBack() {},
      onSource() {},
      onAsk: async () => {},
      notify() {},
    }),
  )
  assert.match(html, /AI 摘要/)
  assert.match(html, /8–12 万元/)
  assert.match(html, /研读问答/)
  assert.match(html, /TCO 交叉点/)
  assert.match(html, /100%/)
  assert.match(html, /适合宽度/)
  assert.match(html, /iw-pane-switch/)
})

test('writer renders editor with report content', () => {
  const html = render(
    fakeReact.createElement(mod.__components.Writer, {
      report: demoReport,
      reports: [demoReport],
      cards: demoCards,
      onOpenReport() {},
      onCreate() {},
      onReport() {},
      onGoLibrary() {},
      notify() {},
    }),
  )
  assert.match(html, /液冷：从主题到订单/)
  assert.match(html, /冷板式先过成本线/)
  assert.match(html, /引用到光标/)
})

test('library renders rows and status', () => {
  const html = render(
    fakeReact.createElement(mod.__components.Library, {
      cards: demoCards,
      onRefresh() {},
      notify() {},
    }),
  )
  assert.match(html, /知识库/)
  assert.match(html, /文档文件夹/)
  assert.match(html, /TCO 交叉点/)
  assert.match(html, /已确认/)
})

test('figure capture and table modal render', () => {
  const C = mod.__components
  const figure = render(
    fakeReact.createElement(C.FigureCapture, {
      source: { id: 's1', title: '测试', pageCount: 12, hasFile: true },
      onClose() {},
      notify() {},
    }),
  )
  assert.match(figure, /截取图表/)
  assert.match(figure, /存入知识库/)

  const table = render(
    fakeReact.createElement(C.TableModal, {
      source: null,
      asset: {
        id: 'a1',
        kind: 'table',
        title: '数据',
        caption: '口径',
        sourceNote: '来源',
        chartType: 'bar',
        data: { columns: ['年份', '值'], rows: [['2025', '1']] },
      },
      onClose() {},
      onSaved() {},
      notify() {},
    }),
  )
  assert.match(table, /编辑数据表/)
  assert.match(table, /年份/)
})

test('session-scoped reader pane renders selection bar', () => {
  const html = render(
    fakeReact.createElement(mod.__components.ReaderPane, {
      sessionId: 'session-1',
      ask: async () => {},
    }),
  )
  assert.match(html, /研读/)
  assert.match(html, /还没有资料/)
})

test('makeAsk sends into the scoped conversation', async () => {
  const sent = []
  const ctx = {
    get(key) {
      if (key !== 'sessions') return undefined
      return {
        scope(id) {
          assert.equal(id, 'session-1')
          return {
            get(name) {
              if (name !== 'conversation') return undefined
              return { send: async (text) => sent.push(text) }
            },
          }
        },
      }
    },
  }
  const ask = mod.__internals.makeAsk(ctx, 'session-1')
  await ask('原文与问题')
  assert.deepEqual(sent, ['原文与问题'])
})

test('pageMap follows PDF page markers', () => {
  const map = mod.__internals.pageMap([
    { text: '【第 1 页】' },
    { text: '正文' },
    { text: '【第 2 页】' },
    { text: '正文' },
  ])
  assert.deepEqual(map, [1, 1, 2, 2])
})

test('pdf page view renders selection surface', () => {
  const html = render(
    fakeReact.createElement(mod.__components.PdfPageView, {
      source: { id: 's1', title: '测试研报', pageCount: 3, hasFile: true },
      onAsk: async () => {},
    }),
  )
  assert.match(html, /PDF/)
  assert.match(html, /上一页/)
  assert.match(html, /拖选文字/)
})

test('chart library renders document folders and empty state', () => {
  const html = render(fakeReact.createElement(mod.__components.ChartLibrary, { notify() {} }))
  assert.match(html, /按文档归档/)
  assert.match(html, /全部图表/)
  assert.match(html, /图表库还是空的/)
})

test('moki export modal renders folder picker surface', () => {
  const html = render(fakeReact.createElement(mod.__components.MokiExportModal, {
    source: { id: 's1', title: '测试研报' },
    onClose() {},
    notify() {},
  }))
  assert.match(html, /导出到 MOKI 资料库/)
  assert.match(html, /MOKI 目录/)
})

test('reader text mode exposes font size controls', () => {
  const html = render(fakeReact.createElement(mod.__components.Reader, {
    source: { ...demoSource, hasFile: false },
    onBack() {},
    onSource() {},
    notify() {},
  }))
  assert.match(html, /A\+/)
  assert.match(html, /15px/)
  assert.match(html, /fontSize:15px/)
})

test('writer exposes AI/free categories, save and delete', () => {
  const html = render(fakeReact.createElement(mod.__components.Writer, {
    report: demoReport,
    reports: [demoReport, { ...demoReport, id: 'r2', title: '自由报告', kind: 'free' }],
    cards: [],
    onOpenReport() {},
    onCreate() {},
    onReport() {},
    onDeleteReport() {},
    onGoLibrary() {},
    notify() {},
  }))
  assert.match(html, /AI 生成/)
  assert.match(html, /自由撰写/)
  assert.match(html, /删除/)
  assert.match(html, /保存/)
})

test('new report modal offers AI generation and free writing', () => {
  const html = render(fakeReact.createElement(mod.__components.NewReportModal, {
    confirmed: [{ id: 'c1' }],
    onCreate() {},
    onClose() {},
  }))
  assert.match(html, /AI 自动生成/)
  assert.match(html, /自由撰写/)
  assert.match(html, /生成研报/)
})
