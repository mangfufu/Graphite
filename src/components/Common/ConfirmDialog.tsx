interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  saveText?: string
  onConfirm: () => void
  onCancel: () => void
  onSave?: () => void
}

export default function ConfirmDialog({
  open, title, message,
  confirmText = '确定', cancelText = '取消', saveText = '保存',
  onConfirm, onCancel, onSave,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl shadow-2xl w-80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-2">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">{message}</p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 px-5 pb-4 pt-3">
          {onSave ? (
            <>
              <button
                onClick={onSave}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity font-medium"
              >
                {saveText}
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
              >
                {confirmText}
              </button>
              <button
                onClick={onCancel}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                {cancelText}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onConfirm}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
              >
                {confirmText}
              </button>
              <button
                onClick={onCancel}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                {cancelText}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
