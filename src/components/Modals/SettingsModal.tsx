import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useEditorSettingsStore } from '@/stores/editorStore'
import { useCssThemeStore } from '@/stores/cssThemeStore'
import { DEFAULT_SHORTCUTS, getKeys, saveCustomShortcut, resetCustomShortcut } from './shortcuts'
import { open } from '@tauri-apps/plugin-dialog'
import { readTextFile } from '@tauri-apps/plugin-fs'

type Tab = 'shortcuts' | 'editor' | 'css'

function NumberInput({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  function clamp(v: number) { return Math.min(max, Math.max(min, v)) }
  function commit(v: number) { onChange(clamp(v)); setDraft(null) }
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--text-primary)]">{label}</span>
      <div className="flex items-center border border-[var(--border)] rounded overflow-hidden focus-within:border-[var(--accent)] transition-colors w-[6em]">
        <input
          type="number"
          value={draft !== null ? draft : value}
          min={min} max={max} step={step}
          onChange={(e) => { setDraft(e.target.value); var v = parseFloat(e.target.value); if (!isNaN(v)) onChange(clamp(v)) }}
          onBlur={() => { if (draft !== null) commit(parseFloat(draft) || min) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && draft !== null) { (e.target as HTMLInputElement).blur() } }}
          className="flex-1 px-2 py-1 text-xs font-mono text-center bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <div className="flex flex-col border-l border-[var(--border)]">
          <button
            onClick={() => commit(value + step)}
            className="flex items-center justify-center w-5 h-4 border-b border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--accent)]/10 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors leading-none"
          ><svg width="7" height="3.5" viewBox="0 0 8 4" fill="currentColor"><path d="M4 0L8 4H0z"/></svg></button>
          <button
            onClick={() => commit(value - step)}
            className="flex items-center justify-center w-5 h-4 bg-[var(--bg-secondary)] hover:bg-[var(--accent)]/10 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors leading-none"
          ><svg width="7" height="3.5" viewBox="0 0 8 4" fill="currentColor"><path d="M0 0L8 0 4 4z"/></svg></button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsModal() {
  const showSettingsModal = useUIStore((s) => s.showSettingsModal)
  const setShowSettingsModal = useUIStore((s) => s.setShowSettingsModal)
  const [activeTab, setActiveTab] = useState<Tab>('editor')

  // Shortcuts state
  const [capturing, setCapturing] = useState<string | null>(null)
  const [shortcuts, setShortcuts] = useState(() =>
    DEFAULT_SHORTCUTS.map(s => ({ ...s, keys: getKeys(s) }))
  )

  // CSS theme state
  const customCss = useCssThemeStore((s) => s.customCss)
  const setCustomCss = useCssThemeStore((s) => s.setCustomCss)
  const clearCustomCss = useCssThemeStore((s) => s.clearCustomCss)

  // Editor settings state
  const fontSize = useEditorSettingsStore((s) => s.fontSize)
  const lineSpacing = useEditorSettingsStore((s) => s.lineSpacing)
  const maxWidth = useEditorSettingsStore((s) => s.maxWidth)
  const autoSaveDelay = useEditorSettingsStore((s) => s.autoSaveDelay)
  const setFontSize = useEditorSettingsStore((s) => s.setFontSize)
  const setLineSpacing = useEditorSettingsStore((s) => s.setLineSpacing)
  const setMaxWidth = useEditorSettingsStore((s) => s.setMaxWidth)
  const setAutoSaveDelay = useEditorSettingsStore((s) => s.setAutoSaveDelay)

  const handleCssImport = useCallback(async () => {
    try {
      const selected = await open({ filters: [{ name: 'CSS', extensions: ['css'] }], multiple: false })
      if (selected && typeof selected === 'string') {
        const content = await readTextFile(selected)
        setCustomCss(content)
      }
    } catch (e) {
      console.error('Failed to import CSS file:', e)
    }
  }, [setCustomCss])

  const handleCapture = useCallback((e: KeyboardEvent) => {
    if (!capturing) return
    e.preventDefault()
    e.stopPropagation()
    const parts: string[] = []
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
    if (e.shiftKey) parts.push('Shift')
    if (e.altKey) parts.push('Alt')
    const key = e.key === 'Escape' ? 'Esc' : e.key === '\\' ? '\\' : e.key
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return
    if (e.key === 'Escape' && parts.length === 0) { setCapturing(null); return }
    const combo = parts.length > 0 ? [...parts, key.toUpperCase()].join('+') : key
    saveCustomShortcut(capturing, combo)
    setCapturing(null)
    setShortcuts(DEFAULT_SHORTCUTS.map(s => ({ ...s, keys: getKeys(s) })))
  }, [capturing])

  useEffect(() => {
    if (!capturing) return
    window.addEventListener('keydown', handleCapture, true)
    return () => window.removeEventListener('keydown', handleCapture, true)
  }, [capturing, handleCapture])

  if (!showSettingsModal) return null

  const groupedShortcuts = shortcuts.reduce<Record<string, typeof shortcuts>>((acc, s) => {
    (acc[s.category] ??= []).push(s)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={() => setShowSettingsModal(false)}>
      <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl shadow-2xl w-[420px] max-h-[520px] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Tabs */}
        <div className="flex gap-1 bg-[var(--bg-secondary)] rounded-lg p-1 mx-5 mt-4">
          {(['editor', 'shortcuts', 'css'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab === 'editor' ? '编辑器' : tab === 'shortcuts' ? '快捷键' : '自定义 CSS'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-5">
          {activeTab === 'editor' && (
            <>
              <NumberInput label="字体大小 (px)" value={fontSize} min={10} max={36} step={1} onChange={setFontSize} />
              <NumberInput label="行距" value={lineSpacing} min={1.0} max={3.0} step={0.1} onChange={setLineSpacing} />
              <NumberInput label="最大宽度 (px)" value={maxWidth} min={400} max={1600} step={10} onChange={setMaxWidth} />
              <NumberInput label="自动保存 (秒)" value={Math.round(autoSaveDelay / 1000)} min={5} max={600} step={5} onChange={(v) => setAutoSaveDelay(v * 1000)} />
            </>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-muted)]">点击快捷键即可自定义</p>
              {Object.entries(groupedShortcuts).map(([category, entries]) => (
                <div key={category}>
                  <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5">{category}</h4>
                  <div className="space-y-0.5">
                    {entries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between py-0.5">
                        <span className="text-xs text-[var(--text-primary)]">{entry.description}</span>
                        {capturing === entry.id ? (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] font-mono animate-pulse">
                            按下快捷键...
                          </span>
                        ) : (
                          <button
                            onClick={() => setCapturing(entry.id)}
                            className="group relative flex items-center gap-1"
                          >
                            <kbd className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-muted)] font-mono group-hover:border-[var(--accent)] transition-colors">
                              {entry.keys}
                            </kbd>
                            {entry.keys !== entry.defaultKeys && (
                              <span
                                onClick={(e) => { e.stopPropagation(); resetCustomShortcut(entry.id); setShortcuts(DEFAULT_SHORTCUTS.map(s => ({ ...s, keys: getKeys(s) }))) }}
                                className="text-[10px] text-[var(--text-muted)] hover:text-red-500 cursor-pointer"
                                title="恢复默认"
                              >↺</span>
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'css' && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-muted)]">自定义 CSS 将应用于整个应用，覆盖现有主题</p>
              <textarea
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
                placeholder="/* 在此输入自定义 CSS */"
                className="w-full h-[200px] text-xs font-mono p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCssImport}
                  className="px-3 py-1.5 text-xs rounded-lg bg-[var(--accent)] text-white hover:opacity-80 transition-opacity"
                >
                  导入 CSS 文件
                </button>
                <button
                  onClick={clearCustomCss}
                  className="px-3 py-1.5 text-xs rounded-lg text-[var(--text-secondary)] hover:bg-red-500 hover:text-white transition-colors"
                >
                  清除
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end px-5 pb-4 pt-2">
          <button
            onClick={() => setShowSettingsModal(false)}
            className="px-3 py-1.5 text-xs rounded-lg text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
