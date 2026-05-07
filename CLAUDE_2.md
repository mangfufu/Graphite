# CLAUDE\_2.md

Secondary working notes for Graphite. This file mirrors the current code state more aggressively than `CLAUDE.md` and should be kept in sync with real behavior.

## Current State

-   The repo root contains `index.html`, but it is the Vite entry point, not a user document.
    
-   Saving is now guarded so Graphite source files are blocked when the current workspace looks like the repository root.
    
-   Image preview now closes through an overlay click path that avoids click-through reopening.
    
-   The app still supports normal `.html` documents; only the app entry file is protected.
    
-   Build passes, but Vite still warns about large chunks.
    

## Updated Runtime Facts

-   Dev port has been moved outside the Windows excluded range.
    
-   Current working behavior is based on the actual code, not on earlier status tables.
    
-   Recent file opening restores the stored workspace path when available.
    
-   File watcher refreshes the directory tree only for structural filesystem changes.
    

## Important Warnings

-   Do not treat the repo-root `index.html` as editable content.
    
-   Do not rely on older descriptions in this file if they conflict with the current code.
    
-   If a workspace is the Graphite source tree, saving to `index.html`, `package.json`, `vite.config.ts`, `src/main.tsx`, or `src-tauri/tauri.conf.json` should be blocked.
    
-   If a user reports weird HTML behavior, first verify whether they are editing the app entry file rather than a normal document.
    

◇BLANK◇