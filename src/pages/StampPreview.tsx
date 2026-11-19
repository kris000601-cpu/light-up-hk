import { DryStamp, faceOf } from '../components/StampArt'

// 內部頁：8 個按類型的通用章面圖案，給 Chris 看（網址 ?stamps=preview）
const SAMPLES: { kind: string; label: string; name: string; district: string; spotId?: string }[] = [
  { kind: '觀景', label: '專屬：尖沙咀鐘樓（原型的圖案）', name: '尖沙咀鐘樓 · 星光大道', district: '油尖旺', spotId: 's023' },
  { kind: '觀景', label: '觀景（山頂亭）', name: '太平山頂 · 獅子亭', district: '中西' },
  { kind: '文化', label: '文化（嶺南廟宇；博物館、古蹟也用它）', name: '黃大仙祠', district: '黃大仙' },
  { kind: '海濱', label: '海濱（燈塔）', name: '中環海濱 · 摩天輪', district: '中西' },
  { kind: '行山', label: '行山 / 步道（遠足徑標距柱）', name: '龍脊', district: '南區' },
  { kind: '地標', label: '地標（摩天樓）', name: '益昌大廈（怪獸大廈）', district: '東區' },
  { kind: '街區', label: '街區 / 美食（唐樓 + 霓虹招牌）', name: '鴨寮街', district: '深水埗' },
  { kind: '自然', label: '自然（白鷺）', name: '香港濕地公園', district: '元朗' },
  { kind: '海島', label: '海島（離島碼頭）', name: '長洲', district: '離島' },
]

export function StampPreview() {
  const at = Date.now()
  return (
    <main className="page stamp-preview">
      <h1 className="app-title">章面圖案</h1>
      <p className="placeholder">內部預覽：8 個按景點類型的通用圖案（乾透的樣子），第一個是尖沙咀鐘樓的專屬圖案，其他都照它的畫法。</p>
      <ul>
        {SAMPLES.map((s, i) => (
          <li key={s.label}>
            <span className="preview-label">{s.label}</span>
            <div className="preview-box">
              <DryStamp f={faceOf({ at, no: 10 + i, name: s.name, district: s.district, kind: s.kind, spotId: s.spotId })} seed={11 + i} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
