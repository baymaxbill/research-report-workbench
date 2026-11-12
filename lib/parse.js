/**
 * 文本侧：把上传文件 / 网页 / 粘贴正文变成可引用的段落块，
 * 并提供本地检索问答与五板块抽取（v0.1 不调用大模型，规则可解释、可离线）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { extractFile } from './extract.js'
import { extractPdfText } from './pdftext.js'

const MAX_BLOCKS = 800
const MAX_TEXT = 200000

/** 标题判定：Markdown 标题，或「短、无句读、下一段很长」的独立行。 */
function looksLikeHeading(line, next) {
  if (/^#{1,4}\s+/.test(line)) return true
  if (line.length > 34) return false
  if (/[。；，、,;:：!?！？]/.test(line)) return false
  return Boolean(next && next.length > 44)
}

export function buildBlocks(rawText) {
  const text = String(rawText || '')
    .replace(/\r\n?/g, '\n')
    .slice(0, MAX_TEXT)
  const lines = text.split('\n')
  const blocks = []
  for (let i = 0; i < lines.length && blocks.length < MAX_BLOCKS; i += 1) {
    const line = lines[i].trim()
    if (!line) continue
    let next = ''
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim()) {
        next = lines[j].trim()
        break
      }
    }
    const heading = looksLikeHeading(line, next)
    const content = line.replace(/^#{1,4}\s+/, '')
    blocks.push({ id: 'b' + (blocks.length + 1), heading, text: content })
  }
  return blocks
}

/** 文件 → 文本。PDF 优先 pdfjs（按坐标还原行），docx 沿用零依赖抽取；失败如实报错。 */
export async function parseFileBuffer(dir, fileName, buffer) {
  const ext = path.extname(String(fileName || '')).slice(1).toLowerCase()
  if (!['txt', 'md', 'docx', 'pdf'].includes(ext)) {
    throw new Error('暂时只支持 txt / md / docx / pdf')
  }
  if (ext === 'txt' || ext === 'md') {
    const text = buffer.toString('utf8').slice(0, MAX_TEXT)
    return { text, blocks: buildBlocks(text), pageCount: 0, engine: 'text', ext, keepFile: false }
  }
  if (ext === 'pdf') {
    try {
      const out = await extractPdfText(buffer)
      if (out.text && out.text.trim().length > 40) {
        return {
          text: out.text.slice(0, MAX_TEXT),
          blocks: buildBlocks(out.text),
          pageCount: out.pageCount || 0,
          engine: 'pdfjs',
          ext,
          keepFile: true,
          buffer,
        }
      }
    } catch {
      /* 落到系统 pdftotext / 最小兜底 */
    }
  }
  const tmp = path.join(dir, 'files', 'upload_' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext)
  fs.writeFileSync(tmp, buffer)
  try {
    const out = extractFile(tmp, ext)
    if (!out || !out.text) {
      throw new Error(
        ext === 'pdf'
          ? 'PDF 未抽取到文本（扫描件或加密文件）。请换一份可复制文字的 PDF，或先转成 DOCX。'
          : '文档未抽取到文本',
      )
    }
    return {
      text: out.text,
      blocks: buildBlocks(out.text),
      pageCount: out.pageCount || 0,
      engine: out.engine || ext,
      ext,
      keepFile: ext === 'pdf',
      buffer,
    }
  } finally {
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* temp already gone */
    }
  }
}

function decodeEntities(input) {
  return String(input)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
}

/** 网页正文抽取：只读用户给定 URL，不做站内检索或批量抓取。 */
export async function fetchUrlText(pageUrl) {
  let parsed
  try {
    parsed = new URL(pageUrl)
  } catch {
    throw new Error('链接格式不正确')
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('只支持 http/https 链接')
  const res = await fetch(parsed.toString(), {
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.6',
    },
  })
  if (!res.ok) throw new Error('抓取失败：HTTP ' + res.status)
  const type = res.headers.get('content-type') || ''
  if (type.includes('pdf')) {
    const buffer = Buffer.from(await res.arrayBuffer())
    return { title: parsed.pathname.split('/').pop() || parsed.hostname, text: null, buffer, isPdf: true }
  }
  const html = (await res.text()).slice(0, 1200000)
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : ''
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  const text = decodeEntities(body)
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n\s*\n\s*/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!text || text.length < 80) throw new Error('网页正文为空或需要登录；请切「粘贴正文」')
  return { title, text, isPdf: false }
}

const ASCII_STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'has', 'have',
  'what', 'which', 'how', 'why', 'does', 'did', 'not', '含', '的', '了', '是', '在', '和', '与', '及', '对',
])

function queryTerms(question) {
  const q = String(question || '').toLowerCase()
  const terms = new Set()
  for (const word of q.match(/[a-z0-9][a-z0-9._%-]{1,}/g) || []) {
    if (!ASCII_STOP.has(word)) terms.add(word)
  }
  for (const run of q.match(/[\u4e00-\u9fa5]{2,}/g) || []) {
    if (run.length <= 8) terms.add(run)
    for (let i = 0; i + 1 < run.length && i < 12; i += 1) terms.add(run.slice(i, i + 2))
  }
  return [...terms]
}

function scoreBlock(block, terms, selectedId) {
  const text = block.text.toLowerCase()
  let score = 0
  for (const term of terms) {
    if (!term) continue
    let at = text.indexOf(term)
    let hits = 0
    while (at >= 0 && hits < 6) {
      hits += 1
      at = text.indexOf(term, at + term.length)
    }
    score += hits * (term.length > 1 ? 2 : 1)
  }
  if (selectedId && block.id === selectedId) score += 6
  if (block.heading) score *= 0.4
  return score
}

/**
 * 本地检索问答：只回答文档里有依据的内容。
 * 返回 { answer, evidence, strength }；没有依据时明确说没有。
 */
export function answerQuestion(blocks, question, selectedId) {
  const terms = queryTerms(question)
  if (!terms.length) {
    return { answer: '问题太短，没抓到可检索的关键词。换一种问法试试。', evidence: [], strength: 'none' }
  }
  const ranked = blocks
    .map((block) => ({ block, score: scoreBlock(block, terms, selectedId) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  if (!ranked.length) {
    return {
      answer: '文档内没有找到直接依据。可以换一种问法，或先把相关研报补进资料台账。',
      evidence: [],
      strength: 'none',
    }
  }
  const top = ranked[0]
  const quote = top.block.text.length > 180 ? top.block.text.slice(0, 180) + '…' : top.block.text
  const others = ranked.slice(1)
  let answer = '原文最相关的是这一段：\n\n「' + quote + '」'
  if (others.length) {
    answer += '\n\n另外两段也相关：\n'
    for (const item of others) {
      const q = item.block.text.length > 90 ? item.block.text.slice(0, 90) + '…' : item.block.text
      answer += '\n·「' + q + '」'
    }
  }
  answer += '\n\n（本地检索结果，未调用模型；点击右侧证据可回原文。）'
  const strength = ranked.length >= 2 ? '多段相关' : '单一段落'
  return {
    answer,
    evidence: ranked.map((item) => ({
      blockId: item.block.id,
      quote: item.block.text.slice(0, 160),
      score: item.score,
    })),
    strength,
  }
}

const BOARD_RULES = [
  {
    board: '行业逻辑与框架',
    keys: ['市场', '规模', '空间', '渗透', '增速', '产业链', '竞争', '份额', '需求', 'CR'],
  },
  {
    board: '技术原理',
    keys: ['技术', '路线', '效率', 'TCO', '方案', '冷板', '浸没', '功率', 'PUE', '芯片'],
  },
  {
    board: '商业逻辑',
    keys: ['客户', '渠道', '毛利', '定价', '订单', '集成', '供应', '认证', '净利', '壁垒'],
  },
  {
    board: '财务框架与预测',
    keys: ['收入', '利润', '毛利', '资本开支', '现金流', '估值', '预测', '亿元', 'CAGR', '测算'],
  },
  {
    board: '技术发展前景',
    keys: ['未来', '趋势', '拐点', '预计', '放量', '2027', '2028', '窗口', '替代', '商用'],
  },
]

/** 五板块草稿：关键词召回头部段落，每张卡都带 blockId 证据。 */
export function analyzeBlocks(blocks) {
  const cards = []
  const used = new Set()
  for (const rule of BOARD_RULES) {
    const ranked = blocks
      .filter((block) => !block.heading)
      .map((block) => {
        let hits = 0
        for (const key of rule.keys) if (block.text.includes(key)) hits += 1
        return { block, hits }
      })
      .filter((item) => item.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 2)
    if (!ranked.length) continue
    const first = ranked[0].block
    const clause = first.text.split(/[。；]/)[0].slice(0, 26)
    const title = (rule.board + '｜' + clause).slice(0, 46)
    const evidence = ranked.map((item) => ({
      blockId: item.block.id,
      quote: item.block.text.slice(0, 160),
    }))
    cards.push({
      board: rule.board,
      title,
      thesis: first.text.slice(0, 150),
      evidence,
    })
    for (const item of ranked) used.add(item.block.id)
  }
  return cards
}
