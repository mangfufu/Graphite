import { useState, useEffect, useRef } from 'react'

interface PromptDialogProps {
  open: boolean
  title: string
  value?: string
  extensions: { label: string; value: string }[]
  defaultExt?: string
  hideExtensions?: boolean
  onConfirm: (name: string) => void
  onCancel: () => void
}

export default function PromptDialog({ open, title, value, extensions, defaultExt, hideExtensions, onConfirm, onCancel }: PromptDialogProps) {
  const [name, setName] = useState(value || '')
  const [ext, setExt] = useState(defaultExt || extensions[0]?.value || '')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i
  const validate = (name: string): string => {
    const trimmed = name.trim()
    if (!trimmed) return '名称不能为空'
    if (WINDOWS_RESERVED.test(trimmed)) return '不允许使用 Windows 保留名称'
    if (trimmed === '.' || trimmed === '..') return '不允许使用 . 或 ..'
    if (trimmed !== trimmed.replace(/[. ]$/, '')) return '名称不能以空格或句点结尾'
    if (trimmed.includes('/') || trimmed.includes('\\')) return '名称不能包含 / 或 \\'
    if (/[:*?"<>|]/.test(trimmed)) return '名称不能包含 : * ? " < > |'
    return ''
  }

  useEffect(() => {
    if (open) {
      setName(value || '')
      setExt(defaultExt || extensions[0]?.value || '')
      setError('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, value, defaultExt, extensions])

  if (!open) return null

  const handleConfirm = () => {
    const finalName = hideExtensions ? name : (name.includes('.') ? name : name + ext)
    const err = validate(finalName)
    if (err) { setError(err); return }
    if (finalName.trim()) onConfirm(finalName.trim())
  }

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl shadow-2xl w-80 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-4 pb-3">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
        </div>
        <div className="px-5 pb-3 space-y-2">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            placeholder="文件名"
            className="w-full px-2 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          {!hideExtensions && (
            <div className="flex gap-1.5">
              {extensions.map((e) => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => setExt(e.value)}
                  className={`flex-1 px-1 py-1 text-xs rounded-md border transition-colors ${
                    ext === e.value
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-500 px-5 pb-2">{error}</p>
        )}
        <div className="flex gap-2 px-5 pb-4">
          <button onClick={handleConfirm} className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity font-medium">
            确定
          </button>
          <button onClick={onCancel} className="flex-1 px-3 py-1.5 text-xs rounded-lg text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
