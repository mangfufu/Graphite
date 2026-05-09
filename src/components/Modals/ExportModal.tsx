import { useState, useCallback, useEffect, useRef } from 'react'
import katexCss from 'katex/dist/katex.min.css?inline'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile, writeFile } from '@tauri-apps/plugin-fs'
import { jsPDF } from 'jspdf'
import { useUIStore } from '@/stores/uiStore'
import { useFileStore } from '@/stores/fileStore'
import { renderDocument } from '@/components/Export/RenderedDocument'
import exportRenderCss from '@/components/Export/export-render.css?inline'

// Rewrite KaTeX font paths to use CDN so fonts work in standalone export HTML
const katexCdnCss = katexCss.replace(
  /url\(fonts\//g,
  'url(https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/fonts/'
)

type ExportFormat = 'html' | 'pdf' | 'png'

function getSerializedThemeStyle(container: HTMLElement): string {
  return Array.from(container.style)
    .filter((name) => name.startsWith('--'))
    .map((name) => `${name}: ${container.style.getPropertyValue(name)};`)
    .join(' ')
}

function wrapHtml(html: string, themeStyle = '', forPdf = false): string {
  const isDark = document.documentElement.classList.contains("dark")
  return `<!DOCTYPE html>
<html lang="zh-CN"${isDark ? " class=\"dark\"" : ""}>
<head><meta charset="UTF-8"><title>${forPdf ? "" : "Exported Document"}</title>
<style>
  ${katexCdnCss}
  ${exportRenderCss}
  ${forPdf ? `@page { margin: 0; }
  body { padding: 10mm; }
  table { page-break-inside: avoid; }
  tr { page-break-inside: avoid; }
  .pdf-footer { position: fixed; bottom: 10mm; right: 10mm; font-size: 9px; color: #999; }` : ""}
</style></head>
<body><div class="export-render" style="${themeStyle}">${html}</div>${forPdf ? `<div class="pdf-footer">${new Date().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>` : ""}</body>
</html>`
}

function cleanExportHtml(html: string): string {
  const div = document.createElement("div")
  div.innerHTML = html
  div.querySelectorAll(".column-resize-handle, .ProseMirror-gapcursor, .ProseMirror-selectednode, .search-match, .search-match-active, .selectedCell").forEach((n: any) => n.remove())
  div.querySelectorAll("[contenteditable]").forEach((n: any) => n.removeAttribute("contenteditable"))
  div.querySelectorAll("[data-math-inline], [data-math-block]").forEach((n: any) => {
    n.classList.remove("ProseMirror-selectednode")
  })
  return div.innerHTML
}

function getDefaultFileName(): string {
  const currentFilePath = useFileStore.getState().currentFilePath
  if (!currentFilePath) return 'document'
  const name = currentFilePath.split(/[\\/]/).pop()
  return name ? name.replace(/\.\w+$/, '') : 'document'
}

function bytesToDataUrl(bytes: Uint8Array): string {
  var binary = ''
  for (var i = 0; i < bytes.length; i++) { binary += String.fromCharCode(bytes[i]) }
  return `data:image/png;base64,${btoa(binary)}`
}

async function nextFrame(count = 2): Promise<void> {
  for (let i = 0; i < count; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
}

async function captureEditorHtml(editorElement: HTMLElement): Promise<Uint8Array> {
  const { invoke } = await import('@tauri-apps/api/core')
  const container = await renderDocument(cleanExportHtml(editorElement.innerHTML))
  try {
    const themeStyle = getSerializedThemeStyle(container)
    const html = wrapHtml(container.innerHTML, themeStyle, false)
    const bytes = await invoke<number[]>('capture_html_png', { html })
    return new Uint8Array(bytes)
  } finally {
    document.body.removeChild(container)
  }
}

export default function ExportModal() {
  const showExportModal = useUIStore((s) => s.showExportModal)
  const setShowExportModal = useUIStore((s) => s.setShowExportModal)
  const [previewPng, setPreviewPng] = useState<string | null>(null)
  const [captureHidden, setCaptureHidden] = useState(false)
  const previewPngBytesRef = useRef<Uint8Array | null>(null)

  const [format, setFormat] = useState<ExportFormat>("html")
  const [exporting, setExporting] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  useEffect(() => {
    if (showExportModal) {
      setPreviewHtml(null)
      setPreviewPng(null)
      previewPngBytesRef.current = null
    }
  }, [showExportModal])

  const getEditorRef = () => (window as any).__graphiteEditor as { getHTML: () => string; element: HTMLElement } | undefined

  const withModalHidden = useCallback(async <T,>(task: () => Promise<T>): Promise<T> => {
    setCaptureHidden(true)
    try {
      await nextFrame(3)
      return await task()
    } finally {
      setCaptureHidden(false)
      await nextFrame(2)
    }
  }, [])

  const handleExport = useCallback(async () => {
    const editorRef = getEditorRef()
    if (!editorRef) return
    setExporting(true)
    const defaultName = getDefaultFileName()

    try {
      const html = editorRef.getHTML()
      const cleanHtml = cleanExportHtml(html)

      if (format === 'html') {
        const container = await renderDocument(cleanHtml)
        try {
          const path = await save({ filters: [{ name: 'HTML 文档', extensions: ['html'] }], defaultPath: defaultName + '.html' })
          if (!path) { setExporting(false); return }
          await writeTextFile(path, wrapHtml(container.innerHTML, getSerializedThemeStyle(container)))
        } finally { document.body.removeChild(container) }
      } else if (format === 'pdf') {
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          const container = await renderDocument(cleanHtml)
          try {
            const pdfHtml = wrapHtml(container.innerHTML, getSerializedThemeStyle(container), true)
            const pdfBytes = await invoke<number[]>('export_pdf', { html: pdfHtml })
            const path = await save({ filters: [{ name: 'PDF 文档', extensions: ['pdf'] }], defaultPath: defaultName + '.pdf' })
            if (!path) { setExporting(false); return }
            await writeFile(path, new Uint8Array(pdfBytes))
          } finally { document.body.removeChild(container) }
        } catch (e) {
          console.warn('Native PDF failed, falling back:', e)
          const pngBytes = await withModalHidden(() => captureEditorHtml(editorRef.element))
          const imgData = bytesToDataUrl(pngBytes)
          const pdf = new jsPDF('p', 'mm', 'a4')
          const pw = pdf.internal.pageSize.getWidth()
          const ph = pdf.internal.pageSize.getHeight()
          const pa = pw / ph
          const img = new Image()
          img.src = imgData
          await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve() })
          const ia = img.naturalWidth / img.naturalHeight
          const path = await save({ filters: [{ name: "PDF 文档", extensions: ["pdf"] }], defaultPath: defaultName + ".pdf" })
          if (!path) { setExporting(false); return }
          pdf.addImage(imgData, "PNG", 0, 0, ia > pa ? pw : ph * ia, ia > pa ? pw / ia : ph)
          await writeFile(path, new Uint8Array(pdf.output("arraybuffer")))
        }
      } else if (format === 'png') {
        const pngBytes = previewPngBytesRef.current ?? await withModalHidden(() => captureEditorHtml(editorRef.element))
        const path = await save({ filters: [{ name: 'PNG 图片', extensions: ['png'] }], defaultPath: defaultName + '.png' })
        if (!path) { setExporting(false); return }
        await writeFile(path, pngBytes)
      }

      setShowExportModal(false)
    } catch (err) {
      console.error('导出失败:', err)
      alert('导出失败: ' + (err instanceof Error ? err.message : String(err)))
    }
    finally { setExporting(false) }
  }, [format, setShowExportModal, withModalHidden])

  const handlePreview = useCallback(async () => {
    const editorRef = getEditorRef()
    if (!editorRef) return
    try {
      if (format === 'html' || format === 'pdf') {
        const container = await renderDocument(cleanExportHtml(editorRef.getHTML()))
        setPreviewHtml(wrapHtml(container.innerHTML, getSerializedThemeStyle(container), format === 'pdf'))
        document.body.removeChild(container)
      } else if (format === 'png') {
        const pngBytes = await withModalHidden(() => captureEditorHtml(editorRef.element))
        previewPngBytesRef.current = pngBytes
        setPreviewPng(bytesToDataUrl(pngBytes))
      }
    } catch (err) {
      console.error('预览失败:', err)
      alert('预览失败: ' + (err instanceof Error ? err.message : String(err)))
    }
  }, [format, withModalHidden])

  if (!showExportModal) return null

  const formats: { value: ExportFormat; label: string }[] = [
    { value: 'html', label: 'HTML' },
    { value: 'pdf', label: 'PDF' },
    { value: 'png', label: 'PNG' },
  ]

  const inPreview = !!(previewHtml || previewPng)

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 ${captureHidden ? 'invisible pointer-events-none' : ''}`}
      onClick={() => setShowExportModal(false)}
    >
      <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden" style={{ width: inPreview ? '640px' : '320px' }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-4 pb-2 border-b border-[var(--border)]">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">{inPreview ? '预览' : '导出文档'}</h3>
        </div>

        {inPreview ? (
          <>
            <div className="p-3 max-h-[420px] overflow-y-auto bg-[var(--bg-secondary)]">
              {previewHtml && <iframe srcDoc={previewHtml} className="w-full border border-[var(--border)] rounded-lg" style={{ minHeight: '380px' }} title="预览" />}
              {previewPng && <img src={previewPng} className="w-full border border-[var(--border)] rounded-lg" alt="预览" />}
            </div>
            <div className="flex gap-2 px-5 pb-4 pt-3">
              <button onClick={handleExport} disabled={exporting} className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity font-medium disabled:opacity-50">
                {exporting ? '导出中...' : '导出'}
              </button>
              <button onClick={() => { setPreviewHtml(null); setPreviewPng(null) }} className="px-3 py-1.5 text-xs rounded-lg text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                返回
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-5 py-4">
              <div className="flex gap-1 bg-[var(--bg-secondary)] rounded-lg p-1">
                {formats.map((f) => (
                  <button key={f.value} onClick={() => setFormat(f.value)}
                    className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-colors font-medium ${format === f.value ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-4 pt-1">
              <button onClick={handlePreview} className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity font-medium">
                预览
              </button>
              <button onClick={() => setShowExportModal(false)} className="flex-1 px-3 py-1.5 text-xs rounded-lg text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                取消
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
