import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view'

export interface SearchMatch {
  from: number
  to: number
}

export interface SearchPluginState {
  decorations: DecorationSet
  term: string
  caseSensitive: boolean
  useRegex: boolean
  activeIndex: number
  matches: SearchMatch[]
}

export const searchPluginKey = new PluginKey<SearchPluginState>('search')

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Find all occurrences of `searchTerm` in the document's text content.
 * Builds a position map from `textContent` indices back to ProseMirror doc positions
 * so matches that span across inline nodes (e.g. across marks) are found correctly.
 */
function findAllMatches(
  doc: any,
  searchTerm: string,
  caseSensitive: boolean,
  useRegex: boolean,
): SearchMatch[] {
  const matches: SearchMatch[] = []
  if (!searchTerm) return matches

  const flags = caseSensitive ? 'g' : 'gi'
  let regex: RegExp
  try {
    regex = useRegex ? new RegExp(searchTerm, flags) : new RegExp(escapeRegExp(searchTerm), flags)
  } catch {
    return matches
  }

  // Walk all text nodes to collect their positions
  const textNodes: { text: string; pos: number }[] = []
  doc.descendants((node: any, pos: number) => {
    if (node.isText) {
      textNodes.push({ text: node.text || '', pos })
    }
    return true
  })

  // Build full concatenated text and position maps
  let fullText = ''
  const posFrom: number[] = [] // char index -> doc position of character start
  const posTo: number[] = []   // char index -> doc position of character end

  for (const { text, pos } of textNodes) {
    for (let i = 0; i < text.length; i++) {
      posFrom.push(pos + i)
      posTo.push(pos + i + 1)
    }
    fullText += text
  }

  // Find regex matches in full text and map to doc positions
  let match: RegExpExecArray | null
  while ((match = regex.exec(fullText)) !== null) {
    if (match[0].length === 0) { regex.lastIndex++; continue }
    const startIdx = match.index
    const endIdx = match.index + match[0].length - 1
    if (startIdx < posFrom.length && endIdx < posTo.length) {
      matches.push({
        from: posFrom[startIdx],
        to: posTo[endIdx],
      })
    }
  }

  return matches
}

function createDecorations(
  matches: SearchMatch[],
  activeIndex: number,
): Decoration[] {
  return matches.map((match, i) => {
    const cls =
      i === activeIndex
        ? 'search-match search-match-active'
        : 'search-match'
    return Decoration.inline(match.from, match.to, { class: cls })
  })
}

/**
 * Replace the current active match with the given text.
 * After replacement, re-runs the search and advances to the next match.
 */
export function replaceCurrent(view: EditorView, replaceText: string) {
  const pluginState = searchPluginKey.getState(view.state) as SearchPluginState | null
  if (!pluginState || pluginState.matches.length === 0 || !pluginState.term) return

  const { matches, activeIndex, term, caseSensitive, useRegex } = pluginState
  const match = matches[activeIndex]
  if (!match) return

  const tr = view.state.tr
  if (replaceText) {
    tr.replaceWith(match.from, match.to, view.state.schema.text(replaceText))
  } else {
    tr.delete(match.from, match.to)
  }

  // Re-run search and advance active index to skip the replaced position
  tr.setMeta(searchPluginKey, { term, caseSensitive, useRegex, activeIndex: activeIndex + 1 })
  view.dispatch(tr)
}

/**
 * Replace all currently highlighted matches with the given text.
 * Replaces in reverse order to keep document positions stable.
 * Clears the search after all replacements are done.
 */
export function replaceAll(view: EditorView, replaceText: string) {
  const pluginState = searchPluginKey.getState(view.state) as SearchPluginState | null
  if (!pluginState || pluginState.matches.length === 0) return

  const { matches } = pluginState

  // Replace in reverse order so earlier positions remain valid
  const tr = view.state.tr
  for (let i = matches.length - 1; i >= 0; i--) {
    const { from, to } = matches[i]
    if (replaceText) {
      tr.replaceWith(from, to, view.state.schema.text(replaceText))
    } else {
      tr.delete(from, to)
    }
  }

  // Clear search after replace all
  tr.setMeta(searchPluginKey, { term: '', caseSensitive: false, useRegex: false, activeIndex: 0 })
  view.dispatch(tr)
}

/**
 * TipTap Extension that adds a ProseMirror search plugin.
 *
 * The plugin stores `DecorationSet` for highlighting matches, plus metadata
 * about the current search (term, case sensitivity, regex mode, active index, all match
 * positions). Search parameters are updated by dispatching a transaction with
 * `tr.setMeta(searchPluginKey, { term, caseSensitive, useRegex, activeIndex })`.
 */
export const SearchExtension = Extension.create({
  name: 'search',

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchPluginState>({
        key: searchPluginKey,
        state: {
          init() {
            return {
              decorations: DecorationSet.empty,
              term: '',
              caseSensitive: false,
              useRegex: false,
              activeIndex: 0,
              matches: [],
            }
          },
          apply(tr, prev: SearchPluginState, _oldState, newState) {
            const meta = tr.getMeta(searchPluginKey)

            if (meta) {
              const { term, caseSensitive, useRegex, activeIndex } = meta

              // Empty term -> clear all decorations
              if (!term) {
                return {
                  decorations: DecorationSet.empty,
                  term: '',
                  caseSensitive: false,
                  useRegex: false,
                  activeIndex: 0,
                  matches: [],
                }
              }

              // Recalculate everything for the new search parameters
              const matches = findAllMatches(newState.doc, term, caseSensitive, useRegex)
              const clampedIndex = Math.min(
                activeIndex,
                Math.max(0, matches.length - 1),
              )
              const decorations = createDecorations(matches, clampedIndex)

              return {
                decorations: DecorationSet.create(newState.doc, decorations),
                term,
                caseSensitive,
                useRegex,
                activeIndex: clampedIndex,
                matches,
              }
            }

            // No search meta: this is a document change (user typing, etc.)
            // Recalculate with the stored search parameters so highlights stay accurate
            if (prev.term) {
              const matches = findAllMatches(
                newState.doc,
                prev.term,
                prev.caseSensitive,
                prev.useRegex,
              )
              const clampedIndex = Math.min(
                prev.activeIndex,
                Math.max(0, matches.length - 1),
              )
              const decorations = createDecorations(matches, clampedIndex)

              return {
                ...prev,
                decorations: DecorationSet.create(newState.doc, decorations),
                activeIndex: clampedIndex,
                matches,
              }
            }

            return prev
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)?.decorations ?? DecorationSet.empty
          },
        },
      }),
    ]
  },
})
