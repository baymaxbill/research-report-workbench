/**
 * 从 PDF 自动提取图表：按「图表 N：标题」与「资料来源」定位图表区域，
 * 渲染整页后裁剪为 PNG。只处理能找到上下文的区域，避免把整页正文当图。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'

let canvasModule = null
let pdfjsModule = null

async function load() {
  if (!canvasModule) {
    canvasModule = await import('@napi-rs/canvas')
    if (canvasModule.DOMMatrix && !globalThis.DOMMatrix) globalThis.DOMMatrix = canvasModule.DOMMatrix
    if (canvasModule.ImageData && !globalThis.ImageData) globalThis.ImageData = canvasModule.ImageData
    if (canvasModule.Path2D && !globalThis.Path2D) globalThis.Path2D = canvasModule.Path2D
  }
  if (!pdfjsModule) pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs')
  return { canvas: canvasModule, pdfjs: pdfjsModule }
}

function rowsOf(items) {
  const rows = new Map()
  for (const item of items || []) {
    if (!item || !item.str) continue
    const transform = item.transform || [1, 0, 0, 1, 0, 0]
    const y = Math.round(transform[5] / 2) * 2
    if (!rows.has(y)) rows.set(y, [])
    rows.get(y).push({ str: item.str, x: transform[4] })
  }
  return [...rows.entries()]
    .map(([y, parts]) => ({
      y,
      text: parts.sort((a, b) => a.x - b.x).map((part) => part.str).join('').replace(/\s+/g, ' ').trim(),
      x: Math.min(...parts.map((part) => part.x)),
    }))
    .filter((row) => row.text)
    .sort((a, b) => b.y - a.y)
}

export async function extractFigures(buffer) {
  const { canvas, pdfjs } = await load()
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise
  const figures = []
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      const rows = rowsOf(content.items)
      const captions = rows.filter((row) => /^(图表|图)\s*\d+[：:]/.test(row.text))
      const sources = rows.filter((row) => /^资料来源/.test(row.text))
      if (!captions.length || captions.length > 8) {
        page.cleanup()
        continue
      }
      const height = page.getViewport({ scale: 1 }).height
      const width = page.getViewport({ scale: 1 }).width
      const groups = []
      for (const caption of captions) {
        if (groups.some((group) => Math.abs(group.y - caption.y) <= 4)) continue
        const source = sources.find((row) => row.y < caption.y - 40 && caption.y - row.y < height * 0.9)
        if (!source) continue
        groups.push({ caption, source, y: caption.y })
      }
      if (!groups.length) {
        page.cleanup()
        continue
      }

      const scale = 2
      const viewport = page.getViewport({ scale })
      const full = canvas.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      const context = full.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, full.width, full.height)
      await page.render({ canvasContext: context, viewport }).promise

      for (const group of groups) {
        const topY = group.caption.y - 10
        const bottomY = group.source.y + 16
        const left = 24
        const right = width - 24
        const sx = Math.max(0, left * scale)
        const sy = Math.max(0, (height - topY) * scale)
        const sw = Math.min(full.width - sx, (right - left) * scale)
        const sh = Math.min(full.height - sy, (topY - bottomY) * scale)
        if (sw < 500 || sh < 120) continue
        const crop = canvas.createCanvas(Math.round(sw), Math.round(sh))
        crop.getContext('2d').drawImage(full, sx, sy, sw, sh, 0, 0, crop.width, crop.height)
        const rawTitle = group.caption.text.replace(/^(图表|图)\s*\d+[：:]\s*/, '').trim()
        const title = rawTitle.split(/\s+(?=(图表|图)\s*\d+[：:])/)[0].trim()
        figures.push({
          page: pageNumber,
          title: title || group.caption.text,
          caption: group.caption.text,
          note: group.source.text,
          width: crop.width,
          height: crop.height,
          buffer: crop.toBuffer('image/png'),
        })
      }
      page.cleanup()
    }
  } finally {
    await doc.destroy()
  }
  return { pageCount: doc.numPages, figures }
}

/** 把自动提取的图表写入 assets 表，按 source + 标题 + 页码去重。 */
export function saveFigures(store, sourceId, figures) {
  const existing = store.listAssets({ sourceId })
  const seen = new Set(existing.map((asset) => asset.page + '|' + asset.title))
  const hashes = new Map()
  const hashOf = (asset) => {
    if (!hashes.has(asset.id)) {
      const file = store.getAssetImage(asset.id)
      hashes.set(asset.id, file ? crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex') : '')
    }
    return hashes.get(asset.id)
  }
  let added = 0
  for (const figure of figures) {
    const key = figure.page + '|' + figure.title
    const hash = crypto.createHash('sha1').update(figure.buffer).digest('hex')
    if (seen.has(key)) continue
    if (existing.some((asset) => asset.page === figure.page && hashOf(asset) === hash)) continue
    const asset = store.createAsset({
      sourceId,
      kind: 'figure',
      title: figure.title,
      caption: figure.caption,
      sourceNote: figure.note,
      page: figure.page,
      data: {},
      chartType: 'none',
    })
    store.saveAssetImage(asset.id, figure.buffer)
    seen.add(key)
    added += 1
  }
  return added
}
