/**
 * 五板块 AI 摘要与卡片重写。
 *
 * 只做三件事：把段落编号化送给模型、把模型返回的严格 JSON 校验回卡片、失败时抛错让上层回退到规则抽取。
 * 模型路由取当前 Agent 的默认选择；取不到时退到第一个可用 provider/model。
 */
const BOARDS = ['行业逻辑与框架', '技术原理', '商业逻辑', '财务框架与预测', '技术发展前景']

const BOARD_BRIEF = {
  行业逻辑与框架: '行业边界、需求驱动、市场规模与增速口径、产业链环节与利润池、竞争格局',
  技术原理: '技术路线、原理要点、关键指标（效率/良率/成本）、成熟度与替代关系、专利与标准',
  商业逻辑: '客户与渠道、定价与单位经济、成本结构、壁垒、可比公司打法',
  财务框架与预测: '收入拆分、关键假设、毛利率与费用率、资本开支、现金流、估值方法、敏感性',
  技术发展前景: '3–5 年路线演进、渗透率与拐点、催化剂、风险与反证、待验证问题',
}

export function selectBlocks(blocks, maxChars = 15000, maxBlocks = 120) {
  const all = Array.isArray(blocks) ? blocks : []
  if (!all.length) return []
  const step = Math.max(1, Math.ceil(all.length / maxBlocks))
  const picked = []
  const seen = new Set()
  let used = 0
  const add = (block) => {
    if (!block || seen.has(block.id)) return
    const size = String(block.text || '').length + 12
    if (used + size > maxChars) return
    seen.add(block.id)
    picked.push(block)
    used += size
  }
  for (const block of all) if (block.heading) add(block)
  for (let i = 0; i < all.length; i += step) add(all[i])
  for (const block of all) {
    if (used >= maxChars * 0.92) break
    add(block)
  }
  return picked.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
}

function blocksText(blocks) {
  return blocks.map((block) => '[' + block.id + '] ' + (block.heading ? '【标题】' : '') + block.text).join('\n')
}

export function buildAnalyzePrompt(blocks, title, instruction) {
  const picked = selectBlocks(blocks)
  const system = [
    '你是买方（PE/VC/公募）行业研究员。',
    '只使用用户给出的段落内容，不引入外部事实，不编造数字。',
    '每个结论必须挂 evidence 段落编号（如 b12），编号必须来自给定列表。',
    '找不到依据的内容写进 gaps，不要用估计值填充。',
    '输出严格 JSON，不要 markdown 代码块，不要解释。',
  ].join('\n')
  const prompt = [
    '报告标题：' + (title || '未命名研报'),
    instruction ? '本次额外要求：' + instruction : '',
    '请按五个板块各输出 1 张卡片：',
    BOARDS.map((board) => '- ' + board + '：' + BOARD_BRIEF[board]).join('\n'),
    '段落如下（[编号] 正文）：',
    blocksText(picked),
    '输出 JSON 结构：',
    '{"cards":[{"board":"行业逻辑与框架","title":"一句判断，≤40字","thesis":"≤120字，必须含数字或明确判断","points":["2-4条支撑点，每条≤60字"],"evidence":["b12","b18"],"gaps":["0-2条待补/存疑"]}]}',
    '要求：cards 恰好 5 个，board 必须使用上面五个名称之一；evidence 1–3 个；points 2–4 条。',
  ]
    .filter(Boolean)
    .join('\n\n')
  return { system, prompt, picked }
}

export function buildRevisePrompt(card, blocks, reason) {
  const picked = selectBlocks(blocks, 9000, 60)
  const system = [
    '你是买方行业研究员。只依据给定段落重写一张研究卡片，不编造数字。',
    '保留原卡片中仍然成立的判断；按用户驳回原因修正；证据编号必须来自给定列表。',
    '输出严格 JSON，不要 markdown 代码块。',
  ].join('\n')
  const prompt = [
    '原卡片：',
    JSON.stringify(
      { board: card.board, title: card.title, thesis: card.thesis, points: card.points || [], evidence: card.evidence || [] },
      null,
      1,
    ),
    '驳回原因：' + (reason || '内容不准确或口径不符'),
    '段落如下（[编号] 正文）：',
    blocksText(picked),
    '输出 JSON：{"card":{"board":"原板块","title":"≤40字","thesis":"≤120字","points":["2-4条"],"evidence":["b12"],"gaps":["0-2条"]}}',
  ].join('\n\n')
  return { system, prompt, picked }
}

function extractJson(text) {
  const raw = String(text || '')
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced ? fenced[1] : raw
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型没有返回 JSON')
  return JSON.parse(body.slice(start, end + 1))
}

function cleanText(value, max) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  return text.slice(0, max)
}

function normalizeEvidence(list, byId) {
  const ids = Array.isArray(list) ? list : []
  const out = []
  for (const item of ids) {
    const id = typeof item === 'string' ? item : item && item.blockId
    const block = byId.get(String(id || '').trim())
    if (!block) continue
    if (out.some((evidence) => evidence.blockId === block.id)) continue
    out.push({ blockId: block.id, quote: String(block.text).slice(0, 160) })
    if (out.length >= 3) break
  }
  return out
}

export function parseCards(text, blocks) {
  const byId = new Map((blocks || []).map((block) => [block.id, block]))
  const data = extractJson(text)
  const rows = Array.isArray(data.cards) ? data.cards : []
  const cards = []
  for (const board of BOARDS) {
    const row = rows.find((item) => item && item.board === board)
    if (!row) continue
    const evidence = normalizeEvidence(row.evidence, byId)
    if (!evidence.length) continue
    const points = (Array.isArray(row.points) ? row.points : []).map((point) => cleanText(point, 80)).filter(Boolean).slice(0, 4)
    const gaps = (Array.isArray(row.gaps) ? row.gaps : []).map((gap) => cleanText(gap, 80)).filter(Boolean).slice(0, 2)
    cards.push({
      board,
      title: cleanText(row.title, 46) || board,
      thesis: cleanText(row.thesis, 150) || cleanText(evidence[0].quote, 150),
      points,
      gaps,
      evidence,
    })
  }
  if (!cards.length) throw new Error('模型返回的卡片没有可用证据')
  return cards
}

export function parseCard(text, blocks) {
  const byId = new Map((blocks || []).map((block) => [block.id, block]))
  const data = extractJson(text)
  const row = data.card
  if (!row || !BOARDS.includes(row.board)) throw new Error('模型没有返回有效卡片')
  const evidence = normalizeEvidence(row.evidence, byId)
  if (!evidence.length) throw new Error('重写后的卡片没有可用证据')
  return {
    board: row.board,
    title: cleanText(row.title, 46) || row.board,
    thesis: cleanText(row.thesis, 150) || cleanText(evidence[0].quote, 150),
    points: (Array.isArray(row.points) ? row.points : []).map((point) => cleanText(point, 80)).filter(Boolean).slice(0, 4),
    gaps: (Array.isArray(row.gaps) ? row.gaps : []).map((gap) => cleanText(gap, 80)).filter(Boolean).slice(0, 2),
    evidence,
  }
}

export function createAi(ctx) {
  const get = typeof ctx.get === 'function' ? (key) => ctx.get(key) : () => undefined
  const llm = get('llm')
  const web = get('web')
  const selectionService = get('agentDefaultModel')

  function selection() {
    try {
      const value = selectionService && selectionService.currentSelection ? selectionService.currentSelection() : null
      if (!value) return {}
      return {
        provider: value.provider || value.providerId || (value.route && value.route.provider) || '',
        model: value.model || value.modelId || (value.route && value.route.model) || '',
      }
    } catch {
      return {}
    }
  }

  function info() {
    const current = selection()
    return { available: Boolean(llm && current.provider && current.model), provider: current.provider, model: current.model, web: Boolean(web) }
  }

  async function target() {
    if (!llm) throw new Error('宿主没有提供 llm 服务')
    const current = selection()
    if (current.provider && current.model) return current
    const providers = await llm.listProviders()
    for (const provider of providers) {
      const models = await llm.listModels(provider.id)
      if (models && models[0]) return { provider: provider.id, model: models[0].id }
    }
    throw new Error('没有可用的模型路由')
  }

  async function complete({ system, prompt, maxTokens = 3000, temperature = 0.2, timeoutMs = 150000 }) {
    const route = await target()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let text = ''
    let blockText = ''
    const stats = { chunks: 0, textDelta: 0, reasoning: 0, blockEnd: 0, finish: '' }
    try {
      const stream = llm.stream({
        provider: route.provider,
        model: route.model,
        system,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        temperature,
        maxTokens,
        signal: controller.signal,
      })
      for await (const chunk of stream) {
        if (!chunk) continue
        stats.chunks += 1
        if (chunk.type === 'text-delta') {
          stats.textDelta += 1
          text += chunk.text || ''
        } else if (chunk.type === 'reasoning-delta') {
          stats.reasoning += 1
        } else if (chunk.type === 'block-end') {
          stats.blockEnd += 1
          if (chunk.block && chunk.block.type === 'text') blockText += chunk.block.text || ''
        } else if (chunk.type === 'finish' && chunk.reason) {
          stats.finish = chunk.reason.kind
          if (chunk.reason.kind === 'error') {
            throw new Error((chunk.reason.failure && chunk.reason.failure.message) || '模型调用失败')
          }
          if (chunk.reason.kind === 'aborted') throw new Error('模型调用已取消或超时')
        }
      }
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('模型调用超时（150s）')
      if (error && error.detail) throw error
      throw Object.assign(new Error((error && error.message) || String(error)), { detail: stats })
    } finally {
      clearTimeout(timer)
    }
    if (!text.trim()) text = blockText
    if (!text.trim()) {
      throw Object.assign(new Error('模型返回空内容（chunks=' + JSON.stringify(stats) + '）'), { detail: stats })
    }
    return text
  }

  async function searchWeb({ query, maxResults = 6 }) {
    const service = web || get('web')
    if (!service) throw new Error('宿主没有提供公开网络检索服务')
    const result = await service.search({ query, maxResults })
    return {
      query,
      content: result.content || '',
      sources: (result.sources || []).map((source) => ({
        url: source.url,
        title: source.title || source.url,
        snippet: source.snippet || source.summary || '',
        publishedAt: source.publishedAt || '',
      })),
      truncated: Boolean(result.truncated),
    }
  }

  return {
    info,
    searchWeb,

    async probe() {
      const text = await complete({
        system: '你是连接测试助手，只回复用户要求的两个字，不要解释。',
        prompt: '只回复：可用',
        maxTokens: 64,
        temperature: 0,
        timeoutMs: 60000,
      })
      return { text }
    },
    async ask(source, { question, quote, page }) {
      const picked = selectBlocks(source.blocks || [], 12000, 90)
      const system = [
        '你是买方（PE/VC/公募）研究助理。',
        '只依据用户给出的资料段落和选中原文回答，不引入外部事实，不编造数字。',
        '回答用中文，3–6 句，直接给结论和口径；每个关键事实后用 [b12] 这样的段落编号标注来源。',
        '资料里没有依据就直说“资料中没有”，不要用常识补。',
      ].join('\n')
      const prompt = [
        '资料标题：' + (source.title || '未命名研报'),
        quote ? '选中原文（第 ' + (page || 1) + ' 页）：\n"""' + quote + '"""' : '',
        '资料摘录：\n' + blocksText(picked),
        '问题：' + question,
      ]
        .filter(Boolean)
        .join('\n\n')
      return complete({ system, prompt, maxTokens: 1200, temperature: 0.2, timeoutMs: 90000 })
    },
    async generate({ title, cards, assets, mode, web: webResearch, documents }) {
      const confirmed = (cards || []).slice(0, 60)
      const docs = (documents || []).slice(0, 6)
      const hasCards = confirmed.length > 0
      const hasDocs = docs.length > 0
      const sources = (webResearch && webResearch.sources ? webResearch.sources : []).slice(0, 8)
      const hasWeb = sources.length > 0 || Boolean(webResearch && webResearch.content)
      const system = [
        '你是买方（PE/VC/公募）研究员，正在写一份中文行业研究报告。',
        '不编造数字，不把常识写成有来源的事实。',
        '输出 Markdown：一级标题、二级章节、必要的小标题和要点；关键判断后标注来源。',
        hasCards ? '来自资料卡片的判断，用（来源：卡片标题）标注。' : '',
        hasDocs ? '来自上传文档的判断，用（来源：文档标题）标注；文档没有覆盖的内容写“文档中没有”，不要用常识补。' : '',
        hasWeb ? '来自公开网络检索的判断，用 [W1]、[W2] 标注，并在文末列出“公开来源与链接”。公开来源优先使用检索结果中的标题和 URL，不得伪造链接。' : '',
        hasWeb && !hasCards && !hasDocs ? '用户没有提供资料卡或上传文档，本报告只依据已授权的公开网络检索结果；检索不足的章节写“公开检索没有找到”。' : '',
        !hasWeb && !hasCards && hasDocs ? '本报告只依据用户选择的上传文档摘录；文档没有覆盖的章节写“文档中没有”。' : '',
        !hasWeb && hasCards && !hasDocs ? '只能使用用户给出的卡片与图表标题，不引入外部事实；卡片没有覆盖的章节写“资料中没有”。' : '',
        !hasWeb && hasCards && hasDocs ? '优先使用资料卡片与上传文档；两者冲突时明确写出冲突，不自行选边。' : '',
        '章节顺序：0 结论与投资含义、1 行业定义与边界、2 需求、3 供给与产能、4 竞争格局与壁垒、5 产业链与价值分配、6 技术路线、7 标的与估值、8 风险与反方。按资料可省略空章节。',
      ].filter(Boolean).join('\n')
      const cardText = confirmed
        .map((card, index) => {
          const points = (card.points || []).map((point) => '  - ' + point).join('\n')
          const evidence = (card.evidence || []).map((item) => '  - [' + item.blockId + '] ' + (item.quote || '')).join('\n')
          return (
            '[' + (index + 1) + '] 板块：' + card.board + '｜标题：' + card.title + '\n' +
            '论点：' + card.thesis + '\n' +
            (points ? '支撑点：\n' + points + '\n' : '') +
            (evidence ? '证据：\n' + evidence : '')
          )
        })
        .join('\n\n')
      const documentText = docs
        .map((doc, index) => {
          const text = String(doc.text || '').slice(0, 7000)
          return '【文档 ' + (index + 1) + '】' + doc.title + (doc.pageCount ? '（' + doc.pageCount + ' 页）' : '') + '\n' + text
        })
        .join('\n\n')
      const assetText = (assets || []).slice(0, 20).map((asset) => '- ' + asset.title + (asset.caption ? '（' + asset.caption + '）' : '')).join('\n')
      const webSources = sources
        .map((source, index) => {
          return '[W' + (index + 1) + '] ' + source.title + '\nURL：' + source.url + '\n' + (source.publishedAt ? '日期：' + source.publishedAt + '\n' : '') + (source.snippet ? '摘要：' + source.snippet : '')
        })
        .join('\n\n')
      const webBody = webResearch && webResearch.content ? String(webResearch.content).slice(0, 12000) : ''
      const prompt = [
        '报告标题：' + (title || '行业研究报告'),
        '写作模式：' + (mode === 'quick' ? '快速初稿' : '深度报告'),
        hasCards ? '用户选择的资料卡片：\n' + (cardText || '（无）') : '',
        hasDocs ? '用户选择的上传文档摘录：\n' + (documentText || '（无）') : '',
        '可引用图表：\n' + (assetText || '（无）'),
        hasWeb ? '公开网络检索查询：' + (webResearch.query || '') : '',
        hasWeb ? '公开网络检索来源：\n' + (webSources || '（无）') : '',
        hasWeb && webBody ? '公开网络检索正文摘录：\n' + webBody : '',
      ]
        .filter((part) => part !== '')
        .join('\n\n')
      return complete({ system, prompt, maxTokens: 4200, temperature: 0.25, timeoutMs: 180000 })
    },


    async analyze(source, instruction) {
      const { system, prompt } = buildAnalyzePrompt(source.blocks, source.title, instruction)
      const text = await complete({ system, prompt })
      return parseCards(text, source.blocks)
    },
    async revise(card, source, reason) {
      const { system, prompt } = buildRevisePrompt(card, source.blocks, reason)
      const text = await complete({ system, prompt, maxTokens: 1600 })
      return parseCard(text, source.blocks)
    },
  }
}
