import { create } from 'zustand'

interface EditorSettingsState {
  fontSize: number
  lineSpacing: number
  maxWidth: number
  autoSaveDelay: number
  setFontSize: (px: number) => void
  setLineSpacing: (val: number) => void
  setMaxWidth: (px: number) => void
  setAutoSaveDelay: (ms: number) => void
}

const KEYS = {
  fontSize: 'graphite-font-size',
  lineSpacing: 'graphite-line-spacing',
  maxWidth: 'graphite-max-width',
  autoSaveDelay: 'graphite-autosave-delay',
}

const DEFAULTS = {
  fontSize: 15,
  lineSpacing: 1.7,
  maxWidth: 720,
  autoSaveDelay: 300000,
}

function load(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key)
    return v !== null ? parseFloat(v) : fallback
  } catch { return fallback }
}

function applyProps(vars: Record<string, string>) {
  for (const [key, val] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, val)
  }
}

export const useEditorSettingsStore = create<EditorSettingsState>((set) => ({
  fontSize: load(KEYS.fontSize, DEFAULTS.fontSize),
  lineSpacing: load(KEYS.lineSpacing, DEFAULTS.lineSpacing),
  maxWidth: load(KEYS.maxWidth, DEFAULTS.maxWidth),
  autoSaveDelay: load(KEYS.autoSaveDelay, DEFAULTS.autoSaveDelay),

  setFontSize: (px) => {
    localStorage.setItem(KEYS.fontSize, String(px))
    applyProps({ '--editor-font-size': px / 16 + 'rem' })
    set({ fontSize: px })
  },

  setLineSpacing: (val) => {
    localStorage.setItem(KEYS.lineSpacing, String(val))
    applyProps({ '--editor-line-height': String(val) })
    set({ lineSpacing: val })
  },

  setMaxWidth: (px) => {
    localStorage.setItem(KEYS.maxWidth, String(px))
    applyProps({ '--editor-max-width': px + 'px' })
    set({ maxWidth: px })
  },

  setAutoSaveDelay: (ms) => {
    localStorage.setItem(KEYS.autoSaveDelay, String(ms))
    set({ autoSaveDelay: ms })
  },
}))

// Apply on init
applyProps({
  '--editor-font-size': load(KEYS.fontSize, DEFAULTS.fontSize) / 16 + 'rem',
  '--editor-line-height': String(load(KEYS.lineSpacing, DEFAULTS.lineSpacing)),
  '--editor-max-width': load(KEYS.maxWidth, DEFAULTS.maxWidth) + 'px',
})
