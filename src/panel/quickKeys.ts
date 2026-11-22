import type { SymbolInsert } from '../math/symbols.ts'
import type { Words } from '../text/words.ts'

/** One quick key: what it shows and reads as, and what it types. */
export interface QuickKey {
  label: string
  /** Its accessible name and hover: its key in the text tables' `panel.keys`. */
  name: keyof Words['panel']['keys']
  insert: SymbolInsert
}

/**
 * The quick keys (docs/spec-v1.md section 4, Touch; section 8, On a phone;
 * M4d), in their order: the characters a line needs most that an on-screen
 * keyboard hides behind its symbols layer. They type by the Symbols tab's
 * rules (`planInsert`): `_ ^ ( ) ,` tight, `= * / ..` spaced, `(` and the
 * quotes wrapping a selection. With nothing selected `(` types only itself,
 * since `)` is its own key; the quotes type a pair with the caret between.
 */
export const QUICK_KEYS: readonly QuickKey[] = [
  { label: '_', name: 'underscore', insert: { mode: 'tight', text: '_' } },
  { label: '^', name: 'power', insert: { mode: 'tight', text: '^' } },
  { label: '=', name: 'equals', insert: { mode: 'spaced', text: '=' } },
  { label: '(', name: 'open', insert: { mode: 'wrap', text: '(', close: ')', alone: true } },
  { label: ')', name: 'close', insert: { mode: 'tight', text: ')' } },
  { label: '*', name: 'times', insert: { mode: 'spaced', text: '*' } },
  { label: '/', name: 'divide', insert: { mode: 'spaced', text: '/' } },
  { label: ',', name: 'comma', insert: { mode: 'tight', text: ',' } },
  { label: '..', name: 'range', insert: { mode: 'spaced', text: '..' } },
  { label: '" "', name: 'quotes', insert: { mode: 'wrap', text: '"', close: '"' } },
]
