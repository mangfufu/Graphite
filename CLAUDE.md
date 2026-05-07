# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

Graphite is a local-first WYSIWYG Markdown editor built with `Tauri 2 + React 18 + TypeScript + Rust`. It uses `TipTap v3 / ProseMirror` and supports tables, KaTeX math, Mermaid diagrams, syntax highlighting, slash commands, search, file tree navigation, recent files, auto-save, and export to HTML/PDF/PNG.

## Build & Run

```bash
# Development
npm run tauri dev

# Frontend only
npm run dev

# Type-check + build frontend
npm run build

# Rust backend only
cargo build --manifest-path src-tauri/Cargo.toml

# Full Tauri production build
npm run tauri build

# If the dev port gets stuck or is blocked, kill stale processes and restart.
taskkill /f /im graphite.exe
taskkill /f /im node.exe
```

## Current Code State

-   The dev server port has been moved away from the Windows excluded range; check `vite.config.ts` and `src-tauri/tauri.conf.json` if it changes again.
    
-   `index.html` is the Vite entry point and must not be used as a document file.
    
-   Saving now blocks Graphite source files when the workspace looks like the repo root.
    
-   Image preview closes through an overlay path that avoids click-through reopening.
    
-   `npm run build` passes, but Vite still reports large chunks for `index`, `mermaid`, and `tiptap`.
    

## Architecture

### Frontend Layout

-   `App.tsx`  
      - `ConfirmDialog`, `ContextMenu`, `ExportModal`, `SettingsModal`, `CommandPalette`  
      - `ErrorBoundary`
    
    -   `TitleBar`
        
    -   `ActivityBar`
        
    -   `Sidebar`
        
    -   `main -> EditorPlaceholder -> Editor`
        
    -   `OutlineRightPanel`
        

### Frontend Stores

-   `useUIStore` in `src/stores/uiStore.ts`: sidebar state, outline state, modals, context menu, confirm dialog, search query, command palette.
    
-   `useFileStore` in `src/stores/fileStore.ts`: file tree, current file, content, dirty state, recent files/dirs, save/load.
    
-   `useThemeStore` in `src/stores/themeStore.ts`: light/dark/system mode and theme variants.
    
-   `useEditorSettingsStore` in `src/stores/editorStore.ts`: font size, line spacing, max width.
    
-   `useCssThemeStore` in `src/stores/cssThemeStore.ts`: custom CSS injection.
    

### Rust Backend

-   `file.rs`: `read_directory`, `read_file`, `write_file`, `create_file`, `create_directory`, `rename_file`, `delete_file`.
    
-   `export.rs`: native PDF export and `capture_region_png`.
    
-   `watcher.rs`: recursive file watcher with self-save suppression.
    

## Key Technical Decisions

### Markdown Pipeline

-   Load: `.md` -> IPC `read_file` -> `marked.parse()` -> TipTap `setContent(html)`.
    
-   Save: TipTap `.getHTML()` -> `turndown` + GFM plugin -> Markdown -> IPC `write_file`.
    
-   `.html` files are treated as direct HTML content instead of Markdown roundtrip.
    

### Editor

-   Custom extensions: `MathInline`, `MathBlock`, `MermaidBlock`, footnotes, `LinkOpener`, `TableHelper`, `AtomBackspace`, `SlashDetector`.
    
-   `window.__graphiteSave` is the save entry point used by the app shell and dialogs.
    
-   `window.__graphiteEditor` is exposed for cross-component access.
    
-   Global shortcuts are centralized through `DEFAULT_SHORTCUTS` and `matchKeyboardEvent`.
    

### Export

-   HTML/PDF native export uses `renderDocument(html)` and a shared read-only layer.
    
-   PNG / PDF fallback use the export layer and screenshot path in `ExportModal.tsx`.
    
-   KaTeX export is rendered with `katex.renderToString()`.
    
-   Standalone HTML/PDF should preserve theme context and `.dark` when needed.
    

### File Change Watcher

-   Rust `notify` watches the current directory recursively.
    
-   `skip_next_event` suppresses self-save filesystem events.
    
-   Structural changes (`Create/Remove/Name`) refresh the directory tree.
    

## Common Issues

-   The repo-root `index.html` is protected because it is the app entry file.
    
-   `tsc` fails on unused imports and unused parameters.
    
-   Rust changes still require a full restart.
    
-   If the dev port is blocked again, check Windows excluded port ranges before changing code blindly.
    
-   Vite chunk warnings are still expected for `index`, `mermaid`, and `tiptap`.
    

◇BLANK◇