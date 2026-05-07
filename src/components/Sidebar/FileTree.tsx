import { useState } from 'react'
import { useFileStore } from '@/stores/fileStore'
import { useUIStore } from '@/stores/uiStore'
import type { FileEntry } from '@/types'

interface FileTreeNodeProps {
  entry: FileEntry
  depth?: number
}

function FileTreeNode({ entry, depth = 0 }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const { openFile, currentFilePath } = useFileStore()
  const setContextMenu = useUIStore((s) => s.setContextMenu)
  const isActive = !entry.is_dir && currentFilePath === entry.path

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      target: { path: entry.path, name: entry.name, isDir: entry.is_dir },
    })
  }

  if (entry.is_dir) {
    return (
      <div>
        <button
          className="flex items-center gap-1 w-full px-2 py-1 text-left hover:bg-black/5 dark:hover:bg-white/5 rounded text-xs text-[var(--text-primary)]"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => setExpanded(!expanded)}
          onContextMenu={handleContextMenu}
        >
          <span className="w-3 text-center text-[var(--text-muted)]">
            {expanded ? '▼' : '▶'}
          </span>
          <span className="opacity-70">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              {expanded ? (
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              ) : (
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              )}
            </svg>
          </span>
          <span className="truncate">{entry.name}</span>
        </button>
        {expanded && entry.children?.map((child) => (
          <FileTreeNode key={child.path} entry={child} depth={depth + 1} />
        ))}
      </div>
    )
  }

  return (
    <button
      className={`flex items-center gap-1 w-full px-2 py-1 text-left rounded text-xs ${
        isActive
          ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
          : 'hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-primary)]'
      }`}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      onClick={() => openFile(entry.path)}
      onContextMenu={handleContextMenu}
    >
      <span className="w-3" />
      <span className="opacity-60">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14,2 14,8 20,8" />
        </svg>
      </span>
      <span className="truncate">{entry.name}</span>
    </button>
  )
}

interface FileTreeProps {
  entries: FileEntry[]
  searchQuery: string
}

export default function FileTree({ entries, searchQuery }: FileTreeProps) {
  if (entries.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-[var(--text-muted)]">
        {searchQuery ? '没有匹配的文件' : '此目录为空'}
      </div>
    )
  }

  return (
    <div className="py-1">
      {entries.map((entry) => (
        <FileTreeNode key={entry.path} entry={entry} />
      ))}
    </div>
  )
}
