/**
 * PDF 正文抽取：pdfjs-dist 逐页取 textContent，按 y 坐标还原行。
 * 比正则抠内容流可读得多；图表本身不在这里，原文页由 /sources/:id/file 提供。
 */
let pdfjsPromise = null

function loadPdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs')
  return pdfjsPromise
}

function joinLine(parts) {
  const sorted = parts.sort((a, b) => a.x - b.x)
  let line = ''
  let prev = null
  for (const part of sorted) {
    const text = String(part.str || '')
    if (!text) continue
    if (line && prev != null) {
      const gap = part.x - prev.end
      const ascii = /[A-Za-z0-9]$/.test(line) && /^[A-Za-z0-9]/.test(text)
      if (gap > 8 || (gap > 1.5 && ascii)) line += ' '
    }
    line += text
    prev = { end: part.x + (part.width || 0) }
  }
  return line.trim()
}

/** 把 pdfjs 的 text item 还原成行；纯函数便于单测。 */
export function groupItems(items) {
  const norm = []
  for (const item of items || []) {
    if (!item || !item.str) continue
    const transform = item.transform || [1, 0, 0, 1, 0, 0]
    norm.push({
      str: item.str,
      x: transform[4],
      y: transform[5],
      width: item.width || 0,
      height: Math.abs(transform[3]) || 0,
    })
  }

  // 竖排标题（如“宏观研究”“证券研究报告”）会把每个字放在同一 x、不同 y。
  // 单字 item 只有在同一 y 上没有横向邻居时才算竖排候选，避免误伤表格列。
  const rowsByY = new Map()
  for (const item of norm) {
    const key = Math.round(item.y / 3) * 3
    if (!rowsByY.has(key)) rowsByY.set(key, [])
    rowsByY.get(key).push(item)
  }
  const verticalCandidates = norm.filter((item) => {
    if (Array.from(item.str).length > 2) return false
    const key = Math.round(item.y / 3) * 3
    const row = rowsByY.get(key) || []
    const reach = Math.max(18, (item.height || 10) * 2.5)
    return !row.some(
      (other) => other !== item && Math.abs(other.y - item.y) < 1.5 && Math.abs(other.x - item.x) < reach,
    )
  })

  const columns = new Map()
  for (const item of verticalCandidates) {
    const key = Math.round(item.x * 2) / 2
    if (!columns.has(key)) columns.set(key, [])
    columns.get(key).push(item)
  }

  const consumed = new Set()
  const lines = []
  for (const [, column] of columns) {
    const sorted = column.slice().sort((a, b) => b.y - a.y)
    let run = []
    const flush = () => {
      if (run.length >= 3) {
        for (const item of run) consumed.add(item)
        lines.push({ y: run[0].y, text: run.map((item) => item.str).join('').trim() })
      }
      run = []
    }
    for (const item of sorted) {
      if (run.length === 0) {
        run.push(item)
        continue
      }
      const gap = run[run.length - 1].y - item.y
      const limit = Math.max(6, (item.height || 10) * 2.6)
      if (gap >= 1 && gap <= limit) run.push(item)
      else {
        flush()
        run.push(item)
      }
    }
    flush()
  }

  const rows = new Map()
  for (const item of norm) {
    if (consumed.has(item)) continue
    const y = Math.round(item.y / 3) * 3
    if (!rows.has(y)) rows.set(y, [])
    rows.get(y).push(item)
  }
  for (const [y, parts] of rows) lines.push({ y, text: joinLine(parts) })

  return lines
    .filter((line) => line.text)
    .sort((a, b) => b.y - a.y)
    .map((line) => line.text)
    .join('\n')
}


const DROP_LINE = [
  /^下载日志已记录，仅供内部参考$/,
  /请务必仔细阅读正文/,
  /有信仰.*敢担当/,
  /第\s*\d+\s*页\s*共\s*\d+\s*页/,
  /^世界经济$/,
  /^证券研究报告$/,
  /^宏观研究$/,
  /^证券分析师$/,
  /^相关研究$/,
  /^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/,
  /^1[3-9]\d{9}$/,
  /^[A-Z]\d{6,}$/,
]

function stripCredentials(line) {
  return line
    .replace(/^[\u4e00-\u9fa5]{2,4}\s+[A-Z]\d{6,}\s*/, '')
    .replace(/\s+[A-Z]\d{6,}\s*$/, '')
    .replace(/\s+[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\s*/g, ' ')
    .trim()
}

/** 去掉页眉页脚、分析师邮箱/工号、图表目录与图表内部坐标轴文字。 */
export function cleanPageText(text) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length) return ''

  const captions = lines.filter((line) => /^图表\s*\d+[：:]/.test(line) || /^图\s*\d+[：:]/.test(line))
  const sources = lines.filter((line) => /^资料来源/.test(line))
  if (/^图表目录/.test(lines[0]) || (captions.length > 8 && sources.length === 0)) return ''

  const out = []
  let inChart = false
  let skipNote = 0
  for (const raw of lines) {
    let line = stripCredentials(raw)
    if (!line) continue
    if (DROP_LINE.some((pattern) => pattern.test(line))) continue
    if (line.length <= 2 && /^[\-—–·]+$/.test(line)) continue
    if (/^图表\s*\d+[：:]/.test(line) || /^图\s*\d+[：:]/.test(line)) {
      out.push(line)
      inChart = true
      continue
    }
    if (inChart && /^资料来源/.test(line)) {
      inChart = false
      continue
    }
    if (inChart) continue
    if (/^资料来源/.test(line)) continue
    if (/^注[：:]/.test(line)) {
      skipNote = 2
      continue
    }
    if (skipNote > 0) {
      skipNote -= 1
      continue
    }
    line = line.replace(/\s{2,}/g, ' ')
    if (line) out.push(line)
  }
  return out.join('\n').trim()
}

export async function extractPdfText(buffer) {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise
  const pages = []
  const pageCount = doc.numPages
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = cleanPageText(groupItems(content.items))
      if (text) pages.push('【第 ' + pageNumber + ' 页】\n' + text)
      page.cleanup()
    }
  } finally {
    await doc.destroy()
  }
  return { text: pages.join('\n\n'), pageCount, engine: 'pdfjs' }
}


/** 一页的文字层几何：坐标与 scale=2 的页图对齐，供前端叠在选择层上。 */
export async function extractPageLayout(buffer, pageNumber) {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise
  try {
    const page = await doc.getPage(Math.max(1, Math.min(Number(pageNumber) || 1, doc.numPages)))
    const viewport = page.getViewport({ scale: 2 })
    const content = await page.getTextContent()
    const items = []
    for (const item of content.items) {
      if (!item || !item.str) continue
      const tx = pdfjs.Util.transform(viewport.transform, item.transform)
      const fontHeight = Math.hypot(tx[2], tx[3])
      items.push({
        str: item.str,
        l: tx[4],
        t: tx[5] - fontHeight,
        w: (item.width || 0) * viewport.scale,
        h: fontHeight,
      })
    }
    return { width: viewport.width, height: viewport.height, pageCount: doc.numPages, items }
  } finally {
    await doc.destroy()
  }
}
