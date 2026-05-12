import { useState, useRef } from 'react'
import { useFileStore } from '@/stores/fileStore'

function TabMenu({ x, y, path, onClose }: { x: number; y: number; path: string; onClose: () => void }) {
  var closeTab = useFileStore((s) => s.closeTab)
  var closeTabs = useFileStore((s) => s.closeTabs)
  var openTabs = useFileStore((s) => s.openTabs)
  var idx = (openTabs || []).indexOf(path)
  var isFirst = idx === 0
  var isLast = idx === (openTabs || []).length - 1

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <div className="fixed z-[9999] py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] shadow-xl min-w-[120px]" style={{ left: x, top: y }}>
        <button onClick={function() { closeTab(path); onClose() }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-primary)] transition-colors">关闭</button>
        {!isFirst && <button onClick={function() { closeTabs('left', path); onClose() }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-primary)] transition-colors">关闭左侧</button>}
        {!isLast && <button onClick={function() { closeTabs('right', path); onClose() }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-primary)] transition-colors">关闭右侧</button>}
        <div className="h-px bg-[var(--border)] my-1" />
        <button onClick={function() { closeTabs('all', path); onClose() }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-primary)] transition-colors">关闭全部</button>
      </div>
    </>
  )
}

export default function TabBar() {
  var openTabs = useFileStore((s) => s.openTabs)
  var currentFilePath = useFileStore((s) => s.currentFilePath)
  var switchTab = useFileStore((s) => s.switchTab)
  var closeTab = useFileStore((s) => s.closeTab)
  var reorderTabs = useFileStore((s) => s.reorderTabs)
  var [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null)
  var dragIdx = useRef<number>(-1)

  if (!openTabs || openTabs.length === 0) return null

  return (
    <>
      <div className="flex items-stretch gap-0 overflow-x-auto shrink-0 bg-[var(--bg-secondary)] border-b border-[var(--border)] min-h-[28px]" style={{ scrollbarWidth: 'thin' }}>
        {openTabs.map(function(path, i) {
          var name = path.split(/[\\/]/).pop() || path
          var isActive = path === currentFilePath
          return (
            <div key={path} draggable
              onDragStart={function() { dragIdx.current = i }}
              onDragOver={function(e: React.DragEvent) { e.preventDefault() }}
              onDrop={function() {
                if (dragIdx.current !== -1 && dragIdx.current !== i) {
                  var arr = [...openTabs]; var [moved] = arr.splice(dragIdx.current, 1); arr.splice(i, 0, moved)
                  reorderTabs(arr)
                }
                dragIdx.current = -1
              }}
              onClick={function() { switchTab(path) }}
              onContextMenu={function(e: React.MouseEvent) { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, path }) }}
              className={'flex items-center gap-1 px-3 text-xs cursor-pointer border-r border-[var(--border)] whitespace-nowrap select-none transition-colors hover:bg-black/5 dark:hover:bg-white/5 ' + (isActive ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-t-[2px] border-t-[var(--accent)]' : 'text-[var(--text-muted)]')}
              title={path}
            >
              <span className="truncate max-w-[120px]">{name}</span>
              <button onClick={function(e: React.MouseEvent) { e.stopPropagation(); closeTab(path) }} className="flex items-center justify-center w-3.5 h-3.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>
      {menu && <TabMenu x={menu.x} y={menu.y} path={menu.path} onClose={function() { setMenu(null) }} />}
    </>
  )
}
