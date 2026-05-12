import { create } from 'zustand'
import type { FileEntry, DirectoryResult } from '@/types'

const STORAGE_KEY_PATH = 'graphite-last-dir'
const STORAGE_KEY_NAME = 'graphite-last-dir-name'
const STORAGE_KEY_FILE = 'graphite-last-file'

function saveToStorage(path: string, name: string) {
  try {
    localStorage.setItem(STORAGE_KEY_PATH, path)
    localStorage.setItem(STORAGE_KEY_NAME, name)
  } catch {
    // localStorage not available (e.g. server-side rendering)
  }
}

function saveFileToStorage(path: string) {
  try {
    localStorage.setItem(STORAGE_KEY_FILE, path)
  } catch {}
}

function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY_PATH)
    localStorage.removeItem(STORAGE_KEY_NAME)
    localStorage.removeItem(STORAGE_KEY_FILE)
  } catch {
    // localStorage not available
  }
}

function loadSavedPath(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_PATH)
  } catch {
    return null
  }
}

function loadSavedFile(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_FILE)
  } catch {
    return null
  }
}

const RECENT_FILES_KEY = 'graphite-recent-files'
const RECENT_DIRS_KEY = 'graphite-recent-dirs'
const MAX_RECENT_FILES = 10
const MAX_RECENT_DIRS = 8
const GRAPHITE_ROOT_MARKERS = ['package.json', 'vite.config.ts', 'src-tauri/tauri.conf.json', 'src/main.tsx'] as const
const PROTECTED_GRAPHITE_FILES = new Set([
  'index.html',
  'package.json',
  'vite.config.ts',
  'src/main.tsx',
  'src-tauri/tauri.conf.json',
])
const graphiteRootCache = new Map<string, boolean>()

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/g, '').toLowerCase()
}

function joinPath(base: string, relative: string): string {
  return `${base.replace(/[\\/]+$/g, '')}/${relative}`
}

function relativeToRoot(root: string, path: string): string | null {
  const normalizedRoot = normalizePath(root)
  const normalizedPath = normalizePath(path)
  if (normalizedPath === normalizedRoot) return ''
  if (!normalizedPath.startsWith(`${normalizedRoot}/`)) return null
  return normalizedPath.slice(normalizedRoot.length + 1)
}

async function looksLikeGraphiteSourceRoot(rootPath: string): Promise<boolean> {
  const normalizedRoot = normalizePath(rootPath)
  const cached = graphiteRootCache.get(normalizedRoot)
  if (cached !== undefined) return cached
  try {
    const { exists } = await import('@tauri-apps/plugin-fs')
    const checks = await Promise.all(
      GRAPHITE_ROOT_MARKERS.map((relative) => exists(joinPath(rootPath, relative)))
    )
    const isGraphiteRoot = checks.every(Boolean)
    graphiteRootCache.set(normalizedRoot, isGraphiteRoot)
    return isGraphiteRoot
  } catch {
    graphiteRootCache.set(normalizedRoot, false)
    return false
  }
}

async function isProtectedGraphiteWorkspaceFile(rootPath: string | null, filePath: string): Promise<boolean> {
  if (!rootPath) return false
  if (!(await looksLikeGraphiteSourceRoot(rootPath))) return false
  const relative = relativeToRoot(rootPath, filePath)
  if (!relative) return false
  return PROTECTED_GRAPHITE_FILES.has(relative)
}

export function addRecentFile(path: string, name: string, rootPath?: string | null): void {
  try {
    const raw = localStorage.getItem(RECENT_FILES_KEY)
    const list: { path: string; name: string; rootPath?: string | null }[] = raw ? JSON.parse(raw) : []
    const filtered = list.filter((f) => f.path !== path)
    filtered.unshift({ path, name, rootPath: rootPath || undefined })
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT_FILES)))
  } catch {}
}

export function addRecentDirectory(path: string, name: string): void {
  try {
    const raw = localStorage.getItem(RECENT_DIRS_KEY)
    const list: { path: string; name: string }[] = raw ? JSON.parse(raw) : []
    const filtered = list.filter((dir) => dir.path !== path)
    filtered.unshift({ path, name })
    localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT_DIRS)))
  } catch {}
}

export function getRecentFiles(): { path: string; name: string; rootPath?: string | null }[] {
  try {
    const raw = localStorage.getItem(RECENT_FILES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function getRecentDirectories(): { path: string; name: string }[] {
  try {
    const raw = localStorage.getItem(RECENT_DIRS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function clearRecentFiles(): void {
  try { localStorage.removeItem(RECENT_FILES_KEY) } catch {}
}

interface FileState {
  rootPath: string | null
  rootName: string | null
  fileTree: FileEntry[] | null
  currentFilePath: string | null
  currentContent: string | null
  originalContent: string | null
  isDirty: boolean
  openTabs: string[]
  userEdited: boolean
  saveStatus: 'saved' | 'unsaved' | 'saving' | 'auto-saving'
  loading: boolean
  error: string | null

  loadDirectory: (path: string) => Promise<void>
  refreshDirectory: () => Promise<void>
  openFile: (path: string, opts?: { skipDirtyCheck?: boolean }) => Promise<void>
  closeTab: (path: string) => Promise<void>
  closeTabs: (mode: 'current' | 'left' | 'right' | 'all', path: string) => Promise<void>
  reorderTabs: (tabs: string[]) => void
  switchTab: (path: string) => Promise<void>
  saveCurrentFile: (mode?: 'saving' | 'auto-saving') => Promise<void>
  setCurrentContent: (content: string) => void
  markEdited: () => void
  setSaveStatus: (status: 'saved' | 'unsaved' | 'saving' | 'auto-saving') => void
  syncRenamedPath: (oldPath: string, newPath: string) => void
  clearCurrentFileIfMatches: (path: string) => void
  clearError: () => void
}

export const useFileStore = create<FileState>((set, get) => ({
  rootPath: null,
  rootName: null,
  fileTree: null,
  currentFilePath: null,
  currentContent: null,
  originalContent: null,
  isDirty: false,
  openTabs: [],
  userEdited: false,
  saveStatus: 'saved' as const,
  loading: false,
  error: null,

  loadDirectory: async (path: string) => {
    const state = get()
    const isSameDir = state.rootPath === path
    if (!isSameDir && state.isDirty && state.currentFilePath) {
      const { useUIStore } = await import('./uiStore')
      const result = await useUIStore.getState().showConfirm({
        title: '未保存的更改',
        message: '当前文件有未保存的更改。保存后再切换工作区？',
        confirmText: '不保存',
        saveText: '保存',
      })
      if (result === 'cancel') return
      if (result === 'save') {
        const save = typeof window !== 'undefined' ? (window as any).__graphiteSave : undefined
        if (save) await save()
      }
    }
    set({
      ...(isSameDir ? {} : {
        currentFilePath: null,
        currentContent: null,
        originalContent: null,
        isDirty: false,
      }),
      loading: true,
      error: null,
    })
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<DirectoryResult>('read_directory', { path })
      saveToStorage(path, result.name)
      addRecentDirectory(path, result.name)
      set({
        rootPath: path,
        rootName: result.name,
        fileTree: result.children,
        loading: false,
      })
    } catch (err: any) {
      clearStorage()
      set({ error: String(err), loading: false })
    }
  },

  refreshDirectory: async () => {
    const { rootPath } = get()
    if (!rootPath) return
    set({ loading: true, error: null })
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<DirectoryResult>('read_directory', { path: rootPath })
      set({
        rootPath,
        rootName: result.name,
        fileTree: result.children,
        loading: false,
      })
    } catch (err: any) {
      set({ error: String(err), loading: false })
    }
  },

  openFile: async (path: string, opts) => {
    // Check for unsaved changes before switching
    const state = get()
    if (!opts?.skipDirtyCheck && state.isDirty && state.currentFilePath && state.currentFilePath !== path) {
      const { useUIStore } = await import('./uiStore')
      const result = await useUIStore.getState().showConfirm({
        title: '未保存的更改',
        message: '当前文件有未保存的更改。保存后再切换？',
        confirmText: '不保存',
        saveText: '保存',
      })
      if (result === 'cancel') return
      if (result === 'save') {
        // Use editor save handler (reads from TipTap)
        const win = typeof window !== 'undefined' ? (window as any).__graphiteSave : undefined
        if (win) { await win() }
      }
      // result === 'confirm' or fallback → discard changes, proceed
    }
    set({ loading: true, error: null })
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const content = await invoke<string>('read_file', { path })
      saveFileToStorage(path)
      addRecentFile(path, path.split(/[\\/]/).pop() || path, get().rootPath)
      set(function(st: any) {
        var tabs = st.openTabs || []
        if (!tabs.includes(path)) tabs = [...tabs, path]
        return {
          currentFilePath: path,
          currentContent: content,
          originalContent: content,
          isDirty: false,
          saveStatus: 'saved' as const,
          loading: false,
          openTabs: tabs,
        }
      })
    } catch (err: any) {
      set({ error: String(err), loading: false })
      throw err
    }
  },

  closeTab: async function(path: string) {
    var st = get()
    var tabs = (st.openTabs || []).filter(function(p: string) { return p !== path })
    if (path === st.currentFilePath) {
      var nextPath = tabs.length > 0 ? tabs[tabs.length - 1] : null
      if (nextPath) {
        await get().openFile(nextPath, { skipDirtyCheck: true })
      } else {
        set({ currentFilePath: null, currentContent: null, originalContent: null, isDirty: false, openTabs: [] })
      }
    }
    set({ openTabs: tabs })
    try { localStorage.removeItem(STORAGE_KEY_FILE) } catch {}
  },

  switchTab: async function(path: string) {
    var st = get()
    if (path === st.currentFilePath) return
    await st.openFile(path, { skipDirtyCheck: true })
  },

  saveCurrentFile: async (mode: 'saving' | 'auto-saving' = 'saving') => {
    const state = get()
    const { currentFilePath, currentContent, rootPath } = state
    if (!currentFilePath || currentContent === null) return

    if (await isProtectedGraphiteWorkspaceFile(rootPath, currentFilePath)) {
      const { useUIStore } = await import('./uiStore')
      await useUIStore.getState().showConfirm({
        title: '禁止保存到程序源码文件',
        message: '当前文件是 Graphite 自己的关键源码文件，不能当作文档保存。请改为在普通工作区或其他 HTML 文件里编辑。',
        confirmText: '知道了',
      })
      set({ saveStatus: 'unsaved' })
      return
    }

    try {
      set({ saveStatus: mode })
      const { invoke } = await import('@tauri-apps/api/core')
      // Tell watcher to ignore the upcoming write (don't trigger "external modification")
      try { await invoke('skip_next_event', { path: currentFilePath }) } catch {}
      // Always write the current content
      await invoke('write_file', { path: currentFilePath, content: currentContent })
      set({ isDirty: false, originalContent: currentContent, saveStatus: 'saved' })
    } catch (err: any) {
      set({ error: String(err), saveStatus: 'unsaved' })
    }
  },

  setCurrentContent: (content: string) => {
    set({ currentContent: content, isDirty: true, saveStatus: 'unsaved' })
  },

  setSaveStatus: (status) => set({ saveStatus: status }),

  markEdited: () => set({ userEdited: true }),

  syncRenamedPath: (oldPath: string, newPath: string) => {
    const state = get()
    if (state.currentFilePath !== oldPath) return
    saveFileToStorage(newPath)
    addRecentFile(newPath, newPath.split(/[\\/]/).pop() || newPath, state.rootPath)
    var tabs = (get().openTabs || []).map(function(p: string) { return p === oldPath ? newPath : p })
    set({ currentFilePath: newPath, openTabs: tabs })
  },

  reorderTabs: function(tabs: string[]) {
    set({ openTabs: tabs })
  },
  closeTabs: async function(mode: 'current' | 'left' | 'right' | 'all', path: string) {
    var st = get()
    var tabs = st.openTabs || []
    var idx = tabs.indexOf(path)
    if (mode === 'all') { set({ currentFilePath: null, currentContent: null, originalContent: null, isDirty: false, openTabs: [] }); return }
    if (mode === 'current') { await get().closeTab(path); return }
    var keep: string[] = []
    for (var i = 0; i < tabs.length; i++) {
      if (mode === 'left' && i >= idx) keep.push(tabs[i])
      else if (mode === 'right' && i <= idx) keep.push(tabs[i])
    }
    if (!keep.includes(st.currentFilePath!)) await get().closeTab(tabs[idx > 0 ? idx - 1 : 1] || '')
    set({ openTabs: keep })
  },
  clearCurrentFileIfMatches: (path: string) => {
    const state = get()
    var tabs = (state.openTabs || []).filter(function(p: string) { return p !== path })
    if (state.currentFilePath !== path) {
      set({ openTabs: tabs }); return
    }
    try { localStorage.removeItem(STORAGE_KEY_FILE) } catch {}
    set({
      currentFilePath: null,
      currentContent: null,
      originalContent: null,
      isDirty: false,
      saveStatus: 'saved',
      openTabs: tabs,
    })
  },

  clearError: () => set({ error: null }),
}))

// Auto-load the last opened directory and file on startup
const savedPath = loadSavedPath()
const savedFile = loadSavedFile()
if (savedPath) {
  useFileStore.getState().loadDirectory(savedPath).then(() => {
    if (savedFile?.startsWith(savedPath)) {
      // Quick sanity check: reject if file looks like corrupted data
      useFileStore.getState().openFile(savedFile).catch(() => {
        localStorage.removeItem(STORAGE_KEY_FILE)
      })
    }
  })
}
