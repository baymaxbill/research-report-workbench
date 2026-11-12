/**
 * 研读台 HTTP API：挂在宿主 webServer 的 `/invest/api` 前缀下，同源 fetch。
 *
 *   GET    /health
 *   GET    /overview
 *   GET    /sources                 · POST /sources            {kind,title,org,text,url}
 *   POST   /sources/upload?name=    裸流上传（txt/md/docx/pdf）
 *   GET    /sources/:id             · DELETE /sources/:id
 *   POST   /sources/:id/ask         {question, blockId}
 *   POST   /sources/:id/analyze     规则抽取五板块草稿
 *   GET    /cards?status=&source_id= · PATCH /cards/:id {status,title,thesis}
 *   GET    /reports · POST /reports  · GET/PATCH /reports/:id
 *   POST   /demo                    幂等写入示例资料
 */
import fs from 'node:fs'
import path from 'node:path'
import { buildBlocks, parseFileBuffer, fetchUrlText, answerQuestion, analyzeBlocks } from './parse.js'
import { renderSourcePage, renderSourcePageLayout } from './pageimage.js'
import { extractFigures, saveFigures } from './figures.js'
import { listMokiItems, importMokiSource, exportSourceToMoki } from './moki.js'

const VERSION = '0.12.7'
const JSON_LIMIT = 256 * 1024
const UPLOAD_LIMIT = 24 * 1024 * 1024

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function fail(res, status, code, message) {
  sendJson(res, status, { ok: false, error: { code, message } })
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(Object.assign(new Error('请求体过大'), { code: 'too_large', status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function readJson(req, limit = JSON_LIMIT) {
  const buffer = await readBody(req, limit)
  if (!buffer.length) return {}
  try {
    return JSON.parse(buffer.toString('utf8'))
  } catch {
    throw Object.assign(new Error('JSON 格式不正确'), { code: 'bad_json', status: 400 })
  }
}

function cleanTitle(value, fallback) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (!text) return fallback
  return text.slice(0, 80)
}

export function createApi(store, ai = null) {
  async function handler(req, res) {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      const pathname = url.pathname.replace(/\/+$/, '') || '/'
      const method = (req.method || 'GET').toUpperCase()
      const parts = pathname.split('/').filter(Boolean)
      const route = parts.slice(2).join('/')

      if (route === '' || route === 'health') {
        if (method !== 'GET') return fail(res, 405, 'method_not_allowed', '只支持 GET')
        return sendJson(res, 200, {
          ok: true,
          plugin: 'research-report-workbench',
          version: VERSION,
          dataDir: store.dir,
          counts: store.counts(),
          boards: store.boards,
          ai: ai ? ai.info() : { available: false, provider: '', model: '' },
          moki: (() => { const info = listMokiItems(); return { available: info.available, files: info.files.length, folders: info.folders.length } })(),
        })
      }

      if (route === 'client-error') {
        if (method !== 'POST') return fail(res, 405, 'method_not_allowed', '只支持 POST')
        const body = await readJson(req)
        const line = JSON.stringify({ at: new Date().toISOString(), ...body }) + '\n'
        try {
          fs.appendFileSync(path.join(store.dir, 'client-errors.log'), line)
        } catch {
          /* diagnostics must never block the response */
        }
        return sendJson(res, 200, { ok: true })
      }

      if (route === 'ai/probe') {
        if (method !== 'POST') return fail(res, 405, 'method_not_allowed', '只支持 POST')
        if (!ai) return fail(res, 503, 'ai_unavailable', '宿主没有提供 llm 服务')
        try {
          const result = await ai.probe()
          return sendJson(res, 200, { ok: true, text: result.text, info: ai.info() })
        } catch (error) {
          return sendJson(res, 200, {
            ok: false,
            error: error && error.message ? error.message : String(error),
            detail: error && error.detail ? error.detail : null,
            info: ai.info(),
          })
        }
      }

      // ---------- MOKI library bridge ----------
      if (route === 'moki/items') {
        if (method !== 'GET') return fail(res, 405, 'method_not_allowed', '只支持 GET')
        return sendJson(res, 200, listMokiItems())
      }
      if (route === 'moki/folders') {
        if (method !== 'GET') return fail(res, 405, 'method_not_allowed', '只支持 GET')
        const info = listMokiItems()
        return sendJson(res, 200, { available: info.available, folders: info.folders, error: info.error })
      }
      if (route === 'moki/import') {
        if (method !== 'POST') return fail(res, 405, 'method_not_allowed', '只支持 POST')
        const body = await readJson(req, 1024 * 1024)
        const itemId = String(body.id || '')
        if (!itemId) return fail(res, 400, 'id_required', '缺少 MOKI 资料 ID')
        try {
          const result = await importMokiSource(store, itemId)
          return sendJson(res, 200, result)
        } catch (error) {
          return fail(res, 400, 'moki_import_failed', error && error.message ? error.message : String(error))
        }
      }

      if (route === 'overview') {
        if (method !== 'GET') return fail(res, 405, 'method_not_allowed', '只支持 GET')
        return sendJson(res, 200, {
          counts: store.counts(),
          sources: store.listSources().slice(0, 6),
          pendingCards: store.listCards({ status: 'pending' }).slice(0, 6),
          reports: store.listReports().slice(0, 5),
          words: store.totalWords(),
        })
      }

      if (route === 'demo') {
        if (method !== 'POST') return fail(res, 405, 'method_not_allowed', '只支持 POST')
        return sendJson(res, 200, { ok: true, counts: store.seedDemo() })
      }

      // ---------- sources ----------
      if (route === 'sources') {
        if (method === 'GET') return sendJson(res, 200, { sources: store.listSources() })
        if (method !== 'POST') return fail(res, 405, 'method_not_allowed', '只支持 GET/POST')
        const body = await readJson(req)
        const kind = body.kind === 'url' ? 'url' : 'paste'
        let text = typeof body.text === 'string' ? body.text : ''
        let pageCount = 0
        let title = cleanTitle(body.title, '')
        let url = ''
        let pdfBuffer = null
        let org = typeof body.org === 'string' ? body.org.trim().slice(0, 60) : ''

        if (kind === 'url') {
          url = String(body.url || '').trim()
          if (!url) return fail(res, 400, 'url_required', '请填写网页链接')
          const page = await fetchUrlText(url)
          if (page.isPdf) {
            const parsed = await parseFileBuffer(store.dir, 'web.pdf', page.buffer)
            text = parsed.text
            pageCount = parsed.pageCount
            pdfBuffer = parsed.keepFile ? parsed.buffer : null
          } else {
            text = page.text
          }
          if (!title) title = cleanTitle(page.title, '网页资料')
        }

        if (!text.trim()) return fail(res, 400, 'text_required', '正文为空')
        const blocks = buildBlocks(text)
        if (!blocks.length) return fail(res, 400, 'text_required', '没有可解析的段落')
        if (!title) {
          const first = blocks.find((block) => !block.heading) || blocks[0]
          title = cleanTitle(first.text.slice(0, 40), '未命名资料')
        }
        const source = store.createSource({ kind, title, org, url, text, blocks, pageCount })
        if (pdfBuffer) {
          const saved = store.saveSourceFile(source.id, pdfBuffer, 'web.pdf')
          source.filePath = saved
          source.hasFile = true
        }
        return sendJson(res, 200, { source })
      }

      if (route === 'sources/upload') {
        if (method !== 'POST') return fail(res, 405, 'method_not_allowed', '只支持 POST')
        const name = String(url.searchParams.get('name') || 'upload.txt')
        const buffer = await readBody(req, UPLOAD_LIMIT)
        if (!buffer.length) return fail(res, 400, 'empty_file', '文件为空')
        const parsed = await parseFileBuffer(store.dir, name, buffer)
        const title = cleanTitle(url.searchParams.get('title'), name.replace(/\.[^.]+$/, ''))
        const org = String(url.searchParams.get('org') || '').trim().slice(0, 60)
        const source = store.createSource({
          kind: 'file',
          title,
          org,
          fileName: name,
          text: parsed.text,
          blocks: parsed.blocks,
          pageCount: parsed.pageCount,
        })
        if (parsed.keepFile && parsed.buffer) {
          const saved = store.saveSourceFile(source.id, parsed.buffer, name)
          source.filePath = saved
          source.hasFile = true
        }
        let figures = 0
        let warning = ''
        if (parsed.keepFile && parsed.buffer && parsed.engine === 'pdfjs') {
          try {
            const result = await extractFigures(parsed.buffer)
            figures = saveFigures(store, source.id, result.figures)
          } catch (error) {
            warning = '图表自动提取失败：' + (error && error.message ? error.message : String(error))
          }
        }
        return sendJson(res, 200, { source, engine: parsed.engine, figures, warning })
      }

      const figuresMatch = route.match(/^sources\/([^/]+)\/figures\/extract$/)
      if (figuresMatch) {
        if (method !== 'POST') return fail(res, 405, 'method_not_allowed', '只支持 POST')
        const file = store.getSourceFile(decodeURIComponent(figuresMatch[1]))
        if (!file) return fail(res, 400, 'file_required', '这份资料没有保存原文件')
        try {
          const result = await extractFigures(fs.readFileSync(file.path))
          const added = saveFigures(store, decodeURIComponent(figuresMatch[1]), result.figures)
          return sendJson(res, 200, { added, total: result.figures.length })
        } catch (error) {
          return fail(res, 400, 'figure_extract_failed', error && error.message ? error.message : String(error))
        }
      }

      const pageTextMatch = route.match(/^sources\/([^/]+)\/page\/(\d+)\/text$/)
      if (pageTextMatch) {
        if (method !== 'GET') return fail(res, 405, 'method_not_allowed', '只支持 GET')
        try {
          const layout = await renderSourcePageLayout(store, decodeURIComponent(pageTextMatch[1]), Number(pageTextMatch[2]))
          return sendJson(res, 200, layout)
        } catch (error) {
          return fail(res, 400, 'page_text_failed', error && error.message ? error.message : String(error))
        }
      }

      const pageMatch = route.match(/^sources\/([^/]+)\/page\/(\d+)$/)
      if (pageMatch) {
        if (method !== 'GET') return fail(res, 405, 'method_not_allowed', '只支持 GET')
        try {
          const abs = await renderSourcePage(store, decodeURIComponent(pageMatch[1]), Number(pageMatch[2]))
          const stat = fs.statSync(abs)
          res.writeHead(200, { 'content-type': 'image/png', 'content-length': stat.size, 'cache-control': 'private, max-age=300' })
          fs.createReadStream(abs).pipe(res)
          return
        } catch (error) {
          return fail(res, 400, 'page_render_failed', error && error.message ? error.message : String(error))
        }
      }

      const sourceMatch = route.match(/^sources\/([^/]+)(?:\/(ask|analyze|file|reparse|export-moki))?$/)
      if (sourceMatch) {
        const sourceId = decodeURIComponent(sourceMatch[1])
        const action = sourceMatch[2]
        const source = store.getSource(sourceId)
        if (!source) return fail(res, 404, 'source_not_found', '资料不存在')

        if (!action && method === 'GET') return sendJson(res, 200, { source })
        if (!action && method === 'DELETE') {
          store.deleteSource(sourceId)
          return sendJson(res, 200, { ok: true })
        }
        if (action === 'ask' && method === 'POST') {
          const body = await readJson(req, 1024 * 1024)
          const question = String(body.question || '').trim() || (body.quote ? '请结合这段解释，并给出处。' : '')
          if (!question) return fail(res, 400, 'question_required', '问题为空')
          const blockId = typeof body.blockId === 'string' ? body.blockId : ''
          const quote = typeof body.quote === 'string' ? body.quote.slice(0, 2000) : ''
          const page = Number(body.page) || 0
          let answer = ''
          let evidence = []
          let engine = 'rule'
          let warning = ''
          if (ai) {
            try {
              answer = await ai.ask(source, { question, quote, page })
              engine = 'ai'
            } catch (error) {
              warning = 'AI 回答失败，已回退本地检索：' + (error && error.message ? error.message : String(error))
            }
          }
          if (!answer) {
            const result = answerQuestion(source.blocks, question, blockId)
            answer = result.answer
            evidence = result.evidence
          }
          if (engine === 'ai') {
            const blocks = Array.isArray(source.blocks) ? source.blocks : []
            const byId = {}
            for (const block of blocks) byId[block.id] = block
            const ids = []
            const matches = answer.match(/\b(b\d+)\b/g) || []
            for (const id of matches) if (!ids.includes(id) && byId[id]) ids.push(id)
            evidence = ids.map((id) => ({ blockId: id, quote: String(byId[id].text || '').slice(0, 160) }))
            if (!evidence.length) {
              const clean = (value) => String(value || '').replace(/\s+/g, '')
              const quoted = clean(quote)
              let found = blocks.find((block) => quoted && clean(block.text).includes(quoted.slice(0, 24))) || null
              if (!found && blockId) found = byId[blockId] || null
              if (!found && page) {
                let current = 0
                for (const block of blocks) {
                  const marker = /^【第\s*(\d+)\s*页】/.exec(block.text || '')
                  if (marker) current = Number(marker[1])
                  if (current === page && String(block.text || '').trim().length > 8) {
                    found = block
                    break
                  }
                }
              }
              if (!found) found = blocks[0]
              if (found) evidence = [{ blockId: found.id, quote: String(found.text || '').slice(0, 160) }]
            }
          }
          const qa = store.addQA(sourceId, question, answer, evidence)
          return sendJson(res, 200, { qa, engine, warning })
        }
        if (action === 'export-moki' && method === 'POST') {
          const body = await readJson(req, 1024 * 1024)
          try {
            const result = exportSourceToMoki(store, sourceId, String(body.folderId || ''))
            return sendJson(res, 200, result)
          } catch (error) {
            return fail(res, 400, 'moki_export_failed', error && error.message ? error.message : String(error))
          }
        }

        if (action === 'reparse' && method === 'POST') {
          const file = store.getSourceFile(sourceId)
          if (!file) return fail(res, 400, 'file_required', '这份资料没有保存原文件，无法重新解析')
          try {
            const parsed = await parseFileBuffer(store.dir, source.fileName || 'source.pdf', fs.readFileSync(file.path))
            const updated = store.updateSourceText(sourceId, {
              text: parsed.text,
              blocks: parsed.blocks,
              pageCount: parsed.pageCount,
            })
            let figures = 0
            let warning = ''
            try {
              const result = await extractFigures(fs.readFileSync(file.path))
              figures = saveFigures(store, sourceId, result.figures)
            } catch (error) {
              warning = '图表自动提取失败：' + (error && error.message ? error.message : String(error))
            }
            return sendJson(res, 200, { source: updated, engine: parsed.engine, figures, warning })
          } catch (error) {
            return fail(res, 400, 'reparse_failed', error && error.message ? error.message : String(error))
          }
        }
        if (action === 'file' && method === 'GET') {
          const file = store.getSourceFile(sourceId)
          if (!file) return fail(res, 404, 'file_not_found', '这份资料没有保存原文')
          const stat = fs.statSync(file.path)
          res.writeHead(200, {
            'content-type': 'application/pdf',
            'content-length': stat.size,
            'content-disposition': 'inline; filename="' + encodeURIComponent(file.name) + '"',
            'cache-control': 'private, max-age=60',
          })
          fs.createReadStream(file.path).pipe(res)
          return
        }
        if (action === 'analyze' && method === 'POST') {
          let body = {}
          try {
            body = await readJson(req)
          } catch {
            body = {}
          }
          const wantAi = body.engine !== 'rule'
          if (wantAi && ai) {
            try {
              const cards = await ai.analyze(source, body.instruction)
              const saved = store.replaceDraftCards(sourceId, cards)
              return sendJson(res, 200, { cards: saved, added: cards.length, engine: 'ai' })
            } catch (error) {
              const cards = analyzeBlocks(source.blocks)
              const saved = store.replaceDraftCards(sourceId, cards)
              return sendJson(res, 200, {
                cards: saved,
                added: cards.length,
                engine: 'rule',
                warning: 'AI 摘要失败，已回退本地抽取：' + (error && error.message ? error.message : String(error)),
              })
            }
          }
          const cards = analyzeBlocks(source.blocks)
          const saved = store.replaceDraftCards(sourceId, cards)
          return sendJson(res, 200, { cards: saved, added: cards.length, engine: 'rule' })
        }
        return fail(res, 405, 'method_not_allowed', '不支持的方法')
      }

      // ---------- assets: figures & data tables ----------
      if (route === 'assets') {
        if (method !== 'GET') return fail(res, 405, 'method_not_allowed', '只支持 GET')
        return sendJson(res, 200, {
          assets: store.listAssets({
            sourceId: url.searchParams.get('source_id') || undefined,
            kind: url.searchParams.get('kind') || undefined,
          }),
        })
      }
      if (route === 'assets/figure') {
        if (method !== 'POST') return fail(res, 405, 'method_not_allowed', '只支持 POST')
        const body = await readJson(req, 8 * 1024 * 1024)
        const sourceId = String(body.sourceId || '')
        if (!store.getSource(sourceId)) return fail(res, 404, 'source_not_found', '资料不存在')
        const raw = String(body.image || '')
        const base64 = raw.replace(/^data:image\/[a-z+]+;base64,/i, '')
        const buffer = Buffer.from(base64, 'base64')
        if (buffer.length < 100) return fail(res, 400, 'image_required', '截取区域为空')
        if (buffer.length > 6 * 1024 * 1024) return fail(res, 413, 'image_too_large', '截图超过 6MB')
        const asset = store.createAsset({
          sourceId,
          kind: 'figure',
          title: String(body.title || '').trim() || '第 ' + (Number(body.page) || 1) + ' 页图表',
          caption: String(body.caption || ''),
          sourceNote: String(body.sourceNote || ''),
          page: Number(body.page) || 0,
          data: {},
          chartType: 'none',
        })
        const saved = store.saveAssetImage(asset.id, buffer)
        return sendJson(res, 200, { asset: store.getAsset(asset.id), imagePath: saved })
      }
      if (route === 'assets/table') {
        if (method !== 'POST') return fail(res, 405, 'method_not_allowed', '只支持 POST')
        const body = await readJson(req, 1024 * 1024)
        const sourceId = String(body.sourceId || '')
        if (sourceId && !store.getSource(sourceId)) return fail(res, 404, 'source_not_found', '资料不存在')
        const columns = (Array.isArray(body.columns) ? body.columns : []).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 30)
        const rows = (Array.isArray(body.rows) ? body.rows : [])
          .slice(0, 500)
          .map((row) => (Array.isArray(row) ? row.slice(0, 30).map((cell) => String(cell == null ? '' : cell)) : []))
        if (!columns.length || !rows.length) return fail(res, 400, 'table_required', '表格至少需要 1 列 1 行')
        const chartType = ['none', 'bar', 'line', 'pie'].includes(body.chartType) ? body.chartType : 'none'
        const asset = store.createAsset({
          sourceId,
          kind: 'table',
          title: String(body.title || '').trim() || '数据表',
          caption: String(body.caption || ''),
          sourceNote: String(body.sourceNote || ''),
          page: Number(body.page) || 0,
          data: { columns, rows },
          chartType,
        })
        return sendJson(res, 200, { asset })
      }
      const assetMatch = route.match(/^assets\/([^/]+)(?:\/(image))?$/)
      if (assetMatch) {
        const assetId = decodeURIComponent(assetMatch[1])
        const isImage = assetMatch[2] === 'image'
        const asset = store.getAsset(assetId)
        if (!asset) return fail(res, 404, 'asset_not_found', '资产不存在')
        if (isImage && method === 'GET') {
          const abs = store.getAssetImage(assetId)
          if (!abs) return fail(res, 404, 'image_not_found', '没有图片')
          const stat = fs.statSync(abs)
          res.writeHead(200, { 'content-type': 'image/png', 'content-length': stat.size, 'cache-control': 'private, max-age=300' })
          fs.createReadStream(abs).pipe(res)
          return
        }
        if (method === 'PATCH') {
          const body = await readJson(req, 1024 * 1024)
          const updated = store.updateAsset(assetId, body)
          return sendJson(res, 200, { asset: updated })
        }
        if (method === 'DELETE') {
          store.deleteAsset(assetId)
          return sendJson(res, 200, { ok: true })
        }
        if (method === 'GET') return sendJson(res, 200, { asset })
        return fail(res, 405, 'method_not_allowed', '不支持的方法')
      }

      // ---------- cards ----------
      if (route === 'cards') {
        if (method !== 'GET') return fail(res, 405, 'method_not_allowed', '只支持 GET')
        return sendJson(res, 200, {
          cards: store.listCards({
            status: url.searchParams.get('status') || undefined,
            sourceId: url.searchParams.get('source_id') || undefined,
          }),
        })
      }
      const reviseMatch = route.match(/^cards\/([^/]+)\/revise$/)
      if (reviseMatch) {
        if (method !== 'POST') return fail(res, 405, 'method_not_allowed', '只支持 POST')
        if (!ai) return fail(res, 503, 'ai_unavailable', '宿主没有提供 llm 服务')
        const body = await readJson(req)
        const card = store.getCard(decodeURIComponent(reviseMatch[1]))
        if (!card) return fail(res, 404, 'card_not_found', '卡片不存在')
        const source = store.getSource(card.sourceId)
        if (!source) return fail(res, 404, 'source_not_found', '卡片所属资料不存在')
        try {
          const revised = await ai.revise(card, source, String(body.reason || ''))
          const updated = store.updateCard(card.id, { ...revised, status: 'ai_draft' })
          return sendJson(res, 200, { card: updated, engine: 'ai' })
        } catch (error) {
          return fail(res, 502, 'ai_failed', error && error.message ? error.message : String(error))
        }
      }

      const cardMatch = route.match(/^cards\/([^/]+)$/)
      if (cardMatch) {
        if (method !== 'PATCH') return fail(res, 405, 'method_not_allowed', '只支持 PATCH')
        const body = await readJson(req)
        const card = store.updateCard(decodeURIComponent(cardMatch[1]), body)
        if (!card) return fail(res, 404, 'card_not_found', '卡片不存在')
        return sendJson(res, 200, { card })
      }

      // ---------- reports ----------
      if (route === 'reports/generate') {
        if (method !== 'POST') return fail(res, 405, 'method_not_allowed', '只支持 POST')
        const body = await readJson(req, 1024 * 1024)
        const title = cleanTitle(body.title, '行业研究报告')
        const mode = body.mode === 'quick' ? 'quick' : 'deep'
        const useMaterials = body.useMaterials !== false
        const allowWebSearch = body.allowWebSearch === true
        let cards = useMaterials ? store.listCards({ status: 'confirmed' }) : []
        if (Array.isArray(body.cardIds) && body.cardIds.length) {
          const wanted = new Set(body.cardIds.map(String))
          cards = cards.filter((card) => wanted.has(card.id))
        }
        if (!cards.length && !allowWebSearch) {
          return fail(res, 400, 'sources_required', '没有可用资料；请勾选“允许公开网络搜索”后重试')
        }
        const assets = store.listAssets({ kind: 'figure' })
        let warning = ''
        let research = null
        if (allowWebSearch) {
          const query = String(body.query || '').trim() || title + ' 行业研究 市场规模 竞争格局'
          if (!ai || typeof ai.searchWeb !== 'function') {
            if (!cards.length) return fail(res, 503, 'web_unavailable', '宿主没有可用的公开网络检索服务')
            warning = '宿主没有公开网络检索服务，已仅用现有资料生成。'
          } else {
            try {
              research = await ai.searchWeb({ query, maxResults: 6 })
            } catch (error) {
              const message = error && error.message ? error.message : String(error)
              if (!cards.length) return fail(res, 502, 'web_search_failed', '公开网络检索失败：' + message)
              warning = '公开网络检索失败，已仅用现有资料生成：' + message
            }
          }
        }
        if (allowWebSearch && !cards.length) {
          const hasWebContent = research && (String(research.content || '').trim() || (research.sources || []).length)
          if (!hasWebContent) return fail(res, 502, 'web_search_empty', '公开网络检索没有返回可用信息，未生成报告；请换一个检索主题后重试')
        }
        let content = ''
        if (ai) {
          try {
            content = await ai.generate({ title, cards, assets, mode, web: research })
          } catch (error) {
            warning = 'AI 生成失败，已用资料整理初稿：' + (error && error.message ? error.message : String(error))
          }
        }
        if (!content || !content.trim()) {
          content = cards.length ? composeReport(title, cards, assets, mode) : composeWebReport(title, research)
        }
        if (!content || !content.trim()) {
          return fail(res, 502, 'empty_report', 'AI 返回空内容，未生成报告；请重试或改用自由撰写')
        }
        const citations = cards.map((card) => ({
          cardId: card.id,
          title: card.title,
          sourceTitle: card.sourceTitle || '',
          quote: card.thesis,
        }))
        for (const source of (research && research.sources) || []) {
          citations.push({
            cardId: 'web:' + source.url,
            title: source.title || source.url,
            sourceTitle: '公开网络',
            url: source.url,
            quote: source.snippet || '',
          })
        }
        const report = store.createReport({ title, mode, kind: 'ai', content, citations })
        return sendJson(res, 200, {
          report,
          warning,
          webSources: (research && research.sources) || [],
        })
      }

      // ---------- reports ----------
      if (route === 'reports') {
        if (method === 'GET') return sendJson(res, 200, { reports: store.listReports() })
        if (method !== 'POST') return fail(res, 405, 'method_not_allowed', '只支持 GET/POST')
        const body = await readJson(req)
        const title = cleanTitle(body.title, '未命名报告')
        const report = store.createReport({ title, mode: body.mode === 'quick' ? 'quick' : 'deep', kind: body.kind === 'ai' ? 'ai' : 'free' })
        return sendJson(res, 200, { report })
      }
      const reportMatch = route.match(/^reports\/([^/]+)$/)
      if (reportMatch) {
        const reportId = decodeURIComponent(reportMatch[1])
        if (method === 'GET') {
          const report = store.getReport(reportId)
          if (!report) return fail(res, 404, 'report_not_found', '报告不存在')
          return sendJson(res, 200, { report })
        }
        if (method === 'PATCH') {
          const body = await readJson(req)
          const report = store.updateReport(reportId, body)
          if (!report) return fail(res, 404, 'report_not_found', '报告不存在')
          return sendJson(res, 200, { report })
        }
        if (method === 'DELETE') {
          if (!store.deleteReport(reportId)) return fail(res, 404, 'report_not_found', '报告不存在')
          return sendJson(res, 200, { ok: true })
        }
        return fail(res, 405, 'method_not_allowed', '不支持的方法')
      }

      return fail(res, 404, 'not_found', '未知接口：' + route)
    } catch (error) {
      const status = error && error.status ? error.status : 500
      const code = error && error.code ? error.code : 'internal_error'
      const message = error && error.message ? error.message : String(error)
      return fail(res, status, code, message)
    }
  }

  function composeReport(title, cards, assets, mode) {
    const lines = ['# ' + title, '', '> ' + (mode === 'quick' ? '快速初稿' : '深度报告') + ' · 由已确认卡片整理', '']
    const boards = new Map()
    for (const card of cards) {
      const list = boards.get(card.board) || []
      list.push(card)
      boards.set(card.board, list)
    }
    let index = 0
    for (const [board, list] of boards) {
      lines.push('## ' + String(index).padStart(1, '0') + ' ' + board, '')
      index += 1
      for (const card of list) {
        lines.push('### ' + card.title, '', card.thesis, '')
        if (card.points && card.points.length) {
          for (const point of card.points) lines.push('- ' + point)
          lines.push('')
        }
        if (card.gaps && card.gaps.length) lines.push('待补：' + card.gaps.join('；'), '')
        if (card.evidence && card.evidence.length) {
          for (const evidence of card.evidence) lines.push('> [' + evidence.blockId + '] ' + (evidence.quote || ''))
          lines.push('')
        }
      }
    }
    if (assets && assets.length) {
      lines.push('## 图表', '')
      for (const asset of assets) lines.push('- ' + asset.title + (asset.caption ? '：' + asset.caption : ''))
      lines.push('')
    }
    return lines.join('\n')
  }

  function composeWebReport(title, research) {
    const sources = (research && research.sources) || []
    const lines = [
      '# ' + title,
      '',
      '> 公开网络检索整理 · 生成前已在新建窗口获得联网授权',
      '> 注意：以下内容来自公开网络摘要，尚未逐条核验，请以原始来源为准。',
      '',
    ]
    if (research && research.content) lines.push(research.content, '')
    if (sources.length) {
      lines.push('## 公开来源与链接', '')
      sources.forEach((source, index) => {
        lines.push('[W' + (index + 1) + '] ' + (source.title || source.url) + ' — ' + source.url)
        if (source.snippet) lines.push('  ' + source.snippet)
      })
      lines.push('')
    }
    if (!research || (!research.content && !sources.length)) lines.push('公开检索没有返回可用内容。', '')
    return lines.join('\n')
  }

  return handler
}
