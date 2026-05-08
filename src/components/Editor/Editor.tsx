import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { Extension, Node } from '@tiptap/core'
import { Plugin, TextSelection } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import ImageExtension from '@tiptap/extension-image'
import LinkExtension from '@tiptap/extension-link'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import CharacterCount from '@tiptap/extension-character-count'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { common, createLowlight } from 'lowlight'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { gfm } from '@joplin/turndown-plugin-gfm'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useFileStore } from '@/stores/fileStore'
import { useUIStore } from '@/stores/uiStore'
import { useEditorSettingsStore } from '@/stores/editorStore'
import { saveSessionCursor, loadSessionCursor, saveSessionScroll, loadSessionScroll } from '@/hooks/useSession'
import Toolbar from './menus/Toolbar'
import SlashMenu from './menus/SlashMenu'
import SearchBar from './menus/SearchBar'
import { SearchExtension, replaceCurrent, replaceAll } from './plugins/searchPlugin'
import { matchKeyboardEvent, getKeys, DEFAULT_SHORTCUTS } from '@/components/Modals/shortcuts'

const lowlight = createLowlight(common)
const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', emDelimiter: '*', bulletListMarker: '-' })
turndownService.use(gfm)
turndownService.addRule('horizontalRule', { filter: 'hr', replacement: () => '\n\n---\n\n' })
let previewSuppressUntil = 0

const _previewImageSrc = { current: null as string | null }
const IMAGE_PREVIEW_EVENT = 'graphite:image-preview'

function scrollElementIntoView(container: HTMLElement | null, target: HTMLElement | null) {
  if (!container || !target) return
  const box = container.getBoundingClientRect()
  const targetBox = target.getBoundingClientRect()
  container.scrollTo({
    top: targetBox.top - box.top + container.scrollTop - 80,
    behavior: 'smooth',
  })
}

function scrollToFootnoteDef(view: any, id: string) {
  const scroller = view.dom.closest('.overflow-y-auto') as HTMLElement | null
  const target = view.dom.querySelector(`[data-footnote-id="${CSS.escape(id)}"]`) as HTMLElement | null
  scrollElementIntoView(scroller, target)
}

function scrollToFootnoteRef(view: any, id: string) {
  const scroller = view.dom.closest('.overflow-y-auto') as HTMLElement | null
  const target = view.dom.querySelector(`sup[data-footnote-ref="${CSS.escape(id)}"]`) as HTMLElement | null
  scrollElementIntoView(scroller, target)
}

function encodeHtmlEntities(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

const FootnoteRef = Node.create({
  name: 'footnoteRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() {
    return { id: { default: '' } }
  },
  parseHTML: () => [{
    tag: 'sup[data-footnote-ref]',
    getAttrs: (node) => ({ id: (node as HTMLElement).getAttribute('data-footnote-ref') || '' }),
  }],
  renderHTML({ node }) {
    const id = node.attrs.id || ''
    return ['sup', { 'data-footnote-ref': id, contenteditable: 'false' }, `[${id}]`]
  },
})
const LinkOpener = Extension.create({ name: 'linkOpener', addProseMirrorPlugins() { return [new Plugin({ props: { handleClick: (view, _pos, event) => {
    if (Date.now() < previewSuppressUntil) { event.preventDefault(); return true }
    const t = event.target as HTMLElement
    const a = t.closest('a')
    if (a?.href?.startsWith('http')) { event.preventDefault(); import('@tauri-apps/plugin-opener').then((m) => m.openUrl(a!.href)); return true }
    const i = t.closest('img')
    if (i?.src) { event.preventDefault(); _previewImageSrc.current = i.src; window.dispatchEvent(new CustomEvent(IMAGE_PREVIEW_EVENT)); return true }
    const s = t.closest('sup[data-footnote-ref]')
    if (s?.hasAttribute?.('data-footnote-ref')) { event.preventDefault(); const id = s.getAttribute('data-footnote-ref'); if (id) scrollToFootnoteDef(view, id); return true }
    const l = t.closest('.footnote-label[data-footnote-backref]')
    if (l?.hasAttribute?.('data-footnote-backref')) { event.preventDefault(); const id = l.getAttribute('data-footnote-backref'); if (id) scrollToFootnoteRef(view, id); return true }
    return false
} } }) ] } })
const AtomBackspace = Extension.create({ name: 'atomBackspace', addKeyboardShortcuts() { return { Backspace: ({ editor }) => { const { selection, doc } = editor.state; if (!(selection instanceof TextSelection)) return false; const { $from } = selection; if ($from.parentOffset === 0 && $from.pos > 0) { const b = doc.resolve($from.pos - 1); if (b.nodeBefore?.type.isAtom) { editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(doc.resolve(b.pos - b.nodeBefore.nodeSize)))); return true } } return false } } } })
const TableHelper = Extension.create({ name: 'tableHelper', addKeyboardShortcuts() { return { Backspace: ({ editor }) => { const { selection } = editor.state; if (!(selection instanceof TextSelection)) return false; const { $from } = selection; let td = -1; for (let d = $from.depth; d > 0; d--) { if ($from.node(d).type.name === 'table') { td = d; break } }; if (td === -1) return false; const cd = td + 2; if ($from.depth >= cd && $from.parentOffset === 0 && $from.node(cd).textContent.trim() === '') { const rd = td + 1; const fc = $from.index(cd) === 0; const fr = $from.index(rd) === 0; if (fc && !fr) { let ae = true; $from.node(rd).forEach((c: any) => { if (c.textContent.trim() !== '') ae = false }); if (ae) { editor.chain().focus().deleteRow().run(); editor.chain().focus().goToPreviousCell().run(); return true } }; editor.chain().focus().goToPreviousCell().run(); return true }; return false }, arrowDown: ({ editor }) => { const { selection } = editor.state; if (!(selection instanceof TextSelection)) return false; const { $from } = selection; let td = -1; for (let d = $from.depth; d > 0; d--) { if ($from.node(d).type.name === 'table') td = d }; if (td === -1) return false; const cd = td + 2; const rd = td + 1; const rn = $from.node(rd); const cn = $from.node(cd); if (!rn || !cn) return false; if ($from.index(rd) === rn.childCount - 1 && $from.index(cd) === cn.childCount - 1 && $from.pos >= $from.end(cd) - 1) { editor.chain().focus().insertContentAt($from.after(td) + 1, '<p></p>').focus().run(); return true }; return false } } } })
const FootnoteNode = Node.create({
  name: 'footnote',
  group: 'block',
  content: 'inline*',
  defining: true,
  selectable: false,
  addAttributes() {
    return { id: { default: '' } }
  },
  parseHTML() {
    return [{
      tag: 'div.footnote-def[data-footnote-id]',
      contentElement: '.footnote-content',
      getAttrs: (node) => ({
        id: (node as HTMLElement).getAttribute('data-footnote-id') || '',
      }),
    }]
  },
  renderHTML({ node }) {
    const id = node.attrs.id || ''
    return [
      'div',
      {
        class: 'footnote-def',
        'data-footnote-id': id,
      },
      ['span', { class: 'footnote-label', 'data-footnote-backref': id }, `[${id}]`],
      ' ',
      ['span', { class: 'footnote-content' }, 0],
    ]
  },
})
const SlashDetector = Extension.create({ name: 'slashDetector', addProseMirrorPlugins() { return [new Plugin({ props: { handleKeyDown: (view, event) => { if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { const { $from } = view.state.selection; if ($from.parentOffset === 1) window.dispatchEvent(new CustomEvent('graphite:slash-opened', { detail: { view, pos: $from.pos } })) }; return false } } })] } })

function isHtmlFile(path?: string | null) { return !!path && /\.html?$/i.test(path) }
function normalizeLineEndings(s: string) { return s.replace(/\r\n/g, '\n') }
function normalizeHtmlString(html: string) { var div = document.createElement('div'); div.innerHTML = html; return div.innerHTML }
function normalizeComparableMarkdown(md: string) { return normalizeLineEndings(md).replace(/\n+$/g, '') }

function protectMarkdownSegments(md: string) {
  const store: string[] = []
  const protect = function(pattern: RegExp) {
    md = md.replace(pattern, function(match) {
      store.push(match)
      return `@@GRAPHITE_SEGMENT_${store.length - 1}@@`
    })
  }
  protect(/```(?!mermaid\b)[\s\S]*?```/g)
  protect(/`[^`\n]+`/g)
  return {
    text: md,
    restore(text: string) {
      return text.replace(/@@GRAPHITE_SEGMENT_(\d+)@@/g, function(_, index) {
        return store[parseInt(index, 10)] || ''
      })
    },
  }
}

function preprocessFootnotes(md: string) {
  const lines = normalizeLineEndings(md).split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\[\^([\w-]+)\]:\s*(.*)$/)
    if (!match) {
      out.push(lines[i])
      continue
    }
    const id = match[1]
    const chunks = [match[2] || '']
    let j = i + 1
    while (j < lines.length) {
      const line = lines[j]
      if (/^( {2,}|\t)/.test(line)) {
        chunks.push(line.replace(/^( {2,}|\t)/, ''))
        j++
        continue
      }
      if (line === '' && j + 1 < lines.length && /^( {2,}|\t)/.test(lines[j + 1])) {
        chunks.push('')
        j++
        continue
      }
      break
    }
    const content = chunks.join('\n').trimEnd()
    out.push(`<div class="footnote-def" data-footnote-id="${encodeHtmlEntities(id)}"><span class="footnote-label" data-footnote-backref="${encodeHtmlEntities(id)}">[${encodeHtmlEntities(id)}]</span> <span class="footnote-content">${marked.parseInline(content || '', { breaks: true, gfm: true, async: false })}</span></div>`)
    i = j - 1
  }
  return out.map(function(line) {
    if (line.startsWith('<div class="footnote-def"')) return line
    return line.replace(/\[\^([\w-]+)\]/g, '<sup data-footnote-ref="$1" contenteditable="false">[$1]</sup>')
  }).join('\n')
}

function preprocessDefinitionLists(md: string) {
  const lines = md.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const term = lines[i]
    const next = lines[i + 1]
    if (!term || !next || !/^:\s+/.test(next)) {
      out.push(lines[i])
      continue
    }

    const entries: Array<{ term: string; definitions: string[] }> = []
    let cursor = i
    while (cursor < lines.length) {
      const currentTerm = lines[cursor]
      const currentDef = lines[cursor + 1]
      if (!currentTerm || !currentDef || !/^:\s+/.test(currentDef)) break
      const definitions = [currentDef.replace(/^:\s+/, '')]
      cursor += 2
      while (cursor < lines.length && /^( {2,}|\t)/.test(lines[cursor])) {
        definitions.push(lines[cursor].replace(/^( {2,}|\t)/, ''))
        cursor++
      }
      entries.push({ term: currentTerm, definitions })
      if (lines[cursor] !== '' || !lines[cursor + 1] || !/^:\s+/.test(lines[cursor + 1])) break
      while (cursor < lines.length && lines[cursor] === '') cursor++
    }

    if (!entries.length) {
      out.push(lines[i])
      continue
    }

    const markdownSource = entries.map(function(entry) {
      return `${entry.term}\n: ${entry.definitions[0]}${entry.definitions.slice(1).map(function(line) { return `\n  ${line}` }).join('')}`
    }).join('\n\n')
    const html = entries.map(function(entry) {
      const body = marked.parseInline(entry.definitions.join('<br />') || '', { breaks: true, gfm: true, async: false })
      return `<dt>${encodeHtmlEntities(entry.term)}</dt><dd>${body}</dd>`
    }).join('')
    out.push(`<dl data-graphite-md="${encodeHtmlEntities(markdownSource)}">${html}</dl>`)
    i = cursor - 1
  }
  return out.join('\n')
}

function finalizeMarkdown(md: string) {
  return normalizeLineEndings(md)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n+$/g, '')
}

function preprocessMarkdownForEditor(md: string): string {
  const protectedSegments = protectMarkdownSegments(normalizeLineEndings(md))
  let text = protectedSegments.text
  text = preprocessFootnotes(text)
  text = preprocessDefinitionLists(text)
  return protectedSegments.restore(text)
}

function mdToHtml(md: string): string {
  let h = preprocessMarkdownForEditor(md)
  h = h.replace(/==(.+?)==/g, '<mark>$1</mark>')
  h = marked.parse(h, { breaks: true, gfm: true, async: false }) as string
  return h
}

function htmlToMd(html: string): string {
  var div = document.createElement('div'); div.innerHTML = html
  return finalizeMarkdown(turndownService.turndown(div.innerHTML))
}

turndownService.addRule('underline', { filter: 'u', replacement: function(_c: string) { return '<u>' + _c + '</u>' } })
turndownService.addRule('highlight', { filter: 'mark', replacement: function(_c: string, n: any) { return '==' + (n.innerHTML || '') + '==' } })
turndownService.addRule('footnoteRef', { filter: function(n) { return (n as HTMLElement).hasAttribute?.('data-footnote-ref') ?? false }, replacement: function(_c: string, n: any) { return `[^${n.getAttribute('data-footnote-ref') || ''}]` } })
turndownService.addRule('footnote', { filter: function(n) { return (n as HTMLElement).classList?.contains('footnote-def') ?? false }, replacement: function(_c: string, n: any) {
  const id = n.getAttribute('data-footnote-id') || ''
  const contentEl = n.querySelector('.footnote-content') as HTMLElement | null
  const rawContent = contentEl ? turndownService.turndown(contentEl.innerHTML).trim() : ''
  const content = normalizeLineEndings(rawContent).split('\n')
  if (!content.length) return `\n\n[^${id}]:`
  const [first, ...rest] = content
  return `\n\n[^${id}]: ${first}${rest.map(function(line: string) { return `\n  ${line}` }).join('')}`
} })
turndownService.addRule('definitionList', { filter: function(n) { return n.nodeName === 'DL' && (n as HTMLElement).hasAttribute('data-graphite-md') }, replacement: function(_c: string, n: any) { return `\n\n${n.getAttribute('data-graphite-md') || ''}\n\n` } })

export default function Editor() {
  const { currentFilePath, currentContent } = useFileStore()
  const [showSearch, setShowSearch] = useState(false)
  const [slashMenu, setSlashMenu] = useState<{ top: number; left: number; pos: number } | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewImageBroken, setPreviewImageBroken] = useState(false)
  const [stats, setStats] = useState({ chars: 0, words: 0 })
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyRef = useRef(false)

  const processedHtml = useMemo(function() {
    if (!currentContent) return ''
    try {
      var h = isHtmlFile(currentFilePath) ? currentContent : mdToHtml(currentContent)
      // Strip stale asset.localhost URLs (Tauri dev asset protocol may not be available)
      h = h.replace(/src="https?:\/\/asset\.localhost\/[^"]*"/g, 'src="" alt="[图片加载失败]"')
      return h
    } catch { return currentContent }
  }, [currentContent, currentFilePath])

  const serializeEditorContent = useCallback(function(html: string) {
    return isHtmlFile(currentFilePath) ? normalizeHtmlString(html) : htmlToMd(html)
  }, [currentFilePath])

  const serializeStoredContent = useCallback(function(content: string | null) {
    if (!content) return ''
    if (isHtmlFile(currentFilePath)) return normalizeHtmlString(content)
    return htmlToMd(mdToHtml(content))
  }, [currentFilePath])

  const closePreview = useCallback(function() {
    previewSuppressUntil = Date.now() + 250
    setPreviewImage(null)
    setPreviewImageBroken(false)
  }, [])

  const handleSave = useCallback(function() {
    var ed = (window as any).__graphiteEditor as { getHTML: () => string } | undefined
    if (!ed) return Promise.resolve()
    var md = serializeEditorContent(ed.getHTML())
    var s = useFileStore.getState()
    s.setCurrentContent(md)
    return s.saveCurrentFile()
  }, [serializeEditorContent])

  const handleImageFile = function(file: File, view: EditorView, pos?: number) {
    var insPos = pos ?? view.state.selection.from
    var reader = new FileReader()
    reader.onload = function() {
      var src = reader.result as string
      view.dispatch(view.state.tr.insert(insPos, view.state.schema.nodes.image.create({ src })))
    }
    reader.readAsDataURL(file)
  }

  const editor = useEditor({
    content: processedHtml || undefined,
    extensions: [
      StarterKit.configure({ codeBlock: false, heading: { levels: [1, 2, 3, 4, 5, 6] }, link: false, underline: false }),
      Table.configure({ resizable: true }), TableRow, TableCell, TableHeader,
      TaskList, TaskItem.configure({ nested: true }),
      ImageExtension.configure({ inline: true, allowBase64: true }),
      LinkExtension.configure({ HTMLAttributes: { class: 'text-[var(--accent)] underline' }, openOnClick: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder: '开始输入...' }),
      Highlight.configure({ multicolor: true }), Typography, Underline,
      TextAlign.configure({ types: ['heading', 'paragraph', 'tableCell', 'tableHeader'] }),
      AtomBackspace, TableHelper, FootnoteNode, FootnoteRef,
      LinkOpener, SlashDetector, SearchExtension, CharacterCount,
    ],
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none focus:outline-none px-8 py-6 min-h-full relative' },
      handleDrop: function(view: EditorView, event: DragEvent, _slice: any, moved: boolean) {
        var files = event.dataTransfer?.files
        if (!moved && files?.length) {
          var images = Array.from(files).filter(function(f: any) { return f.type.startsWith('image/') })
          if (!images.length) return false
          event.preventDefault()
          var dropCoords = view.posAtCoords({ left: event.clientX, top: event.clientY })
          var pos = dropCoords ? dropCoords.pos : view.state.selection.from
          for (var i = 0; i < images.length; i++) { handleImageFile(images[i], view, pos); pos += 1 }
          return true
        }
        return false
      },
      handlePaste: function(view: EditorView, event: ClipboardEvent) {
        var items = event.clipboardData?.items
        if (items) {
          for (var i = 0; i < items.length; i++) {
            var item = items[i]
            if (item.type.startsWith('image/')) {
              event.preventDefault(); var file = item.getAsFile()
              if (file) handleImageFile(file, view, view.state.selection.from)
              return true
            }
          }
        }
        return false
      },
    },
    onUpdate: function() {
      if (!readyRef.current) return
      // Check if content actually changed vs original to avoid false dirty on initial render
      var ed = editor
      if (!ed) return
      var currentMd = serializeEditorContent(ed.getHTML())
      var store = useFileStore.getState()
      if (normalizeComparableMarkdown(currentMd) === normalizeComparableMarkdown(serializeStoredContent(store.originalContent))) return
      store.setSaveStatus('unsaved')
      useFileStore.setState({ isDirty: true })
      setStats({ chars: ed.storage.characterCount.characters(), words: ed.storage.characterCount.words() })
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(function() {
        var s = useFileStore.getState()
        s.setCurrentContent(currentMd); s.saveCurrentFile('auto-saving')
      }, useEditorSettingsStore.getState().autoSaveDelay)
    },
    onCreate: function() { readyRef.current = true; var ed = editor; if (ed) setStats({ chars: ed.storage.characterCount.characters(), words: ed.storage.characterCount.words() }) },
    immediatelyRender: true,
  })

  useEffect(function() { if (!editor) return; (window as any).__graphiteEditor = new Proxy(editor, { get(t, p) { if (p === "element") return t.view?.dom || t.options?.element; return Reflect.get(t, p) } }); window.dispatchEvent(new CustomEvent('graphite:editor-ready')); return function() { (window as any).__graphiteEditor = undefined } }, [editor])
  useEffect(function() { (window as any).__graphiteSave = handleSave }, [handleSave])

  useEffect(function() {
    function fn(e: KeyboardEvent) {
      if (matchKeyboardEvent(e, getKeys(DEFAULT_SHORTCUTS.find(function(s) { return s.id === 'save' })!))) { e.preventDefault(); handleSave() }
      if (matchKeyboardEvent(e, getKeys(DEFAULT_SHORTCUTS.find(function(s) { return s.id === 'search' })!))) { e.preventDefault(); e.stopPropagation(); setShowSearch(function(p) { return !p }) }
      if (matchKeyboardEvent(e, getKeys(DEFAULT_SHORTCUTS.find(function(s) { return s.id === 'toggleSidebar' })!))) { e.preventDefault(); var u = useUIStore.getState(); u.setSidebarOpen(!u.sidebarOpen) }
      if (matchKeyboardEvent(e, getKeys(DEFAULT_SHORTCUTS.find(function(s) { return s.id === 'openFolder' })!))) {
        e.preventDefault(); import('@tauri-apps/plugin-dialog').then(async function({ open }) { var sel = await open({ directory: true }); if (sel && typeof sel === 'string') { useFileStore.getState().loadDirectory(sel); useUIStore.getState().setSidebarOpen(true) } })
      }
      if (matchKeyboardEvent(e, getKeys(DEFAULT_SHORTCUTS.find(function(s) { return s.id === 'fullscreen' })!))) { e.preventDefault(); var w = getCurrentWindow(); w.isFullscreen().then(function(fs) { w.setFullscreen(!fs) }) }
    }
    document.addEventListener('keydown', fn); return function() { document.removeEventListener('keydown', fn) }
  }, [handleSave])

  useEffect(function() { function fn(e: BeforeUnloadEvent) { if (useFileStore.getState().isDirty) { e.preventDefault(); e.returnValue = '' } }; window.addEventListener('beforeunload', fn); return function() { window.removeEventListener('beforeunload', fn) } }, [])
  useEffect(function() { var unlisten = getCurrentWindow().onCloseRequested(async function() { if (useFileStore.getState().isDirty) { var ui = await import('@/stores/uiStore'); var r = await ui.useUIStore.getState().showConfirm({ title: '未保存的更改', message: '有未保存的更改，是否保存后再关闭？', confirmText: '不保存', saveText: '保存' }); if (r === 'save') { var w = (window as any).__graphiteSave; if (w) await w() }; if (r === 'cancel') return }; getCurrentWindow().destroy() }); return function() { unlisten.then(function(fn) { fn() }) } }, [])
  useEffect(function() { return function() { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) } }, [])

  useEffect(function() {
    function fn(e: Event) { var d = (e as CustomEvent).detail; if (d?.view && editor) { var c = d.view.coordsAtPos(d.pos); if (c) setSlashMenu({ top: c.bottom + 4, left: c.left, pos: d.pos }) } }
    window.addEventListener('graphite:slash-opened', fn); return function() { window.removeEventListener('graphite:slash-opened', fn) }
  }, [editor])

  useEffect(function() { function fn() { setPreviewImageBroken(false); setPreviewImage(_previewImageSrc.current) }; window.addEventListener(IMAGE_PREVIEW_EVENT, fn); return function() { window.removeEventListener(IMAGE_PREVIEW_EVENT, fn) } }, [])
  useEffect(function() {
    if (!previewImage) return
    function fn(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closePreview()
      }
    }
    window.addEventListener('keydown', fn)
    return function() { window.removeEventListener('keydown', fn) }
  }, [previewImage, closePreview])
  useEffect(function() { if (!editor || !currentFilePath) return; var offset = loadSessionCursor(currentFilePath); if (offset !== null && offset > 0) { setTimeout(function() { try { var $pos = editor!.state.doc.resolve(offset!); if ($pos.parent.isTextblock) editor!.commands.setTextSelection(offset!) } catch {} }, 0) }; var scroll = loadSessionScroll(currentFilePath); if (scroll !== null && scroll > 0) { requestAnimationFrame(function() { var ed2 = editor; if (!ed2) return; var s = ed2.view.dom.closest('.overflow-y-auto') as HTMLElement; if (s) s.scrollTop = scroll! }) } }, [editor, currentFilePath])
  useEffect(function() { if (!editor) return; function fn() { var path = useFileStore.getState().currentFilePath; if (path) saveSessionCursor(path, editor!.state.selection.from) }; editor.on('selectionUpdate', fn); return function() { editor.off('selectionUpdate', fn) } }, [editor])
  useEffect(function() {
    if (!editor || !currentFilePath) return
    var path = currentFilePath
    var s = editor.view.dom.closest('.overflow-y-auto') as HTMLElement | null
    if (!s) return
    var scroller = s
    var raf = 0
    function persist() {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(function() {
        saveSessionScroll(path, scroller.scrollTop)
      })
    }
    scroller.addEventListener('scroll', persist, { passive: true })
    return function() {
      if (raf) cancelAnimationFrame(raf)
      saveSessionScroll(path, scroller.scrollTop)
      scroller.removeEventListener('scroll', persist)
    }
  }, [editor, currentFilePath])

  if (!editor) return null

  return (
    <div className="flex flex-col h-full">
      <Toolbar editor={editor} onSearchToggle={function() { setShowSearch(function(p) { return !p }) }} />
      <div className={`flex-1 overflow-y-auto bg-[var(--bg-primary)] ${previewImage ? 'pointer-events-none' : ''}`}>
        {showSearch && <SearchBar editor={editor} onClose={function() { setShowSearch(false) }} onReplace={function(t) { replaceCurrent(editor.view, t) }} onReplaceAll={function(t) { replaceAll(editor.view, t) }} />}
        <div className="max-w-[var(--editor-max-width)] mx-auto min-h-full">
          <EditorContent editor={editor} />
        </div>
      </div>
      {/* Status bar */}
      <div className="flex items-center justify-end gap-3 px-4 py-0.5 text-[11px] text-[var(--text-muted)] border-t border-[var(--border)] bg-[var(--bg-secondary)] shrink-0 select-none">
        <span>{stats.chars} 字符</span>
        <span>{stats.words} 词</span>
      </div>
      {slashMenu && <SlashMenu editor={editor} position={{ top: slashMenu.top, left: slashMenu.left }} slashMenuPos={slashMenu.pos} onClose={function() { setSlashMenu(null) }} />}
      {previewImage && (
        <div className="fixed inset-0 z-[10002] bg-black/80 flex items-center justify-center" onClick={function(e) { e.preventDefault(); e.stopPropagation(); closePreview() }}>
          <div
            className="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3"
            onMouseDown={function(e: React.MouseEvent) { e.stopPropagation() }}
            onClick={function(e: React.MouseEvent) { e.stopPropagation() }}
          >
            {!previewImageBroken ? (
              <img
                src={previewImage}
                className="max-w-[90vw] max-h-[90vh] object-contain"
                onMouseDown={function(e: React.MouseEvent) { e.stopPropagation() }}
                onClick={function(e: React.MouseEvent) { e.stopPropagation() }}
                onError={function() { setPreviewImageBroken(true) }}
              />
            ) : (
              <div className="rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-white/70 text-sm">
                图片加载失败
              </div>
            )}
            <button
              onClick={function(e) { e.preventDefault(); e.stopPropagation(); closePreview() }}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
