/**
 * 研读台本地库：node:sqlite，单文件，随 DSH 一起走。
 *
 * 数据位置：`<DSH_HOME>/invest-workbench/invest.db`，可用 `DSH_INVEST_DATA_DIR` 覆盖。
 * 五张表：projects / sources / cards / reports / qa。
 * 原则：AI 产出只能写 `ai_draft`；人确认后才变 `confirmed`，驳回写 `rejected`。
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

const BOARDS = ['行业逻辑与框架', '技术原理', '商业逻辑', '财务框架与预测', '技术发展前景']

function now() {
  return new Date().toISOString()
}

function id(prefix) {
  return prefix + '_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex')
}

export function openStore(dir) {
  fs.mkdirSync(path.join(dir, 'files'), { recursive: true })
  const file = path.join(dir, 'invest.db')
  const db = new DatabaseSync(file)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, industry TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, kind TEXT NOT NULL,
      title TEXT NOT NULL, org TEXT, url TEXT, file_name TEXT,
      text TEXT NOT NULL, blocks_json TEXT NOT NULL, page_count INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ready', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY, source_id TEXT, project_id TEXT, board TEXT NOT NULL,
      title TEXT NOT NULL, thesis TEXT NOT NULL, evidence_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'ai_draft', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, mode TEXT NOT NULL,
      outline TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
      citations_json TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY, source_id TEXT, project_id TEXT, kind TEXT NOT NULL,
      title TEXT NOT NULL, caption TEXT DEFAULT '', source_note TEXT DEFAULT '', page INTEGER DEFAULT 0,
      image_path TEXT DEFAULT '', data_json TEXT DEFAULT '{}', chart_type TEXT DEFAULT 'none',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qa (
      id TEXT PRIMARY KEY, source_id TEXT NOT NULL, question TEXT NOT NULL,
      answer TEXT NOT NULL, evidence_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sources_project ON sources(project_id);
    CREATE INDEX IF NOT EXISTS idx_cards_source ON cards(source_id);
    CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
    CREATE INDEX IF NOT EXISTS idx_reports_project ON reports(project_id);
    CREATE INDEX IF NOT EXISTS idx_qa_source ON qa(source_id);
    CREATE INDEX IF NOT EXISTS idx_assets_source ON assets(source_id);
  `)

  const ensureColumn = (table, column, definition) => {
    const columns = db.prepare('PRAGMA table_info(' + table + ')').all()
    if (!columns.some((item) => item.name === column)) {
      db.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + definition)
    }
  }
  ensureColumn('sources', 'file_path', "TEXT NOT NULL DEFAULT ''")
  ensureColumn('cards', 'points_json', "TEXT NOT NULL DEFAULT '[]'")
  ensureColumn('cards', 'gaps_json', "TEXT NOT NULL DEFAULT '[]'")
  ensureColumn('sources', 'moki_id', "TEXT NOT NULL DEFAULT ''")
  ensureColumn('reports', 'kind', "TEXT NOT NULL DEFAULT 'free'")

  const defaultProject = 'p_liquid'
  const found = db.prepare('SELECT id FROM projects WHERE id = ?').get(defaultProject)
  if (!found) {
    db.prepare('INSERT INTO projects (id, name, industry, created_at) VALUES (?, ?, ?, ?)').run(
      defaultProject,
      'AI 数据中心 · 液冷',
      '数据中心温控',
      now(),
    )
  }

  function sourceRow(row, withDetail = false) {
    if (!row) return null
    const out = {
      id: row.id,
      projectId: row.project_id,
      kind: row.kind,
      title: row.title,
      org: row.org || '',
      url: row.url || '',
      fileName: row.file_name || '',
      filePath: row.file_path || '',
      hasFile: Boolean(row.file_path),
      mokiId: row.moki_id || '',
      pageCount: row.page_count || 0,
      status: row.status,
      createdAt: row.created_at,
      blocks: JSON.parse(row.blocks_json || '[]'),
    }
    if (withDetail) out.text = row.text
    return out
  }

  function cardRow(row) {
    if (!row) return null
    return {
      id: row.id,
      sourceId: row.source_id,
      board: row.board,
      title: row.title,
      thesis: row.thesis,
      points: JSON.parse(row.points_json || '[]'),
      gaps: JSON.parse(row.gaps_json || '[]'),
      evidence: JSON.parse(row.evidence_json || '[]'),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  function assetRow(row) {
    if (!row) return null
    return {
      id: row.id,
      sourceId: row.source_id,
      kind: row.kind,
      title: row.title,
      caption: row.caption || '',
      sourceNote: row.source_note || '',
      page: row.page || 0,
      hasImage: Boolean(row.image_path),
      imagePath: row.image_path || '',
      data: JSON.parse(row.data_json || '{}'),
      chartType: row.chart_type || 'none',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  const store = {
    dir,
    file,
    boards: BOARDS,

    close() {
      try {
        db.close()
      } catch {
        /* already closed */
      }
    },

    counts() {
      const one = (sql, ...args) => db.prepare(sql).get(...args).n
      return {
        sources: one('SELECT COUNT(*) AS n FROM sources'),
        cards: one('SELECT COUNT(*) AS n FROM cards'),
        pending: one("SELECT COUNT(*) AS n FROM cards WHERE status = 'ai_draft'"),
        confirmed: one("SELECT COUNT(*) AS n FROM cards WHERE status IN ('confirmed','edited')"),
        reports: one('SELECT COUNT(*) AS n FROM reports'),
        assets: one('SELECT COUNT(*) AS n FROM assets'),
      }
    },

    listSources() {
      const rows = db
        .prepare(
          `SELECT s.*, (SELECT COUNT(*) FROM cards c WHERE c.source_id = s.id) AS card_count
           FROM sources s ORDER BY s.created_at DESC`,
        )
        .all()
      return rows.map((row) => ({ ...sourceRow(row), cardCount: row.card_count }))
    },

    getSource(sourceId) {
      const row = db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId)
      if (!row) return null
      const source = sourceRow(row, true)
      source.cards = db
        .prepare('SELECT * FROM cards WHERE source_id = ? ORDER BY created_at ASC')
        .all(sourceId)
        .map(cardRow)
      source.qa = db
        .prepare('SELECT * FROM qa WHERE source_id = ? ORDER BY created_at ASC LIMIT 40')
        .all(sourceId)
        .map((item) => ({
          id: item.id,
          question: item.question,
          answer: item.answer,
          evidence: JSON.parse(item.evidence_json || '[]'),
          createdAt: item.created_at,
        }))
      return source
    },

    findSourceByMokiId(mokiId) {
      if (!mokiId) return null
      const row = db.prepare('SELECT * FROM sources WHERE moki_id = ?').get(mokiId)
      return row ? store.getSource(row.id) : null
    },

    createSource({ kind, title, org, url, fileName, filePath, mokiId, text, blocks, pageCount }) {
      const sourceId = id('s')
      db.prepare(
        `INSERT INTO sources (id, project_id, kind, title, org, url, file_name, file_path, moki_id, text, blocks_json, page_count, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?)`,
      ).run(
        sourceId,
        defaultProject,
        kind,
        title,
        org || '',
        url || '',
        fileName || '',
        filePath || '',
        mokiId || '',
        text,
        JSON.stringify(blocks),
        pageCount || 0,
        now(),
      )
      return store.getSource(sourceId)
    },

    saveSourceFile(sourceId, buffer, originalName) {
      const ext = path.extname(String(originalName || '')).slice(1).toLowerCase() || 'pdf'
      const safe = 'source-' + sourceId.replace(/[^a-zA-Z0-9_-]/g, '') + '.' + ext
      fs.writeFileSync(path.join(dir, 'files', safe), buffer)
      db.prepare('UPDATE sources SET file_path = ? WHERE id = ?').run(safe, sourceId)
      return safe
    },

    getSourceFile(sourceId) {
      const row = db.prepare('SELECT file_path, file_name, title FROM sources WHERE id = ?').get(sourceId)
      if (!row || !row.file_path) return null
      const abs = path.join(dir, 'files', path.basename(row.file_path))
      if (!fs.existsSync(abs)) return null
      return { path: abs, name: row.file_name || 'source.pdf', title: row.title }
    },

    updateSourceText(sourceId, { text, blocks, pageCount }) {
      db.prepare('UPDATE sources SET text = ?, blocks_json = ?, page_count = ? WHERE id = ?').run(
        text,
        JSON.stringify(blocks || []),
        pageCount || 0,
        sourceId,
      )
      return store.getSource(sourceId)
    },

    deleteSource(sourceId) {
      const row = db.prepare('SELECT file_path FROM sources WHERE id = ?').get(sourceId)
      if (row && row.file_path) {
        try {
          fs.unlinkSync(path.join(dir, 'files', path.basename(row.file_path)))
        } catch {
          /* already gone */
        }
      }
      db.prepare('DELETE FROM qa WHERE source_id = ?').run(sourceId)
      db.prepare('DELETE FROM cards WHERE source_id = ?').run(sourceId)
      db.prepare('DELETE FROM sources WHERE id = ?').run(sourceId)
    },

    getCard(cardId) {
      return cardRow(db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId))
    },

    listCards({ status, sourceId } = {}) {
      const where = []
      const args = []
      if (status === 'pending') where.push("c.status = 'ai_draft'")
      else if (status === 'confirmed') where.push("c.status IN ('confirmed','edited')")
      else if (status === 'rejected') where.push("c.status = 'rejected'")
      if (sourceId) {
        where.push('c.source_id = ?')
        args.push(sourceId)
      }
      const sql =
        `SELECT c.*, s.title AS source_title FROM cards c LEFT JOIN sources s ON s.id = c.source_id` +
        (where.length ? ' WHERE ' + where.join(' AND ') : '') +
        ' ORDER BY c.updated_at DESC'
      return db.prepare(sql).all(...args).map((row) => ({ ...cardRow(row), sourceTitle: row.source_title || '' }))
    },

    updateCard(cardId, patch) {
      const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId)
      if (!row) return null
      const title = typeof patch.title === 'string' && patch.title.trim() ? patch.title.trim() : row.title
      const thesis = typeof patch.thesis === 'string' && patch.thesis.trim() ? patch.thesis.trim() : row.thesis
      const points = Array.isArray(patch.points) ? patch.points : JSON.parse(row.points_json || '[]')
      const gaps = Array.isArray(patch.gaps) ? patch.gaps : JSON.parse(row.gaps_json || '[]')
      const evidence = Array.isArray(patch.evidence) ? patch.evidence : JSON.parse(row.evidence_json || '[]')
      const status =
        typeof patch.status === 'string' && ['ai_draft', 'confirmed', 'edited', 'rejected'].includes(patch.status)
          ? patch.status
          : row.status
      db.prepare(
        'UPDATE cards SET title = ?, thesis = ?, points_json = ?, gaps_json = ?, evidence_json = ?, status = ?, updated_at = ? WHERE id = ?',
      ).run(
        title,
        thesis,
        JSON.stringify(points),
        JSON.stringify(gaps),
        JSON.stringify(evidence),
        status,
        now(),
        cardId,
      )
      return cardRow(db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId))
    },

    replaceDraftCards(sourceId, cards) {
      db.prepare("DELETE FROM cards WHERE source_id = ? AND status = 'ai_draft'").run(sourceId)
      const insert = db.prepare(
        `INSERT INTO cards (id, source_id, project_id, board, title, thesis, points_json, gaps_json, evidence_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai_draft', ?, ?)`,
      )
      const stamp = now()
      for (const card of cards) {
        insert.run(
          id('c'),
          sourceId,
          defaultProject,
          card.board,
          card.title,
          card.thesis,
          JSON.stringify(card.points || []),
          JSON.stringify(card.gaps || []),
          JSON.stringify(card.evidence || []),
          stamp,
          stamp,
        )
      }
      return store.listCards({ sourceId })
    },

    listAssets({ sourceId, kind } = {}) {
      const where = []
      const args = []
      if (sourceId) {
        where.push('source_id = ?')
        args.push(sourceId)
      }
      if (kind) {
        where.push('kind = ?')
        args.push(kind)
      }
      const sql = 'SELECT * FROM assets' + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY updated_at DESC'
      return db.prepare(sql).all(...args).map(assetRow)
    },

    getAsset(assetId) {
      return assetRow(db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId))
    },

    createAsset({ sourceId, kind, title, caption, sourceNote, page, imagePath, data, chartType }) {
      const assetId = id('a')
      const stamp = now()
      db.prepare(
        `INSERT INTO assets (id, source_id, project_id, kind, title, caption, source_note, page, image_path, data_json, chart_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        assetId,
        sourceId || '',
        defaultProject,
        kind,
        title,
        caption || '',
        sourceNote || '',
        page || 0,
        imagePath || '',
        JSON.stringify(data || {}),
        chartType || 'none',
        stamp,
        stamp,
      )
      return store.getAsset(assetId)
    },

    updateAsset(assetId, patch) {
      const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId)
      if (!row) return null
      const title = typeof patch.title === 'string' && patch.title.trim() ? patch.title.trim() : row.title
      const caption = typeof patch.caption === 'string' ? patch.caption : row.caption
      const sourceNote = typeof patch.sourceNote === 'string' ? patch.sourceNote : row.source_note
      const data = patch.data !== undefined ? patch.data : JSON.parse(row.data_json || '{}')
      const chartType = typeof patch.chartType === 'string' ? patch.chartType : row.chart_type
      db.prepare('UPDATE assets SET title = ?, caption = ?, source_note = ?, data_json = ?, chart_type = ?, updated_at = ? WHERE id = ?').run(
        title,
        caption,
        sourceNote,
        JSON.stringify(data || {}),
        chartType,
        now(),
        assetId,
      )
      return store.getAsset(assetId)
    },

    deleteAsset(assetId) {
      const row = db.prepare('SELECT image_path FROM assets WHERE id = ?').get(assetId)
      if (row && row.image_path) {
        try {
          fs.unlinkSync(path.join(dir, 'files', path.basename(row.image_path)))
        } catch {
          /* already gone */
        }
      }
      db.prepare('DELETE FROM assets WHERE id = ?').run(assetId)
    },

    saveAssetImage(assetId, buffer) {
      const safe = 'asset-' + assetId.replace(/[^a-zA-Z0-9_-]/g, '') + '.png'
      fs.writeFileSync(path.join(dir, 'files', safe), buffer)
      db.prepare('UPDATE assets SET image_path = ? WHERE id = ?').run(safe, assetId)
      return safe
    },

    getAssetImage(assetId) {
      const row = db.prepare('SELECT image_path FROM assets WHERE id = ?').get(assetId)
      if (!row || !row.image_path) return null
      const abs = path.join(dir, 'files', path.basename(row.image_path))
      return fs.existsSync(abs) ? abs : null
    },

    addQA(sourceId, question, answer, evidence) {
      const qaId = id('q')
      db.prepare(
        'INSERT INTO qa (id, source_id, question, answer, evidence_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(qaId, sourceId, question, answer, JSON.stringify(evidence || []), now())
      return { id: qaId, question, answer, evidence, createdAt: now() }
    },

    listReports() {
      return db
        .prepare('SELECT * FROM reports ORDER BY updated_at DESC')
        .all()
        .map((row) => ({
          id: row.id,
          title: row.title,
          mode: row.mode,
          kind: row.kind || 'free',
          status: row.status,
          updatedAt: row.updated_at,
          words: Array.from(row.content || '').length,
        }))
    },

    getReport(reportId) {
      const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId)
      if (!row) return null
      return {
        id: row.id,
        title: row.title,
        mode: row.mode,
        kind: row.kind || 'free',
        outline: row.outline,
        content: row.content,
        citations: JSON.parse(row.citations_json || '[]'),
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    },

    createReport({ title, mode, kind, content, outline, citations }) {
      const reportId = id('r')
      const defaultOutline = [
        '0 结论与投资含义',
        '1 行业定义与边界',
        '2 需求：量从哪里来',
        '3 供给与产能',
        '4 竞争格局与壁垒',
        '5 产业链与价值分配',
        '6 技术路线',
        '7 标的与估值',
        '8 风险与反方',
      ].join('\n')
      const reportOutline = typeof outline === 'string' && outline.trim() ? outline : defaultOutline
      db.prepare(
        `INSERT INTO reports (id, project_id, title, mode, kind, outline, content, citations_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      ).run(
        reportId,
        defaultProject,
        title,
        mode || 'deep',
        kind || 'free',
        reportOutline,
        typeof content === 'string' ? content : '',
        JSON.stringify(Array.isArray(citations) ? citations : []),
        now(),
        now(),
      )
      return store.getReport(reportId)
    },

    deleteReport(reportId) {
      const row = db.prepare('SELECT id FROM reports WHERE id = ?').get(reportId)
      if (!row) return false
      db.prepare('DELETE FROM reports WHERE id = ?').run(reportId)
      return true
    },

    updateReport(reportId, patch) {
      const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId)
      if (!row) return null
      const title = typeof patch.title === 'string' && patch.title.trim() ? patch.title.trim() : row.title
      const outline = typeof patch.outline === 'string' ? patch.outline : row.outline
      const content = typeof patch.content === 'string' ? patch.content : row.content
      const status =
        typeof patch.status === 'string' && ['draft', 'reviewing', 'final'].includes(patch.status)
          ? patch.status
          : row.status
      const citations = Array.isArray(patch.citations) ? patch.citations : JSON.parse(row.citations_json || '[]')
      db.prepare(
        'UPDATE reports SET title = ?, outline = ?, content = ?, citations_json = ?, status = ?, updated_at = ? WHERE id = ?',
      ).run(title, outline, content, JSON.stringify(citations), status, now(), reportId)
      return store.getReport(reportId)
    },

    totalWords() {
      const rows = db.prepare('SELECT content FROM reports').all()
      return rows.reduce((sum, row) => sum + Array.from(row.content || '').length, 0)
    },

    seedDemo() {
      const existing = db.prepare("SELECT id FROM sources WHERE title LIKE '冷板式液冷%'").get()
      if (!existing) {
        const demo = demoSource()
        const source = store.createSource({
          kind: 'demo',
          title: demo.title,
          org: demo.org,
          text: demo.text,
          blocks: demo.blocks,
        })
        store.replaceDraftCards(source.id, demo.cards(source.blocks))
      }
      if (!db.prepare('SELECT id FROM reports LIMIT 1').get()) {
        const report = store.createReport({ title: '液冷：从主题到订单', mode: 'deep' })
        store.updateReport(report.id, {
          content:
            '## 0 结论与投资含义\n\n冷板式是 2026–2027 年唯一具备交付确定性的路线，瓶颈在快接头与 CDU，不在冷板本体。\n\n投资含义：优选快接头与 CDU 环节，观察 2026Q2 扩产释放后的价格拐点。\n\n## 3.2 冷板式 vs 浸没式：谁先过成本线\n\n两条路线的竞争不在散热效率，而在 1.2kW/柜 这个 TCO 交叉点。\n',
        })
      }
      return store.counts()
    },
  }

  return store
}

/** 示例资料：故意包含可检索的数字与口径，用来演示「带出处的回答」。 */
function demoSource() {
  const paragraphs = [
    '# 1 行业定义与边界',
    '液冷指以液体作为冷媒，把机柜或芯片产生的热量带到室外侧的散热方式；按接触形态分为冷板式与浸没式两类。',
    '# 2 需求：GB300 的单柜功率',
    'GB300 整柜功率提升至约 120kW，风冷在 40kW 以上已难以经济地满足 PUE 约束，冷板式成为 2026 年的主力方案。',
    '# 3 技术路线与成本',
    '冷板式的单柜价值量约 8–12 万元，其中冷板、快接头与 manifold 占七成，CDU 单列，约 3.5 万元/柜。',
    '两条路线的 TCO 交叉点在 1.2kW/柜；超过该功率后，冷板式三年 TCO 开始低于风冷，浸没式要到 1.8kW 才具备经济性。',
    '浸没式的初始投资更高，但在 1.8kW 以上单柜功率下，PUE 与占地优势开始抵消设备溢价。',
    '# 4 供给与产能',
    '国内快接头有效产能约 180 万套/年，对应约 45 万柜，低于 2026 年 62 万柜的需求测算。',
    'CDU 的扩产周期约 9–12 个月，2025 年下半年开始的扩产会在 2026Q2 后集中释放，届时价格战风险上升。',
    '# 5 竞争格局与壁垒',
    '2025 年冷板式市场 CR3 约 52%，快接头环节集中度更高；客户认证周期普遍在 12 个月以上。',
    '集成商毛利被快接头与 CDU 两头挤压，净利率约 6–8%，规模化后能否降本取决于自制率。',
    '# 6 市场空间与预测',
    '报告测算 2027 年冷板式渗透率 38%，对应市场空间 268 亿元，2025–2027 年收入 CAGR 约 41%。',
    '# 7 风险与反方',
    '若 GB300 延期至 2027H2，冷板式渗透率假设需下调 6–8pct，2027 年市场空间降至 219–232 亿元。',
    '价格战早于预期、快接头国产化率不及预期，是另外两条主要的证伪路径。',
  ]
  const blocks = paragraphs.map((text, index) => ({
    id: 'b' + (index + 1),
    heading: text.startsWith('# '),
    text: text.replace(/^#\s*/, ''),
  }))
  return {
    title: '冷板式液冷：2027 年的渗透拐点',
    org: '某券商研究所',
    text: paragraphs.join('\n\n'),
    blocks,
    cards: () => [
      {
        board: '行业逻辑与框架',
        title: '冷板式渗透率 2027 年升至 38%，拐点在 GB300 放量',
        thesis: 'GB300 整柜功率提升至约 120kW，风冷在 40kW 以上难以满足 PUE 约束，冷板式成为 2026 年主力方案。',
        evidence: [
          { blockId: 'b4', quote: 'GB300 整柜功率提升至约 120kW，风冷在 40kW 以上已难以经济地满足 PUE 约束。' },
          { blockId: 'b12', quote: '报告测算 2027 年冷板式渗透率 38%，对应市场空间 268 亿元。' },
        ],
      },
      {
        board: '技术原理',
        title: '冷板与浸没的 TCO 交叉点在 1.2kW/柜',
        thesis: '超过 1.2kW/柜后，冷板式三年 TCO 开始低于风冷；浸没式要到 1.8kW 才具备经济性。',
        evidence: [
          { blockId: 'b6', quote: '两条路线的 TCO 交叉点在 1.2kW/柜；超过该功率后，冷板式三年 TCO 开始低于风冷。' },
          { blockId: 'b7', quote: '浸没式的初始投资更高，但在 1.8kW 以上单柜功率下，PUE 与占地优势开始抵消设备溢价。' },
        ],
      },
      {
        board: '商业逻辑',
        title: '集成商毛利被快接头与 CDU 两头挤压，净利率 6–8%',
        thesis: '快接头环节集中度更高、认证周期 12 个月以上，集成商议价能力弱，净利率仅 6–8%。',
        evidence: [
          { blockId: 'b10', quote: '2025 年冷板式市场 CR3 约 52%，快接头环节集中度更高；客户认证周期普遍在 12 个月以上。' },
          { blockId: 'b11', quote: '集成商毛利被快接头与 CDU 两头挤压，净利率约 6–8%。' },
        ],
      },
      {
        board: '财务框架与预测',
        title: '2027 年市场空间 268 亿元，2025–2027 年 CAGR 41%',
        thesis: '冷板式 2027 年渗透率 38%，对应市场空间 268 亿元；预测需同时跟踪 GB300 排期与快接头产能。',
        evidence: [{ blockId: 'b12', quote: '报告测算 2027 年冷板式渗透率 38%，对应市场空间 268 亿元，2025–2027 年收入 CAGR 约 41%。' }],
      },
      {
        board: '技术发展前景',
        title: '2028 年后浸没式窗口打开，但先看 1.8kW 经济性',
        thesis: '浸没式的商用窗口在 2028 年之后，触发条件是单柜功率稳定超过 1.8kW。',
        evidence: [{ blockId: 'b7', quote: '浸没式要到 1.8kW 才具备经济性。' }],
      },
    ],
  }
}
