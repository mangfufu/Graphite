import { useState, useEffect, useRef, useCallback } from 'react'
import { type Editor } from '@tiptap/react'

interface SlashMenuProps {
  editor: Editor
  position: { top: number; left: number }
  slashMenuPos: number
  onClose: () => void
}

interface CommandItem {
  label: string
  icon: string
  description: string
  execute: (editor: Editor) => void
}

const COMMANDS: CommandItem[] = [
  {
    label: '标题 1',
    icon: 'H1',
    description: '大标题',
    execute: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: '标题 2',
    icon: 'H2',
    description: '中标题',
    execute: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: '标题 3',
    icon: 'H3',
    description: '小标题',
    execute: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: '粗体',
    icon: 'B',
    description: '加粗文本',
    execute: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    label: '斜体',
    icon: 'I',
    description: '斜体文本',
    execute: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    label: '引用',
    icon: '¶',
    description: '引用块',
    execute: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    label: '无序列表',
    icon: '•',
    description: '项目符号列表',
    execute: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: '有序列表',
    icon: '1.',
    description: '编号列表',
    execute: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    label: '任务列表',
    icon: '☑',
    description: '待办事项',
    execute: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    label: '代码块',
    icon: '</>',
    description: '代码块',
    execute: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    label: '表格',
    icon: '⊞',
    description: '插入表格',
    execute: (e) =>
      e
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    label: '分割线',
    icon: '—',
    description: '水平分割线',
    execute: (e) => e.chain().focus().setHorizontalRule().run(),
  },
]

export default function SlashMenu({
  editor,
  position,
  slashMenuPos,
  onClose,
}: SlashMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedIndexRef = useRef(0)
  const menuRef = useRef<HTMLDivElement>(null)

  // Keep the ref in sync with state for use in the stable keydown handler
  useEffect(() => {
    selectedIndexRef.current = selectedIndex
  }, [selectedIndex])

  const executeCommand = useCallback(
    (index: number) => {
      const { from } = editor.state.selection
      // Delete from the slash position to the current cursor position
      const to = from > slashMenuPos ? from : slashMenuPos + 1
      editor.chain().focus().deleteRange({ from: slashMenuPos, to }).run()
      COMMANDS[index].execute(editor)
      onClose()
    },
    [editor, slashMenuPos, onClose],
  )

  // Intercept keyboard events in capture phase so they are handled before
  // ProseMirror processes them (preventing cursor movement / newline insertion).
  useEffect(() => {
    const ed = editor.view.dom
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          e.stopImmediatePropagation()
          {
            const next =
              (selectedIndexRef.current + 1) % COMMANDS.length
            selectedIndexRef.current = next
            setSelectedIndex(next)
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          e.stopImmediatePropagation()
          {
            const prev =
              (selectedIndexRef.current - 1 + COMMANDS.length) %
              COMMANDS.length
            selectedIndexRef.current = prev
            setSelectedIndex(prev)
          }
          break
        case 'Enter':
          e.preventDefault()
          e.stopImmediatePropagation()
          executeCommand(selectedIndexRef.current)
          break
        case 'Escape':
          e.preventDefault()
          e.stopImmediatePropagation()
          onClose()
          break
      }
    }
    ed.addEventListener('keydown', handler, { capture: true })
    return () => ed.removeEventListener('keydown', handler, { capture: true })
  }, [editor, executeCommand, onClose])

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Reset selection index each time the menu opens
  useEffect(() => {
    setSelectedIndex(0)
  }, [])

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-56 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-1.5 text-xs text-[var(--text-muted)] font-medium">
        基本格式
      </div>
      {COMMANDS.map((cmd, i) => (
        <button
          key={cmd.label}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${
            i === selectedIndex
              ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
              : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
          }`}
          onClick={() => executeCommand(i)}
          onMouseEnter={() => setSelectedIndex(i)}
          type="button"
        >
          <span
            className={`flex items-center justify-center w-7 h-7 rounded text-xs font-medium ${
              i === selectedIndex
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
            }`}
          >
            {cmd.icon}
          </span>
          <div className="flex-1">
            <div className="text-sm">{cmd.label}</div>
            <div className="text-xs text-[var(--text-muted)]">
              {cmd.description}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
