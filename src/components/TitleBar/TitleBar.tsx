import { useState, useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useFileStore } from '@/stores/fileStore'
import graphiteIcon from '@/assets/branding/graphite-icon-64.png'

export default function TitleBar() {
  const { currentFilePath, isDirty } = useFileStore()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const win = getCurrentWindow()
    let unlisten: (() => void) | undefined
    win.isMaximized().then(setMaximized)
    win.onResized(() => {
      win.isMaximized().then(setMaximized)
    }).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [])

  const handleMinimize = async () => { await getCurrentWindow().minimize() }
  const handleMaximize = async () => {
    const win = getCurrentWindow()
    if (maximized) { await win.unmaximize() } else { await win.maximize() }
    setMaximized(!maximized)
  }
  const handleClose = async () => { await getCurrentWindow().close() }

  const fileName = currentFilePath ? currentFilePath.split(/[\\/]/).pop() : null

  return (
    <div className="flex items-center h-[var(--titlebar-height)] bg-[var(--bg-titlebar)] border-b border-[var(--border)] text-xs select-none shrink-0">
      {/* Graphite + file name — drag region */}
      <div className="flex items-center gap-2 pl-3 min-w-0 flex-1 h-full" data-tauri-drag-region>
        <img src={graphiteIcon} alt="Graphite" className="w-4 h-4 shrink-0 rounded-[4px]" draggable={false} />
        <span className="font-semibold text-sm text-[var(--text-primary)] whitespace-nowrap">Graphite</span>
        {fileName && (
          <>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="text-[var(--text-muted)] truncate">{fileName}</span>
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />}
          </>
        )}
      </div>

      {/* Window controls */}
      <div className="flex items-center">
        <button onClick={handleMinimize} className="w-[46px] h-[var(--titlebar-height)] flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-secondary)]">
          <svg width="10" height="10" viewBox="0 0 12 12"><rect y="5" width="12" height="1.5" fill="currentColor" /></svg>
        </button>
        <button onClick={handleMaximize} className="w-[46px] h-[var(--titlebar-height)] flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-secondary)]">
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 12 12">
              <rect x="3" y="1" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <rect x="1" y="3" width="8" height="8" rx="1" fill="var(--bg-titlebar)" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
          )}
        </button>
        <button onClick={handleClose} className="w-[46px] h-[var(--titlebar-height)] flex items-center justify-center hover:bg-red-500 hover:text-white text-[var(--text-secondary)]">
          <svg width="10" height="10" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>
      </div>
    </div>
  )
}
