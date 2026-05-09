import { Node, mergeAttributes } from '@tiptap/core'

let mermaidModule: any = null
const renderCache = new Map<string, string>()

async function getMermaid() {
  if (!mermaidModule) {
    mermaidModule = (await import('mermaid')).default
    mermaidModule.initialize({
      startOnLoad: false,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
      securityLevel: 'loose',
    })
  }
  return mermaidModule
}

export async function renderMermaidCode(code: string): Promise<string> {
  const cached = renderCache.get(code)
  if (cached) return cached

  try {
    const mermaid = await getMermaid()
    const id = 'mermaid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
    const { svg } = await mermaid.render(id, code)
    renderCache.set(code, svg)
    return svg
  } catch (err) {
    const errorHtml = `<div style="color:#e74c3c;font-size:12px;">Mermaid Error: ${err instanceof Error ? err.message : String(err)}</div>`
    renderCache.set(code, errorHtml)
    return errorHtml
  }
}

export const MermaidExtension = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      code: { default: 'graph TD\n    A --> B' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-mermaid]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-mermaid': '' }, HTMLAttributes)]
  },

  addNodeView() {
    return ({ node, editor }) => {
      const dom = document.createElement('div')
      dom.setAttribute('data-mermaid', '')
      dom.style.cssText = 'margin:8px 0;padding:16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;overflow-x:auto;min-height:60px;position:relative;cursor:pointer;'

      const renderArea = document.createElement('div')
      renderArea.className = 'mermaid-render'
      dom.appendChild(renderArea)

      const editBtn = document.createElement('button')
      editBtn.textContent = '编辑'
      editBtn.style.cssText = 'position:absolute;top:8px;right:8px;padding:2px 8px;font-size:11px;background:var(--bg-primary);border:1px solid var(--border);border-radius:4px;cursor:pointer;opacity:0;transition:opacity 0.2s;'
      dom.appendChild(editBtn)

      dom.addEventListener('mouseenter', () => { editBtn.style.opacity = '1' })
      dom.addEventListener('mouseleave', () => { editBtn.style.opacity = '0' })

      async function render() {
        const code = node.attrs.code as string
        if (!code?.trim()) {
          renderArea.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">点击编辑输入 Mermaid 代码</div>'
          return
        }
        renderArea.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">渲染中...</div>'
        const svg = await renderMermaidCode(code)
        renderArea.innerHTML = svg
      }

      render()

      function openEditor() {
        const overlay = document.createElement('div')
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;'

        const dialog = document.createElement('div')
        dialog.style.cssText = 'background:var(--bg-primary);border:1px solid var(--border);border-radius:12px;padding:20px;width:500px;max-width:90vw;'

        const title = document.createElement('div')
        title.textContent = '编辑 Mermaid 图表'
        title.style.cssText = 'font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text-primary);'

        const textarea = document.createElement('textarea')
        textarea.value = node.attrs.code as string
        textarea.style.cssText = 'width:100%;height:200px;padding:12px;font-family:monospace;font-size:13px;border:1px solid var(--border);border-radius:6px;background:var(--bg-secondary);color:var(--text-primary);resize:vertical;'

        const btnRow = document.createElement('div')
        btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px;'

        const cancelBtn = document.createElement('button')
        cancelBtn.textContent = '取消'
        cancelBtn.style.cssText = 'padding:6px 16px;font-size:12px;border:1px solid var(--border);border-radius:6px;background:var(--bg-secondary);color:var(--text-primary);cursor:pointer;'
        cancelBtn.onclick = () => overlay.remove()

        const saveBtn = document.createElement('button')
        saveBtn.textContent = '保存'
        saveBtn.style.cssText = 'padding:6px 16px;font-size:12px;border:none;border-radius:6px;background:var(--accent);color:white;cursor:pointer;'
        saveBtn.onclick = () => {
          const pos = editor.view.posAtDOM(dom, 0)
          if (pos >= 0) {
            const tr = editor.view.state.tr
            tr.setNodeMarkup(pos, undefined, { code: textarea.value })
            editor.view.dispatch(tr)
          }
          renderCache.delete(textarea.value)
          overlay.remove()
        }

        btnRow.appendChild(cancelBtn)
        btnRow.appendChild(saveBtn)
        dialog.appendChild(title)
        dialog.appendChild(textarea)
        dialog.appendChild(btnRow)
        overlay.appendChild(dialog)
        document.body.appendChild(overlay)

        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove() }
        textarea.focus()
      }

      editBtn.onclick = (e) => { e.stopPropagation(); openEditor() }
      dom.ondblclick = openEditor

      return {
        dom,
        update: (updatedNode: any) => {
          if (updatedNode.type.name !== 'mermaidBlock') return false
          node = updatedNode
          render()
          return true
        },
      }
    }
  },

  addCommands() {
    return {
      insertMermaid: () => ({ commands }: any) => {
        return commands.insertContent({ type: this.name, attrs: { code: 'graph TD\n    A[开始] --> B[结束]' } })
      },
    } as any
  },
})
