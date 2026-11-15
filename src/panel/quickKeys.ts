import type { SymbolInsert } from '../math/symbols.ts'

/** One quick key: what it shows and reads as, and what it types. */
export interface QuickKey {
  label: string
  /** Its accessible name and hover. */
  name: string
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
  { label: '_', name: 'Underscore', insert: { mode: 'tight', text: '_' } },
  { label: '^', name: 'To the power', insert: { mode: 'tight', text: '^' } },
  { label: '=', name: 'Equals', insert: { mode: 'spaced', text: '=' } },
  { label: '(', name: 'Open bracket', insert: { mode: 'wrap', text: '(', close: ')', alone: true } },
  { label: ')', name: 'Close bracket', insert: { mode: 'tight', text: ')' } },
  { label: '*', name: 'Times', insert: { mode: 'spaced', text: '*' } },
  { label: '/', name: 'Divide', insert: { mode: 'spaced', text: '/' } },
  { label: ',', name: 'Comma', insert: { mode: 'tight', text: ',' } },
  { label: '..', name: 'Range', insert: { mode: 'spaced', text: '..' } },
  { label: '" "', name: 'Quotes', insert: { mode: 'wrap', text: '"', close: '"' } },
]
