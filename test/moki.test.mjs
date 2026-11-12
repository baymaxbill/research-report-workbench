import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { openStore } from '../lib/db.js'
import { listMokiItems, importMokiSource, exportSourceToMoki } from '../lib/moki.js'

function makeMoki(dir, exportDir) {
  fs.mkdirSync(dir, { recursive: true })
  fs.mkdirSync(exportDir, { recursive: true })
  const db = new DatabaseSync(path.join(dir, 'library.sqlite'))
  db.exec(`
    CREATE TABLE resource_library_items (
      id TEXT PRIMARY KEY, parent_id TEXT, kind TEXT NOT NULL, name TEXT NOT NULL, target TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]', folder_color TEXT, assistant_permission TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0, file_created_at TEXT, file_modified_at TEXT,
      thumbnail_data_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `)
  const now = new Date().toISOString()
  const insert = db.prepare(
    'INSERT INTO resource_library_items (id,parent_id,kind,name,target,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
  )
  insert.run('folder-virtual', null, 'folder', '研报-AI赛道', null, now, now)
  insert.run('folder-export', null, 'local_folder', '研读台输出', exportDir, now, now)
  const sample = path.join(dir, 'sample.md')
  fs.writeFileSync(sample, '# 测试研报\n\n冷板式单柜价值量 8–12 万元。\n', 'utf8')
  insert.run('file-1', 'folder-virtual', 'local_file', '测试研报', sample, now, now)
  db.close()
}

test('MOKI: list, import and export via file layer', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moki-bridge-'))
  const mokiDir = path.join(root, 'moki')
  const exportDir = path.join(root, 'export')
  const appDir = path.join(root, 'app')
  makeMoki(mokiDir, exportDir)
  process.env.MOKI_LIBRARY_DB = path.join(mokiDir, 'library.sqlite')
  const store = openStore(appDir)
  try {
    const listing = listMokiItems()
    assert.equal(listing.available, true)
    assert.equal(listing.files.length, 1)
    assert.equal(listing.files[0].name, '测试研报')
    assert.equal(listing.files[0].ext, '.md')
    assert.equal(listing.folders.length, 1)

    const imported = await importMokiSource(store, 'file-1')
    assert.equal(imported.source.mokiId, 'file-1')
    assert.equal(imported.source.title, '测试研报')
    assert.ok(imported.source.blocks.some((block) => /冷板式/.test(block.text)))
    const again = await importMokiSource(store, 'file-1')
    assert.equal(again.existing, true)

    const exported = exportSourceToMoki(store, imported.source.id, 'folder-export')
    assert.ok(exported.files.includes('正文.md'))
    assert.ok(exported.files.includes('manifest.json'))
    const body = fs.readFileSync(path.join(exported.path, '正文.md'), 'utf8')
    assert.match(body, /冷板式单柜价值量/)
    const manifest = JSON.parse(fs.readFileSync(path.join(exported.path, 'manifest.json'), 'utf8'))
    assert.equal(manifest.sourceId, imported.source.id)
  } finally {
    store.close()
    delete process.env.MOKI_LIBRARY_DB
    fs.rmSync(root, { recursive: true, force: true })
  }
})
