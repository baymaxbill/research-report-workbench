/**
 * MOKI 资料库文件层适配：
 * - 只读 MOKI 的 library.sqlite，按 resource_library_items.target 读取原文件；
 * - 导出只写 MOKI 的 local_folder 真实目录，不写它的数据库。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { parseFileBuffer } from './parse.js'
import { extractFigures, saveFigures } from './figures.js'

const SUPPORTED = new Set(['.pdf', '.docx', '.txt', '.md'])
const MAX_BYTES = 30 * 1024 * 1024

export function mokiDbPath() {
  if (process.env.MOKI_LIBRARY_DB) return process.env.MOKI_LIBRARY_DB
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'moki-library', 'library.sqlite')
}

function openMoki() {
  const file = mokiDbPath()
  if (!fs.existsSync(file)) {
    const error = new Error('没有找到 MOKI 资料库数据库')
    error.code = 'MOKI_NOT_FOUND'
    throw error
  }
  const db = new DatabaseSync(file, { readOnly: true })
  try {
    db.exec('PRAGMA busy_timeout = 3000')
  } catch {
    /* read-only pragma may be ignored */
  }
  return db
}

function readItems() {
  const db = openMoki()
  try {
    return db
      .prepare(
        `SELECT id, parent_id, kind, name, target, tags_json, updated_at
         FROM resource_library_items
         ORDER BY sort_order, name`,
      )
      .all()
  } finally {
    db.close()
  }
}

function folderPathOf(item, byId) {
  const names = []
  let cursor = item.parent_id
  const seen = new Set()
  while (cursor && byId.has(cursor) && !seen.has(cursor)) {
    seen.add(cursor)
    const parent = byId.get(cursor)
    if (parent.name) names.unshift(parent.name)
    cursor = parent.parent_id
  }
  return names.join(' / ')
}

function fileInfo(item, byId) {
  const target = item.target ? String(item.target) : ''
  let exists = false
  let size = 0
  let mtime = ''
  if (target) {
    try {
      const stat = fs.statSync(target)
      exists = stat.isFile()
      size = stat.size
      mtime = stat.mtime.toISOString()
    } catch {
      exists = false
    }
  }
  return {
    id: item.id,
    name: item.name,
    folder: folderPathOf(item, byId),
    ext: path.extname(item.target || item.name || '').toLowerCase(),
    size,
    mtime,
    exists,
    kind: item.kind,
    updatedAt: item.updated_at || '',
  }
}

export function listMokiItems() {
  try {
    const rows = readItems()
    const byId = new Map(rows.map((row) => [row.id, row]))
    const files = rows
      .filter((row) => row.kind === 'local_file')
      .map((row) => fileInfo(row, byId))
      .filter((item) => item.exists && SUPPORTED.has(item.ext))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    const folders = rows
      .filter((row) => row.kind === 'local_folder' && row.target)
      .map((row) => ({ id: row.id, name: row.name, target: String(row.target), folder: folderPathOf(row, byId) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    return { available: true, dbPath: mokiDbPath(), files, folders, total: rows.length }
  } catch (error) {
    return { available: false, dbPath: mokiDbPath(), files: [], folders: [], total: 0, error: error.message }
  }
}

function findItem(itemId) {
  const db = openMoki()
  try {
    return db
      .prepare('SELECT id, parent_id, kind, name, target FROM resource_library_items WHERE id = ?')
      .get(itemId)
  } finally {
    db.close()
  }
}

export async function importMokiSource(store, itemId) {
  const existing = store.findSourceByMokiId(itemId)
  if (existing) return { source: existing, existing: true, figures: 0 }

  const item = findItem(itemId)
  if (!item || item.kind !== 'local_file' || !item.target) throw new Error('MOKI 资料不存在或不是本地文件')
  const ext = path.extname(item.target || item.name || '').toLowerCase()
  if (!SUPPORTED.has(ext)) throw new Error('暂不支持这个 MOKI 文件类型')
  const fileName = path.extname(item.name || '') ? item.name : item.name + ext
  const stat = fs.statSync(item.target)
  if (!stat.isFile()) throw new Error('MOKI 资料不是普通文件')
  if (stat.size > MAX_BYTES) throw new Error('文件超过 30MB')

  const buffer = fs.readFileSync(item.target)
  const parsed = await parseFileBuffer(store.dir, fileName, buffer)
  const source = store.createSource({
    kind: 'file',
    title: item.name,
    org: 'MOKI 资料库',
    fileName,
    mokiId: item.id,
    text: parsed.text,
    blocks: parsed.blocks,
    pageCount: parsed.pageCount,
  })
  if (parsed.keepFile && parsed.buffer) {
    store.saveSourceFile(source.id, parsed.buffer, fileName)
  }

  let figures = 0
  let warning = ''
  if (parsed.keepFile && parsed.buffer && parsed.engine === 'pdfjs') {
    try {
      const result = await extractFigures(parsed.buffer)
      figures = saveFigures(store, source.id, result.figures)
    } catch (error) {
      warning = '图表提取失败：' + error.message
    }
  }
  return { source: store.getSource(source.id), existing: false, figures, warning }
}

function safeName(value, fallback) {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|[. ]+$/g, '')
    .trim()
    .slice(0, 80)
  return cleaned || fallback
}

function writeText(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

export function exportSourceToMoki(store, sourceId, folderId) {
  const source = store.getSource(sourceId)
  if (!source) throw new Error('资料不存在')
  const folder = findItem(folderId)
  if (!folder || folder.kind !== 'local_folder' || !folder.target) {
    throw new Error('目标必须是 MOKI 的本地文件夹映射')
  }
  const root = path.resolve(String(folder.target))
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error('目标文件夹不可用')
  const name = safeName(source.title, '未命名资料')
  const outDir = path.resolve(root, name)
  if (outDir !== root && !outDir.startsWith(root + path.sep)) throw new Error('导出路径越界')

  const cards = store.listCards({ sourceId })
  const assets = store.listAssets({ sourceId }).filter((asset) => asset.kind === 'figure')
  const files = []
  fs.mkdirSync(path.join(outDir, '章节'), { recursive: true })
  fs.mkdirSync(path.join(outDir, '图表'), { recursive: true })

  const body = [
    '# ' + source.title,
    '',
    '> 来源：' + (source.org || 'MOKI 资料库') + (source.pageCount ? ' · ' + source.pageCount + ' 页' : ''),
    '> 导出：研报撰写工作台 · ' + new Date().toISOString(),
    '',
    source.text || '',
    '',
  ].join('\n')
  writeText(path.join(outDir, '正文.md'), body)
  files.push('正文.md')

  const boardFiles = new Map()
  for (const card of cards) {
    const list = boardFiles.get(card.board) || []
    list.push(card)
    boardFiles.set(card.board, list)
  }
  let chapterIndex = 1
  for (const [board, list] of boardFiles) {
    const lines = ['# ' + board, '']
    for (const card of list) {
      lines.push('## ' + card.title, '', card.thesis, '')
      if (card.points && card.points.length) {
        lines.push('支撑点：')
        for (const point of card.points) lines.push('- ' + point)
        lines.push('')
      }
      if (card.gaps && card.gaps.length) {
        lines.push('待补：' + card.gaps.join('；'), '')
      }
      if (card.evidence && card.evidence.length) {
        lines.push('证据：')
        for (const evidence of card.evidence) lines.push('- [' + evidence.blockId + '] ' + (evidence.quote || ''))
        lines.push('')
      }
    }
    const file = '章节/' + String(chapterIndex).padStart(2, '0') + '-' + safeName(board, '板块') + '.md'
    writeText(path.join(outDir, file), lines.join('\n'))
    files.push(file)
    chapterIndex += 1
  }

  writeText(path.join(outDir, '卡片.json'), JSON.stringify(cards, null, 2))
  files.push('卡片.json')

  let imageIndex = 1
  for (const asset of assets) {
    const image = store.getAssetImage(asset.id)
    if (!image) continue
    const ext = path.extname(image).toLowerCase() || '.png'
    const file = '图表/' + String(imageIndex).padStart(2, '0') + '-' + safeName(asset.title, '图表') + ext
    fs.copyFileSync(image, path.join(outDir, file))
    files.push(file)
    imageIndex += 1
  }
  writeText(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(
      {
        sourceId: source.id,
        title: source.title,
        folderId: folder.id,
        exportedAt: new Date().toISOString(),
        cards: cards.length,
        figures: imageIndex - 1,
        files,
      },
      null,
      2,
    ),
  )
  files.push('manifest.json')
  return { path: outDir, name, files, cards: cards.length, figures: imageIndex - 1 }
}
