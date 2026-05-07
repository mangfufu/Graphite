import { useState, useEffect, Fragment } from 'react'
import { type Editor } from '@tiptap/react'

interface ToolbarProps {
  editor: Editor | null
  onSearchToggle?: () => void
}

export default function Toolbar({ editor, onSearchToggle }: ToolbarProps) {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    if (!editor) return
    const handler = () => forceUpdate((n) => n + 1)
    editor.on('selectionUpdate', handler)
    return () => { editor.off('selectionUpdate', handler) }
  }, [editor])

  if (!editor) return null

    // Image insertion: local file or URL
  const handleImageLocal = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        multiple: false,
        filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] }],
      })
      if (selected && typeof selected === 'string') {
        const { readFile } = await import('@tauri-apps/plugin-fs')
        const data = await readFile(selected)
        const binary = Array.from(data).map(b => String.fromCharCode(b)).join('')
        const ext = (selected.split('.').pop() || 'png').replace('jpg', 'jpeg')
        const src = `data:image/${ext};base64,${btoa(binary)}`
        editor.chain().focus().setImage({ src }).run()
      }
    } catch { /* ignore */ }
  }

  const handleImageUrl = () => {
    const url = window.prompt('请输入图片URL:')
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }

  const handleMath = () => {
    const { empty, from, to } = editor.state.selection

    if (empty) {
      // Insert "$$" and place cursor between them so the user can type the formula
      editor.chain().focus().insertContentAt(from, '$$').run()
      editor.chain().focus().setTextSelection(from + 1).run()
    } else {
      // Wrap selected text in $...$
      const text = editor.state.doc.textBetween(from, to)
      editor.chain().focus().deleteSelection().insertContentAt(from, `$${text}$`).run()
      editor.chain().focus().setTextSelection(from + text.length + 2).run()
    }
  }

  // Custom handler for deleting a row: ensures cursor stays in the document
  // when the last row is deleted (table is removed).
  const handleDeleteRow = () => {
    const { $from } = editor.state.selection

    // Record table position before deletion
    let tablePos = -1
    let tableDepth = -1
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'table') {
        tablePos = $from.before(d)
        tableDepth = d
        break
      }
    }
    if (tablePos < 0) return

    const tableNode = $from.node(tableDepth)

    // If this is the last row, delete the entire table
    if (tableNode.childCount === 1) {
      editor.chain().focus().deleteTable().run()
      editor.commands.setTextSelection(
        Math.min(tablePos, editor.state.doc.content.size),
      )
      return
    }

    editor.chain().focus().deleteRow().run()

    // If the table was deleted (shouldn't happen now, but handle defensively)
    const exists = editor.state.doc.nodeAt(tablePos)
    if (!exists || exists.type.name !== 'table') {
      editor.commands.setTextSelection(
        Math.min(tablePos, editor.state.doc.content.size),
      )
    }
  }

  // Custom handler for adding a row before the current row:
  // if the cursor was in the first row, the new row becomes the new first row,
  // so we convert its cells from regular TableCell to TableHeader to preserve
  // the header-row styling.
  // Custom handler for deleting a column: ensures cursor stays in the table
  // and moves to the next column to the right, or the previous column if the
  // last column was deleted.
  const handleDeleteColumn = () => {
    const { $from } = editor.state.selection
    let cellIndex = -1
    let tableStart = -1 // position INSIDE the table (first row)
    let tablePos = -1 // position OF the table node
    let tableDepth = -1

    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'tableRow') {
        cellIndex = $from.index(d)
      }
      if ($from.node(d).type.name === 'table') {
        tableStart = $from.start(d)
        tablePos = $from.before(d)
        tableDepth = d
        break
      }
    }
    if (tablePos < 0) return

    const tableNode = $from.node(tableDepth)

    // Count total columns in the table (accounting for colspan)
    const firstRow = tableNode.firstChild
    let colCount = 0
    if (firstRow) {
      firstRow.forEach((cell) => {
        colCount += cell.attrs.colspan || 1
      })
    }

    // If this is the last column, delete the entire table
    if (colCount === 1) {
      editor.chain().focus().deleteTable().run()
      editor.commands.setTextSelection(
        Math.min(tablePos, editor.state.doc.content.size),
      )
      return
    }

    editor.chain().focus().deleteColumn().run()

    // Check if table still exists
    const tableAfter = editor.state.doc.nodeAt(tablePos)
    if (tableAfter && tableAfter.type.name === 'table') {
      const firstRowAfter = tableAfter.firstChild
      if (
        firstRowAfter &&
        (firstRowAfter.type.name === 'tableRow' || firstRowAfter.type.name === 'row')
      ) {
        const numCells = firstRowAfter.childCount
        // After column deletion, columns to the right shift left by one.
        // Try the same cell index (now holds the "next column right").
        // If OOB, use the last column (previous column).
        const targetIndex = Math.min(cellIndex, numCells - 1)

        if (targetIndex >= 0) {
          // Compute the absolute position of the target cell
          let cellPos = tableStart + 1 // position OF the first cell node
          for (let i = 0; i < targetIndex; i++) {
            cellPos += firstRowAfter.child(i).nodeSize
          }
          // Position INSIDE the cell = cellPos + 1
          editor.commands.setTextSelection(cellPos + 1)
          return
        }
      }
    }

    // Fallback: table was deleted (last column) or navigation failed —
    // place cursor at the table's former position
    editor.commands.setTextSelection(
      Math.min(tablePos, editor.state.doc.content.size),
    )
  }

  const groups = [
    {
      buttons: [
        { label: 'B', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), title: '粗体' },
        { label: 'I', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), title: '斜体' },
        { label: 'U', action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline'), title: '下划线' },
        { label: 'S', action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike'), title: '删除线' },
        { label: 'H', action: () => editor.chain().focus().toggleHighlight().run(), active: editor.isActive('highlight'), title: '高亮' },
        { label: 'Σ', action: handleMath, active: false, title: '行内公式 ($...$)' },
        { label: '∑b', action: () => {
          editor.chain().focus().insertContent({
            type: 'mathBlock',
            attrs: { latex: '公式' },
          }).run()
        }, active: false, title: '块级公式' },
      ],
    },
    {
      buttons: [
        { label: 'H1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }), title: '标题1' },
        { label: 'H2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }), title: '标题2' },
        { label: 'H3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }), title: '标题3' },
        { label: 'H4', action: () => editor.chain().focus().toggleHeading({ level: 4 }).run(), active: editor.isActive('heading', { level: 4 }), title: '标题4' },
        { label: 'H5', action: () => editor.chain().focus().toggleHeading({ level: 5 }).run(), active: editor.isActive('heading', { level: 5 }), title: '标题5' },
        { label: 'H6', action: () => editor.chain().focus().toggleHeading({ level: 6 }).run(), active: editor.isActive('heading', { level: 6 }), title: '标题6' },
      ],
    },
    {
      buttons: [
        { label: '¶', action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote'), title: '引用' },
        { label: '•', action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), title: '无序列表' },
        { label: '1.', action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), title: '有序列表' },
        { label: '☑', action: () => editor.chain().focus().toggleTaskList().run(), active: editor.isActive('taskList'), title: '任务列表' },
        { label: '</>', action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock'), title: '代码块' },
        { label: 'Dl', action: () => {
          const pos = editor.state.selection.$from.pos
          editor.chain().focus().insertContentAt(pos, '\n术语\n: 定义内容\n').run()
        }, active: false, title: '定义列表' },
        { label: 'Fn', action: () => {
          let maxN = 0
          editor.state.doc.descendants((node) => {
            if (node.type.name === 'footnote') {
              const num = parseInt((node.attrs.n as string) || (node.attrs.id as string), 10)
              if (!isNaN(num) && num > maxN) maxN = num
            }
          })
          const nextN = maxN + 1
          const id = String(nextN)
          const cursorPos = editor.state.selection.$from.pos
          const fnNode = editor.schema.nodes.footnote.create({ id, content: '脚注内容' })
          editor.chain().focus().insertContentAt(cursorPos, fnNode).run()
          const end = editor.state.doc.content.size
          editor.chain().focus().insertContentAt(end, [
            { type: 'text', text: '\n\n' },
            { type: 'text', text: `[${id}]`, marks: [{ type: 'footnoteRef' }] },
            { type: 'text', text: ': ' },
          ]).run()
        }, active: false, title: '脚注' },
      ],
    },
    {
      buttons: [
        { label: '⬅', action: () => editor.chain().focus().setTextAlign('left').run(), active: editor.isActive({ textAlign: 'left' }), title: '左对齐', render: 'align-left' as const },
        { label: '⬡', action: () => editor.chain().focus().setTextAlign('center').run(), active: editor.isActive({ textAlign: 'center' }), title: '居中对齐', render: 'align-center' as const },
        { label: '➡', action: () => editor.chain().focus().setTextAlign('right').run(), active: editor.isActive({ textAlign: 'right' }), title: '右对齐', render: 'align-right' as const },
      ],
    },
    {
      buttons: [
        { label: '—', action: () => editor.chain().focus().setHorizontalRule().run(), active: false, title: '分割线', render: 'hr' as const },
        { label: '⊞', action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), active: false, title: '插入表格', render: 'table' as const },
        { label: '🖼', action: handleImageLocal, active: false, title: '图片', render: 'image' as const },
      ],
    },
  ]

  // Image alignment controls (show when an image is selected)
  if (editor.isActive("image")) {
    const imgAlign = editor.getAttributes("paragraph").textAlign || "left"
    groups.push({
      buttons: [
        { label: "⬒", action: () => editor.chain().focus().setTextAlign("left").run(), active: imgAlign === "left", title: "左对齐" },
        { label: "⬔", action: () => editor.chain().focus().setTextAlign("center").run(), active: imgAlign === "center", title: "居中" },
        { label: "⬓", action: () => editor.chain().focus().setTextAlign("right").run(), active: imgAlign === "right", title: "右对齐" },
      ],
    })
  }

  return (
    <div className="flex items-center gap-0.5 pl-3 pr-2 min-h-[var(--titlebar-height)] border-b border-[var(--border)] bg-[var(--bg-secondary)] shrink-0 relative flex-wrap">
      {onSearchToggle && (
        <>
          <button
            onClick={onSearchToggle}
            className="min-w-[24px] text-center px-1 py-0.5 text-xs rounded transition-colors text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10"
            title="搜索"
          >
            <span className="flex items-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </span>
          </button>
          <div className="w-px h-4 mx-1 bg-[var(--border)]" />
        </>
      )}
      {groups.map((group, i) => (
        <div key={i} className="flex items-center gap-0.5 relative">
          {group.buttons.map((btn) => {
            const r = (btn as any).render
            if (r === 'align-left' || r === 'align-center' || r === 'align-right') {
              const paths: Record<string, string> = {
                'align-left': 'M17 6H3M19 10H3M15 14H3M17 18H3',
                'align-center': 'M3 6h18M5 10h14M3 14h18M5 18h14',
                'align-right': 'M7 6h14M9 10h12M5 14h16M7 18h14',
              }
              return (
                <button
                  key={r}
                  onClick={() => editor.chain().focus().setTextAlign(r === 'align-left' ? 'left' : r === 'align-center' ? 'center' : 'right').run()}
                  className={`min-w-[24px] text-center px-1 py-0.5 text-xs rounded transition-colors ${
                    btn.active ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                  title={btn.title}
                ><span className="flex items-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={paths[r]}/></svg></span></button>
              )
            }
            if (r === 'hr') {
              return (
                <button
                  key="hr"
                  onClick={() => editor.chain().focus().setHorizontalRule().run()}
                  className="min-w-[24px] text-center px-1 py-0.5 text-xs rounded transition-colors text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10"
                  title="分割线"
                >
                  <span className="flex items-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14"/>
                    </svg>
                  </span>
                </button>
              )
            }
            if ((btn as any).render === 'table') {
              if (editor.isActive('table')) {
                return (
                  <Fragment key="table-group">
                    <button
                      onClick={() => editor.chain().focus().deleteTable().run()}
                      className="min-w-[24px] text-center px-1 py-0.5 text-xs rounded transition-colors text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10"
                      title="删除表格"
                    >🗑</button>
                    <button
                      onClick={() => editor.chain().focus().addRowAfter().run()}
                      className="min-w-[24px] text-center px-1 py-0.5 text-xs rounded transition-colors text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10"
                      title="下行插入"
                    >+行</button>
                    <button
                      onClick={handleDeleteRow}
                      className="min-w-[24px] text-center px-1 py-0.5 text-xs rounded transition-colors text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10"
                      title="删除行"
                    >-行</button>
                    <button
                      onClick={() => editor.chain().focus().addColumnAfter().run()}
                      className="min-w-[24px] text-center px-1 py-0.5 text-xs rounded transition-colors text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10"
                      title="右列插入"
                    >+列</button>
                    <button
                      onClick={handleDeleteColumn}
                      className="min-w-[24px] text-center px-1 py-0.5 text-xs rounded transition-colors text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10"
                      title="删除列"
                    >-列</button>
                  </Fragment>
                )
              }
              return (
                <button
                  key="table-insert"
                  onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                  className="min-w-[24px] text-center px-1 py-0.5 text-xs rounded transition-colors text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10"
                  title="插入表格"
                >
                  <span className="flex items-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <path d="M3 9h18M9 3v18"/>
                    </svg>
                  </span>
                </button>
              )
            }
            if ((btn as any).render === 'image') {
              return (
                <div key="image" className="relative group flex items-center">
                  <button
                    className="min-w-[24px] text-center px-1 py-0.5 text-xs rounded transition-colors text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10"
                    title="图片"
                  >
                    <span className="flex items-center leading-none">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="block">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </span>
                  </button>
                  <div className="absolute top-0 left-0 right-0 h-3 pointer-events-none" />
                  <div className="absolute top-full left-0 z-50 flex-col bg-[var(--bg-titlebar)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden hidden group-hover:flex"
                    style={{ marginTop: 0 }}
                  >
                    <div className="h-1" />
                    <button
                      onClick={handleImageLocal}
                      className="px-3 py-1.5 text-xs text-left hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-primary)] whitespace-nowrap"
                    >本地图片</button>
                    <button
                      onClick={handleImageUrl}
                      className="px-3 py-1.5 text-xs text-left hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-primary)] whitespace-nowrap"
                    >URL图片</button>
                  </div>
                </div>
              )
            }
            return (
              <button
                key={btn.label}
                onClick={btn.action}
                title={btn.title}
                className={`min-w-[24px] text-center px-1 py-0.5 text-xs rounded transition-colors ${
                  btn.active
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                {btn.label}
              </button>
            )
          })}
          {i < groups.length - 1 && (
            <div className="w-px h-4 mx-1 bg-[var(--border)]" />
          )}
        </div>
      ))}

      <div className="ml-auto" />
    </div>
  )
}
