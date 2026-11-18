// 乙 · 鋼印凸紋 interactive board + local test harness. usage: node gen-emboss.mjs <projectDir> <renderDir>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const [, , out, rdir] = process.argv
const logic = fs.readFileSync(path.join(here, 'emboss-logic.js'), 'utf8')
const RED = '#B9473A', NAVY = '#2D3E5C', PAPER = '#F3EDDF', SUB = '#5C667A', LINE = '#C1C1BE'
const r2 = (n) => Math.round(n * 100) / 100

const clock = `<path d="M50 3V11M44 24L50 11L56 24Z"></path><rect x="42" y="24" width="16" height="10"></rect><rect x="39" y="34" width="22" height="48"></rect><circle cx="50" cy="46" r="6.5"></circle><path d="M50 46V41.5M50 46L53.5 48"></path><path d="M43 60H57M43 66H57"></path><path d="M45 82V75A5 5 0 0 1 55 75V82"></path><path d="M61 82H90M68 82V75H83V82M14 82H39M22 82V77H33V82"></path><path d="M6 90Q12 86 18 90T30 90T42 90T54 90T66 90T78 90T90 90T96 90"></path><path d="M18 97Q24 93 30 97T42 97T54 97T66 97T78 97"></path>`
const picto = (x, y, s, sw) => `<g transform="translate(${x} ${y}) scale(${s})" stroke-width="${r2(sw / s)}" stroke-linecap="round" stroke-linejoin="round">${clock}</g>`
const octBody = (date, n, c) => {
  const [y, m, d] = date.split('.')
  const oct = (i) => `M${30 - i * 0.4} ${4 + i}H${180 + i * 0.4}L${206 - i} ${30 - i * 0.4}V${140 + i * 0.4}L${180 + i * 0.4} ${166 - i}H${30 - i * 0.4}L${4 + i} ${140 + i * 0.4}V${30 - i * 0.4}Z`
  return `<g fill="none" stroke="${c}"><path d="${oct(0)}" stroke-width="4" stroke-linejoin="round"></path><path d="${oct(7)}" stroke-width="1.1" stroke-linejoin="round"></path><path d="M24 44H186M24 124H186" stroke-width="0.9"></path><path d="M93 54V114" stroke-width="0.9"></path>${picto(24, 50, 0.66, 2.3)}</g><g fill="${c}"><text x="105" y="34" text-anchor="middle" font-family="Noto Sans TC, sans-serif" font-weight="700" font-size="10.5" letter-spacing="4">油尖旺 · 已抵達</text><text x="102" y="70" font-family="Noto Sans TC, sans-serif" font-weight="700" font-size="12" letter-spacing="4">${y}</text><text x="100" y="108" font-family="Noto Sans TC, sans-serif" font-weight="900" font-size="28" letter-spacing="-0.5">${m}·${d}</text><text x="105" y="150" text-anchor="middle" font-family="Noto Serif TC, serif" font-weight="900" font-size="16" letter-spacing="4">尖沙咀鐘樓</text><text x="178" y="70" text-anchor="end" font-family="Noto Sans TC, sans-serif" font-weight="500" font-size="9" letter-spacing="1">No.${n}</text></g>`
}
const inkDefs = (k, seed, ang) => `<filter id="ink${k}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="${seed}" result="n"></feTurbulence><feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" result="d"></feDisplacementMap><feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="1" seed="${seed + 5}" result="n2"></feTurbulence><feColorMatrix in="n2" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2 1.85" result="m"></feColorMatrix><feComposite in="d" in2="m" operator="in"></feComposite></filter><linearGradient id="pg${k}" gradientTransform="rotate(${ang} .5 .5)"><stop offset="0" stop-color="#fff"></stop><stop offset=".5" stop-color="#fff" stop-opacity=".95"></stop><stop offset="1" stop-color="#fff" stop-opacity=".55"></stop></linearGradient><mask id="pm${k}"><rect width="210" height="170" fill="url(#pg${k})"></rect></mask>`
const svg = (inner, defs = '') => `<svg width="210" height="170" viewBox="0 0 210 170" style="position: absolute; left: 10px; top: 10px; overflow: visible" aria-hidden="true">${defs ? `<defs>${defs}</defs>` : ''}${inner}</svg>`
const inked = (k, date, n, seed, ang) => svg(`<g mask="url(#pm${k})"><g filter="url(#ink${k})">${octBody(date, n, RED)}</g></g>`, inkDefs(k, seed, ang))
const NEWD = '2026.11.18', NEWN = 23

// --- shared geometry: relief, wet ink and dry ink all use the SAME displacement (seed 7, scale 1.8),
// so the red lands exactly on the white relief lines (no shift at the click) ---
const WET = '#B5231A', DRY = '#B9473A'
const turb = '<feOffset in="SourceGraphic" dx="0" dy="0" result="d"></feOffset>'
const dispF = (id) => `<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%">${turb}</filter>`
const blurDispF = (id) => `<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%">${turb}<feGaussianBlur in="d" stdDeviation="0.4"></feGaussianBlur></filter>`
// ink texture: a = how much paper grain shows through (dry shows more); wet also gets a thin glossy rim on the upper-left edge of each stroke
const inkF = (id, wet) => `<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">${turb}<feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="1" seed="12" result="n2"></feTurbulence><feColorMatrix in="n2" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${wet ? '0 1' : '-1.6 1.85'}" result="m"></feColorMatrix><feComposite in="d" in2="m" operator="in" result="t"></feComposite>${false ? '<feOffset in="d" dx="0.7" dy="0.8" result="o"></feOffset><feComposite in="d" in2="o" operator="out" result="rim"></feComposite><feFlood flood-color="#FBD8CF" result="fl"></feFlood><feComposite in="fl" in2="rim" operator="in" result="rc"></feComposite><feComponentTransfer in="rc" result="rs"><feFuncA type="linear" slope="1"></feFuncA></feComponentTransfer><feMerge><feMergeNode in="t"></feMergeNode><feMergeNode in="rs"></feMergeNode></feMerge>' : ''}</filter>`
const pressure = (id) => `<linearGradient id="g${id}" gradientTransform="rotate(35 .5 .5)"><stop offset="0" stop-color="#fff"></stop><stop offset=".5" stop-color="#fff" stop-opacity=".98"></stop><stop offset="1" stop-color="#fff" stop-opacity=".9"></stop></linearGradient><mask id="${id}"><rect width="210" height="170" fill="url(#g${id})"></rect></mask>`
// drying order map: horizontal "paper fibre" noise, biased so thin lines / edges dry first and thick strokes (11·18, border) last.
// Each dry layer only covers the area whose value is above its threshold; layers fade in one after another.
const dryMaskF = (id, thr) => `<filter id="${id}" filterUnits="userSpaceOnUse" x="-10" y="-10" width="230" height="190" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="th"></feGaussianBlur><feTurbulence type="fractalNoise" baseFrequency="0.035 0.12" numOctaves="3" seed="21" result="nz"></feTurbulence><feColorMatrix in="nz" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0" result="na"></feColorMatrix><feComposite in="na" in2="th" operator="arithmetic" k1="0" k2="0.85" k3="-0.9" k4="0.42" result="v"></feComposite><feComponentTransfer in="v" result="a"><feFuncA type="linear" slope="10" intercept="${r2(-10 * thr)}"></feFuncA></feComponentTransfer><feFlood flood-color="#fff" result="w"></feFlood><feComposite in="w" in2="a" operator="in"></feComposite></filter>`
const THR = [0.6, 0.52, 0.44, 0.36, 0.28, 0.18, null]
// A dry patch first paints the relief-face colour over the stroke (so the wet ink underneath is hidden),
// then the grainy dry ink on top: the gaps in the grain show paper, not wet ink.
const inkLayer = (id, wet, thr) => {
  const ink = `<g mask="url(#p${id})"><g filter="url(#f${id})">${octBody(NEWD, NEWN, wet ? WET : DRY)}</g></g>`
  const body = wet ? ink : `<g filter="url(#c${id})">${octBody(NEWD, NEWN, '#EEE6D4')}</g>${ink}`
  const defs = inkF(`f${id}`, wet) + pressure(`p${id}`) + (wet ? '' : dispF(`c${id}`)) +
    (thr == null ? '' : dryMaskF(`dmf${id}`, thr) + `<mask id="dm${id}" maskUnits="userSpaceOnUse" x="-10" y="-10" width="230" height="190"><g filter="url(#dmf${id})">${octBody(NEWD, NEWN, '#000')}</g></mask>`)
  return svg(thr == null ? body : `<g mask="url(#dm${id})">${body}</g>`, defs)
}
// the earlier (dry) stamp from 2026.03.08
const oldDry = svg(`<g mask="url(#pgOld)"><g filter="url(#fgOld)">${octBody('2026.03.08', 12, DRY)}</g></g>`, inkF('fgOld', false).replace('seed="7"', 'seed="11"') + pressure('pgOld'))

const html = `<!doctype html>
<html lang="zh-Hant-HK">
<head>
<meta charset="utf-8">
<title>方案 A · 蓋章 乙 · 鋼印凸紋</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&amp;family=Noto+Serif+TC:wght@700;900&amp;display=swap">
<style>
body{margin:0}
a{color:${NAVY}}a:hover{color:#1E2B3C}
.stage{touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent}
.stage:focus-visible{box-shadow:inset 0 0 0 2px ${NAVY}}
.ph-done.stage{cursor:default}
.lay{position:absolute;left:0;top:0;width:230px;height:190px}
.stamp{position:absolute;left:0;top:0;width:230px;height:190px;transform-origin:115px 95px;will-change:transform}
.emb,.ink,.dry{opacity:0.001;will-change:opacity}
.shadow,.hi{will-change:transform,opacity;opacity:0.001}
.dent{opacity:0;will-change:opacity,transform}
.touch{opacity:0;transition:opacity .2s}
.hint{transition:opacity .2s ease}
.ph-press .hint{opacity:0;transition:opacity .12s ease}
.hint.first{color:#1E2B3C}
.hint.later{font-size:12px!important;opacity:.7}
.guide{transition:opacity .15s ease}
.ph-press .guide{opacity:0}
@keyframes guidePress{0%,18%{transform:scale(1);opacity:.55}45%{transform:scale(.8);opacity:1}60%{transform:scale(.8);opacity:1}82%,100%{transform:scale(1);opacity:.55}}
@keyframes guideRing{0%,40%{transform:scale(.8);opacity:0}55%{opacity:.5}100%{transform:scale(1.9);opacity:0}}
.guide .dot{animation:guidePress 2.2s cubic-bezier(.4,0,.2,1) infinite}
.guide .ring{animation:guideRing 2.2s cubic-bezier(.2,.6,.3,1) infinite}
@media (prefers-reduced-motion: reduce){.guide .dot,.guide .ring{animation:none}}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.rise{animation:rise .6s .3s cubic-bezier(.2,.7,.2,1) both}
@media (prefers-reduced-motion: reduce){.rise{animation-duration:1ms;animation-delay:0s}}
</style>
</helmet>
<div style="width: 390px; height: 844px; position: relative; overflow: hidden; font-family: 'Noto Sans TC', 'PingFang HK', sans-serif; color: #1E2B3C; background: ${PAPER}">
<img src="/_blob/b9a55d4f8c2cc0e6b01877e2eda54444" alt="" style="position: absolute; left: 0; top: 0; width: 390px; height: 844px">

<div style="position: absolute; left: 8px; right: 20px; top: 44px; display: flex; align-items: center; justify-content: space-between">
<a href="A-Home.dc.html" aria-label="返回地圖" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1E2B3C" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg></a>
<span style="font-size: 11px; letter-spacing: 5px; color: ${NAVY}">遊歷護照 · 第 12 頁</span>
</div>

<div style="position: absolute; left: 24px; right: 24px; top: 100px; display: flex; flex-direction: column; gap: 4px">
<span style="font-size: 13px; color: ${SUB}">你已到達</span>
<h1 style="margin: 0; font-family: 'Noto Serif TC', 'PMingLiU', serif; font-weight: 900; font-size: 27px; letter-spacing: 2px">尖沙咀鐘樓 · 星光大道</h1>
<span style="font-size: 13px; color: ${SUB}">尖沙咀 · 油尖旺 · 距離 24 米 · 第 2 次來</span>
</div>

<div class="stage ph-{{phase}}" ref="{{rStage}}" role="button" tabIndex="0" aria-label="按住蓋章：尖沙咀鐘樓" onPointerDown="{{down}}" onPointerUp="{{up}}" onPointerCancel="{{up}}" onLostPointerCapture="{{up}}" onKeyDown="{{keyDown}}" onKeyUp="{{keyUp}}" onContextMenu="{{noMenu}}" style="position: absolute; left: 16px; right: 16px; top: 196px; height: 360px; border-top: 1px solid ${LINE}; border-bottom: 1px solid ${LINE}">
<div aria-hidden="true" style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; pointer-events: none">
<div class="lay" style="transform: translate(112px, 92px) rotate(9deg); opacity: 0.4">${oldDry}</div>
<div class="dent" ref="{{rDent}}" style="position: absolute; left: 0; top: 0; width: 260px; height: 260px; border-radius: 50%; background: radial-gradient(circle at 50% 52%, rgba(30, 43, 60, 0.11) 0%, rgba(30, 43, 60, 0.05) 38%, rgba(30, 43, 60, 0) 70%)"></div>
<div class="stamp" ref="{{rStamp}}">
<div class="emb lay" ref="{{rEmb}}">
<div class="shadow lay" ref="{{rShadow}}">${svg(`<g filter="url(#gEs)">${octBody(NEWD, NEWN, '#1E2B3C')}</g>`, blurDispF('gEs'))}</div>
<div class="hi lay" ref="{{rHi}}">${svg(`<g filter="url(#gEh)">${octBody(NEWD, NEWN, '#FFFFFF')}</g>`, dispF('gEh'))}</div>
<div class="lay">${svg(`<g filter="url(#gEf)">${octBody(NEWD, NEWN, '#EEE6D4')}</g>`, dispF('gEf'))}</div>
</div>
<div class="ink lay" ref="{{rInk}}">
<div class="lay">${inkLayer('gW', true, null)}</div>
${THR.map((t, i) => `<div class="dry lay">${inkLayer(`gD${i}`, false, t)}</div>`).join('\n')}
</div>
</div>
<div class="touch" ref="{{rTouch}}" style="position: absolute; left: 0; top: 0; width: 44px; height: 44px; border-radius: 50%; border: 1px solid rgba(45, 62, 92, 0.25); box-sizing: border-box"></div>
</div>
<sc-if value="{{showGuide}}" hint-placeholder-val="{{ true }}">
<div class="guide" aria-hidden="true" style="position: absolute; left: 40px; top: 70px; width: 64px; height: 64px; pointer-events: none">
<span class="ring" style="position: absolute; left: 0; top: 0; width: 64px; height: 64px; border-radius: 50%; border: 1.5px solid ${NAVY}; box-sizing: border-box"></span>
<span class="dot" style="position: absolute; left: 12px; top: 12px; width: 40px; height: 40px; border-radius: 50%; background: rgba(45, 62, 92, 0.1); border: 1.5px solid rgba(45, 62, 92, 0.55); box-sizing: border-box"></span>
</div>
<span class="hint first" aria-live="polite" style="position: absolute; left: 0; right: 0; bottom: 12px; text-align: center; font-size: 14px; line-height: 1.6">第一次蓋章<br><span style="color: ${SUB}">按住紙上任何地方，壓到底就蓋好</span></span>
</sc-if>
<sc-if value="{{showLater}}" hint-placeholder-val="{{ false }}">
<span class="hint later" style="position: absolute; left: 0; right: 0; bottom: 14px; text-align: center; font-size: 12px; color: ${SUB}">按住紙面蓋章</span>
</sc-if>
</div>

<sc-if value="{{done}}" hint-placeholder-val="{{ false }}">
<div class="rise" style="position: absolute; left: 24px; right: 24px; top: 574px; display: flex; flex-direction: column; gap: 6px">
<div style="display: flex; align-items: baseline; gap: 14px"><span style="font-family: 'Noto Serif TC', serif; font-weight: 900; font-size: 22px; white-space: nowrap">油尖旺 3 / 5</span><span style="font-size: 13px; color: ${SUB}; white-space: nowrap">這一頁第 2 個章 · 上次 2026.03.08</span></div>
<span style="font-size: 13px; color: ${SUB}">每來一次就多一個章。集齊 5 個景點，油尖旺會變紅。</span>
</div>
</sc-if>

<div style="position: absolute; left: 20px; right: 20px; bottom: 36px; display: flex; flex-direction: column; gap: 10px; align-items: stretch">
<sc-if value="{{notDone}}" hint-placeholder-val="{{ true }}">
<span style="text-align: center; font-size: 12px; color: ${SUB}">定位只在你按下去的那一刻讀一次</span>
</sc-if>
<sc-if value="{{done}}" hint-placeholder-val="{{ false }}">
<div class="rise" style="display: flex; flex-direction: column; gap: 10px">
<button type="button" style="height: 52px; border: 1.5px dashed ${NAVY}; border-radius: 14px; background: rgba(251, 248, 240, 0.8); color: #1E2B3C; font-family: inherit; font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"></path><circle cx="12" cy="13" r="3.5"></circle></svg>拍一張照片，貼在印章旁邊</button>
<div style="display: flex; gap: 10px">
<button type="button" onClick="{{reset}}" style="flex: 1; height: 52px; border: 1.5px solid ${NAVY}; border-radius: 14px; background: transparent; color: ${NAVY}; font-family: inherit; font-size: 15px; cursor: pointer">再試一次（示範）</button>
<a href="A-Home.dc.html" style="flex: 1; height: 52px; border-radius: 14px; background: ${NAVY}; color: #FFFFFF; font-size: 15px; font-weight: 700; text-decoration: none; display: flex; align-items: center; justify-content: center">返回地圖</a>
</div>
</div>
</sc-if>
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844},"holdMs":{"editor":"range","default":700,"min":400,"max":1200,"step":50,"unit":"ms","section":"蓋章手感"},"alwaysGuide":{"editor":"boolean","default":false,"section":"蓋章手感"},"inkBuild":{"editor":"boolean","default":true,"section":"蓋章手感"}}'>
${logic}</script>
</body>
</html>
`
fs.writeFileSync(path.join(out, 'A-Emboss.dc.html'), html)

// ---- local harness: same markup + same logic, with a tiny stand-in for the DC runtime ----
let h = html.replace('/_blob/b9a55d4f8c2cc0e6b01877e2eda54444', 'assets/A-bg.svg')
  .replace(/<script src="\.\/support\.js"><\/script>/, '')
  .replace(/<\/?x-dc>|<\/?helmet>/g, '')
  .replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, '')
  .replace(/ ref="\{\{(\w+)\}\}"/g, ' data-ref="$1"')
  .replace(/ on([A-Z]\w+)="\{\{(\w+)\}\}"/g, (_, ev, fn) => ` data-on-${ev.toLowerCase()}="${fn}"`)
  .replace(/<sc-if value="\{\{(\w+)\}\}"[^>]*>/g, '<div data-if="$1" style="display: contents">').replace(/<\/sc-if>/g, '</div>')
  .replace('{{hint}}', '<span data-hole="hint"></span>')
  .replace('class="stage ph-{{phase}}"', 'class="stage" data-phase')
h = h.replace('</body>', `<script>
class DCLogic { constructor(p) { this.props = p || {}; this.state = {}; } setState(s) { Object.assign(this.state, s); window.__render(); } }
${logic}
const c = new Component({});
window.__c = c;
window.__render = () => {
  const v = c.renderVals();
  document.querySelector('[data-phase]').className = 'stage ph-' + v.phase;
  document.querySelectorAll('[data-if]').forEach((n) => { n.style.display = v[n.dataset.if] ? 'contents' : 'none'; });
  document.querySelectorAll('[data-hole]').forEach((n) => { n.textContent = v[n.dataset.hole]; });
};
if (c.componentDidMount) c.componentDidMount();
const v0 = c.renderVals();
document.querySelectorAll('[data-ref]').forEach((n) => v0[n.dataset.ref](n));
const map = { pointerdown: 'down', pointerup: 'up', pointercancel: 'up', lostpointercapture: 'up', keydown: 'keyDown', keyup: 'keyUp', contextmenu: 'noMenu', click: 'reset' };
document.querySelectorAll('*').forEach((n) => { for (const a of n.getAttributeNames()) if (a.startsWith('data-on-')) { const ev = a.slice(8); n.addEventListener(ev, (e) => c.renderVals()[n.getAttribute(a)](e)); } });
window.__render();
</script></body>`)
fs.writeFileSync(path.join(rdir, 'emboss.html'), h)

const cj = JSON.parse(fs.readFileSync(path.join(out, 'canvas.json'), 'utf8'))
cj.boards['A-Emboss.dc.html'] = { x: 470, y: 2892, w: 390, h: 844, title: 'A · 蓋章 乙：鋼印凸紋（按住試試）', is_interactive: true }
if (!cj.order.includes('A-Emboss.dc.html')) cj.order.push('A-Emboss.dc.html')
fs.writeFileSync(path.join(out, 'canvas.json'), JSON.stringify(cj, null, 2) + '\n')
console.log('ok')
