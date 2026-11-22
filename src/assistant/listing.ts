import type { SceneText } from '../canvas/sceneTexts.ts'
import type { DisplaySettings } from '../math/display.ts'
import type { SheetLine, SolveDetails, TableView } from '../math/evaluate.ts'
import { lineFormats, withFormat } from '../math/lineForm.ts'
import type { EngineMessage } from '../math/messages.ts'
import { readTable } from '../math/tableLine.ts'
import type { UnitSystemName } from '../math/unitSystems.ts'
import { readingOrder, type Placed } from '../overlay/readingOrder.ts'
import { wordMessage } from '../text/engine.ts'
import type { Words } from '../text/words.ts'

/**
 * The listing (spec section 8, Math assistant, The listing; section 14, 0.7.0): the sheet
 * written as plain text for the model, as the sheet is at one Send. One pure function,
 * `listSheet`, from the last evaluation and the scene's text elements to the text, its
 * counts and the map. The map is kept per Send and never sent; `chipTarget` reads it.
 *
 * The marks are English in both languages; a result, an error and a warning are worded as
 * the sheet shows them, in the language of `words`. Nothing that isn't text or math goes:
 * no Excalidraw id, no position, no file name, no title format, no rule state, no Result
 * colour, no Page.
 */

/** The cap, in characters as JavaScript's `length` counts them (section 8, What a Send carries). */
export const LISTING_LIMIT = 200_000

/** A table's rows that go, at most (section 8, The listing: "its first 20 rows"). */
export const TABLE_ROWS = 20

/** One math element as last evaluated: what the overlay reports (`EvaluatedElement` fits it). */
export interface ListedElement {
  anchorId: string
  title: string | null
  /** The element's lines as text, an open line's typed text in place. */
  source: string
  /** The lines' stored formats, as the anchor holds them. */
  formats?: string
  lines: readonly SheetLine[]
}

/** What the listing is made from. */
export interface ListingInput {
  /** The last evaluation, its elements in any order. */
  elements: readonly ListedElement[]
  /** Each math element's anchor box, for the reading order with the texts. */
  anchors: readonly Placed[]
  /** The scene's text elements (`sceneTexts`). */
  texts: readonly SceneText[]
  /** The sheet's unit system and Digits. */
  settings: DisplaySettings
  /** The words of the language shown, for results, errors and warnings. */
  words: Words
}

/** What a label stands for in the scene. Never sent. */
export type MapEntry =
  | { kind: 'element'; anchorId: string }
  /** `line` is the line's index, from 0; `text` the line as the listing gave it. */
  | { kind: 'line'; anchorId: string; line: number; text: string }
  | { kind: 'text'; textId: string; text: string }

/** Each label of one listing (`E2`, `E2:3`, `T1`) and what it stands for. */
export type ListingMap = ReadonlyMap<string, MapEntry>

export interface ListingCounts {
  elements: number
  lines: number
  texts: number
}

export type Listing =
  | { kind: 'listing'; text: string; counts: ListingCounts; map: ListingMap }
  /** No math element and no text: there is no listing, and the Send says the sheet is empty. */
  | { kind: 'empty' }
  /** Over the cap: refused with both numbers, never cut. `message` is the refusal, worded. */
  | { kind: 'tooLong'; length: number; limit: number; message: string }

/** The unit systems by their English names (the marks are English in both languages). */
const SYSTEM_NAMES: Record<UnitSystemName, string> = {
  'si-prefixed': 'SI with prefixes',
  'si-base': 'SI base units',
  uscs: 'USCS',
}

/** The sheet as the model reads it, or why there is none. */
export function listSheet(input: ListingInput, limit = LISTING_LIMIT): Listing {
  const { elements, anchors, texts, settings, words: w } = input
  if (elements.length === 0 && texts.length === 0) return { kind: 'empty' }

  const byAnchor = new Map(elements.map((element) => [element.anchorId, element]))
  const byText = new Map(texts.map((text) => [text.id, text]))
  const placed = [...anchors.filter(({ id }) => byAnchor.has(id)), ...texts]
  const order = readingOrder(placed)
  // An element whose anchor wasn't handed in still goes, after the placed ones.
  const seen = new Set(order)
  for (const { anchorId } of elements) if (!seen.has(anchorId)) order.push(anchorId)

  const out: string[] = [systemLine(settings)]
  const map = new Map<string, MapEntry>()
  const counts: ListingCounts = { elements: 0, lines: 0, texts: 0 }
  for (const id of order) {
    const element = byAnchor.get(id)
    if (element) {
      const label = `E${++counts.elements}`
      map.set(label, { kind: 'element', anchorId: id })
      out.push('', element.title ? `${label}  title: ${quoted(element.title)}` : `${label}  (no title)`)
      const sent = sentLines(element.source, element.formats ?? '')
      sent.forEach((text, i) => {
        map.set(`${label}:${i + 1}`, { kind: 'line', anchorId: id, line: i, text })
        out.push(...lineRows(i + 1, text, element.lines[i], w))
      })
      counts.lines += sent.length
      continue
    }
    const text = byText.get(id)
    if (text) {
      const label = `T${++counts.texts}`
      map.set(label, { kind: 'text', textId: id, text: text.text })
      out.push('', `${label}  text: ${quoted(text.text)}`)
    }
  }
  const listing = out.join('\n') + '\n'
  if (listing.length > limit) {
    return { kind: 'tooLong', length: listing.length, limit, message: w.assistant.tooLong(listing.length, limit) }
  }
  return { kind: 'listing', text: listing, counts, map }
}

/** Each line of an element as the engine reads it: its text with its stored clause joined. */
export function sentLines(source: string, formats: string): string[] {
  const lines = source.split('\n')
  const stored = lineFormats(formats, lines.length)
  return lines.map((line, i) => withFormat(line, stored[i]))
}

/** The first line, once: the unit system and Digits. */
function systemLine({ units, digits }: DisplaySettings): string {
  const custom = Object.entries(units.custom).filter((entry): entry is [string, string] => entry[1] !== undefined)
  const system =
    custom.length === 0
      ? SYSTEM_NAMES[units.system]
      : `Custom, from ${SYSTEM_NAMES[units.system]} (${custom.map(([kind, unit]) => `${kind}: ${unit}`).join(', ')})`
  return `unit system: ${system}, Digits: ${digits}`
}

/** A text in quotes, on one row: a line break in it is written `\n`. */
function quoted(text: string): string {
  return `"${text.replace(/\r\n|\r|\n/g, '\\n')}"`
}

/** A message or a shown text on one row. */
function oneRow(text: string): string {
  return text.replace(/\s*(?:\r\n|\r|\n)\s*/g, ' ')
}

/** One line of an element and the rows after it: its result, error, warnings and solve details. */
function lineRows(number: number, text: string, line: SheetLine | undefined, w: Words): string[] {
  const rows = [text.trim() === '' ? `  ${number} |` : `  ${number} | ${text}`]
  if (!line) return rows
  const word = (message: EngineMessage) => oneRow(wordMessage(w.engine, message))
  const { result, typeset } = line
  switch (result.kind) {
    case 'value':
    case 'roots':
      rows.push(`    = ${oneRow(result.text)}`)
      break
    case 'list':
      rows.push(`    = ${oneRow(result.text)}`)
      if (result.failed !== null) rows.push(`    ! error: ${word(result.failed)}`)
      break
    case 'error':
      // An unexpected failure goes as its words and its raw text, never its stack.
      rows.push(
        `    ! error: ${word(result.message)}${result.unexpected ? `: ${oneRow(result.unexpected.text)}` : ''}`,
      )
      break
    case 'empty':
      // A comment line and a blank line have no `=` row; a table and a plot have their own.
      if (typeset.kind === 'math' && line.table === null && line.plot === null) {
        rows.push(`    = ${line.variables.some((v) => v.kind === 'function') ? '(function)' : '(input)'}`)
      }
      break
  }
  if (line.table !== null) rows.push(...tableRows(text, line.table, w))
  if (line.plot !== null) {
    const points = line.plot.x.values.length
    const failed = line.plot.failed.length
    rows.push(`    = plot, ${points} ${points === 1 ? 'point' : 'points'}, ${failed} failed`)
  }
  for (const warning of line.warnings) rows.push(`    ~ warning: ${word(warning)}`)
  if (line.solveDetails !== null) rows.push(`    solve: ${solveText(line.solveDetails)}`)
  return rows
}

/** A table as its headers, its first rows and its row count. */
function tableRows(text: string, table: TableView, w: Words): string[] {
  const args = readTable(text)?.args ?? []
  const headers = table.columns.map((column, i) => {
    const expression = args[i]?.expression ?? `column ${i + 1}`
    return column.unit === '' ? expression : `${expression} (${column.unit})`
  })
  const count = table.rows.length
  const shown = table.rows.slice(0, TABLE_ROWS)
  const head =
    count > TABLE_ROWS
      ? `    = table, ${count} rows; first ${TABLE_ROWS}:`
      : `    = table, ${count} ${count === 1 ? 'row' : 'rows'}:`
  return [
    head,
    `      ${headers.join(' | ')}`,
    ...shown.map(
      (row) =>
        `      ${row.map((cell) => (cell.ok ? cell.text : `failed: ${oneRow(wordMessage(w.engine, cell.message))}`)).join(' | ')}`,
    ),
  ]
}

/** A solve's details, on one row, so the reviewer can say whether a root can be trusted. */
function solveText(details: SolveDetails): string {
  if (details.method === 'scan') {
    const { range, points, roots, rejected } = details
    const found = roots.map(
      (root) => `${root.value}${root.touching ? ' (touching)' : ''}, residual ${root.residual}`,
    )
    return [
      `range ${range}`,
      `scan + Brent, ${points} points`,
      `${roots.length} ${roots.length === 1 ? 'root' : 'roots'} found in the range${found.length > 0 ? `: ${found.join('; ')}` : ''}`,
      `${rejected} ${rejected === 1 ? 'crossing' : 'crossings'} rejected as poles or jumps`,
    ].join(', ')
  }
  const { method, iterations, residual, bracket } = details
  return `guess, ${method}, ${iterations} ${iterations === 1 ? 'iteration' : 'iterations'}, residual ${residual}, bracket ${bracket}`
}

/** What a chip does now (section 8, An answer, After the sheet changed). */
export type ChipState = 'jumps' | 'changed' | 'gone' | 'unknown'

/** The scene now, as a chip reads it: each math element's lines and each text element's text. */
export interface SceneNow {
  anchors: readonly { id: string; source: string; formats?: string }[]
  texts: readonly { id: string; text: string }[]
}

/**
 * A chip's label against the scene now, by the map of the Send it came with: the line still
 * reads as sent (jumps), the element is there but the line's text differs (changed), the
 * element is gone, or the label is in no map (the model made it up).
 */
export function chipTarget(map: ListingMap, label: string, now: SceneNow): { state: ChipState; entry: MapEntry | null } {
  const entry = map.get(label) ?? null
  if (entry === null) return { state: 'unknown', entry }
  if (entry.kind === 'text') {
    const text = now.texts.find(({ id }) => id === entry.textId)
    return { state: !text ? 'gone' : text.text === entry.text ? 'jumps' : 'changed', entry }
  }
  const anchor = now.anchors.find(({ id }) => id === entry.anchorId)
  if (!anchor) return { state: 'gone', entry }
  if (entry.kind === 'element') return { state: 'jumps', entry }
  const line = sentLines(anchor.source, anchor.formats ?? '')[entry.line]
  return { state: line === entry.text ? 'jumps' : 'changed', entry }
}
