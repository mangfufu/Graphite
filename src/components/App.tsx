import { useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useThemeStore } from '@/stores/themeStore'
import { useFileStore } from '@/stores/fileStore'
import '@/stores/editorStore'
import ErrorBoundary from './Common/ErrorBoundary'
import TitleBar from './TitleBar/TitleBar'
import ActivityBar from './Sidebar/ActivityBar'
import Sidebar from './Sidebar/Sidebar'
import EditorPlaceholder from './Editor/EditorPlaceholder'
import ConfirmDialog from './Common/ConfirmDialog'
import ContextMenu from './Common/ContextMenu'
import ExportModal from './Modals/ExportModal'
import SettingsModal from './Modals/SettingsModal'
import CommandPalette from './Modals/CommandPalette'
import { matchKeyboardEvent, getKeys, DEFAULT_SHORTCUTS } from '@/components/Modals/shortcuts'
import { useFileWatcher } from '@/hooks/useFileWatcher'
import { saveSessionSidebar, loadSessionSidebar } from '@/hooks/useSession'

export default function App() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const sidebarWidth = useUIStore((s) => s.sidebarWidth)
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth)
  const confirm = useUIStore((s) => s.confirm)
  const closeConfirm = useUIStore((s) => s.closeConfirm)
  const rootPath = useFileStore((s) => s.rootPath)

  // Restore sidebar state from localStorage on mount
  useEffect(() => {
    const sidebar = loadSessionSidebar()
    if (sidebar) {
      useUIStore.getState().setSidebarOpen(sidebar.open)
      useUIStore.getState().setSidebarWidth(sidebar.width)
    }
  }, [])

  // Save sidebar state whenever it changes
  useEffect(() => {
    saveSessionSidebar(sidebarOpen, sidebarWidth)
  }, [sidebarOpen, sidebarWidth])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (matchKeyboardEvent(e, getKeys(DEFAULT_SHORTCUTS.find(s => s.id === 'commandPalette')!))) {
        e.preventDefault()
        useUIStore.getState().setShowCommandPalette(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Ensure theme is applied on mount
  useThemeStore.getState()

  // Watch for file changes
  useFileWatcher(rootPath)

  return (
    <ErrorBoundary>
      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmText={confirm.confirmText}
        saveText={confirm.saveText}
        onConfirm={() => { confirm.resolve?.('confirm'); closeConfirm() }}
        onCancel={() => { confirm.resolve?.('cancel'); closeConfirm() }}
        onSave={confirm.saveText ? () => { confirm.resolve?.('save'); closeConfirm() } : undefined}
      />
      <ContextMenu />
      <ExportModal />
      <SettingsModal />
      <CommandPalette />
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-sidebar)] text-[var(--text-primary)]">
        <TitleBar />
        <div className="flex flex-1 overflow-hidden">
          <ActivityBar />
          {/* Sidebar */}
          <div
            className="flex-shrink-0 overflow-hidden"
            style={{ width: sidebarOpen ? sidebarWidth : 0 }}
          >
            <Sidebar />
          </div>

          {/* Resizable divider */}
          {sidebarOpen && (
            <div
              className="relative w-px shrink-0 cursor-col-resize group"
              onMouseDown={(e) => {
                e.preventDefault()
                const startX = e.clientX
                const startWidth = sidebarWidth
                const onMouseMove = (e: MouseEvent) => {
                  const newWidth = startWidth + (e.clientX - startX)
                  setSidebarWidth(Math.max(150, Math.min(400, Math.round(newWidth))))
                }
                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove)
                  document.removeEventListener('mouseup', onMouseUp)
                }
                document.addEventListener('mousemove', onMouseMove)
                document.addEventListener('mouseup', onMouseUp)
              }}
            >
              <div className="absolute inset-y-0 left-0 w-full bg-[var(--border)] group-hover:bg-[var(--accent)] transition-colors" />
            </div>
          )}

          {/* Main editor area */}
          <main className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-primary)]">
            <EditorPlaceholder />
          </main>

          {/* Right: Outline panel */}
        </div>
      </div>
    </ErrorBoundary>
  )
}
