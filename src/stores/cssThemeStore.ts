import { create } from 'zustand'

interface CssThemeState {
  customCss: string
  setCustomCss: (css: string) => void
  clearCustomCss: () => void
}

const STORAGE_KEY = 'graphite-custom-css'

function load(): string {
  try { return localStorage.getItem(STORAGE_KEY) || '' } catch { return '' }
}

function apply(css: string) {
  let el = document.getElementById('graphite-custom-css')
  if (!css && el) { el.remove(); return }
  if (!el) {
    el = document.createElement('style')
    el.id = 'graphite-custom-css'
    document.head.appendChild(el)
  }
  el.textContent = css
}

// Apply on load
const initial = load()
apply(initial)

export const useCssThemeStore = create<CssThemeState>((set) => ({
  customCss: initial,
  setCustomCss: (css) => {
    localStorage.setItem(STORAGE_KEY, css)
    apply(css)
    set({ customCss: css })
  },
  clearCustomCss: () => {
    localStorage.removeItem(STORAGE_KEY)
    apply('')
    set({ customCss: '' })
  },
}))
