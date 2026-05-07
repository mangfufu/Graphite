import { create } from 'zustand'

interface ConfirmState {
  open: boolean
  title: string
  message: string
  confirmText?: string
  saveText?: string
  resolve: ((value: 'confirm' | 'cancel' | 'save') => void) | null
}

interface ContextMenuTarget {
  path: string
  name: string
  isDir: boolean
}

interface UIState {
  sidebarOpen: boolean
  sidebarWidth: number
  outlineOpen: boolean
  outlineWidth: number
  showExportModal: boolean
  showSettingsModal: boolean
  showCommandPalette: boolean
  sidebarSearchQuery: string
  confirm: ConfirmState
  contextMenu: { x: number; y: number; target: ContextMenuTarget | null } | null

  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarWidth: (width: number) => void
  toggleOutline: () => void
  setOutlineOpen: (open: boolean) => void
  setOutlineWidth: (width: number) => void
  setShowExportModal: (show: boolean) => void
  setShowSettingsModal: (show: boolean) => void
  setShowCommandPalette: (show: boolean) => void
  setSidebarSearchQuery: (query: string) => void
  showConfirm: (opts: { title: string; message: string; confirmText?: string; saveText?: string }) => Promise<'confirm' | 'cancel' | 'save'>
  closeConfirm: () => void
  setContextMenu: (menu: { x: number; y: number; target: ContextMenuTarget | null } | null) => void
  closeContextMenu: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarWidth: 220,
  outlineOpen: false,
  outlineWidth: 200,
  showExportModal: false,
  showSettingsModal: false,
  showCommandPalette: false,
  confirm: { open: false, title: '', message: '', resolve: null },
  contextMenu: null,
  sidebarSearchQuery: '',

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  toggleOutline: () => set((s) => ({ outlineOpen: !s.outlineOpen })),
  setOutlineOpen: (open) => set({ outlineOpen: open }),
  setOutlineWidth: (width) => set({ outlineWidth: width }),
  setShowExportModal: (show) => set({ showExportModal: show }),
  setShowSettingsModal: (show) => set({ showSettingsModal: show }),
  setShowCommandPalette: (show) => set({ showCommandPalette: show }),
  setSidebarSearchQuery: (query) => set({ sidebarSearchQuery: query }),

  showConfirm: (opts) => {
    return new Promise<'confirm' | 'cancel' | 'save'>((resolve) => {
      set({
        confirm: {
          open: true,
          title: opts.title,
          message: opts.message,
          confirmText: opts.confirmText,
          saveText: opts.saveText,
          resolve,
        },
      })
    })
  },

  closeConfirm: () => {
    const state = useUIStore.getState().confirm
    state.resolve?.('cancel')
    set({ confirm: { open: false, title: '', message: '', resolve: null } })
  },

  setContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: null }),
}))
