/**
 * RenderedDocument.tsx
 *
 * NOT a React component — a shared utility module providing:
 *  - renderDocument(html)      – creates a read-only DOM element from export HTML
 *  - inlineLocalImages(clone)  – inlines local images as data URIs
 *  - waitForImages(container)  – waits for all images to load
 *  - renderMermaidBlocks       – re-renders mermaid blocks to SVGs
 *
 * This is the SINGLE rendering path used by ALL export formats (HTML/PDF/PNG).
 * It eliminates the dual-renderer problem where:
 *   - The semantic path (html → template) had style/layout drift
 *   - The visual path (clone live editor DOM) captured editor artifacts
 */

import { useFileStore } from '@/stores/fileStore'
import './export-render.css'

/* ── helpers ─────────────────────────────────────────────── */

function bytesToBase64(bytes: Uint8Array): string {
  var binary = ''
  for (var i = 0; i < bytes.length; i++) { binary += String.fromCharCode(bytes[i]) }
  return btoa(binary)
}

function getImageMimeType(src: string): string {
  const ext = src.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'svg':
      return 'image/svg+xml'
    case 'bmp':
      return 'image/bmp'
    default:
      return 'image/png'
  }
}

function resolveImagePath(src: string): string | null {
  const trimmed = src.trim()
  if (!trimmed) return null
  if (/^(data:|blob:|https?:|asset:|tauri:)/i.test(trimmed)) return null
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('\\\\')) return trimmed

  const currentFilePath = useFileStore.getState().currentFilePath
  if (!currentFilePath) return null

  const dir = currentFilePath.replace(/[\\/][^\\/]+$/, '')
  const baseParts = dir.replace(/\\/g, '/').split('/')
  const targetParts = trimmed.replace(/\\/g, '/').split('/')

  for (const part of targetParts) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (baseParts.length > 1) baseParts.pop()
      continue
    }
    baseParts.push(part)
  }

  return baseParts.join('/')
}

/* ── public helpers ──────────────────────────────────────── */

export async function inlineLocalImages(clone: HTMLElement): Promise<void> {
  const localImages = Array.from(clone.querySelectorAll<HTMLImageElement>('img[src]'))
  if (localImages.length === 0) return

  const { readFile } = await import('@tauri-apps/plugin-fs')

  await Promise.all(localImages.map(async (img) => {
    const rawSrc = img.getAttribute('src')?.trim()
    if (!rawSrc) return

    const resolvedPath = resolveImagePath(rawSrc)
    if (!resolvedPath) return

    try {
      const bytes = await readFile(resolvedPath)
      const mime = getImageMimeType(rawSrc)
      img.src = `data:${mime};base64,${bytesToBase64(bytes)}`
    } catch {
      // Keep the original src if inlining fails.
    }
  }))
}

export async function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'))
  await Promise.all(images.map(async (img) => {
    if (img.complete && img.naturalWidth > 0) return
    await new Promise<void>((resolve) => {
      const done = () => resolve()
      img.addEventListener('load', done, { once: true })
      img.addEventListener('error', done, { once: true })
    })
  }))
}

export async function renderMermaidBlocks(container: HTMLElement): Promise<void> {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>('pre.mermaid-container[data-mermaid-src]'))
  if (blocks.length === 0) return

  const mod = await import('mermaid')
  const mermaid = (mod.default || mod) as any
  const isDark = document.documentElement.classList.contains('dark') || !!document.querySelector('.dark')

  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
  })

  for (const [index, block] of blocks.entries()) {
    const encodedSrc = block.getAttribute('data-mermaid-src') || ''
    const rawSrc = decodeURIComponent(encodedSrc)

    if (!rawSrc) {
      block.outerHTML = '<div class="mermaid-error">Empty mermaid block</div>'
      continue
    }

    try {
      const id = `export-mermaid-${Date.now()}-${index}`
      const result = await mermaid.render(id, rawSrc)
      const svg = typeof result === 'string' ? result : (result as { svg: string }).svg
      const wrapper = document.createElement('div')
      wrapper.className = 'mermaid-wrapper'
      wrapper.innerHTML = svg
      block.replaceWith(wrapper)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Render failed'
      block.outerHTML = `<div class="mermaid-error">Render failed: ${message}</div>`
    }
  }
}

/* ── main render function ─────────────────────────────────── */

/**
 * Creates a read-only, fully styled DOM element from export HTML content.
 *
 * This is the SINGLE shared rendering function used by ALL export paths:
 *   - HTML export:   wrapHtml(container.innerHTML)
 *   - PDF (native):  wrapHtml(container.innerHTML, true)
 *   - PNG:           dom-to-image-more on container
 *   - PDF (fallback): dom-to-image-more on container → jsPDF
 *   - Preview:       container.innerHTML or dom-to-image-more
 *
 * The container is appended to document.body at position (-9999px, 0)
 * for off-screen rendering. Caller MUST remove it with `document.body.removeChild(container)`.
 *
 * Steps:
 *  1. Create a container div with class "export-render"
 *  2. Set innerHTML to the provided html content
 *  3. Read CSS variables from document.documentElement and apply as inline styles
 *  4. Render Mermaid blocks (<pre class="mermaid-container">) → SVG wrappers
 *  5. Inline local images as base64 data URIs
 *  6. Wait for all images to finish loading
 *  7. Return the container
 */
export async function renderDocument(html: string): Promise<HTMLElement> {
  // 1. Create container with a dedicated export class only.
  //    Avoid reusing the app's `.prose` styles so global editor CSS
  //    and custom CSS are less likely to leak into exported output.
  const container = document.createElement('div')
  container.className = 'export-render'

  // 2. Set content
  container.innerHTML = html

  // 3. Read computed CSS variables from the document root and apply as inline styles
  //    This ensures the rendered container inherits the current theme (light/dark/custom)
  const root = document.documentElement
  const rootStyle = getComputedStyle(root)
  const cssVars = [
    '--bg-primary',
    '--bg-secondary',
    '--bg-sidebar',
    '--bg-titlebar',
    '--text-primary',
    '--text-secondary',
    '--text-muted',
    '--accent',
    '--accent-hover',
    '--border',
    '--font-body',
    '--font-mono',
    '--editor-font-size',
    '--editor-line-height',
    '--editor-max-width',
  ]

  for (const varName of cssVars) {
    const value = rootStyle.getPropertyValue(varName).trim()
    if (value) {
      container.style.setProperty(varName, value)
    }
  }

  // 4. Render Mermaid blocks
  try {
    await renderMermaidBlocks(container)
  } catch {
    // Mermaid rendering failed; continue with original HTML
  }

  // 5. Inline local images
  try {
    await inlineLocalImages(container)
  } catch {
    // Image inlining failed; continue with original src
  }

  // 6. Wait for images to load
  try {
    await waitForImages(container)
  } catch {
    // Image loading wait failed; continue anyway
  }

  // Position off-screen for capture
  container.style.position = 'absolute'
  container.style.left = '0'
  container.style.top = '-9999px'
  container.style.width = '720px'
  container.style.height = 'auto'
  container.style.overflow = 'hidden'
  container.style.caretColor = 'transparent'

  // Append to body so images render and Mermaid SVGs compute correctly
  document.body.appendChild(container)

  return container
}
