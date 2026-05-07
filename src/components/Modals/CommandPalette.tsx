import { useState, useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useThemeStore } from '@/stores/themeStore'
import { useFileStore } from '@/stores/fileStore'
import { DEFAULT_SHORTCUTS, getKeys, parseKeys } from './shortcuts'

interface Command {
  id: string
  label: string
  action: () => void
}

type GraphiteEditorHandle = {
  chain: () => {
    focus: () => any
    insertTable: (options: { rows: number; cols: number; withHeaderRow: boolean }) => any
    insertContentAt: (pos: number, value: string) => any
    setTextSelection: (pos: number) => any
    deleteSelection: () => any
    insertContent: (value: unknown) => any
    run: () => boolean
  }
  state: {
    selection: {
      empty: boolean
      from: number
      to: number
    }
    doc: {
      textBetween: (from: number, to: number) => string
    }
  }
}

export default function CommandPalette() {
  const show = useUIStore((s) => s.showCommandPalette)
  const setShow = useUIStore((s) => s.setShowCommandPalette)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset state when palette opens
  useEffect(() => {
    if (show) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [show])

  const getEditor = () => (window as any).__graphiteEditor as GraphiteEditorHandle | undefined

  const dispatchShortcut = useCallback((shortcutId: string) => {
    const entry = DEFAULT_SHORTCUTS.find((item) => item.id === shortcutId)
    if (!entry) return

    const binding = parseKeys(getKeys(entry))
    const event = new KeyboardEvent('keydown', {
      key: binding.key,
      bubbles: true,
      cancelable: true,
      ctrlKey: binding.ctrl,
      shiftKey: binding.shift,
      altKey: binding.alt,
      metaKey: binding.meta,
    })

    document.dispatchEvent(event)
  }, [])

  const executeCommand = useCallback((id: string) => {
    setShow(false)

    switch (id) {
      case 'toggleSidebar': {
        const state = useUIStore.getState()
        state.setSidebarOpen(!state.sidebarOpen)
        break
      }
      case 'openFolder': {
        import('@tauri-apps/plugin-dialog').then(({ open }) => {
          open({ directory: true, multiple: false }).then((selected) => {
            if (selected && typeof selected === 'string') {
              useFileStore.getState().loadDirectory(selected)
              useUIStore.getState().setSidebarOpen(true)
            }
          })
        })
        break
      }
      case 'save': {
        ;(window as any).__graphiteSave?.()
        break
      }
      case 'export': {
        useUIStore.getState().setShowExportModal(true)
        break
      }
      case 'toggleTheme': {
        useThemeStore.getState().toggleMode()
        break
      }
      case 'openSettings': {
        useUIStore.getState().setShowSettingsModal(true)
        break
      }
      case 'insertTable': {
        const editor = getEditor()
        if (editor) {
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        break
      }
      case 'insertMath': {
        const editor = getEditor()
        if (editor) {
          const { empty, from, to } = editor.state.selection
          if (empty) {
            editor.chain().focus().insertContentAt(from, '$$').run()
            editor.chain().focus().setTextSelection(from + 1).run()
          } else {
            const text = editor.state.doc.textBetween(from, to)
            editor.chain().focus().deleteSelection().insertContentAt(from, `$${text}$`).run()
            editor.chain().focus().setTextSelection(from + text.length + 2).run()
          }
        }
        break
      }
      case 'insertMermaid': {
        const editor = getEditor()
        if (editor) {
          editor.chain().focus().insertContent({
            type: 'mermaidBlock',
            attrs: { src: 'graph TD\n  A[Start] --> B[End]' },
          }).run()
        }
        break
      }
      case 'toggleSearch': {
        if (getEditor()) {
          requestAnimationFrame(() => {
            dispatchShortcut('search')
          })
        }
        break
      }
    }
  }, [dispatchShortcut, setShow])

  const commands: Command[] = [
    { id: 'toggleSidebar', label: '切换侧边栏', action: () => executeCommand('toggleSidebar') },
    { id: 'openFolder', label: '打开文件夹', action: () => executeCommand('openFolder') },
    { id: 'save', label: '保存文档', action: () => executeCommand('save') },
    { id: 'export', label: '导出文档', action: () => executeCommand('export') },
    { id: 'toggleTheme', label: '切换主题模式', action: () => executeCommand('toggleTheme') },
    { id: 'openSettings', label: '打开设置', action: () => executeCommand('openSettings') },
    { id: 'insertTable', label: '插入表格', action: () => executeCommand('insertTable') },
    { id: 'insertMath', label: '行内公式', action: () => executeCommand('insertMath') },
    { id: 'insertMermaid', label: '插入 Mermaid', action: () => executeCommand('insertMermaid') },
    { id: 'toggleSearch', label: '文档搜索', action: () => executeCommand('toggleSearch') },
  ]

  const filtered = query
    ? commands.filter(
        (c) => c.label.includes(query) || c.id.toLowerCase().includes(query.toLowerCase()),
      )
    : commands

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setShow(false)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action()
        }
        return
      }
    },
    [filtered, selectedIndex, setShow],
  )

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.querySelector(
      `[data-index="${selectedIndex}"]`,
    ) as HTMLElement | null
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      onMouseDown={() => setShow(false)}
    >
      <div
        className="w-[500px] max-w-[90vw] bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="p-3 border-b border-[var(--border)]">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="输入命令..."
            className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
        </div>

        {/* Command list */}
        <div ref={listRef} className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-xs text-[var(--text-muted)] text-center">
              没有匹配的命令
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                data-index={i}
                className={`px-4 py-2 text-sm cursor-pointer flex items-center justify-between ${
                  i === selectedIndex
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                }`}
                onMouseDown={() => cmd.action()}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span>{cmd.label}</span>
                <span
                  className={`text-[10px] ${
                    i === selectedIndex ? 'text-white/70' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {cmd.id}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
