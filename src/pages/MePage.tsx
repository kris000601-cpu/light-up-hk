import { useRef, useState } from 'react'
import { BackupCard } from '../components/Backup'
import { InstallSteps } from '../components/InstallHint'
import { label, useDistricts } from '../lib/districts'
import { monthDay } from '../lib/format'
import { platform } from '../lib/install'
import { addStamp, clearTestStamps, reloadStamps, usePersist, useStamps } from '../lib/stamps'
import { setFakeLocation, setTestMode, useFakeLocation, useTestMode } from '../lib/testMode'
import { useLit } from '../lib/lit'

const VERSION = '0.5'

export function MePage() {
  const { ready, stamps, error } = useStamps()
  const persist = usePersist()
  const test = useTestMode()
  const installed = platform() === 'installed'
  const real = stamps.filter((s) => !s.test).length

  // 連按版本號 5 下（2 秒內）開關測試模式
  const taps = useRef<number[]>([])
  const onVersionTap = () => {
    const now = Date.now()
    taps.current = [...taps.current.filter((t) => now - t < 2000), now]
    if (taps.current.length >= 5) {
      taps.current = []
      setTestMode(!test)
    }
  }

  return (
    <>
      <h1 className="app-title">我的</h1>

      <section className="card-block" aria-labelledby="save-title">
        <h2 id="save-title" className="block-title">
          印章保存
        </h2>
        {error ? (
          <p className="warn">
            {error}{' '}
            <button type="button" className="link" onClick={reloadStamps}>
              再試一次
            </button>
          </p>
        ) : !ready ? (
          <p className="block-text">讀取中…</p>
        ) : (
          <p className="block-text">
            印章只存在這部手機裏，現在共 <b>{real}</b> 枚
            {stamps.length > real && `（另有測試章 ${stamps.length - real} 枚）`}。
          </p>
        )}
        <ul className="status-list">
          <li>
            <span className={installed ? 'status ok' : 'status'}>{installed ? '✓' : '·'}</span>
            <span>
              <b>{installed ? '已從主畫面打開' : '還沒加到主畫面'}</b>
              {!installed && <InstallSteps />}
            </span>
          </li>
          <li>
            <span className={persist === 'yes' ? 'status ok' : 'status'}>{persist === 'yes' ? '✓' : '·'}</span>
            <span>
              <b>{persist === 'yes' ? '已鎖定，瀏覽器不會自動清走' : '還沒鎖定'}</b>
              {persist !== 'yes' && (
                <span className="status-note">
                  {persist === 'unsupported' ? '這個瀏覽器不支援。' : '蓋第一個章時會自動申請；加到主畫面後比較容易批准。'}
                </span>
              )}
            </span>
          </li>
        </ul>
        <p className="fine">換手機、或在設定裏清除瀏覽器資料，印章會不見；有備份的話可以用下面的「從備份還原」找回來。</p>
      </section>

      <BackupCard />

      {test && <TestTools />}

      <p className="version" onClick={onVersionTap}>
        點亮香港 · 版本 {VERSION}（{__BUILD__}）
        {test && ' · 測試模式'}
      </p>
    </>
  )
}

/** 測試工具：不用到現場也可以蓋章，看首頁和印章冊的效果 */
function TestTools() {
  const districts = useDistricts()
  const { stamps } = useStamps()
  const [code, setCode] = useState(districts[0].code)
  const [busy, setBusy] = useState(false)
  const [acc, setAcc] = useState(15)
  const fake = useFakeLocation()
  const d = districts.find((x) => x.code === code) ?? districts[0]
  const tests = stamps.filter((s) => s.test).length
  const { lit } = useLit()
  const testPlaces = lit.filter((x) => x.test).length

  const run = async (f: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await f()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card-block test-tools" aria-labelledby="test-title">
      <h2 id="test-title" className="block-title">
        測試工具
      </h2>
      <p className="block-text">
        「假裝在這」：回到「蓋章」頁按中間的點，就當你人在那個景點（不讀 GPS），可以試「你已到達」和蓋章；選大的假誤差可以試「誤差太大，不給蓋」。「蓋測試章」：直接蓋，不用定位。假裝在某處按中間的點，也會點亮那個地方（測試的）。測試章和測試點亮的地方只在測試模式開着時算進進度，可以一鍵清走。
      </p>
      {fake && (
        <p className="fake-note">
          現在假裝在「{fake.label}」，誤差 {fake.acc} 米 ·{' '}
          <button type="button" className="link" onClick={() => setFakeLocation(null)}>
            取消
          </button>
        </p>
      )}
      <label className="acc-pick">
        假裝的定位誤差
        <select className="select" value={acc} onChange={(e) => setAcc(Number(e.target.value))}>
          <option value={15}>15 米（很準）</option>
          <option value={90}>90 米（一般）</option>
          <option value={400}>400 米（太差，不給蓋）</option>
        </select>
      </label>
      <select className="select" value={code} onChange={(e) => setCode(e.target.value)} aria-label="選區">
        {districts.map((x) => (
          <option key={x.code} value={x.code}>
            {label(x)}（{x.visited} / {x.total}）
          </option>
        ))}
      </select>
      <ul className="test-spots">
        {d.spots.map((s) => {
          const st = d.done[s.id]
          return (
            <li key={s.id}>
              <span>
                {s.name}
                {st && <small> · {monthDay(st.at)}{st.test ? ' 測試' : ''}</small>}
              </span>
              <span className="test-btns">
              <button type="button" className="btn-small" onClick={() => setFakeLocation({ lat: s.lat, lng: s.lng, acc, label: s.name })}>
                假裝在這
              </button>
              <button
                type="button"
                className="btn-small"
                disabled={busy}
                onClick={() => run(() => addStamp({ spotId: s.id, spotName: s.name, district: s.district, test: true, px: 0.3 + Math.random() * 0.4, py: 0.3 + Math.random() * 0.3, rot: Math.round((-6 + Math.random() * 9) * 10) / 10 }))}
              >
                蓋測試章
              </button>
              </span>
            </li>
          )
        })}
      </ul>
      <button type="button" className="btn-outline" disabled={busy || (!tests && !testPlaces)} onClick={() => run(clearTestStamps)}>
        清走全部測試章（{tests} 枚）{testPlaces ? `和測試點亮的 ${testPlaces} 個地方` : ''}
      </button>
      <button type="button" className="btn-text" onClick={() => setTestMode(false)}>
        關閉測試工具
      </button>
    </section>
  )
}
