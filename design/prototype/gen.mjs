// Three warm/handmade map styles + page textures. No text in any SVG (text stays in HTML).
// usage: node gen.mjs <geojson> <outdir>
import fs from 'node:fs'
import path from 'node:path'

const [, , geoPath, outDir] = process.argv
const geo = JSON.parse(fs.readFileSync(geoPath, 'utf8'))
fs.mkdirSync(outDir, { recursive: true })

const progress = {
  中西區: [5, 5], 灣仔區: [3, 5], 東區: [2, 5], 南區: [2, 5], 油尖旺區: [4, 5], 深水埗區: [0, 5],
  九龍城區: [1, 5], 黃大仙區: [0, 4], 觀塘區: [0, 4], 葵青區: [0, 3], 荃灣區: [0, 5], 屯門區: [0, 5],
  元朗區: [0, 5], 北區: [0, 5], 大埔區: [0, 5], 沙田區: [0, 5], 西貢區: [3, 5], 離島區: [1, 6],
}
const level = ([a, b]) => (a === 0 ? 0 : a === b ? 3 : a * 2 >= b ? 2 : 1)

const lat0 = 22.35, kx = Math.cos((lat0 * Math.PI) / 180)
const polys = (f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)
const all = geo.features.flatMap((f) => polys(f).flatMap((p) => p.flat()))
const minX = Math.min(...all.map((p) => p[0] * kx)), maxX = Math.max(...all.map((p) => p[0] * kx))
const minY = Math.min(...all.map((p) => -p[1]))
const W = 390, H = 288, PAD = 8
const s = (W - PAD * 2) / (maxX - minX)
const proj = ([lon, lat]) => [PAD + (lon * kx - minX) * s, PAD + (-lat - minY) * s]
const f2 = (n) => Math.round(n * 100) / 100
const area = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length]; a += x1 * y2 - x2 * y1 } return a / 2 }
const D = geo.features.map((f) => {
  const rings = polys(f).map((p) => p[0].map(proj)).filter((r) => Math.abs(area(r)) > 0.6)
  return { name: f.properties.name, lv: level(progress[f.properties.name]), d: rings.map((r) => 'M' + r.map(([x, y]) => `${f2(x)} ${f2(y)}`).join('L') + 'Z').join('') }
})
const by = (lv) => D.filter((d) => d.lv === lv)
const paths = (list, attrs = '') => list.map((d) => `<path d="${d.d}"${attrs}/>`).join('')
const svg = (w, h, defs, body, vb = `0 0 ${w} ${h}`) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}" viewBox="${vb}"><defs>${defs}</defs>${body}</svg>`
const write = (n, t) => { fs.writeFileSync(path.join(outDir, n), t); console.error(n, t.length) }

// ---------- A 遊歷護照: navy line map, rubber-stamp ink washes ----------
{
  const ink = `<filter id="ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.4 1.75" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>`
  // three-ink system: progress = navy ink density; red only for a completed district
  const tone = ['none', '#2D3E5C', '#2D3E5C', '#B9473A']
  const op = [0, 0.2, 0.48, 0.9]
  // Victoria Harbour (approximate, lon/lat): the simplified district polygons run into the water,
  // so cut the harbour out and redraw its shoreline. Real fix = official land boundaries (M1).
  const harbourLL = [
    [114.108, 22.284], [114.127, 22.2865], [114.140, 22.290], [114.152, 22.2885], [114.160, 22.2875],
    [114.170, 22.2840], [114.180, 22.2845], [114.186, 22.2875], [114.195, 22.2905], [114.205, 22.2935],
    [114.215, 22.2905], [114.225, 22.2860], [114.234, 22.2825], [114.242, 22.2835],
    [114.238, 22.2890], [114.228, 22.3000], [114.222, 22.3070], [114.214, 22.3005], [114.200, 22.3170],
    [114.192, 22.3130], [114.188, 22.3035], [114.180, 22.2965], [114.170, 22.2935], [114.160, 22.2985],
    [114.155, 22.3050], [114.148, 22.3150], [114.140, 22.3200], [114.125, 22.3220], [114.108, 22.3150],
  ]
  const harbour = 'M' + harbourLL.map(proj).map(([x, y]) => `${f2(x)} ${f2(y)}`).join('L') + 'Z'
  const defs = ink + `<mask id="sea"><rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" fill="#fff"/><path d="${harbour}" fill="#000"/></mask>`
  const body =
    `<g mask="url(#sea)">` +
    [1, 2, 3].map((lv) => `<g filter="url(#ink)" fill="${tone[lv]}" fill-opacity="${op[lv]}">${paths(by(lv))}</g>`).join('') +
    `<g fill="none" stroke="#2D3E5C" stroke-width="0.7" stroke-linejoin="round">${paths(D)}</g></g>` +
    `<path d="${harbour}" fill="none" stroke="#2D3E5C" stroke-width="0.7" stroke-linejoin="round" mask="url(#shore)"/>`
  const shore = `<mask id="shore"><rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" fill="#000"/>${paths(D, ' fill="#fff"')}</mask>`
  write('A-map.svg', svg(W, H, defs + shore, body))
  // passport page: fine guilloché-like waves
  let waves = ''
  for (let i = 0; i < 70; i++) {
    const y = 10 + i * 12.2
    let d = `M-10 ${y}`
    for (let x = -10; x <= 400; x += 10) d += `Q${x + 5} ${f2(y + Math.sin((x + i * 13) / 23) * 4)} ${x + 10} ${y}`
    waves += `<path d="${d}"/>`
  }
  write('A-bg.svg', svg(390, 844, '', `<rect width="390" height="844" fill="#F3EDDF"/><g fill="none" stroke="#E4DAC4" stroke-width="0.45">${waves}</g>`))
}

// ---------- B 手帳拼貼: dot grid, pencil outlines, cut-paper pieces ----------
{
  const defs =
    `<filter id="pencil" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.4"/></filter>` +
    `<filter id="paper" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="0.9" dy="1.3" stdDeviation="0.7" flood-color="#5A4632" flood-opacity="0.28"/></filter>` +
    `<linearGradient id="foil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E9C46A"/><stop offset="0.45" stop-color="#F6E3A6"/><stop offset="0.55" stop-color="#D9A441"/><stop offset="1" stop-color="#B9852F"/></linearGradient>` +
    `<pattern id="fiber" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 1.5L6 2.2M0 4.4L6 3.9" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="0.4"/></pattern>`
  const fill = ['none', '#E8D5AE', '#C8865A', 'url(#foil)']
  const body =
    `<g fill="none" stroke="#8C8577" stroke-width="0.6" stroke-linejoin="round" filter="url(#pencil)">${paths(by(0))}</g>` +
    [1, 2, 3].map((lv) => `<g filter="url(#paper)">${paths(by(lv), ` fill="${fill[lv]}"`)}</g><g fill="url(#fiber)">${paths(by(lv))}</g>`).join('') +
    `<g fill="none" stroke="#FFFDF7" stroke-width="0.6" stroke-linejoin="round">${paths(D.filter((d) => d.lv > 0))}</g>`
  write('B-map.svg', svg(W, H, defs, body))
  let dots = ''
  for (let y = 12; y < 844; y += 14) for (let x = 13; x < 390; x += 14) dots += `M${x} ${y}h0.01`
  write('B-bg.svg', svg(390, 844, '', `<rect width="390" height="844" fill="#FBF7EE"/><path d="${dots}" stroke="#D9D0BD" stroke-width="1.5" stroke-linecap="round"/>`))
}

// ---------- C 套色印刷: two-colour riso, halftone density = progress, misregistered outline ----------
{
  const dot = (id, r, step) => `<pattern id="${id}" width="${step}" height="${step}" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><circle cx="${step / 2}" cy="${step / 2}" r="${r}" fill="#E0533D"/></pattern>`
  const grain = `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="1" seed="9" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.6 1.45" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>`
  const defs = dot('h1', 0.62, 2.2) + dot('h2', 0.98, 2.2) + grain
  const fill = ['none', 'url(#h1)', 'url(#h2)', '#E0533D']
  const body =
    `<g filter="url(#grain)">${[1, 2, 3].map((lv) => paths(by(lv), ` fill="${fill[lv]}"`)).join('')}</g>` +
    `<g transform="translate(0.9 0.7)" fill="none" stroke="#2F4C86" stroke-width="0.65" stroke-linejoin="round" filter="url(#grain)" style="mix-blend-mode:multiply">${paths(D)}</g>` +
    `<g transform="translate(0.9 0.7)" fill="none" stroke="#2F4C86" stroke-width="0.5" stroke-dasharray="1.4 1.1">${''}</g>`
  write('C-map.svg', svg(W, H, defs, body))
  write('C-bg.svg', svg(390, 844, `<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 0.35 0 0 0 0 0.3 0 0 0 0 0.25 0 0 0 0.09 0"/></filter>`, `<rect width="390" height="844" fill="#F4EEE2"/><rect width="390" height="844" filter="url(#g)"/>`))
}
