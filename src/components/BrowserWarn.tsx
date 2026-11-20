// iPhone Safari / App 內置瀏覽器裏，第一次正式蓋章前提醒：這裏的章和主畫面 App 是分開存的。
import { platform } from '../lib/install'
import { InstallSteps } from './InstallHint'
import { Sheet } from './Sheet'

const BROWSER_OK_KEY = 'browser-stamp-ok'

export const needsBrowserWarning = () => {
  const p = platform()
  if (p !== 'ios' && p !== 'inapp') return false
  try {
    return localStorage.getItem(BROWSER_OK_KEY) !== '1'
  } catch {
    return true
  }
}

const markBrowserOk = () => {
  try {
    localStorage.setItem(BROWSER_OK_KEY, '1')
  } catch {
    /* 存不了就下次再問 */
  }
}

/** open：要不要顯示；onCancel：先不蓋；onConfirm：照樣在這裏蓋（記住，以後不再問） */
export function BrowserWarnSheet({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Sheet open={open} label="先加到主畫面？" onClose={onCancel}>
      <div className="sheet-head">
        <h2 className="sheet-title">先加到主畫面？</h2>
      </div>
      <p className="warn-body">
        你現在不是從主畫面打開。在 iPhone 上，瀏覽器和主畫面的「點亮香港」是<b>分開存印章</b>的：在這裏蓋的章，之後從主畫面打開會看不到。
      </p>
      <InstallSteps />
      <div className="warn-actions">
        <button type="button" className="btn-outline" onClick={onCancel}>
          先不蓋，去加主畫面
        </button>
        <button
          type="button"
          className="btn-text"
          onClick={() => {
            markBrowserOk()
            onConfirm()
          }}
        >
          照樣在這裏蓋
        </button>
      </div>
    </Sheet>
  )
}
