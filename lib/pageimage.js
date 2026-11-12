/**
 * 把已保存的 PDF 指定页渲染为 PNG，供「图表工坊」截取。
 * pdfjs 负责解析与绘制指令，@napi-rs/canvas 提供 Node 侧画布。
 */
import fs from 'node:fs'
import path from 'node:path'
import { extractPageLayout } from './pdftext.js'

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

export async function renderSourcePage(store, sourceId, pageNumber) {
  const page = Math.max(1, Math.floor(Number(pageNumber) || 1))
  const file = store.getSourceFile(sourceId)
  if (!file) throw new Error('这份资料没有保存原文件，无法渲染原文页')
  const cacheDir = path.join(store.dir, 'files', 'pages')
  fs.mkdirSync(cacheDir, { recursive: true })
  const cachePath = path.join(cacheDir, sourceId + '-p' + page + '.png')
  if (fs.existsSync(cachePath)) return cachePath

  const { canvas, pdfjs } = await load()
  const data = fs.readFileSync(file.path)
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise
  try {
    if (page > doc.numPages) throw new Error('页码超出范围（共 ' + doc.numPages + ' 页）')
    const pdfPage = await doc.getPage(page)
    const viewport = pdfPage.getViewport({ scale: 2 })
    const width = Math.ceil(viewport.width)
    const height = Math.ceil(viewport.height)
    const target = canvas.createCanvas(width, height)
    const context = target.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    await pdfPage.render({ canvasContext: context, viewport }).promise
    fs.writeFileSync(cachePath, target.toBuffer('image/png'))
    pdfPage.cleanup()
    return cachePath
  } finally {
    await doc.destroy()
  }
}


export async function renderSourcePageLayout(store, sourceId, pageNumber) {
  const page = Math.max(1, Math.floor(Number(pageNumber) || 1))
  const file = store.getSourceFile(sourceId)
  if (!file) throw new Error('这份资料没有保存原文件，无法读取文字层')
  const cacheDir = path.join(store.dir, 'files', 'pages')
  fs.mkdirSync(cacheDir, { recursive: true })
  const cachePath = path.join(cacheDir, sourceId + '-p' + page + '.json')
  if (fs.existsSync(cachePath)) {
    try {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'))
    } catch {
      /* rebuild corrupt cache */
    }
  }
  const layout = await extractPageLayout(fs.readFileSync(file.path), page)
  fs.writeFileSync(cachePath, JSON.stringify(layout))
  return layout
}
