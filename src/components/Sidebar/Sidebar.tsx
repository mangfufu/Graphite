import { useState, useCallback, useEffect, useRef } from 'react'
import { useFileStore, getRecentDirectories, getRecentFiles } from '@/stores/fileStore'
import { useUIStore } from '@/stores/uiStore'
import { matchKeyboardEvent, getKeys, DEFAULT_SHORTCUTS } from '@/components/Modals/shortcuts'
import FileTree from './FileTree'
import OutlinePanel from './OutlinePanel'
import type { FileEntry } from '@/types'

function RecentFiles() {
  const [expanded, setExpanded] = useState(false)
  const recent = getRecentFiles()
  if (recent.length === 0) return null
  return (
    <div className="border-b border-[var(--border)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 w-full px-2 py-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <span className="text-xs">{expanded ? '▼' : '▶'}</span>
        最近打开 <span className="text-[10px]">({recent.length})</span>
      </button>
      {expanded && (
        <div className="pb-1">
          {recent.slice(0, 8).map((f, i) => (
            <button
              key={i}
              onClick={async () => {
                try {
                  const idx = f.path.replace(/\\/g, '/').lastIndexOf('/')
                  const parentDir = idx >= 0 ? f.path.substring(0, idx) : null
                  const workspacePath = f.rootPath || parentDir
                  if (workspacePath) await useFileStore.getState().loadDirectory(workspacePath)
                  await useFileStore.getState().openFile(f.path)
                } catch (error) {
                  console.error('Failed to open recent file:', error)
                }
              }}
              className="w-full text-left px-3 py-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors truncate"
              title={f.path}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function RecentDirectories() {
  const recent = getRecentDirectories()
  if (recent.length === 0) return null
  return (
    <div className="mt-4 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)]/40 p-2">
      <div className="mb-2 px-1 text-[11px] text-[var(--text-muted)]">最近项目</div>
      <div className="space-y-1">
        {recent.slice(0, 5).map((dir) => (
          <button
            key={dir.path}
            onClick={() => void useFileStore.getState().loadDirectory(dir.path)}
            className="block w-full rounded px-2 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5"
            title={dir.path}
          >
            <div className="truncate text-[11px] text-[var(--text-primary)]">{dir.name}</div>
            <div className="truncate text-[10px] text-[var(--text-muted)]">{dir.path}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function OutlineSection() {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border-b border-[var(--border)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 w-full px-2 py-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <span className="text-xs">{expanded ? '▼' : '▶'}</span>
        大纲
      </button>
      {expanded && <OutlinePanel />}
    </div>
  )
}

function filterTree(entries: FileEntry[], query: string): FileEntry[] {
  if (!query) return entries
  const lower = query.toLowerCase()
  return entries.reduce<FileEntry[]>((acc, entry) => {
    const nameMatch = entry.name.toLowerCase().includes(lower)
    const children = entry.children ? filterTree(entry.children, query) : []
    if (nameMatch || children.length > 0) {
      acc.push({ ...entry, children: children.length > 0 ? children : entry.children })
    }
    return acc
  }, [])
}

export default function Sidebar() {
  const { rootPath, error, clearError, fileTree } = useFileStore()
  const searchQuery = useUIStore((s) => s.sidebarSearchQuery)
  const setSidebarSearchQuery = useUIStore((s) => s.setSidebarSearchQuery)
  const setContextMenu = useUIStore((s) => s.setContextMenu)
  const searchRef = useRef<HTMLInputElement>(null)

  // Ctrl+Shift+F to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (matchKeyboardEvent(e, getKeys(DEFAULT_SHORTCUTS.find((s) => s.id === 'fileSearch')!))) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault()
          searchRef.current?.focus()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const filteredTree = filterTree(fileTree || [], searchQuery)

  const handleEmptyContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (!rootPath) return
    setContextMenu({ x: e.clientX, y: e.clientY, target: null })
  }, [rootPath, setContextMenu])

  const handleOpenFolder = async () => {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, multiple: false })
    if (selected && typeof selected === 'string') {
      useFileStore.getState().loadDirectory(selected)
      useUIStore.getState().setSidebarOpen(true)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-sidebar)] text-xs">
      {/* Error */}
      {error && (
        <div className="p-2 m-1 rounded bg-red-500/10 text-red-500 text-xs">
          {error}
          <button onClick={clearError} className="ml-2 underline">关闭</button>
        </div>
      )}

      {/* Search */}
      {rootPath && (
        <div className="relative px-2 pb-1 pt-1.5">
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSidebarSearchQuery(e.target.value)}
            placeholder="搜索文件..."
            className="w-full px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)] pr-6"
          />
          {searchQuery && (
            <button
              onClick={() => { setSidebarSearchQuery(''); searchRef.current?.focus() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] leading-none px-1"
            >×</button>
          )}
        </div>
      )}

      {/* Recent files */}
      {rootPath && !searchQuery && <RecentFiles />}

      {/* Outline */}
      {rootPath && !searchQuery && <OutlineSection />}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto" onContextMenu={handleEmptyContextMenu}>
        {rootPath ? (
          <FileTree entries={filteredTree} searchQuery={searchQuery} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
            <p className="text-[var(--text-muted)]">尚未打开文件夹</p>
            <button onClick={handleOpenFolder} className="px-3 py-1.5 rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors">
              打开文件夹
            </button>
            <RecentDirectories />
          </div>
        )}
      </div>
    </div>
  )
}
