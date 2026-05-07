import graphiteHorizontal from '@/assets/branding/graphite-horizontal-1024.png'
import { getRecentDirectories, getRecentFiles, useFileStore } from '@/stores/fileStore'
import Editor from './Editor'

function Section({
  title,
  items,
  onOpen,
}: {
  title: string
  items: { path: string; name: string; rootPath?: string | null }[]
  onOpen: (path: string) => Promise<void> | void
}) {
  if (items.length === 0) return null

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-sidebar)]/35 p-4 text-left">
      <div className="mb-3 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {title}
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.path}
            onClick={() => void onOpen(item.path)}
            className="group block w-full rounded-lg border border-transparent px-3 py-2 text-left hover:border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5"
            title={item.path}
          >
            <div className="truncate text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)]">
              {item.name}
            </div>
            <div className="truncate text-xs text-[var(--text-muted)]">
              {item.path}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function EditorPlaceholder() {
  const { currentFilePath, rootPath, rootName } = useFileStore((s) => ({
    currentFilePath: s.currentFilePath,
    rootPath: s.rootPath,
    rootName: s.rootName,
  }))

  if (currentFilePath) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Editor key={currentFilePath} />
      </div>
    )
  }

  const recentDirectories = getRecentDirectories()
  const recentFiles = getRecentFiles()

  const openFolder = async () => {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, multiple: false })
    if (selected && typeof selected === 'string') {
      await useFileStore.getState().loadDirectory(selected)
    }
  }

  const openRecentDirectory = async (path: string) => {
    await useFileStore.getState().loadDirectory(path)
  }

  const openRecentFile = async (path: string) => {
    try {
      const recent = getRecentFiles().find((item) => item.path === path)
      const idx = path.replace(/\\/g, '/').lastIndexOf('/')
      const parentDir = idx >= 0 ? path.substring(0, idx) : null
      const workspacePath = recent?.rootPath || parentDir
      if (workspacePath) {
        await useFileStore.getState().loadDirectory(workspacePath)
      }
      await useFileStore.getState().openFile(path)
    } catch (error) {
      console.error('Failed to open recent file:', error)
    }
  }

  if (rootPath) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center px-8 py-12 text-[var(--text-muted)]">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-sidebar)]/30 p-8">
            <div className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Workspace Ready
            </div>
            <h2 className="mb-2 text-2xl font-semibold text-[var(--text-primary)]">
              {rootName || '当前工作区'}
            </h2>
            <p className="mb-6 break-all text-sm">{rootPath}</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void openFolder()}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white hover:bg-[var(--accent-hover)]"
              >
                打开其他文件夹
              </button>
            </div>
            {recentFiles.length > 0 && (
              <div className="mt-8">
                <Section
                  title="最近文件"
                  items={recentFiles.slice(0, 6)}
                  onOpen={openRecentFile}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center px-8 py-12 text-[var(--text-muted)]">
        <div className="mb-10 text-center">
          <img
            src={graphiteHorizontal}
            alt="Graphite"
            className="mx-auto mb-5 w-[360px] max-w-[72vw] select-none opacity-85"
            draggable={false}
          />
          <p className="mb-2 text-sm">本地优先的 Markdown 工作区</p>
          <p className="mb-6 text-xs opacity-70">打开文件夹开始编辑，或从最近项目继续。</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => void openFolder()}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white hover:bg-[var(--accent-hover)]"
            >
              打开文件夹
            </button>
          </div>
          <p className="mt-4 text-xs opacity-60">Ctrl+O 打开文件夹</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Section
            title="最近项目"
            items={recentDirectories}
            onOpen={openRecentDirectory}
          />
          <Section
            title="最近文件"
            items={recentFiles}
            onOpen={openRecentFile}
          />
        </div>
      </div>
    </div>
  )
}
