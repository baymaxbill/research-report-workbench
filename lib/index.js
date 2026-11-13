/**
 * 研读台 Host 半边：本地 SQLite + /invest/api 路由。
 *
 * 数据位置：`<DSH_HOME>/invest-workbench/invest.db`
 * 覆盖：`DSH_INVEST_DATA_DIR`（测试与多库隔离用）。
 */
import os from 'node:os'
import path from 'node:path'
import { openStore } from './db.js'
import { createApi } from './api.js'
import { createAi } from './ai.js'

export const inject = ['webServer']

const VERSION = '0.12.11'

function resolveDataDir() {
  const fromEnv = process.env.DSH_INVEST_DATA_DIR
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'invest-workbench')
}

export function apply(ctx) {
  const dataDir = resolveDataDir()
  let store = null
  let storeError = ''
  try {
    store = openStore(dataDir)
  } catch (error) {
    storeError = '无法打开研读台数据库 ' + dataDir + '：' + (error && error.message ? error.message : String(error))
  }

  const ai = createAi(ctx)
  const handler = store
    ? createApi(store, ai)
    : (req, res) => {
        res.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ ok: false, error: { code: 'store_unavailable', message: storeError } }))
      }

  ctx.effect(() => {
    const dispose = ctx.webServer.register({ kind: 'prefix', path: '/invest/api', handler })
    return () => {
      dispose()
      if (store) store.close()
    }
  }, 'invest-workbench: api')

  if (ctx.logger && typeof ctx.logger.info === 'function') {
    ctx.logger.info(
      'invest-workbench v' + VERSION + ' api ready at /invest/api (db: ' + (store ? store.file : storeError) + ')',
    )
  }
}
