import { isAssignmentNode, isFunctionAssignmentNode, isSymbolNode, type MathNode } from 'mathjs'
import type { DisplaySettings } from './display.ts'
import {
  DEFAULT_DISPLAY,
  evaluateSheet,
  isAssignableName,
  isReservedName,
  parseCondition,
  readSheetLine,
  splitLines,
  type ParsedLine,
  type SheetBlock,
  type SheetLine,
} from './evaluate.ts'
import { lineFormats, storeFormats } from './lineForm.ts'

/**
 * A rename (docs/spec-v1.md section 4, Renaming a name; section 14, 0.5.0):
 * one name changed in the line that assigns it and in every use in its reach.
 * Pure: from the sheet's blocks in reading order, one assignment and the new
 * name, `planRename` gives the lines to write, the refusal if there is one,
 * the shadow warning, and the lines whose result would differ. The form, the
 * card and the phone's row show what it returns, and Rename writes exactly that.
 *
 * **It reads a line as the engine does.** No search for the word decides what
 * a use is. Each place the name stands in a line's text is tried on its own:
 * the name there is swapped for a marker no sheet holds, and the line is read
 * again with `readSheetLine`, the reader `evaluateSheet` uses. If the reading
 * is otherwise the same (`signature`), the marker shows how the engine reads
 * that place: as the name the line assigns, as a name it reads, as a parameter
 * or a solve's unknown, or not at all (a text, a note, a plot's title, a unit
 * after `in`, a keyword such as a plot's `x`). If the reading changed, the
 * place was a unit or a keyword, and it is left alone.
 *
 * **Its reach is one assignment** (section 2, Reach): from the line that
 * assigns the name down to the next line that assigns it. What a line reads
 * when it runs (`before`) is the assignment above it; what it reads afterwards
 * (`after`: a rule's condition, a function's body, a solve function's
 * equation and guess) is the assignment the line itself makes, if it makes
 * one. So `rho = rho * 1.1` keeps its left side at the end of a reach, and its
 * right side when it starts one.
 *
 * Only the name's own characters are replaced, in the line's text and in its
 * stored clause, so spacing, notes and clauses stay as typed.
 */

/** One assignment: the element, the line in it (from 0), and the name that line assigns. */
export interface RenameTarget {
  id: string
  line: number
  name: string
}

/** A line of the sheet: its element and its index there, from 0. */
export interface RenameLineRef {
  id: string
  line: number
}

/** Where a name stands in a text. */
export interface NameSpan {
  start: number
  end: number
}

/** One line a rename writes. */
export interface RenamedLine extends RenameLineRef {
  /** The line's new text. With a refusal, the text as it is. */
  text: string
  /** The line's new stored clause (`customData.formats`). With a refusal, the clause as it is. */
  stored: string
  /** Where the old name stands in the line's text as it is: the places a rename replaces. */
  uses: readonly NameSpan[]
  /** The same, in the line's stored clause as it is. */
  storedUses: readonly NameSpan[]
}

/**
 * Why a new name is refused (section 4, The form), with the reason to show
 * under the field in section 13's words. The old name itself and an empty
 * field are refused and say nothing.
 */
export type RenameRefusal =
  | { kind: 'same' | 'empty'; message: null }
  | { kind: 'taken' | 'reserved' | 'not-a-name'; message: string }

export interface RenamePlan {
  /**
   * The lines a rename changes, in reading order: the assigning line and each
   * line with a use. This is what Rename writes, and the form's list.
   */
  lines: readonly RenamedLine[]
  /** Set when the new name is refused: nothing may be written. */
  refusal: RenameRefusal | null
  /** The new name's shadow warning (section 5), in the warning's own words. Allowed. */
  warning: string | null
  /** The lines whose result would differ after the rename, in reading order. Said, not refused. */
  changes: readonly RenameLineRef[]
}

/**
 * What renaming `target` to `newName` does to the sheet. Null when `target`
 * isn't a line that assigns that name, or the name can't be found in it.
 */
export function planRename(
  blocks: readonly SheetBlock[],
  target: RenameTarget,
  newName: string,
  settings: DisplaySettings = DEFAULT_DISPLAY,
): RenamePlan | null {
  const sheet = readSheet(blocks)
  const found = findUses(sheet, target)
  if (found === null) return null
  const refusal = refusalOf(sheet, target.name, newName)
  const lines = found.map(({ row, uses, storedUses }): RenamedLine => ({
    id: row.id,
    line: row.line,
    text: refusal === null ? replaceSpans(row.shown, uses, newName) : row.shown,
    stored: refusal === null ? replaceSpans(row.stored, storedUses, newName) : row.stored,
    uses,
    storedUses,
  }))
  if (refusal !== null) return { lines, refusal, warning: null, changes: [] }

  // "Changes a result" is the engine run twice (section 14): on the sheet as it is and renamed.
  const before = evaluateSheet(blocks, settings)
  const after = evaluateSheet(applyRename(blocks, lines), settings)
  const same = resultComparer(target.name, newName)
  const changes = sheet.flatMap(({ id, line }) => {
    const a = before.get(id)?.[line]
    const b = after.get(id)?.[line]
    return a !== undefined && b !== undefined && same(a, b) ? [] : [{ id, line }]
  })
  const shadows = `${newName} shadows `
  const warning = after.get(target.id)?.[target.line]?.warnings.find((text) => text.startsWith(shadows)) ?? null
  return { lines, refusal, warning, changes }
}

/**
 * The blocks with a plan's lines written: each changed line's text and stored
 * clause, every other character kept, the line ends included.
 */
export function applyRename(blocks: readonly SheetBlock[], lines: readonly RenamedLine[]): SheetBlock[] {
  return blocks.map((block) => {
    const own = lines.filter((line) => line.id === block.id)
    if (own.length === 0) return block
    // Odd entries are the line ends, kept as they are.
    const parts = block.source.split(/(\r?\n)/)
    const stored = lineFormats(block.formats ?? '', (parts.length + 1) / 2)
    let clauseChanged = false
    for (const { line, text, stored: clause } of own) {
      if (line * 2 >= parts.length) continue
      parts[line * 2] = text
      if (stored[line] !== clause) clauseChanged = true
      stored[line] = clause
    }
    const formats = clauseChanged ? storeFormats(stored) : block.formats
    return { ...block, source: parts.join(''), ...(formats === undefined ? {} : { formats }) }
  })
}

/** One line of the sheet, as the engine reads it. */
interface Row extends RenameLineRef {
  shown: string
  stored: string
  parsed: ParsedLine
}

/** Every line of every block, in reading order, read as `evaluateSheet` reads it. */
function readSheet(blocks: readonly SheetBlock[]): Row[] {
  return blocks.flatMap(({ id, source, formats = '' }) => {
    const sources = splitLines(source)
    const stored = lineFormats(formats, sources.length)
    return sources.map((shown, line) => ({ id, line, shown, stored: stored[line], parsed: readSheetLine(shown, stored[line]) }))
  })
}

const assigns = (line: ParsedLine, name: string) => line.kind !== 'blank' && line.defines.includes(name)

/**
 * The lines of `target`'s reach that hold the name, each with where it stands:
 * the assigning line first. Null when `target` assigns no such name.
 */
function findUses(sheet: readonly Row[], target: RenameTarget): { row: Row; uses: NameSpan[]; storedUses: NameSpan[] }[] | null {
  const { name } = target
  const from = sheet.findIndex((row) => row.id === target.id && row.line === target.line)
  if (name === '' || from === -1 || !assigns(sheet[from].parsed, name)) return null
  const next = sheet.findIndex((row, at) => at > from && assigns(row.parsed, name))
  const to = next === -1 ? sheet.length - 1 : next
  const marker = markerFor(sheet)
  const inReach = (role: Role, at: number) =>
    role === 'target' ? at === from : role === 'before' ? at > from : role === 'after' ? next === -1 || at < next : false

  const found: { row: Row; uses: NameSpan[]; storedUses: NameSpan[] }[] = []
  for (let at = from; at <= to; at++) {
    const row = sheet[at]
    let whole: string | null = null
    let assigned = false
    const usesIn = (text: string, read: (swapped: string) => ParsedLine) =>
      places(text, name).filter((span) => {
        whole ??= signature(row.parsed).replaceAll(marker, name)
        const swapped = read(`${text.slice(0, span.start)}${marker}${text.slice(span.end)}`)
        // Read otherwise the same: the marker stands where the engine reads this place.
        if (signature(swapped).replaceAll(marker, name) !== whole) return false
        const roles = rolesOf(swapped, marker, name)
        if (roles.length === 0 || !roles.every((role) => inReach(role, at))) return false
        assigned ||= roles.includes('target')
        return true
      })
    const uses = usesIn(row.shown, (swapped) => readSheetLine(swapped, row.stored))
    const storedUses = usesIn(row.stored, (swapped) => readSheetLine(row.shown, swapped))
    // The name the line assigns has to be found in it, or there is nothing to rename.
    if (at === from && !assigned) return null
    if (uses.length > 0 || storedUses.length > 0) found.push({ row, uses, storedUses })
  }
  return found
}

/** A name no line of the sheet holds, to stand in one place of a line while it is read. */
function markerFor(sheet: readonly Row[]): string {
  let marker = '__renamed__'
  while (sheet.some((row) => row.shown.includes(marker) || row.stored.includes(marker))) marker += '_'
  return marker
}

/**
 * Every place the name's characters stand as a word of their own in a text. A
 * place that isn't the name to the engine (inside a text in quotes, a note, a
 * longer name after a digit) is told apart by reading the line, not here.
 */
function places(text: string, name: string): NameSpan[] {
  const found: NameSpan[] = []
  for (let start = text.indexOf(name); start !== -1; start = text.indexOf(name, start + 1)) {
    const end = start + name.length
    if (!/[A-Za-z_$]/.test(text.charAt(start - 1)) && !/[\w$]/.test(text.charAt(end))) found.push({ start, end })
  }
  return found
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** A text with each span replaced, the rest kept. */
function replaceSpans(text: string, spans: readonly NameSpan[], by: string): string {
  let written = ''
  let from = 0
  for (const { start, end } of spans) {
    written += text.slice(from, start) + by
    from = end
  }
  return written + text.slice(from)
}

/** A rule's condition as the engine parses it, or null where it doesn't parse or assigns: a warning, never run. */
function conditionNode(condition: string): MathNode | null {
  if (condition === '') return null
  try {
    const node = parseCondition(condition)
    return isAssignmentNode(node) || isFunctionAssignmentNode(node) ? null : node
  } catch {
    return null
  }
}

const conditionsOf = (line: ParsedLine): (MathNode | null)[] =>
  line.kind === 'blank' || line.kind === 'syntax-error' ? [] : line.rules.map((rule) => conditionNode(rule.condition))

/**
 * Everything the engine reads from a line, as one text: its form, the names it
 * assigns, each parsed part, its clauses and its rules' conditions. Two lines
 * with one signature read the same. Left out: what moves with a text's length
 * (a rule's place, a syntax error's place), the compiled solve, and
 * `plainInputUnits`, which is read off the parse and depends on what a unit is.
 * A line that didn't parse is only the names its text assigns.
 */
function signature(line: ParsedLine): string {
  if (line.kind === 'syntax-error') return JSON.stringify({ kind: line.kind, defines: line.defines })
  return JSON.stringify({ line, conditions: conditionsOf(line) }, (key, value: unknown) => {
    if (key === 'solve' || key === 'plainInputUnits') return undefined
    if ((key === 'start' || key === 'end') && typeof value === 'number') return undefined
    return value
  })
}

/**
 * How a line reads a name: it assigns it (`target`), reads it when it runs
 * (`before` its own assignment), reads it afterwards (`after`: a rule, a
 * function body, a solve function's parts), or holds it as a name of its own
 * (`bound`: a parameter, a solve's unknown, a rule's `result`).
 */
type Role = 'target' | 'before' | 'after' | 'bound'

/**
 * Each role `marker` has in a line, where `name` stood before the marker took
 * one of its places: the line's own names (parameters, unknown) still say
 * `name` unless the marker took that very place.
 */
function rolesOf(line: ParsedLine, marker: string, name: string): Role[] {
  if (line.kind === 'blank') return []
  const roles: Role[] = line.defines.includes(marker) ? ['target'] : []
  if (line.kind === 'syntax-error') return roles
  const read = (node: MathNode | null, when: 'before' | 'after', own: readonly string[] = []) => {
    if (node === null) return
    for (const bound of symbolReads(node, marker, name, own)) roles.push(bound ? 'bound' : when)
  }
  switch (line.kind) {
    case 'parsed': {
      const { node } = line
      // A function's body runs at each call, after its line.
      if (isFunctionAssignmentNode(node)) read(node.expr, 'after', node.params)
      else read(node, 'before')
      break
    }
    case 'range':
      for (const node of [line.start, line.end, line.step]) read(node, 'before')
      break
    case 'table':
      for (const arg of line.args) read(arg.node, 'before')
      break
    case 'plot':
      for (const node of [
        ...line.args.map((arg) => arg.node),
        ...line.marks.map((mark) => mark.node),
        ...line.ranges.flatMap((range) => [range.start, range.end]),
        ...line.points.flatMap((point) => point.pair ?? []),
        ...line.circles.flatMap((circle) => [...(circle.centre ?? []), circle.radius]),
      ]) {
        read(node, 'before')
      }
      break
    case 'solve': {
      // A solved value runs at its line; a solve function at each call. The unknown is the solve's own.
      const { parts, params } = line
      const own = [parts.unknown, ...(params ?? [])]
      const when = params === null ? 'before' : 'after'
      for (const node of [parts.lhs, parts.rhs, parts.guess, parts.range?.from ?? null, parts.range?.to ?? null]) {
        read(node, when, own)
      }
      break
    }
  }
  // A rule runs after its line, with `result` the line's own value.
  for (const node of conditionsOf(line)) read(node, 'after', ['result'])
  return roles
}

/**
 * For each place a node reads `marker` from the scope, whether `name` is bound
 * there by a function's parameters or by `own`. The left side of a plain
 * assignment isn't a read.
 */
function symbolReads(node: MathNode, marker: string, name: string, own: readonly string[]): boolean[] {
  if (isSymbolNode(node)) return node.name === marker ? [own.includes(name)] : []
  if (isFunctionAssignmentNode(node)) return symbolReads(node.expr, marker, name, [...own, ...node.params])
  if (isAssignmentNode(node) && !node.index) return symbolReads(node.value, marker, name, own)
  const found: boolean[] = []
  node.forEach((child) => found.push(...symbolReads(child, marker, name, own)))
  return found
}

/** Why `newName` can't be the new name, or null (section 4, The form; wording in section 13). */
function refusalOf(sheet: readonly Row[], name: string, newName: string): RenameRefusal | null {
  if (newName === name) return { kind: 'same', message: null }
  if (newName.trim() === '') return { kind: 'empty', message: null }
  if (!isAssignableName(newName)) return { kind: 'not-a-name', message: `${newName} isn't a name.` }
  if (isReservedName(newName)) return { kind: 'reserved', message: `${newName} is reserved.` }
  if (sheet.some((row) => assigns(row.parsed, newName))) {
    return { kind: 'taken', message: `${newName} is already a name on this sheet.` }
  }
  return null
}

/**
 * Whether two runs of one line show the same (section 14, 0.5.0): the same
 * kind of result, and the same shown value, error or list; for a table or a
 * plot, the same cells or points. An error that names the renamed name is the
 * same error under either name, wherever in the line a syntax error stands.
 */
function resultComparer(name: string, newName: string): (a: SheetLine, b: SheetLine) => boolean {
  // Written with no lookbehind, which Obsidian's lint keeps out of the plugin's code (section 12a).
  const either = new RegExp(`(^|[^\\w$])(?:${escapeRegExp(name)}|${escapeRegExp(newName)})(?![\\w$])`, 'g')
  // A syntax error counts its characters, which a longer name moves: `(char 12)`.
  const worded = (message: string | null) => message?.replace(either, '$1\u0000').replace(/ \(char \d+\)/g, '') ?? null
  const shown = ({ result, table, plot }: SheetLine) =>
    JSON.stringify({
      result:
        result.kind === 'error'
          ? { kind: result.kind, message: worded(result.message) }
          : result.kind === 'list'
            ? { ...result, failed: worded(result.failed) }
            : result,
      table: table && {
        units: table.columns.map((column) => column.unit),
        rows: table.rows.map((row) => row.map((cell) => (cell.ok ? cell.text : { failed: worded(cell.message) }))),
      },
      plot: plot && {
        x: [plot.x.values, plot.x.unit, plot.x.domain],
        y: [plot.series.map((series) => series.values), plot.y.unit, plot.y.domain],
        marks: plot.marks.map((mark) => mark.x),
        failed: plot.failed.map((point) => [point.x, worded(point.message)]),
        dots: plot.dots.map((dot) => [dot.x, dot.y, dot.label]),
        circles: plot.circles.map((circle) => [circle.cx, circle.cy, circle.rx, circle.ry]),
        equal: plot.equal,
      },
    })
  return (a, b) => shown(a) === shown(b)
}
