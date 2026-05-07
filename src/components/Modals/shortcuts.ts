export interface ShortcutEntry {
  id: string
  category: string
  defaultKeys: string
  description: string
}

const STORAGE_KEY = 'graphite-shortcuts'

export function loadCustomShortcuts(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function saveCustomShortcut(id: string, keys: string): void {
  const custom = loadCustomShortcuts()
  custom[id] = keys
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(custom)) } catch {}
}

export function resetCustomShortcut(id: string): void {
  const custom = loadCustomShortcuts()
  delete custom[id]
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(custom)) } catch {}
}

export function getKeys(entry: ShortcutEntry): string {
  const custom = loadCustomShortcuts()
  return custom[entry.id] || entry.defaultKeys
}

export function parseKeys(keys: string): { key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean } {
  const parts = keys.split('+')
  return {
    ctrl: parts.includes('Ctrl'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
    meta: parts.includes('Cmd'),
    key: parts.filter(p => !['Ctrl', 'Shift', 'Alt', 'Cmd'].includes(p)).join('+'),
  }
}

export function matchKeyboardEvent(e: KeyboardEvent, keys: string): boolean {
  const binding = parseKeys(keys)
  const ctrlOrMeta = (e.ctrlKey || e.metaKey)
  if (binding.ctrl && !ctrlOrMeta) return false
  if (!binding.ctrl && ctrlOrMeta) return false
  if (e.shiftKey && !binding.shift) return false
  if (binding.shift && !e.shiftKey) return false
  if (binding.alt && !e.altKey) return false
  if (!binding.alt && e.altKey) return false
  const key = e.key.toLowerCase()
  const targetKey = binding.key.toLowerCase()
  if (key === targetKey) return true
  if (targetKey === 'esc' && key === 'escape') return true
  if (targetKey === 'escape' && key === 'escape') return true
  if (targetKey === '\\' && key === '\\') return true
  if (targetKey === 'f11' && key === 'f11') return true
  return false
}

export const DEFAULT_SHORTCUTS: ShortcutEntry[] = [
  { id: 'save', category: '文件', defaultKeys: 'Ctrl+S', description: '保存文档' },
  { id: 'openFolder', category: '文件', defaultKeys: 'Ctrl+O', description: '打开文件夹' },
  { id: 'undo', category: '编辑', defaultKeys: 'Ctrl+Z', description: '撤销' },
  { id: 'redo', category: '编辑', defaultKeys: 'Ctrl+Shift+Z', description: '重做' },
  { id: 'bold', category: '编辑', defaultKeys: 'Ctrl+B', description: '粗体' },
  { id: 'italic', category: '编辑', defaultKeys: 'Ctrl+I', description: '斜体' },
  { id: 'underline', category: '编辑', defaultKeys: 'Ctrl+U', description: '下划线' },
  { id: 'strikethrough', category: '编辑', defaultKeys: 'Ctrl+D', description: '删除线' },
  { id: 'link', category: '编辑', defaultKeys: 'Ctrl+K', description: '插入链接' },
  { id: 'search', category: '编辑', defaultKeys: 'Ctrl+F', description: '在文档中搜索' },
  { id: 'fileSearch', category: '视图', defaultKeys: 'Ctrl+Shift+F', description: '在文件树中搜索' },
  { id: 'toggleSidebar', category: '视图', defaultKeys: 'Ctrl+\\', description: '切换侧边栏' },
  { id: 'escape', category: '视图', defaultKeys: 'Esc', description: '关闭搜索/对话框' },
  { id: 'fullscreen', category: '视图', defaultKeys: 'F11', description: '切换全屏' },
  { id: 'commandPalette', category: '视图', defaultKeys: 'Ctrl+Shift+P', description: '命令面板' },
]
