import type { ConstantRowGroup, SheetLine } from '../math/evaluate.ts'
import { APP_UNITS } from '../math/appUnits.ts'
import { FORMAT_COLORS, readFormatWord, TEXT_COLORS } from '../math/lineForm.ts'
import { symbolHint, SYMBOLS } from '../math/symbols.ts'
import { KINDS, NAMED_SI_UNITS, SI_PREFIXED, SLOT_UNITS, USCS } from '../math/unitSystems.ts'
import { words, type Words } from '../text/words.ts'

/**
 * Suggestions while a line is typed (docs/spec-v1.md section 4, While editing
 * a line): the names that start with the word at the caret, drawn from the
 * sheet's names above the line, the built-in constants, the functions and line
 * forms, and the units. Pure: what the sheet and the engine know comes in as
 * `SuggestSources`, so this module knows no React and no math.js. A detail is
 * worded from the text table it is given (`suggest`, the kinds, the symbols'
 * hints, 0.6.0), the one shown unless another is passed: the overlay builds
 * the sources again when the language changes.
 */

export type SuggestionKind = 'variable' | 'function' | 'constant' | 'unit' | 'keyword'

export interface Suggestion {
  /** The name as it is matched and shown. */
  name: string
  kind: SuggestionKind
  /** What it is, beside the name: a value, a signature, a description. */
  detail: string
  /** What replaces the typed word: the name, or `sqrt(` for a function. */
  insert: string
}

export interface SuggestSources {
  /** The sheet's names defined above the line, the nearest first. */
  sheet: readonly Suggestion[]
  constants: readonly Suggestion[]
  functions: readonly Suggestion[]
  units: readonly Suggestion[]
}

export interface Suggested {
  /** The typed word is `text.slice(from, to)`; `to` is the caret. */
  from: number
  to: number
  items: readonly Suggestion[]
}

/** How many entries the list shows. */
export const SUGGESTION_LIMIT = 8

const WORD_CHAR = /[A-Za-z0-9_]/

/**
 * The word being typed: the name that ends at the caret. Null when there is
 * none to complete: the caret is inside a word, after a number (`10k`, `2e3`),
 * in a comment or in a quoted title.
 */
export function wordAt(text: string, caret: number): { from: number; word: string; unitsOnly: boolean } | null {
  const before = text.slice(0, caret)
  const word = /[A-Za-z_][A-Za-z0-9_]*$/.exec(before)?.[0]
  if (!word) return null
  if (WORD_CHAR.test(text[caret] ?? '')) return null
  const from = caret - word.length
  const lead = before.slice(0, from)
  if (/[0-9.]$/.test(lead)) return null
  if (lead.includes('#')) return null
  if ((lead.match(/"/g)?.length ?? 0) % 2 === 1) return null
  // After `in` or `to`, a line reads a display unit: units and nothing else.
  const unitsOnly = /(?:^|[\s)])(?:in|to)\s+[^=,#]*$/.test(lead)
  return { from, word, unitsOnly }
}

/**
 * The list for the text and caret, or null when there is nothing to offer.
 * A name matches when it starts with the word; the same capitals come first,
 * then the sheet's names, then the rest with shorter names first. A name already typed in full isn't offered, and it keeps away names
 * that differ in their capitals.
 */
export function suggest(
  text: string,
  caret: number,
  sources: SuggestSources,
  limit = SUGGESTION_LIMIT,
  w: Words = words(),
): Suggested | null {
  const format = formatSuggest(text, caret, limit, w)
  if (format !== undefined) return format
  const at = wordAt(text, caret)
  if (!at) return null
  const { from, word, unitsOnly } = at
  // A unit typed in full is finished (`3 m/s`): a list there would only be in
  // the way of ↓ and Tab. One more letter brings the list back (`si` for `sin`).
  if (sources.units.some((unit) => unit.name === word)) return null
  const lower = word.toLowerCase()
  const groups = unitsOnly ? [sources.units] : [sources.sheet, sources.constants, sources.functions, sources.units]
  const seen = new Set<string>()
  const ranked: { item: Suggestion; rank: number; group: number; order: number }[] = []
  groups.forEach((group, groupIndex) => {
    group.forEach((item, order) => {
      if (seen.has(item.name)) return
      const exact = item.name.startsWith(word)
      if (!exact && !item.name.toLowerCase().startsWith(lower)) return
      seen.add(item.name)
      if (item.name === word) return
      ranked.push({ item, rank: exact ? 0 : 1, group: groupIndex, order })
    })
  })
  // A word that is already a name: only longer names with the same capitals
  // are worth offering (`sqrt` doesn't bring up `SQRT2`).
  if (seen.has(word)) {
    for (let i = ranked.length - 1; i >= 0; i--) if (ranked[i].rank === 1) ranked.splice(i, 1)
  }
  if (ranked.length === 0) return null
  // The sheet's names lead, in their order (the nearest line first). The rest
  // go by length, since a short name is the nearer completion (`cos` before
  // `conductanceQuantum`), then functions before constants before units.
  const ORDER: Record<SuggestionKind, number> = { variable: 0, function: 1, keyword: 1, constant: 2, unit: 3 }
  const own = (entry: (typeof ranked)[number]) => !unitsOnly && entry.group === 0
  ranked.sort(
    (a, b) =>
      a.rank - b.rank ||
      Number(own(b)) - Number(own(a)) ||
      (own(a) ? a.order - b.order : 0) ||
      a.item.name.length - b.item.name.length ||
      ORDER[a.item.kind] - ORDER[b.item.kind] ||
      a.item.name.localeCompare(b.item.name),
  )
  return { from, to: caret, items: ranked.slice(0, limit).map((entry) => entry.item) }
}

/** The format words a clause offers after `@` (section 3), in the Format tab's order. */
function formatWords(w: Words): Suggestion[] {
  return [
    { name: 'bold', kind: 'keyword', detail: w.suggest.boldRow, insert: 'bold' },
    { name: 'underline', kind: 'keyword', detail: w.suggest.underlinedRow, insert: 'underline' },
    ...TEXT_COLORS.map((color) => ({
      name: `text-${color}`,
      kind: 'keyword' as const,
      detail: w.suggest.textColor,
      insert: `text-${color}`,
    })),
    ...FORMAT_COLORS.map((color) => ({ name: color, kind: 'keyword' as const, detail: w.suggest.highlight, insert: color })),
  ]
}

/**
 * The words a comment line's clause offers (section 4, Suggestions, M4d), in
 * the order the Format tab writes them: no rules, so no `if` after them.
 */
function commentWords(w: Words): Suggestion[] {
  return [
    { name: 'bold', kind: 'keyword', detail: w.suggest.boldComment, insert: 'bold' },
    { name: 'upright', kind: 'keyword', detail: w.suggest.upright, insert: 'upright' },
    { name: 'underline', kind: 'keyword', detail: w.suggest.underlinedComment, insert: 'underline' },
    { name: 'S', kind: 'keyword', detail: w.suggest.size('S', 13), insert: 'S' },
    { name: 'L', kind: 'keyword', detail: w.suggest.size('L', 20), insert: 'L' },
    { name: 'XL', kind: 'keyword', detail: w.suggest.size('XL', 26), insert: 'XL' },
    ...formatWords(w).filter((word) => word.name !== 'bold' && word.name !== 'underline'),
  ]
}

/**
 * Suggestions in a format clause (section 4, Suggestions, M4c): after `@`, the
 * format words; after a whole format word and a space, `if`. A clause at the
 * start of the line, with no code before it, is a comment line's (M4d): it
 * offers the comment words, and never `if`. Undefined when the caret isn't in
 * a clause, so the ordinary list takes over; null when it is, with nothing to
 * offer.
 */
function formatSuggest(text: string, caret: number, limit: number, w: Words): Suggested | null | undefined {
  if (/[\w-]/.test(text[caret] ?? '')) return undefined
  const before = text.slice(0, caret)
  const lead = (index: number) => before.slice(0, index)
  const outside = (index: number) => !lead(index).includes('#') && (lead(index).match(/"/g)?.length ?? 0) % 2 === 0
  // No code before the first `@`: a math line needs code there, so this is a comment's clause.
  const comment = /^\s*@/.test(before)
  const word = /@([A-Za-z][\w-]*)?$/.exec(before)
  if (word && outside(word.index)) {
    const typed = word[1] ?? ''
    const items = (comment ? commentWords(w) : formatWords(w)).filter((item) => item.name.startsWith(typed) && item.name !== typed)
    return items.length === 0 ? null : { from: caret - typed.length, to: caret, items: items.slice(0, limit) }
  }
  const after = /@([A-Za-z][\w-]*)\s+(i?)$/.exec(before)
  if (after && outside(after.index)) {
    if (comment) return null
    if (readFormatWord(after[1]) !== null) {
      const ifWord: Suggestion = { name: 'if', kind: 'keyword', detail: w.suggest.if, insert: 'if ' }
      return { from: caret - after[2].length, to: caret, items: [ifWord] }
    }
  }
  return undefined
}

/** The text and caret after a suggestion replaces the typed word. */
export function accept(text: string, suggested: Suggested, item: Suggestion): { text: string; caret: number } {
  const next = text.slice(0, suggested.from) + item.insert + text.slice(suggested.to)
  return { text: next, caret: suggested.from + item.insert.length }
}

/**
 * The sheet's names for a line: every name the lines above it define, in the
 * elements' reading order, the nearest first. A name defined twice shows as
 * its latest definition above the line.
 */
export function sheetNames(
  blocks: readonly { id: string; lines: readonly SheetLine[] }[],
  at: { anchorId: string; lineIndex: number },
  w: Words = words(),
): Suggestion[] {
  const names: Suggestion[] = []
  outer: for (const block of blocks) {
    for (const [index, line] of block.lines.entries()) {
      if (block.id === at.anchorId && index >= at.lineIndex) break outer
      for (const variable of line.variables) {
        if (variable.kind === 'function') {
          const signature = `${variable.name}(${variable.params.join(', ')})`
          names.push({
            name: variable.name,
            kind: 'function',
            detail: variable.solve ? w.suggest.solveFunction(signature) : signature,
            insert: `${variable.name}(`,
          })
        } else {
          names.push({
            name: variable.name,
            kind: 'variable',
            detail: variable.kind === 'error' ? w.suggest.error : variable.text,
            insert: variable.name,
          })
        }
      }
    }
    if (block.id === at.anchorId) break
  }
  return names.reverse()
}

/** The constants as suggestions: the short name where there is one, then math.js's. */
export function constantSuggestions(groups: readonly ConstantRowGroup[], w: Words = words()): Suggestion[] {
  const description = w.constants.description as Readonly<Record<string, string>>
  return groups
    .flatMap((group) => group.rows)
    .flatMap((row) =>
      [row.short, row.name].flatMap((name) =>
        name === null
          ? []
          : [{ name, kind: 'constant' as const, detail: `${description[row.name] ?? row.name} · ${row.value}`, insert: name }],
      ),
    )
}

/**
 * The functions and line forms a line can use, built from the Symbols
 * catalogue (section 4, Symbols tab, M4d), so the tab and the list can't
 * drift: every entry spelled as a name, but the Greek letters, which are
 * already shortest typed. A call inserts `sqrt(`; a keyword its word and a
 * space (`solve `), or the bare word for `true` and `false`.
 */
export function functionSuggestions(w: Words = words()): Suggestion[] {
  return SYMBOLS.filter((entry) => entry.group !== 'greek' && /^[A-Za-z]\w*$/.test(entry.spelling)).map((entry) => {
    const { spelling, insert } = entry
    const detail = symbolHint(entry, w)
    return insert.mode === 'wrap'
      ? { name: spelling, kind: 'function', detail, insert: `${spelling}(` }
      : { name: spelling, kind: 'keyword', detail, insert: insert.mode === 'word' ? spelling : `${spelling} ` }
  })
}

/**
 * The units as suggestions: every unit name the app's own lists use (the unit
 * slot's, the systems' and the app units), each with its kind. A name only
 * found inside a compound unit (`minute` in `L/minute`) reads "unit".
 */
export function unitSuggestions(w: Words = words()): Suggestion[] {
  const kindOf = new Map<string, string>()
  const atoms = new Set<string>()
  const read = (unit: string, label: string | null) => {
    const names = unit.split(/[^A-Za-z_]+/).filter(Boolean)
    for (const name of names) atoms.add(name)
    if (label !== null && names.length === 1 && names[0] === unit && !kindOf.has(unit)) kindOf.set(unit, label)
  }
  for (const kind of KINDS) {
    for (const unit of [...SI_PREFIXED[kind], ...SLOT_UNITS[kind], USCS[kind]]) read(unit, w.kinds.name[kind])
  }
  for (const unit of NAMED_SI_UNITS) read(unit, w.suggest.electrical)
  for (const { name } of APP_UNITS) read(name, null)
  for (const extra of ['mol', 'rad', 'deg', 'hour', 'second', 'kohm', 'mA', 'mV', 'kV', 'degC', 'degF']) read(extra, null)
  return [...atoms].map((name) => ({ name, kind: 'unit', detail: kindOf.get(name) ?? w.suggest.unit, insert: name }))
}

/** Where the open line's field and its list sit on screen, and the strip that is visible. */
export interface ListRoom {
  fieldTop: number
  fieldBottom: number
  listHeight: number
  /** The visible strip: the visual viewport, short of a phone's bottom sheet. */
  visibleTop: number
  visibleBottom: number
}

/**
 * Whether the suggestions open above the field (section 4, While editing a
 * line, M4d): when below it they would be covered (by the on-screen keyboard or
 * a phone's bottom sheet) and there is more room above.
 */
export function listGoesAbove({ fieldTop, fieldBottom, listHeight, visibleTop, visibleBottom }: ListRoom): boolean {
  const below = visibleBottom - fieldBottom
  const above = fieldTop - visibleTop
  return listHeight > below && above > below
}
