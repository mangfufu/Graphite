import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useFileStore } from '@/stores/fileStore'
import { invoke } from '@tauri-apps/api/core'
import PromptDialog from './PromptDialog'

const EXTENSIONS = [
  { label: '.md', value: '.md' },
  { label: '.html', value: '.html' },
  { label: '.htm', value: '.htm' },
  { label: '.txt', value: '.txt' },
]

export default function ContextMenu() {
  const menu = useUIStore((s) => s.contextMenu)
  const closeContextMenu = useUIStore((s) => s.closeContextMenu)
  const showConfirm = useUIStore((s) => s.showConfirm)
  const rootPath = useFileStore((s) => s.rootPath)
  const menuRef = useRef<HTMLDivElement>(null)

  const [prompt, setPrompt] = useState<{ title: string; value?: string; defaultExt?: string; hideExtensions?: boolean; onConfirm: (name: string) => void } | null>(null)

  // Reset prompt when menu opens (prevent stale prompt from showing)
  useEffect(() => {
    if (menu) setPrompt(null)
  }, [menu])

  // Close on Escape, click outside
  useEffect(() => {
    if (!menu) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu()
    }
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleClick)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleClick)
    }
  }, [menu, closeContextMenu])

  const getParentDir = (): string | null => {
    if (!menu) return null
    if (!menu.target) return rootPath
    if (menu.target.isDir) return menu.target.path
    const idx = menu.target.path.replace(/\\/g, '/').lastIndexOf('/')
    return idx >= 0 ? menu.target.path.substring(0, idx) : null
  }

  const handleAction = (action: 'newFile' | 'newFolder' | 'rename' | 'delete') => {

    if (action === 'newFile') {
      const parentDir = getParentDir()
      if (!parentDir) return
      setPrompt({
        title: '新建文件',
        onConfirm: async (fullName) => {
          setPrompt(null)
          closeContextMenu()
          const fullPath = parentDir.replace(/\\$/, '') + '/' + fullName
          try {
            await invoke('create_file', { path: fullPath })
            if (rootPath) useFileStore.getState().loadDirectory(rootPath)
            // Auto-open the newly created file
            useFileStore.getState().openFile(fullPath)
          } catch (err) { console.error('Failed to create file:', err) }
        },
      })
      return
    }

    if (action === 'newFolder') {
      const parentDir = getParentDir()
      if (!parentDir) return
      setPrompt({
        title: '新建文件夹',
        hideExtensions: true,
        onConfirm: async (fullName) => {
          setPrompt(null)
          closeContextMenu()
          try {
            await invoke('create_directory', { path: parentDir.replace(/\\$/, '') + '/' + fullName })
            if (rootPath) useFileStore.getState().loadDirectory(rootPath)
          } catch (err) { console.error('Failed to create folder:', err) }
        },
      })
      return
    }

    if (action === 'rename') {
      if (!menu?.target) return
      const { path, name } = menu.target
      const idx = path.replace(/\\/g, '/').lastIndexOf('/')
      const parentDir = idx >= 0 ? path.substring(0, idx) : ''
      const ext = name.includes('.') ? '.' + name.split('.').pop() : ''
      const baseName = ext ? name.slice(0, -ext.length) : name
      setPrompt({
        title: '重命名',
        value: baseName,
        defaultExt: ext || undefined,
        onConfirm: async (newFullName) => {
          setPrompt(null)
          closeContextMenu()
          const newPath = parentDir + '/' + newFullName
          try {
            await invoke('rename_file', { oldPath: path, newPath })
            const store = useFileStore.getState()
            store.syncRenamedPath(path, newPath)
            await store.refreshDirectory()
          } catch (err) { console.error('Failed to rename:', err) }
        },
      })
      return
    }

    if (action === 'delete') {
      if (!menu?.target) return
      closeContextMenu()
      showConfirm({
        title: '确认删除',
        message: `确定要删除 "${menu.target.name}" 吗？此操作不可撤销。`,
        confirmText: '删除',
      }).then((result) => {
        if (result !== 'confirm') return
        const targetPath = menu!.target!.path
        invoke('delete_file', { path: targetPath }).then(() => {
          const store = useFileStore.getState()
          store.clearCurrentFileIfMatches(targetPath)
          store.refreshDirectory()
        }).catch((err) => console.error('Failed to delete:', err))
      })
    }
  }

  const showMenu = !!menu
  const showNewFile = true
  const showNewFolder = true
  const showRename = !!menu?.target
  const showDelete = !!menu?.target

  return (
    <>
      {showMenu && (
        <div
          ref={menuRef}
          className="fixed z-[10000] min-w-[140px] py-1 bg-[var(--bg-titlebar)] border border-[var(--border)] rounded-lg shadow-2xl"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {showNewFile && (
            <button
              className="w-full px-3 py-1.5 text-xs text-left text-[var(--text-primary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              onClick={() => handleAction('newFile')}
            >
              新建文件
            </button>
          )}
          {showNewFolder && (
            <button
              className="w-full px-3 py-1.5 text-xs text-left text-[var(--text-primary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              onClick={() => handleAction('newFolder')}
            >
              新建文件夹
            </button>
          )}
          {showRename && (
            <button
              className="w-full px-3 py-1.5 text-xs text-left text-[var(--text-primary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              onClick={() => handleAction('rename')}
            >
              重命名
            </button>
          )}
          {showDelete && (
            <>
              <div className="my-1 border-t border-[var(--border)]" />
              <button
                className="w-full px-3 py-1.5 text-xs text-left text-red-500 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                onClick={() => handleAction('delete')}
              >
                删除
              </button>
            </>
          )}
        </div>
      )}

      <PromptDialog
        open={!!prompt}
        title={prompt?.title || ''}
        value={prompt?.value}
        defaultExt={prompt?.defaultExt}
        extensions={EXTENSIONS}
        hideExtensions={prompt?.hideExtensions}
        onConfirm={(name) => prompt?.onConfirm(name)}
        onCancel={() => { setPrompt(null); closeContextMenu() }}
      />
    </>
  )
}
