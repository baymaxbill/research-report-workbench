/**
 * 素材文本抽取（P1-b/P2）：零依赖。
 *
 *   docx / xlsx / pptx  → 本质是 zip：解析中央目录 → zlib.inflateRaw → 去 XML 标签
 *   md / txt            → 直接读
 *   pdf                 → 先借系统 pdftotext（P2），没有再做最小内置兜底；页数顺带数出来
 *
 * 只对 ≤2MiB 的文件调用（文档 §6.3）；解析失败返回 text=null，不阻塞上传。
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { extractPdf, pdfPageCount } from './pdf.js'

const MAX_TEXT = 200000

function stripXml(xml) {
  return xml
    .replace(/<w:tab\s*\/>/g, '\t')
    .replace(/<w:br\s*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/a:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 解析 ZIP 中央目录；支持 store(0) 与 deflate(8)，暂不处理 zip64。 */
function openZip(buffer) {
  let eocd = -1
  const min = Math.max(0, buffer.length - 65557)
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a zip archive')
  const count = buffer.readUInt16LE(eocd + 10)
  let offset = buffer.readUInt32LE(eocd + 16)
  const entries = new Map()
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    entries.set(name, { method, compressedSize, localOffset })
    offset += 46 + nameLength + extraLength + commentLength
  }

  function readEntry(name) {
    const entry = entries.get(name)
    if (!entry) return null
    const header = entry.localOffset
    if (buffer.readUInt32LE(header) !== 0x04034b50) return null
    const nameLength = buffer.readUInt16LE(header + 26)
    const extraLength = buffer.readUInt16LE(header + 28)
    const start = header + 30 + nameLength + extraLength
    const data = buffer.subarray(start, start + entry.compressedSize)
    if (entry.method === 0) return Buffer.from(data)
    if (entry.method === 8) return zlib.inflateRawSync(data)
    return null
  }

  return { names: [...entries.keys()], read: readEntry }
}

function extractDocx(buffer) {
  const zip = openZip(buffer)
  const xml = zip.read('word/document.xml')
  return xml ? stripXml(xml.toString('utf8')) : null
}

function extractXlsx(buffer) {
  const zip = openZip(buffer)
  const shared = zip.read('xl/sharedStrings.xml')
  const texts = []
  if (shared) {
    const xml = shared.toString('utf8')
    const matches = xml.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []
    for (const match of matches) texts.push(stripXml(match))
  }
  const sheetNames = zip.names.filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).slice(0, 3)
  for (const name of sheetNames) {
    const xml = zip.read(name)
    if (!xml) continue
    const raw = xml.toString('utf8')
    const inline = raw.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []
    for (const match of inline) texts.push(stripXml(match))
  }
  return texts.filter(Boolean).join('\n') || null
}

function extractPptx(buffer) {
  const zip = openZip(buffer)
  const slides = zip.names
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]))
  const texts = []
  for (const name of slides) {
    const xml = zip.read(name)
    if (!xml) continue
    const raw = xml.toString('utf8')
    const matches = raw.match(/<a:t>([\s\S]*?)<\/a:t>/g) || []
    for (const match of matches) texts.push(stripXml(match))
  }
  return texts.filter(Boolean).join('\n') || null
}

/**
 * @param {string} absPath 文件绝对路径
 * @param {string} ext 小写扩展名（不带点）
 * @returns {{text: string|null, pageCount: number, engine: string}}
 */
export function extractFile(absPath, ext) {
  const result = { text: null, pageCount: 0, engine: 'none' }
  try {
    if (ext === 'md' || ext === 'txt') {
      result.text = fs.readFileSync(absPath, 'utf8').slice(0, MAX_TEXT)
      result.engine = 'text'
      return result
    }
    if (ext === 'pdf') {
      const buffer = fs.readFileSync(absPath)
      result.pageCount = pdfPageCount(buffer)
      const extracted = extractPdf(absPath)
      result.text = extracted.text
      result.engine = extracted.engine
      return result
    }
    if (ext === 'docx' || ext === 'xlsx' || ext === 'pptx') {
      const buffer = fs.readFileSync(absPath)
      let text = null
      if (ext === 'docx') text = extractDocx(buffer)
      else if (ext === 'xlsx') text = extractXlsx(buffer)
      else text = extractPptx(buffer)
      if (text) {
        result.text = text.slice(0, MAX_TEXT)
        result.engine = 'zlib'
      }
      return result
    }
  } catch {
    /* 解析失败不阻塞上传：text 保持 null */
  }
  return result
}

export function extractFromName(absPath, originalName) {
  return extractFile(absPath, path.extname(String(originalName || '')).slice(1).toLowerCase())
}
