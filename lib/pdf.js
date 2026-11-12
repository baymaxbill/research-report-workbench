/**
 * PDF 正文抽取：优先用系统的 `pdftotext`（poppler），没有再做一次最小的内置兜底。
 *
 * 文档 §6.3 的口径：不自研 PDF 阅读器；正文抽取能借系统工具就借。
 * Git for Windows 通常自带 `C:\Program Files\Git\mingw64\bin\pdftotext.exe`，这里会主动探测。
 * 兜底只处理最简单的情况（未加密、Flate/未压缩内容流里的 ASCII 文本），
 * 提不出来就返回 null，让 UI 如实标「未解析」，不假装成功。
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { spawnSync } from 'node:child_process'

const MAX_TEXT = 200000

const COMMON_PATHS = [
  'C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe',
  'C:\\Program Files\\poppler\\Library\\bin\\pdftotext.exe',
  'C:\\Program Files\\poppler-24.02.0\\Library\\bin\\pdftotext.exe',
  'C:\\ProgramData\\chocolatey\\bin\\pdftotext.exe',
  '/usr/bin/pdftotext',
  '/usr/local/bin/pdftotext',
  '/opt/homebrew/bin/pdftotext',
]

function isExecutable(candidate) {
  try {
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile()
  } catch {
    return false
  }
}

/** 找 pdftotext：环境变量 → PATH → 常见安装路径。 */
export function resolvePdftotext() {
  const fromEnv = process.env.DSH_PDFTOTEXT
  if (fromEnv && isExecutable(fromEnv)) return fromEnv
  const probe = spawnSync('pdftotext', ['-v'], { encoding: 'utf8', timeout: 5000 })
  if (!probe.error && (probe.status === 0 || probe.status === 1)) return 'pdftotext'
  for (const candidate of COMMON_PATHS) {
    if (isExecutable(candidate)) return candidate
  }
  return null
}

/** 用 pdftotext 抽文本；失败返回 null。 */
function extractWithPdftotext(executable, absPath) {
  const result = spawnSync(executable, ['-layout', '-enc', 'UTF-8', absPath, '-'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 30000,
    windowsHide: true,
  })
  if (result.error) return null
  const text = typeof result.stdout === 'string' ? result.stdout : ''
  const trimmed = text.replace(/\u0000/g, '').trim()
  return trimmed.length > 0 ? trimmed.slice(0, MAX_TEXT) : null
}

/** 从内容流里抠 (…)Tj / [ … ]TJ / <…>Tj 的文本；只做最基本的转义。 */
function textFromContentStream(content) {
  const chunks = []
  const stringPattern = /\((?:\\.|[^\\()])*\)\s*(?:Tj|')/g
  const arrayPattern = /\[((?:\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>|[^\]])*)\]\s*TJ/g
  const hexPattern = /<([0-9A-Fa-f\s]+)>\s*Tj/g

  const decodePdfString = (raw) =>
    raw
      .replace(/\\([nrtbf()\\])/g, (_match, char) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }[char] || char))
      .replace(/\\([0-7]{1,3})/g, (_match, octal) => String.fromCharCode(parseInt(octal, 8)))

  let match
  while ((match = stringPattern.exec(content)) !== null) {
    chunks.push(decodePdfString(match[0].replace(/\s*(?:Tj|')$/, '').slice(1, -1)))
  }
  while ((match = arrayPattern.exec(content)) !== null) {
    const inner = match[1]
    const parts = inner.match(/\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>/g) || []
    let line = ''
    for (const part of parts) {
      if (part.startsWith('(')) line += decodePdfString(part.slice(1, -1))
      else {
        const hex = part.slice(1, -1).replace(/\s+/g, '')
        for (let index = 0; index + 1 < hex.length; index += 2) {
          line += String.fromCharCode(parseInt(hex.slice(index, index + 2), 16))
        }
      }
    }
    chunks.push(line)
  }
  while ((match = hexPattern.exec(content)) !== null) {
    const hex = match[1].replace(/\s+/g, '')
    let line = ''
    for (let index = 0; index + 1 < hex.length; index += 2) {
      line += String.fromCharCode(parseInt(hex.slice(index, index + 2), 16))
    }
    chunks.push(line)
  }
  return chunks.join('\n')
}

function printableRatio(text) {
  if (!text) return 0
  let printable = 0
  for (const char of text) {
    const code = char.codePointAt(0)
    if (code === 9 || code === 10 || (code >= 32 && code !== 127)) printable += 1
  }
  return printable / [...text].length
}

/** 内置兜底：解压 FlateDecode 流并抽简单文本。 */
export function extractPdfNaive(buffer) {
  const latin = buffer.toString('latin1')
  const pieces = []
  const streamPattern = /stream\r?\n?([\s\S]*?)endstream/g
  let match
  while ((match = streamPattern.exec(latin)) !== null) {
    const raw = Buffer.from(match[1], 'latin1')
    let content = null
    try {
      content = zlib.inflateSync(raw)
    } catch {
      try {
        content = zlib.inflateRawSync(raw)
      } catch {
        content = raw
      }
    }
    if (!content) continue
    const text = textFromContentStream(content.toString('latin1'))
    if (text && text.trim()) pieces.push(text)
  }
  const merged = pieces.join('\n').trim().slice(0, MAX_TEXT)
  if (!merged) return null
  return printableRatio(merged) >= 0.7 ? merged : null
}

/**
 * @param {string} absPath
 * @returns {{text: string|null, engine: string}}
 */
export function extractPdf(absPath) {
  const executable = resolvePdftotext()
  if (executable) {
    const text = extractWithPdftotext(executable, absPath)
    if (text) return { text, engine: 'pdftotext' }
  }
  try {
    const buffer = fs.readFileSync(absPath)
    const text = extractPdfNaive(buffer)
    if (text) return { text, engine: 'builtin' }
  } catch {
    /* 兜底失败 */
  }
  return { text: null, engine: 'none' }
}

export function pdfPageCount(buffer) {
  const matches = buffer.toString('latin1').match(/\/Type\s*\/Page\b/g)
  return matches ? matches.length : 0
}

export function pdftotextInfo() {
  const executable = resolvePdftotext()
  return executable ? { available: true, path: executable } : { available: false, path: null }
}
