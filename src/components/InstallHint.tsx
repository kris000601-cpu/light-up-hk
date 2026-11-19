import { useState } from 'react'
import { hideHint, hintHidden, platform, useInstallPrompt } from '../lib/install'

const ShareIcon = () => (
  <svg className="inline-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="分享">
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M6 11H5v10h14V11h-1" />
  </svg>
)

/** 教用戶把 App 加到主畫面的那幾句話（按手機類型不同） */
export function InstallSteps() {
  const p = platform()
  const { canPrompt, prompt } = useInstallPrompt()
  if (p === 'ios')
    return (
      <p className="install-steps">
        按 Safari 下方的分享按鈕 <ShareIcon /> → 選「加至主畫面」。之後都從主畫面的「點亮香港」打開。
      </p>
    )
  if (p === 'inapp') return <p className="install-steps">這個 App 內置的瀏覽器加不了主畫面。請按右上角「⋯」，選用 Safari 或 Chrome 打開。</p>
  if (canPrompt)
    return (
      <button type="button" className="btn-primary" onClick={prompt}>
        加到主畫面
      </button>
    )
  if (p === 'android') return <p className="install-steps">按瀏覽器右上角「⋮」→ 選「加到主畫面」或「安裝應用程式」。</p>
  return <p className="install-steps">用手機打開這個網頁，再加到主畫面。</p>
}

/** 首頁頂部的提示卡：還沒從主畫面打開時出現，可以按「稍後」收起三天 */
export function InstallHint() {
  const [hidden, setHidden] = useState(hintHidden)
  const { installedNow } = useInstallPrompt()
  const p = platform()
  if (hidden || installedNow || p === 'installed' || p === 'desktop') return null
  return (
    <aside className="install-hint" aria-label="加到主畫面">
      <div className="install-hint-text">
        <b>先加到主畫面，再開始蓋章</b>
        <p>
          {p === 'ios'
            ? 'iPhone 上，主畫面的 App 和 Safari 是分開存印章的，所以請先加到主畫面，以後都從主畫面打開。'
            : '像 App 一樣從主畫面打開，印章也比較不容易被瀏覽器清走。'}
        </p>
        <InstallSteps />
      </div>
      <button
        type="button"
        className="install-hint-close"
        onClick={() => {
          hideHint()
          setHidden(true)
        }}
      >
        稍後
      </button>
    </aside>
  )
}
