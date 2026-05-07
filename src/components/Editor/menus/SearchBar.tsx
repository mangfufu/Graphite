import { useState, useEffect, useRef, useCallback } from 'react'
import { type Editor } from '@tiptap/react'
import {
  searchPluginKey,
  type SearchPluginState,
} from '../plugins/searchPlugin'

interface SearchBarProps {
  editor: Editor
  onClose: () => void
  onReplace?: (replaceText: string) => void
  onReplaceAll?: (replaceText: string) => void
}

export default function SearchBar({ editor, onClose, onReplace, onReplaceAll }: SearchBarProps) {
  const [term, setTerm] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [replaceText, setReplaceText] = useState('')
  const [results, setResults] = useState<number>(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  // Use refs so event handlers always read the latest values without stale closures
  const caseSensitiveRef = useRef(caseSensitive)
  const termRef = useRef(term)
  const useRegexRef = useRef(useRegex)

  // Sync refs with state
  useEffect(() => {
    caseSensitiveRef.current = caseSensitive
  }, [caseSensitive])

  useEffect(() => {
    termRef.current = term
  }, [term])

  useEffect(() => {
    useRegexRef.current = useRegex
  }, [useRegex])

  // Auto-focus the input when mounted
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Clear search decorations on unmount
  useEffect(() => {
    return () => {
      editor.view.dispatch(
        editor.state.tr.setMeta(searchPluginKey, {
          term: '',
          caseSensitive: false,
          useRegex: false,
          activeIndex: 0,
        }),
      )
    }
  }, [editor])

  // Read match info from plugin state into local state
  const syncFromPlugin = useCallback(() => {
    const pluginState = searchPluginKey.getState(
      editor.state,
    ) as SearchPluginState | null
    if (pluginState) {
      setResults(pluginState.matches.length)
      setActiveIndex(pluginState.activeIndex)
    }
  }, [editor])

  // Dispatch search parameters to the plugin and sync results back
  const dispatchSearch = useCallback(
    (newTerm: string, newActiveIndex: number) => {
      const cs = caseSensitiveRef.current
      const ur = useRegexRef.current
      editor.view.dispatch(
        editor.state.tr.setMeta(searchPluginKey, {
          term: newTerm,
          caseSensitive: cs,
          useRegex: ur,
          activeIndex: newActiveIndex,
        }),
      )
      syncFromPlugin()
    },
    [editor, syncFromPlugin],
  )

  // Navigate to a match: set the active index, select text, scroll into view
  const navigateToMatch = useCallback(
    (index: number) => {
      const pluginState = searchPluginKey.getState(
        editor.state,
      ) as SearchPluginState | null
      if (!pluginState || index < 0 || index >= pluginState.matches.length)
        return

      const match = pluginState.matches[index]

      editor
        .chain()
        .command(({ tr }) => {
          tr.setMeta(searchPluginKey, {
            term: termRef.current,
            caseSensitive: caseSensitiveRef.current,
            useRegex: useRegexRef.current,
            activeIndex: index,
          })
          return true
        })
        .focus()
        .setTextSelection({ from: match.from, to: match.to })
        .scrollIntoView()
        .run()

      syncFromPlugin()
    },
    [editor, syncFromPlugin],
  )

  const goToNext = useCallback(() => {
    const pluginState = searchPluginKey.getState(
      editor.state,
    ) as SearchPluginState | null
    if (!pluginState || pluginState.matches.length === 0) return
    const next = (pluginState.activeIndex + 1) % pluginState.matches.length
    navigateToMatch(next)
  }, [editor, navigateToMatch])

  const goToPrev = useCallback(() => {
    const pluginState = searchPluginKey.getState(
      editor.state,
    ) as SearchPluginState | null
    if (!pluginState || pluginState.matches.length === 0) return
    const total = pluginState.matches.length
    const prev =
      (pluginState.activeIndex - 1 + total) % total
    navigateToMatch(prev)
  }, [editor, navigateToMatch])

  // Handle search term changes (live search on every keystroke)
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTerm = e.target.value
      setTerm(newTerm)
      dispatchSearch(newTerm, 0)
    },
    [dispatchSearch],
  )

  // Toggle case-sensitive mode
  const toggleCaseSensitive = useCallback(() => {
    const newCs = !caseSensitive
    setCaseSensitive(newCs)
    caseSensitiveRef.current = newCs
    dispatchSearch(termRef.current, 0)
  }, [caseSensitive, dispatchSearch])

  // Toggle regex mode
  const toggleUseRegex = useCallback(() => {
    const newUr = !useRegex
    setUseRegex(newUr)
    useRegexRef.current = newUr
    dispatchSearch(termRef.current, 0)
  }, [useRegex, dispatchSearch])

  // Handle replace current match
  const handleReplace = useCallback(() => {
    if (onReplace) {
      onReplace(replaceText)
    }
    syncFromPlugin()
  }, [onReplace, replaceText, syncFromPlugin])

  // Handle replace all matches
  const handleReplaceAll = useCallback(() => {
    if (onReplaceAll) {
      onReplaceAll(replaceText)
    }
    syncFromPlugin()
  }, [onReplaceAll, replaceText, syncFromPlugin])

  // Handle keyboard events on the search input
  const handleClose = useCallback(() => {
    editor.view.dispatch(
      editor.state.tr.setMeta(searchPluginKey, {
        term: "",
        caseSensitive: false,
        useRegex: false,
        activeIndex: 0,
      }),
    )
    onClose()
  }, [editor, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault()
          if (e.shiftKey) {
            goToPrev()
          } else {
            goToNext()
          }
          break
        case 'Escape':
          e.preventDefault()
          e.stopPropagation() // Prevent document-level Esc handler from also firing
          handleClose()
          break
      }
    },
    [goToNext, goToPrev, handleClose],
  )

  // Handle keyboard events on the replace input
  const handleReplaceKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleReplace()
      }
    },
    [handleReplace],
  )

  // Close: clear decorations and notify parent

  const displayIndex = results > 0 ? activeIndex + 1 : 0

  return (
    <div className="sticky top-0 z-10 w-full flex justify-end pointer-events-none py-1 pr-4">
      <div className="pointer-events-auto bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg shadow-lg px-2.5 py-1.5 text-sm">
        {/* First row: search controls */}
        <div className="flex items-center gap-1">
          {/* Case-sensitive toggle */}
          <button
            type="button"
            onClick={toggleCaseSensitive}
            className={`flex items-center justify-center w-7 h-7 rounded text-xs font-mono font-bold transition-colors ${
              caseSensitive
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
            }`}
            title="区分大小写"
          >
            Aa
          </button>

          {/* Search input */}
          <input
            ref={inputRef}
            type="text"
            value={term}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="搜索..."
            className="w-36 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border-none px-1.5 py-0.5"
          />

          {/* Match count */}
          <span className="text-xs text-[var(--text-muted)] min-w-[2.5rem] text-right tabular-nums select-none">
            {results > 0 ? `${displayIndex}/${results}` : ''}
          </span>

          {/* Previous match */}
          <button
            type="button"
            onClick={goToPrev}
            disabled={results === 0}
            className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-30 disabled:cursor-default transition-colors"
            title="上一个匹配 (Shift+Enter)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>

          {/* Next match */}
          <button
            type="button"
            onClick={goToNext}
            disabled={results === 0}
            className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-30 disabled:cursor-default transition-colors"
            title="下一个匹配 (Enter)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Separator */}
          <div className="w-px h-5 bg-[var(--border)] mx-0.5" />

          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
            title="关闭 (Esc)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Second row: replace controls (only when editor is editable) */}
        {editor.isEditable && (
          <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-[var(--border)]">
            {/* Regex toggle */}
            <button
              type="button"
              onClick={toggleUseRegex}
              className={`flex items-center justify-center w-7 h-7 rounded text-xs font-mono font-bold transition-colors ${
                useRegex
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
              }`}
              title="使用正则表达式"
            >
              .*
            </button>

            {/* Replace input */}
            <input
              ref={replaceInputRef}
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              onKeyDown={handleReplaceKeyDown}
              placeholder="替换为..."
              className="w-36 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border-none px-1.5 py-0.5"
            />

            {/* Replace one button */}
            <button
              type="button"
              onClick={handleReplace}
              disabled={results === 0 || !term}
              className="flex items-center justify-center px-2 h-7 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-30 disabled:cursor-default transition-colors"
              title="替换当前匹配"
            >
              替换
            </button>

            {/* Replace all button */}
            <button
              type="button"
              onClick={handleReplaceAll}
              disabled={results === 0 || !term}
              className="flex items-center justify-center px-2 h-7 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-30 disabled:cursor-default transition-colors"
              title="全部替换"
            >
              全部替换
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
