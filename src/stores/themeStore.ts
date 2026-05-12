import { create } from 'zustand'
import type { ThemeMode, Theme } from '@/types'

interface ThemeState {
  mode: ThemeMode
  theme: Theme
  setMode: (mode: ThemeMode) => void
  setTheme: (theme: Theme) => void
  toggleMode: () => void
  cycleTheme: () => void
}

const VALID_THEMES: Theme[] = ['default', 'warm', 'forest', 'ocean', 'sepia']

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Theme CSS variable overrides — only the vars that differ from defaults
const THEME_VARS: Record<Theme, { light: Record<string, string>; dark: Record<string, string> }> = {
  default: { light: {}, dark: {} },
  warm: {
    light: {
      '--bg-primary': '#fdf6e3', '--bg-secondary': '#f5edd6', '--bg-sidebar': '#eee8d5',
      '--bg-titlebar': '#e8e0c8', '--text-primary': '#5c4a32', '--text-secondary': '#8a7a62',
      '--text-muted': '#b8a88a', '--accent': '#d4a84b', '--accent-hover': '#c09840', '--border': '#d8cdb5',
    },
    dark: {
      '--bg-primary': '#2d2418', '--bg-secondary': '#3a2e1e', '--bg-sidebar': '#231b12',
      '--bg-titlebar': '#1c1510', '--text-primary': '#e8dcc8', '--text-secondary': '#b8aa8a',
      '--text-muted': '#7a6e56', '--accent': '#d4a84b', '--accent-hover': '#e0b85a', '--border': '#4a3e2e',
    },
  },
  forest: {
    light: {
      '--bg-primary': '#f0f7f0', '--bg-secondary': '#e4efe4', '--bg-sidebar': '#d8e8d8',
      '--bg-titlebar': '#cce0cc', '--text-primary': '#2d4a2d', '--text-secondary': '#5a7a5a',
      '--text-muted': '#8aaa8a', '--accent': '#4a9a4a', '--accent-hover': '#3a8a3a', '--border': '#c0d8c0',
    },
    dark: {
      '--bg-primary': '#1a2e1a', '--bg-secondary': '#243e24', '--bg-sidebar': '#162416',
      '--bg-titlebar': '#0e1a0e', '--text-primary': '#d8e8d8', '--text-secondary': '#a0b8a0',
      '--text-muted': '#6a7e6a', '--accent': '#5aba5a', '--accent-hover': '#4aaa4a', '--border': '#2a4a2a',
    },
  },
  ocean: {
    light: {
      '--bg-primary': '#f0f4fa', '--bg-secondary': '#e4eaf4', '--bg-sidebar': '#d8e0ee',
      '--bg-titlebar': '#c8d4e8', '--text-primary': '#2a3a5a', '--text-secondary': '#5a6a8a',
      '--text-muted': '#8a9aaa', '--accent': '#3b82f6', '--accent-hover': '#2563eb', '--border': '#c0d0e0',
    },
    dark: {
      '--bg-primary': '#1a2238', '--bg-secondary': '#1e2a44', '--bg-sidebar': '#141e30',
      '--bg-titlebar': '#0e1628', '--text-primary': '#d0dce8', '--text-secondary': '#8a9ab0',
      '--text-muted': '#5a6a80', '--accent': '#60a5fa', '--accent-hover': '#3b82f6', '--border': '#2a3a54',
    },
  },
  sepia: {
    light: {
      '--bg-primary': '#faf0e6', '--bg-secondary': '#f0e4d4', '--bg-sidebar': '#e8d8c4',
      '--bg-titlebar': '#e0ccb8', '--text-primary': '#5a4230', '--text-secondary': '#8a7258',
      '--text-muted': '#b0a088', '--accent': '#c09050', '--accent-hover': '#b08040', '--border': '#d8c8b4',
    },
    dark: {
      '--bg-primary': '#2a2018', '--bg-secondary': '#3a2c20', '--bg-sidebar': '#221810',
      '--bg-titlebar': '#1a120e', '--text-primary': '#e0d0c0', '--text-secondary': '#b0a090',
      '--text-muted': '#7a6a5a', '--accent': '#c09050', '--accent-hover': '#d0a060', '--border': '#4a3828',
    },
  },
}

function applyTheme(mode: ThemeMode, theme: Theme) {
  const resolved = mode === 'system' ? getSystemTheme() : mode
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')

  // Get the override variables for this theme
  const vars = THEME_VARS[theme]?.[resolved === 'dark' ? 'dark' : 'light'] ?? {}
  // Apply all vars as inline styles (highest CSS priority)
  for (const [key, val] of Object.entries(vars)) {
    root.style.setProperty(key, val)
  }
  // Remove inline vars that aren't in the current theme (reset to CSS defaults)
  const allVarKeys = ['--bg-primary', '--bg-secondary', '--bg-sidebar', '--bg-titlebar',
    '--text-primary', '--text-secondary', '--text-muted', '--accent', '--accent-hover', '--border']
  for (const key of allVarKeys) {
    if (!(key in vars)) root.style.removeProperty(key)
  }
}

function loadStoredValue<T>(key: string, fallback: T, valid?: T[]): T {
  if (typeof localStorage === 'undefined') return fallback
  try {
    const stored = localStorage.getItem(key) as T | null
    if (stored !== null && (!valid || valid.includes(stored))) return stored
  } catch {}
  return fallback
}

const initialMode: ThemeMode = loadStoredValue<ThemeMode>('graphite-theme', 'light', ['light', 'dark', 'system'])
const initialTheme: Theme = loadStoredValue<Theme>('graphite-theme-variant', 'default', VALID_THEMES)

applyTheme(initialMode, initialTheme)

export const useThemeStore = create<ThemeState>((set) => ({
  mode: initialMode,
  theme: initialTheme,

  setMode: (mode: ThemeMode) => {
    const { theme } = useThemeStore.getState()
    localStorage.setItem('graphite-theme', mode)
    applyTheme(mode, theme)
    set({ mode })
  },

  setTheme: (theme: Theme) => {
    const { mode } = useThemeStore.getState()
    localStorage.setItem('graphite-theme-variant', theme)
    applyTheme(mode, theme)
    set({ theme })
  },

  toggleMode: () => set((state) => {
    const modes: ThemeMode[] = ['light', 'dark', 'system']
    const next = modes[(modes.indexOf(state.mode) + 1) % modes.length]
    localStorage.setItem('graphite-theme', next)
    applyTheme(next, state.theme)
    return { mode: next }
  }),

  cycleTheme: () => set((state) => {
    const next = VALID_THEMES[(VALID_THEMES.indexOf(state.theme) + 1) % VALID_THEMES.length]
    localStorage.setItem('graphite-theme-variant', next)
    applyTheme(state.mode, next)
    return { theme: next }
  }),
}))

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { mode, theme } = useThemeStore.getState()
    if (mode === 'system') applyTheme('system', theme)
  })
}
