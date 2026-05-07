import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useFileStore } from '@/stores/fileStore'

type FileChangedPayload = {
  paths: string[]
  kind: string
}

function isStructuralChange(kind: string): boolean {
  return /Create|Remove|Name/.test(kind)
}

export function useFileWatcher(rootPath: string | null) {
  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setup = async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      unlisten = await listen<FileChangedPayload>('file-changed', async (event) => {
        const store = useFileStore.getState()
        const currentPath = store.currentFilePath
        const { paths, kind } = event.payload
        const touchesCurrentFile = !!currentPath && paths.some((p) => p === currentPath)

        if (touchesCurrentFile) {
          if (isStructuralChange(kind)) {
            store.clearCurrentFileIfMatches(currentPath!)
          } else {
            const { confirm: dlgConfirm } = await import('@tauri-apps/plugin-dialog')
            const result = await dlgConfirm('文件已被外部修改，是否重新加载？', { title: '文件变更', kind: 'warning' })
            if (result) {
              try {
                await store.openFile(currentPath!, { skipDirtyCheck: true })
              } catch (error) {
                console.error('Failed to reload externally modified file:', error)
              }
            }
          }
        }

        if (isStructuralChange(kind)) {
          await store.refreshDirectory()
        }
      })

      if (rootPath) {
        try { await invoke('start_watcher', { path: rootPath }) }
        catch (e) { console.error('Failed to start watcher:', e) }
      }
    }
    setup()

    return () => { unlisten?.() }
  }, [rootPath])
}
