// 景點數據的共用小工具：讀 spots.csv、算距離
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const CSV = path.join(root, 'data', 'spots.csv')

/** 最簡單的 CSV 解析（支援雙引號包住含逗號的欄） */
export function parseCsv(text) {
  const rows = []
  let row = [], cell = '', q = false
  text = text.replace(/^﻿/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x !== '')) rows.push(row)
  const [head, ...body] = rows
  return { head, rows: body.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()]))) }
}

export function toCsv(head, rows) {
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  return '﻿' + [head, ...rows.map((r) => head.map((h) => r[h] ?? ''))].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n'
}

/** 按 CSV 的行序給 id：s001、s002…（跟現有 spots.json 一致） */
export function readSpots() {
  const { rows } = parseCsv(fs.readFileSync(CSV, 'utf8'))
  return rows.map((r, i) => ({
    id: 's' + String(i + 1).padStart(3, '0'),
    district: r['區'],
    area: r['小地名'],
    name: r['景點'],
    tip: r['一句推薦'],
    lat: Number(r['緯度']),
    lng: Number(r['經度']),
    kind: r['類型'],
    verified: r['座標已核對'] === '是',
    shape: r['範圍'] ?? '',
    radius: r['範圍米'] ? Number(r['範圍米']) : 0,
  }))
}

/** 兩點距離（米） */
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000, toR = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * toR) / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(((lng2 - lng1) * toR) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** 查 OpenStreetMap（Overpass）。用 curl：Node 自帶的 fetch 遇到 overpass-api.de 某台伺服器連不上時不會換另一台 */
import { execFileSync } from 'node:child_process'
import os from 'node:os'
export async function overpass(q) {
  const tmp = path.join(os.tmpdir(), `overpass-${process.pid}.txt`)
  fs.writeFileSync(tmp, q)
  for (let i = 0; i < 5; i++) {
    try {
      const out = execFileSync('curl', ['-s', '-f', '-m', '120', '-A', 'light-up-hk-data-check/0.1', '--data-urlencode', `data@${tmp}`, 'https://overpass-api.de/api/interpreter'], { maxBuffer: 1 << 28 })
      return JSON.parse(out.toString('utf8')).elements
    } catch {
      await new Promise((r) => setTimeout(r, 5000 * (i + 1)))
    }
  }
  throw new Error('Overpass 查詢失敗')
}
