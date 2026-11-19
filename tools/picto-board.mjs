// 把章面圖案畫成一張對比板：design/pictos-board.svg（大圖，墨藍）+ 章面大小（紅）。用法：node tools/picto-board.mjs
import fs from 'node:fs'
import { PICTOS } from '../src/lib/pictos.ts'
const ITEMS = [
  ['clock', '參考：尖沙咀鐘樓（原型）'], ['view', '觀景 · 山頂亭'], ['temple', '文化 · 嶺南廟宇'],
  ['harbour', '海濱 · 燈塔'], ['hike', '行山 · 遠足徑標距柱'], ['landmark', '地標 · 摩天樓'],
  ['street', '街區 · 唐樓招牌'], ['nature', '自然 · 白鷺'], ['island', '海島 · 離島碼頭'],
]
const CW = 230, CH = 300, COLS = 3
const cells = ITEMS.map(([k, label], i) => {
  const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH
  const big = `<g transform="translate(${x + 25} ${y + 16}) scale(1.8)" fill="none" stroke="#2D3E5C" stroke-width="${(2.3 / 0.66 / 1.8 * 0.66).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"><path d="${PICTOS[k]}"/></g>`
  const small = `<g transform="translate(${x + 82} ${y + 226}) scale(0.66)" fill="none" stroke="#B9473A" stroke-width="${(2.3 / 0.66).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"><path d="${PICTOS[k]}"/></g>`
  const t = `<text x="${x + CW / 2}" y="${y + 214}" text-anchor="middle" font-family="Noto Sans TC, sans-serif" font-size="13" fill="#5C667A">${label}</text>`
  const frame = i === 0 ? `<rect x="${x + 6}" y="${y + 6}" width="${CW - 12}" height="${CH - 12}" rx="10" fill="none" stroke="#B9473A" stroke-dasharray="4 4"/>` : ''
  return frame + big + t + small
}).join('\n')
const W = CW * COLS, H = CH * Math.ceil(ITEMS.length / COLS)
fs.writeFileSync('design/pictos-board.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#F3EDDF"/>\n${cells}\n</svg>\n`)
console.log('design/pictos-board.svg', W, H)
