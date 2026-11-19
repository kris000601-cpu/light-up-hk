// 章面左邊的簡筆圖案：先按景點類型做 8 個通用的，試用後再換成每個景點專屬（見 CLAUDE.md）。
// 每個圖案畫在 100 × 100 的格子裏，只用線條（stroke），章面上縮小到約 66 像素。
// 風格參考原型的鐘樓圖案：線條乾淨、圓頭圓角，下面兩行水紋 / 地平線。

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`
const WAVES = 'M6 84Q12 80 18 84T30 84T42 84T54 84T66 84T78 84T90 84T96 84M18 93Q24 89 30 93T42 93T54 93T66 93T78 93'

export type Picto = 'view' | 'temple' | 'harbour' | 'hike' | 'landmark' | 'street' | 'nature' | 'island'

export const PICTOS: Record<Picto, string> = {
  // 觀景：山脊 + 城市天際線 + 海
  view: `M4 40L20 24L30 32L46 14L62 30L72 22L96 40 M12 74V60H22V74M22 74V50H32V74M36 74V64H44V74M48 74V46H58V74M62 74V58H72V74M76 74V52H86V74 M6 74H94 ${WAVES}`,
  // 文化：廟宇 / 古建築（翹起的屋簷、柱、門、台階）
  temple: `M50 8V18 M6 34Q10 40 20 40Q36 36 44 20H56Q64 36 80 40Q90 40 94 34 M16 48H84 M22 48V82M78 48V82 M40 82V62H60V82 M30 56V64M70 56V64 M10 82H90 M4 90H96`,
  // 海濱：街燈 + 欄杆 + 海
  harbour: `M20 72V22Q20 14 28 14H32V20 M27 20H37 ${circle(74, 28, 8)} M6 50H94 M6 59H94 M34 50V72M54 50V72M74 50V72 M6 72H94 ${WAVES}`,
  // 行山 / 步道：兩座山 + 之字山徑 + 山頂小旗 + 太陽
  hike: `M4 82L36 30L52 54 M44 66L66 38L96 82 M4 82H96 M30 82Q40 74 50 72T60 62T64 52 M36 30V16L46 20L36 24 ${circle(84, 18, 6)} M14 92H86`,
  // 地標：星 + 紀念碑 + 台階
  landmark: `M50 6L53.5 14H62L55 19L57.5 27L50 22L42.5 27L45 19L38 14H46.5Z M44 34H56L58 76H42Z M34 76H66V83H34Z M24 83H76V90H24Z M8 90H92`,
  // 街區 / 美食：唐樓 + 招牌 + 街道
  street: `M10 84V34H38V84 M38 84V20H64V84 M64 84V44H90V84 M16 44H22M28 44H32M16 56H22M28 56H32M16 68H22M28 68H32 M44 30H56V62H44Z M50 36V56 M70 54H86V62H70Z M70 72H76M80 72H86 M4 84H96 M14 92H86`,
  // 自然：樹 + 蘆葦 + 飛鳥
  nature: `${circle(30, 42, 16)} M30 84V58 M30 66L22 60 M30 62L37 56 M62 84Q60 70 56 60 M70 84Q70 68 74 56 M78 84Q80 72 88 64 M54 24Q60 18 66 24Q72 18 78 24 M6 84H94 M18 92H82`,
  // 海島：小島 + 椰樹 + 帆船 + 海
  island: `M10 64Q26 44 44 46Q58 38 72 48Q84 54 90 64 M4 64H96 M64 48Q62 36 66 28 M66 28Q58 25 53 30 M66 28Q74 23 80 28 M66 28Q71 33 73 38 M16 78H40L36 84H20Z M28 78V66L36 76 M50 76Q56 72 62 76T74 76T86 76 M54 90Q60 86 66 90T78 90T90 90`,
}

/** spots.csv「類型」欄 → 圖案 */
const BY_KIND: Record<string, Picto> = {
  觀景: 'view',
  文化: 'temple',
  海濱: 'harbour',
  行山: 'hike',
  步道: 'hike',
  地標: 'landmark',
  街區: 'street',
  美食: 'street',
  自然: 'nature',
  海島: 'island',
}

export const pictoFor = (kind: string): Picto => BY_KIND[kind] ?? 'landmark'
