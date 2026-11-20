// 八角入境章的章面，以及蓋章動畫用到的各層（移植自 design/prototype/gen-emboss.mjs，以原型為準）。
//
// 章面 210 × 170：頂「區名 · 已抵達」、左邊簡筆圖案、右邊年份 + No. + 大字「月·日」、底下景點名。
// 線條銳利乾淨：凸紋、濕墨、乾墨用同一個幾何（不加位移濾鏡），紅墨正好落在凸紋上，咔嗒時不會錯位。
import { useId, type CSSProperties } from 'react'
import { PICTOS, pictoFor } from '../lib/pictos'

export interface FaceData {
  /** 區名簡稱，例如「油尖旺」「東區」 */
  district: string
  year: string
  month: string
  day: string
  /** 「23」或「測試」 */
  no: string
  name: string
  kind: string
  /** 景點編號：有專屬圖案的景點（例如尖沙咀鐘樓）靠它認 */
  spotId?: string
}

export const WET = '#B5231A'
export const DRY = '#B9473A'
const FACE = '#EEE6D4' // 凸紋表面的紙色（比紙略深）
const SANS = "'Noto Sans TC', sans-serif"
const SERIF = "'Noto Serif TC', serif"

const oct = (i: number) =>
  `M${30 - i * 0.4} ${4 + i}H${180 + i * 0.4}L${206 - i} ${30 - i * 0.4}V${140 + i * 0.4}L${180 + i * 0.4} ${166 - i}H${30 - i * 0.4}L${4 + i} ${140 + i * 0.4}V${30 - i * 0.4}Z`

/**
 * 景點名太長時縮小字。章底那一行在八角框裏，留足邊距最多約 140 像素寬：
 * 估計寬度超過就按比例縮小字號，並用 textLength 把整行壓到剛好 140，保證不碰框。
 */
const NAME_MAX = 140
function fitName(name: string) {
  const chars = [...name]
  const em = chars.reduce((a, ch) => a + (ch === ' ' ? 0.3 : ch.charCodeAt(0) < 0x250 ? 0.6 : 1), 0)
  const width = em * 16 + (chars.length - 1) * 4
  if (width <= NAME_MAX) return { size: 16, spacing: 4, length: undefined }
  const k = Math.max(0.7, NAME_MAX / width)
  return { size: Math.round(16 * k * 10) / 10, spacing: 1, length: NAME_MAX }
}

/** 章面本身（線 + 字），用指定顏色畫 */
export function FaceBody({ f, c }: { f: FaceData; c: string }) {
  const n = fitName(f.name)
  return (
    <>
      <g fill="none" stroke={c}>
        <path d={oct(0)} strokeWidth={4} strokeLinejoin="round" />
        <path d={oct(7)} strokeWidth={1.1} strokeLinejoin="round" />
        <path d="M24 44H186M24 124H186" strokeWidth={0.9} />
        <path d="M93 54V114" strokeWidth={0.9} />
        <g transform="translate(24 50) scale(0.66)" strokeWidth={2.3 / 0.66} strokeLinecap="round" strokeLinejoin="round">
          <path d={PICTOS[pictoFor(f.kind, f.spotId)]} />
        </g>
      </g>
      <g fill={c}>
        <text x={105} y={34} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={10.5} letterSpacing={4}>
          {f.district} · 已抵達
        </text>
        <text x={102} y={70} fontFamily={SANS} fontWeight={700} fontSize={12} letterSpacing={4}>
          {f.year}
        </text>
        <text x={100} y={108} fontFamily={SANS} fontWeight={900} fontSize={28} letterSpacing={-0.5}>
          {f.month}·{f.day}
        </text>
        <text x={105} y={150} textAnchor="middle" fontFamily={SERIF} fontWeight={900} fontSize={n.size} letterSpacing={n.spacing} textLength={n.length} lengthAdjust={n.length ? 'spacingAndGlyphs' : undefined}>
          {f.name}
        </text>
        <text x={178} y={70} textAnchor="end" fontFamily={SANS} fontWeight={500} fontSize={9} letterSpacing={1}>
          {f.no === '測試' ? '測試' : `No.${f.no}`}
        </text>
      </g>
    </>
  )
}

// ---------- 濾鏡 ----------

/** 墨的紙紋：乾墨會透出一點紙的顆粒；濕墨飽滿不透 */
const InkFilter = ({ id, wet, seed = 12 }: { id: string; wet: boolean; seed?: number }) => (
  <filter id={id} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
    <feOffset in="SourceGraphic" dx={0} dy={0} result="d" />
    <feTurbulence type="fractalNoise" baseFrequency={1.3} numOctaves={1} seed={seed} result="n2" />
    <feColorMatrix in="n2" type="matrix" values={`0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${wet ? '0 1' : '-1.6 1.85'}`} result="m" />
    <feComposite in="d" in2="m" operator="in" />
  </filter>
)

/** 壓力不完全均勻：一角略淡 */
const Pressure = ({ id, angle = 35 }: { id: string; angle?: number }) => (
  <>
    <linearGradient id={`g${id}`} gradientTransform={`rotate(${angle} .5 .5)`}>
      <stop offset="0" stopColor="#fff" />
      <stop offset=".5" stopColor="#fff" stopOpacity={0.98} />
      <stop offset="1" stopColor="#fff" stopOpacity={0.9} />
    </linearGradient>
    <mask id={id}>
      <rect width={210} height={170} fill={`url(#g${id})`} />
    </mask>
  </>
)

/**
 * 變乾的次序：橫向「紙纖維」噪聲，細線 / 邊緣先乾，粗字（月·日、外框）最後。
 * 每一層只蓋住數值高於門檻的部分，一層接一層淡入。
 */
const DryMaskFilter = ({ id, thr }: { id: string; thr: number }) => (
  <filter id={id} filterUnits="userSpaceOnUse" x={-10} y={-10} width={230} height={190} colorInterpolationFilters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation={2.2} result="th" />
    <feTurbulence type="fractalNoise" baseFrequency="0.035 0.12" numOctaves={3} seed={21} result="nz" />
    <feColorMatrix in="nz" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0" result="na" />
    <feComposite in="na" in2="th" operator="arithmetic" k1={0} k2={0.85} k3={-0.9} k4={0.42} result="v" />
    <feComponentTransfer in="v" result="a">
      <feFuncA type="linear" slope={10} intercept={Math.round(-10 * thr * 100) / 100} />
    </feComponentTransfer>
    <feFlood floodColor="#fff" result="w" />
    <feComposite in="w" in2="a" operator="in" />
  </filter>
)

/** 乾墨分 7 層，門檻從高到低（最後一層蓋滿） */
export const DRY_THRESHOLDS: (number | null)[] = [0.6, 0.52, 0.44, 0.36, 0.28, 0.18, null]

const SVG_STYLE: CSSProperties = { position: 'absolute', left: 10, top: 10, overflow: 'visible' }
const useSvgId = () => 's' + useId().replace(/[^a-zA-Z0-9]/g, '')

export type Layer =
  | { k: 'shadow' } // 凸紋的陰影（右下）
  | { k: 'hi' } // 凸紋的高光（左上）
  | { k: 'face' } // 凸紋表面
  | { k: 'wet' } // 剛蓋好的濕墨
  | { k: 'dry'; thr: number | null } // 變乾的其中一層
  | { k: 'old'; seed?: number; angle?: number; lite?: boolean } // 以前蓋的章（已經乾透）；lite = 縮圖用，不加紙紋（小圖看不出，省掉濾鏡手機更順）

/** 章的一層（210 × 170 的 SVG，放在 230 × 190 的框裏，四周留 10 像素） */
export function StampLayer({ f, layer }: { f: FaceData; layer: Layer }) {
  const id = useSvgId()
  let defs: React.ReactNode = null
  let body: React.ReactNode

  if (layer.k === 'shadow') {
    defs = (
      <filter id={`b${id}`} x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur stdDeviation={0.4} />
      </filter>
    )
    body = (
      <g filter={`url(#b${id})`}>
        <FaceBody f={f} c="#1E2B3C" />
      </g>
    )
  } else if (layer.k === 'hi' || layer.k === 'face') {
    body = <FaceBody f={f} c={layer.k === 'hi' ? '#FFFFFF' : FACE} />
  } else if (layer.k === 'old' && layer.lite) {
    body = <FaceBody f={f} c={DRY} />
  } else if (layer.k === 'old') {
    defs = (
      <>
        <InkFilter id={`f${id}`} wet={false} seed={layer.seed ?? 11} />
        <Pressure id={`p${id}`} angle={layer.angle} />
      </>
    )
    body = (
      <g mask={`url(#p${id})`}>
        <g filter={`url(#f${id})`}>
          <FaceBody f={f} c={DRY} />
        </g>
      </g>
    )
  } else {
    const wet = layer.k === 'wet'
    const thr = layer.k === 'dry' ? layer.thr : null
    const ink = (
      <g mask={`url(#p${id})`}>
        <g filter={`url(#f${id})`}>
          <FaceBody f={f} c={wet ? WET : DRY} />
        </g>
      </g>
    )
    // 乾的部分先用凸紋表面色蓋住下面的濕墨，再疊上帶紙紋的乾墨：顆粒的空隙透出的是紙，不是濕墨
    const inner = wet ? (
      ink
    ) : (
      <>
        <FaceBody f={f} c={FACE} />
        {ink}
      </>
    )
    defs = (
      <>
        <InkFilter id={`f${id}`} wet={wet} />
        <Pressure id={`p${id}`} />
        {thr != null && (
          <>
            <DryMaskFilter id={`m${id}`} thr={thr} />
            <mask id={`dm${id}`} maskUnits="userSpaceOnUse" x={-10} y={-10} width={230} height={190}>
              <g filter={`url(#m${id})`}>
                <FaceBody f={f} c="#000" />
              </g>
            </mask>
          </>
        )}
      </>
    )
    body = thr == null ? inner : <g mask={`url(#dm${id})`}>{inner}</g>
  }

  return (
    <svg width={210} height={170} viewBox="0 0 210 170" style={SVG_STYLE} aria-hidden="true">
      {defs && <defs>{defs}</defs>}
      {body}
    </svg>
  )
}

/** 一個已經乾透的章（印章冊、蓋章頁上以前的章用） */
export function DryStamp({ f, style, seed, angle, lite }: { f: FaceData; style?: CSSProperties; seed?: number; angle?: number; lite?: boolean }) {
  return (
    <div className="stamp-box" style={style}>
      <StampLayer f={f} layer={{ k: 'old', seed, angle, lite }} />
    </div>
  )
}

/** 從一枚章的記錄算出章面要寫的字 */
export function faceOf(p: { at: number; no: number | null; name: string; district: string; kind: string; spotId?: string }): FaceData {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(p.at)
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? ''
  return { district: p.district, year: get('year'), month: get('month'), day: get('day'), no: p.no == null ? '測試' : String(p.no), name: p.name, kind: p.kind, spotId: p.spotId }
}
