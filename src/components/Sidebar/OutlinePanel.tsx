import { useState, useEffect } from 'react'
import type { Editor } from '@tiptap/react'

interface HeadingEntry {
  level: number
  text: string
  pos: number
}

function getEditorFromGlobal(): Editor | null {
  try {
    const handle = (window as any).__graphiteEditor
    return handle ?? null
  } catch {
    return null
  }
}

export default function OutlinePanel() {
  const [headings, setHeadings] = useState<HeadingEntry[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    let editor: Editor | null = null

    const update = () => {
      if (!editor) return
      const result: HeadingEntry[] = []
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          result.push({ level: node.attrs.level, text: node.textContent, pos })
        }
      })
      setHeadings(result)
      const { from } = editor.state.selection
      let active = -1
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i].pos <= from) { active = i; break }
      }
      setActiveIndex(active)
    }

    const onEditorReady = () => {
      const e = getEditorFromGlobal()
      if (!e || e === editor) return
      // Detach old editor listeners
      if (editor) {
        editor.off('update', update)
        editor.off('selectionUpdate', update)
      }
      editor = e
      update()
      editor.on('update', update)
      editor.on('selectionUpdate', update)
    }

    // Try initial mount
    onEditorReady()
    // Listen for editor switches (file changes)
    window.addEventListener('graphite:editor-ready', onEditorReady)

    return () => {
      window.removeEventListener('graphite:editor-ready', onEditorReady)
      if (editor) {
        editor.off('update', update)
        editor.off('selectionUpdate', update)
      }
    }
  }, [])

  if (headings.length === 0) return null

  return (
    <div className="py-1">
      {headings.map((h, i) => (
        <button
          key={i}
          onClick={() => {
            const editor = getEditorFromGlobal()
            if (!editor) return
            editor.commands.setTextSelection(h.pos)
            editor.commands.focus()
          }}
          className={`w-full text-left px-3 py-1 text-[12px] truncate transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
            i === activeIndex
              ? 'text-[var(--accent)]'
              : 'text-[var(--text-secondary)]'
          }`}
          style={{ paddingLeft: `${12 + (h.level - 1) * 14}px` }}
        >
          {'# '.repeat(h.level)}
          {h.text || '（空标题）'}
        </button>
      ))}
    </div>
  )
}
