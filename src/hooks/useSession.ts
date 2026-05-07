// Session save/load utilities for cursor position, scroll position, and sidebar state

const CURSOR_KEY = 'graphite-cursor-pos'
const SCROLL_KEY = 'graphite-scroll-pos'
const SIDEBAR_KEY = 'graphite-sidebar-state'

export function saveSessionCursor(path: string, offset: number): void {
  try {
    const all = JSON.parse(localStorage.getItem(CURSOR_KEY) || '{}')
    all[path] = offset
    localStorage.setItem(CURSOR_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

export function loadSessionCursor(path: string): number | null {
  try {
    const all = JSON.parse(localStorage.getItem(CURSOR_KEY) || '{}')
    return all[path] ?? null
  } catch { return null }
}

export function saveSessionScroll(path: string, scroll: number): void {
  try {
    const all = JSON.parse(localStorage.getItem(SCROLL_KEY) || '{}')
    all[path] = scroll
    localStorage.setItem(SCROLL_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

export function loadSessionScroll(path: string): number | null {
  try {
    const all = JSON.parse(localStorage.getItem(SCROLL_KEY) || '{}')
    return all[path] ?? null
  } catch { return null }
}

export function saveSessionSidebar(open: boolean, width: number): void {
  try {
    localStorage.setItem(SIDEBAR_KEY, JSON.stringify({ open, width }))
  } catch { /* ignore */ }
}

export function loadSessionSidebar(): { open: boolean; width: number } | null {
  try {
    const raw = localStorage.getItem(SIDEBAR_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
