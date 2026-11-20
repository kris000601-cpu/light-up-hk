// iPhone 瀏覽器 / App 內置瀏覽器裏不能蓋章，要先加到主畫面。
// 原因：iPhone Safari 裏長按紙面會被系統搶走（Chris 2026-11-20 試過蓋不成）；
// 而且瀏覽器和主畫面 App 分開存印章，在瀏覽器裏蓋了也帶不過去。
// 安卓 Chrome 的瀏覽器和主畫面 App 共用儲存，照常可以蓋。
import { platform } from '../lib/install'
import { InstallSteps } from './InstallHint'
import { Sheet } from './Sheet'

/** 要先加到主畫面才能蓋章（iPhone 瀏覽器、App 內置瀏覽器） */
export const mustInstallToStamp = () => {
  const p = platform()
  return p === 'ios' || p === 'inapp'
}

export function BrowserWarnSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inApp = platform() === 'inapp'
  return (
    <Sheet open={open} label="先加到主畫面" onClose={onClose}>
      <div className="sheet-head">
        <h2 className="sheet-title">先加到主畫面</h2>
      </div>
      <p className="warn-body">{inApp ? '這個 App 內置的瀏覽器蓋不了章。' : '在 iPhone 上，要從主畫面打開才能蓋章。'}</p>
      <InstallSteps />
      <div className="warn-actions">
        <button type="button" className="btn-outline" onClick={onClose}>
          知道了
        </button>
      </div>
    </Sheet>
  )
}
