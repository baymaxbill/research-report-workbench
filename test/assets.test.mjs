import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { openStore } from '../lib/db.js'
import { createApi } from '../lib/api.js'

async function start() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'invest-assets-'))
  const store = openStore(dir)
  const server = http.createServer(createApi(store))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    dir,
    store,
    base: 'http://127.0.0.1:' + server.address().port + '/invest/api',
    async close() {
      await new Promise((resolve) => server.close(resolve))
      store.close()
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

test('assets: create table, edit data, list and delete', async () => {
  const app = await start()
  try {
    const source = (
      await (
        await fetch(app.base + '/sources', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'paste', title: '测试', text: '冷板式单柜价值量 8–12 万元。' }),
        })
      ).json()
    ).source

    const created = await (
      await fetch(app.base + '/assets/table', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceId: source.id,
          title: '单柜价值量拆分',
          caption: '冷板式单柜价值量（万元）',
          columns: ['环节', '价值量', '占比'],
          rows: [
            ['冷板', '4.5', '45%'],
            ['快接头', '2.0', '20%'],
            ['CDU', '3.5', '35%'],
          ],
          chartType: 'bar',
        }),
      })
    ).json()
    assert.ok(created.asset.id)
    assert.equal(created.asset.kind, 'table')
    assert.equal(created.asset.data.rows.length, 3)
    assert.equal(created.asset.chartType, 'bar')

    const list = await (await fetch(app.base + '/assets?source_id=' + source.id)).json()
    assert.equal(list.assets.length, 1)

    const patched = await (
      await fetch(app.base + '/assets/' + created.asset.id, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: '改过的标题', data: { columns: ['A'], rows: [['1']] } }),
      })
    ).json()
    assert.equal(patched.asset.title, '改过的标题')
    assert.equal(patched.asset.data.rows[0][0], '1')

    const health = await (await fetch(app.base + '/health')).json()
    assert.equal(health.counts.assets, 1)

    await fetch(app.base + '/assets/' + created.asset.id, { method: 'DELETE' })
    const empty = await (await fetch(app.base + '/assets')).json()
    assert.equal(empty.assets.length, 0)
  } finally {
    await app.close()
  }
})

test('assets: figure image round-trip', async () => {
  const app = await start()
  try {
    const source = (
      await (
        await fetch(app.base + '/sources', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'paste', title: '测试', text: '图表页。' }),
        })
      ).json()
    ).source

    const canvas = createCanvas(40, 30)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#123B4A'
    ctx.fillRect(0, 0, 40, 30)
    const base64 = canvas.toBuffer('image/png').toString('base64')

    const created = await (
      await fetch(app.base + '/assets/figure', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceId: source.id,
          page: 3,
          title: '图 3 渗透率',
          caption: '液冷渗透率（2023–2028E，%）',
          image: 'data:image/png;base64,' + base64,
        }),
      })
    ).json()
    assert.equal(created.asset.kind, 'figure')
    assert.equal(created.asset.hasImage, true)

    const image = await fetch(app.base + '/assets/' + created.asset.id + '/image')
    assert.equal(image.status, 200)
    assert.equal(image.headers.get('content-type'), 'image/png')
    assert.ok((await image.arrayBuffer()).byteLength > 100)
  } finally {
    await app.close()
  }
})

test('page render rejects sources without an original PDF', async () => {
  const app = await start()
  try {
    const source = (
      await (
        await fetch(app.base + '/sources', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'paste', title: '测试', text: '没有原文。' }),
        })
      ).json()
    ).source
    const res = await fetch(app.base + '/sources/' + source.id + '/page/1')
    assert.equal(res.status, 400)
    const body = await res.json()
    assert.match(body.error.message, /没有保存原文件/)
  } finally {
    await app.close()
  }
})
