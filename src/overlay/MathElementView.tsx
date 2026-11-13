import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import type { MathAnchor } from '../canvas/mathAnchor.ts'
import type { ForwardWheel } from '../canvas/SheetCanvas.tsx'
import {
  splitLines,
  typesetResult,
  typesetUnit,
  type LineResult,
  type SheetLine,
  type SolveDetails,
  type PlotView,
  type TableView,
  type TypesetLine,
} from '../math/evaluate.ts'
import {
  codeLength,
  FORMAT_COLORS,
  NO_FORMAT,
  readLine,
  writeFormat,
  type LineFormat,
} from '../math/lineForm.ts'
import { leadingNumber } from '../math/numbers.ts'
import { texToHtml, useKatexReady } from './katex.ts'
import { UnitField } from './UnitField.tsx'
import { PlotChart } from './PlotChart.tsx'
import { PlotSettings } from './PlotSettings.tsx'
import { GEAR } from './useSheetGestures.ts'
import { readPlot, type PlotClause } from '../math/plotLine.ts'
import { hasText, TITLE_LINE, type LineEdit, type LineMove } from './lineEdit.ts'
import type { Suggested, Suggestion } from './suggest.ts'
import { sceneToStage, type Viewport } from './viewport.ts'

export interface MathElementViewProps {
  anchor: MathAnchor
  viewport: Viewport
  /** The element's lines, with any typed text in place. */
  source: string
  /** One per line of `source`, from the sheet's evaluation (MathOverlay). */
  lines: readonly SheetLine[]
  /** The sheet's line edit, when it is in this element. */
  edit: LineEdit | null
  onType: (text: string) => void
  /** The app rewrote the open line's text (a format from the bar): one line commit. */
  onRewrite: (text: string, caret: number) => void
  onMove: (move: LineMove) => void
  onEscape: () => void
  onBlurLine: (lineIndex: number) => void
  forwardWheel: ForwardWheel
  /** The line a jump from the Sheet panel flashes (section 8), with its key to restart the flash. */
  flash?: { line: number; key: number } | null
  /** The unit slots (section 5): which row is hovered, which slot's field is open. */
  unitSlots?: UnitSlots
  /** The suggestions for the open line's text and caret (section 4); none on the title. */
  suggest?: Suggest | null
}

/** What the open line offers for a text and caret: the names that start with the word there. */
export type Suggest = (text: string, caret: number) => Suggested | null

/** What the result cells need for their unit slots. */
export interface UnitSlots {
  /** The hovered row: its slot shows outlined, an empty one included. */
  hovered: number | null
  /** The row whose unit field is open. */
  open: number | null
  /** The table column whose header field is open on that row; null for the result's own. */
  openColumn?: number | null
  /** Writes the chosen unit (null for Sheet units) into the line, or into a table column's argument, as one line commit. */
  apply: (line: number, unit: string | null, column?: number) => void
  /** Writes a plot line's clauses (its ⚙ popover), as one line commit; the popover stays open. */
  applyPlot?: (line: number, clauses: PlotClause[]) => void
  cancel: () => void
  /** Whether typed text is a unit the line can show in. */
  isUnit: (text: string) => boolean
}

const NO_SLOTS: UnitSlots = {
  hovered: null,
  open: null,
  apply: () => {},
  cancel: () => {},
  isUnit: () => false,
}

const SlotsContext = createContext<UnitSlots>(NO_SLOTS)

const SuggestContext = createContext<Suggest | null>(null)

/**
 * One math element as a worksheet block (docs/spec-v1.md section 4, Typeset
 * grid): a grid of typeset rows, *gutter · equation · result · note*, where the
 * equation is the line's name, `≔` and expression, flush left. The result and
 * note columns line up across the element's rows. Laid out in scene units and scaled
 * by the zoom, so it moves and scales exactly like the anchor Excalidraw draws
 * underneath.
 *
 * The body takes its content's size (`max-content`); the overlay measures it
 * and sizes the anchor to it (`useAnchorSizes`). It rotates about the anchor's
 * centre, Excalidraw's rule, so it matches the drawing before a size write too.
 *
 * Takes no pointer events, except the open field: Excalidraw gets every click
 * and drag on the anchor underneath, and the overlay's gestures find the line
 * from each row's `offsetTop` and `offsetHeight` (`data-line`).
 */
export function MathElementView({
  anchor,
  viewport,
  source,
  lines,
  edit,
  onType,
  onRewrite,
  onMove,
  onEscape,
  onBlurLine,
  forwardWheel,
  flash = null,
  unitSlots = NO_SLOTS,
  suggest = null,
}: MathElementViewProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const katexReady = useKatexReady()
  const { x, y } = sceneToStage(anchor, viewport)
  // A new or emptied element: its field starts with room to type (section 4, Size).
  const isEmpty = !hasText(anchor.source)

  // React's onWheel is passive, so it cannot stop ctrl+wheel zooming the page.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.addEventListener('wheel', forwardWheel, { passive: false })
    return () => root.removeEventListener('wheel', forwardWheel)
  }, [forwardWheel])

  return (
    <div
      ref={rootRef}
      className="math-element"
      data-anchor-id={anchor.id}
      style={{
        width: anchor.width,
        height: anchor.height,
        // The anchor's opacity, on every row but the one being edited.
        ['--math-opacity' as string]: anchor.opacity / 100,
        transform: `translate(${x}px, ${y}px) scale(${viewport.zoom})`,
      }}
    >
      <div
        className="math-element__body"
        style={
          anchor.angle
            ? {
                transform: `rotate(${anchor.angle}rad)`,
                transformOrigin: `${anchor.width / 2}px ${anchor.height / 2}px`,
              }
            : undefined
        }
      >
        {(anchor.title !== '' || edit?.lineIndex === TITLE_LINE) && (
          <Header
            title={anchor.title}
            edit={edit?.lineIndex === TITLE_LINE ? edit : null}
            onType={onType}
            onMove={onMove}
            onEscape={onEscape}
            onBlur={() => onBlurLine(TITLE_LINE)}
          />
        )}
        <SuggestContext.Provider value={suggest}>
        <SlotsContext.Provider value={unitSlots}>
          <ol className="math-element__grid" aria-label="Lines">
            {splitLines(source).map((text, i) => {
              const line = lines[i] ?? EMPTY_LINE
              const editing = edit?.lineIndex === i
              const flashing = flash?.line === i
              return (
                <li
                  // A new key restarts the flash's animation on a second jump.
                  key={flashing ? `${i}:${flash.key}` : i}
                  className={`math-element__row is-${editing ? 'editing' : line.typeset.kind}${formatClasses(
                    editing ? formatOf(edit.text) : line.typeset.kind === 'math' ? line.typeset.format : NO_FORMAT,
                  )}${flashing ? ' is-flash' : ''}`}
                  data-line={i}
                  aria-label={text}
                >
                  {editing ? (
                    <EditingRow
                      edit={edit}
                      result={line.result}
                      warnings={line.warnings}
                      isEmpty={isEmpty}
                      onType={onType}
                      onRewrite={onRewrite}
                      onMove={onMove}
                      onEscape={onEscape}
                      onBlur={() => onBlurLine(i)}
                    />
                  ) : (
                    <TypesetRow text={text} line={line} index={i} katexReady={katexReady} />
                  )}
                </li>
              )
            })}
          </ol>
        </SlotsContext.Provider>
        </SuggestContext.Provider>
      </div>
    </div>
  )
}

/**
 * The element's header (section 4, Typeset grid): its optional title, bold,
 * above the lines, with a rule under it. Plain text on one line, never
 * evaluated. While its edit is open it is a field, as a line is; an element
 * with no title has no header until the edit opens one.
 */
function Header({
  title,
  edit,
  ...field
}: {
  title: string
  edit: LineEdit | null
  onType: (text: string) => void
  onMove: (move: LineMove) => void
  onEscape: () => void
  onBlur: () => void
}) {
  const fieldRef = useRef<HTMLInputElement>(null)
  return (
    <div className={`math-element__title${edit ? ' is-editing' : ''}`} data-title aria-label="Title">
      {edit ? (
        <span className="math-element__field-cell is-title">
          <span className="math-element__field-text" aria-hidden="true">
            {edit.text}
          </span>
          <LineField fieldRef={fieldRef} label="Title" edit={edit} onFormat={null} {...field} />
        </span>
      ) : (
        title
      )}
    </div>
  )
}

/** The format the open line's typed text asks for; a line with no code has none. */
function formatOf(text: string): LineFormat {
  const form = readLine(text)
  return form.kind === 'code' ? form.format : NO_FORMAT
}

/** A row's format as classes: the stylesheet draws bold, underline and the band. */
function formatClasses({ bold, underline, color }: LineFormat): string {
  return `${bold ? ' is-bold' : ''}${underline ? ' is-underline' : ''}${color ? ` is-${color}` : ''}`
}

const EMPTY_LINE: SheetLine = {
  result: { kind: 'empty' },
  typeset: { kind: 'blank' },
  warnings: [],
  variables: [],
  unitSlot: null,
  solveDetails: null,
  listPreview: null,
  table: null,
  plot: null,
}

/** A row's cells, by line form (section 3, section 4 Problems). */
function TypesetRow({
  text,
  line,
  index,
  katexReady,
}: {
  text: string
  line: SheetLine
  index: number
  katexReady: boolean
}) {
  const { typeset, result, warnings } = line
  switch (typeset.kind) {
    case 'blank':
      return <ResultCell result={result} />
    case 'comment':
      return <span className="math-element__comment">{typeset.text}</span>
    case 'unparsed':
      return (
        <>
          <Gutter result={result} warnings={warnings} />
          <span className="math-element__raw">{typeset.source}</span>
          <ResultCell result={result} />
        </>
      )
    case 'math':
      // Until KaTeX has loaded, the line shows as its source.
      if (!katexReady) {
        return (
          <>
            <Gutter result={result} warnings={warnings} />
            <span className="math-element__source">{text}</span>
            <ResultCell result={result} plain />
          </>
        )
      }
      return (
        <MathCells typeset={typeset} result={result} warnings={warnings} fallback={text} line={line} index={index} />
      )
  }
}

function MathCells({
  typeset,
  result,
  warnings,
  fallback,
  line,
  index,
}: {
  typeset: Extract<TypesetLine, { kind: 'math' }>
  result: LineResult
  warnings: readonly string[]
  fallback: string
  line: SheetLine
  index: number
}) {
  const name = typeset.name === null ? null : texToHtml(typeset.name)
  const defines = texToHtml(DEFINES)
  const expression = texToHtml(typeset.expression)
  const aside = typeset.aside === undefined ? null : texToHtml(typeset.aside)
  // TeX KaTeX couldn't render: the line's source, as text, rather than nothing.
  const cells =
    expression === null || (typeset.name !== null && name === null) ? (
      <span className="math-element__source">{fallback}</span>
    ) : (
      // One display, flush left: name, ≔ and expression together (section 4,
      // Typeset grid). A bare expression has no name or ≔ to indent it.
      <span className="math-element__equation">
        {name !== null && (
          <>
            <span className="math-element__name">
              <Html html={name} />
            </span>
            {defines !== null && (
              <span className="math-element__defines">
                <Html html={defines} />
              </span>
            )}
          </>
        )}
        <span className="math-element__expression">
          <Html html={expression} />
        </span>
        {aside !== null && (
          <span className="math-element__aside">
            <Html html={aside} />
          </span>
        )}
      </span>
    )
  return (
    <>
      <Gutter result={result} warnings={warnings} />
      {cells}
      <ResultCell
        result={result}
        slot={line.unitSlot}
        index={index}
        details={line.solveDetails}
        preview={line.listPreview}
      />
      {typeset.note !== null && <span className="math-element__note">{typeset.note}</span>}
      {line.table !== null && <TableBlock table={line.table} index={index} />}
      {line.plot !== null && <PlotCell plot={line.plot} source={fallback} index={index} />}
    </>
  )
}

/**
 * A table line's table (section 10), under the line and inside its row, so it
 * counts toward the box and a double-click on it opens the line. One column
 * per argument, headed by its expression and its unit in a slot; numbers line
 * up on the decimal point; a failed cell is a red — with its message on hover.
 */
function TableBlock({ table, index }: { table: TableView; index: number }) {
  const slots = useContext(SlotsContext)
  return (
    <div className="math-element__table-cell">
      <table className="math-element__table">
        <thead>
          <tr>
            {table.columns.map((column, c) => {
              const header = texToHtml(column.header)
              const unit = column.unit === '' ? null : texToHtml(typesetUnit(column.unit))
              const open = column.slot !== null && slots.open === index && slots.openColumn === c
              return (
                <th key={c} colSpan={2}>
                  {header === null ? column.header : <Html html={header} />}
                  {column.slot !== null && (
                    <span className="math-element__column-unit">
                      <SlotBox
                        index={index}
                        column={c}
                        chosen={column.slot.chosen !== null}
                        hovered={slots.hovered === index}
                        unitHtml={unit}
                        unitText={column.unit}
                      />
                      {open && (
                        <UnitField
                          slot={column.slot}
                          isUnit={slots.isUnit}
                          onApply={(chosen) => slots.apply(index, chosen, c)}
                          onCancel={slots.cancel}
                        />
                      )}
                    </span>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => {
                if (!cell.ok) {
                  return (
                    <td key={c} colSpan={2} className="is-failed" data-tip={cell.message} data-tip-when="details">
                      —
                    </td>
                  )
                }
                const [whole, rest] = splitDecimal(cell.text)
                return [
                  <td key={`${c}w`} className="is-whole">
                    {whole}
                  </td>,
                  <td key={`${c}r`} className="is-rest">
                    {rest}
                  </td>,
                ]
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * A plot line's chart, with its ⚙ (section 10, Plots): the ⚙ shows while the
 * row is hovered and opens the settings popover on `click`, as a unit slot
 * does (it is found by `data-unit-slot="line:gear"`); the popover writes the
 * line's clauses.
 */
function PlotCell({ plot, source, index }: { plot: PlotView; source: string; index: number }) {
  const slots = useContext(SlotsContext)
  const open = slots.open === index && slots.openColumn === GEAR
  const form = readLine(source)
  const clauses = form.kind === 'code' ? (readPlot(form.code)?.clauses ?? []) : []
  return (
    <div className="math-element__plot-cell">
      <PlotChart plot={plot} />
      {(slots.hovered === index || open) && (
        <span className={`math-element__gear${open ? ' is-open' : ''}`} data-unit-slot={`${index}:gear`}>
          ⚙
        </span>
      )}
      {open && (
        <PlotSettings
          clauses={clauses}
          onChange={(next) => slots.applyPlot?.(index, next)}
          onClose={slots.cancel}
        />
      )}
    </div>
  )
}

/** `12.04` as `12` and `.04`, so a column lines up on the decimal point; `1.860·10⁵` as `1` and `.860·10⁵`. */
function splitDecimal(text: string): [string, string] {
  const match = /^(-?\d+)(.*)$/s.exec(text)
  return match ? [match[1], match[2]] : [text, '']
}

/** `≔`, Mathcad's definition sign, in KaTeX's font (`\coloneqq`). */
const DEFINES = '\\coloneqq'

function Html({ html }: { html: string }) {
  return <span className="math-element__tex" dangerouslySetInnerHTML={{ __html: html }} />
}

/**
 * The problem gutter (section 4, Problems): a red `●` for an error, else an
 * amber `⚠` for warnings. Warnings never change the result, so the value still
 * shows beside the mark. The mark's message (`data-tip`) shows on hover, found
 * by the gestures from the mark's box (`tipAt`): the overlay takes no pointer
 * events, so a `title` here would never show. Screen only: print and the file
 * never carry it.
 */
function Gutter({ result, warnings }: { result: LineResult; warnings: readonly string[] }) {
  // A list's failed points are the line's error (section 10).
  const message = result.kind === 'error' ? result.message : result.kind === 'list' ? result.failed : null
  const error = message !== null
  const warned = !error && warnings.length > 0
  return (
    <span
      className={`math-element__gutter${warned ? ' is-warning' : ''}`}
      data-tip={error ? message : warned ? warnings.join('\n') : undefined}
      data-warnings={warnings.length > 0 ? warnings.join('\n') : undefined}
    >
      {error ? '●' : warned ? '⚠' : ''}
    </span>
  )
}

/**
 * The result cell, after the column rule. A value shows typeset, with no
 * leading `=`; an error shows its message, capped with an ellipsis, the whole
 * text on hover (section 4, Problems): `data-tip`, which the gestures show only
 * while the cell is cut short. `data-text` holds the result as text.
 */
function ResultCell({
  result,
  plain = false,
  slot = null,
  index = -1,
  details = null,
  preview = null,
}: {
  result: LineResult
  plain?: boolean
  slot?: SheetLine['unitSlot']
  index?: number
  details?: SolveDetails | null
  preview?: string | null
}) {
  const slots = useContext(SlotsContext)
  let content: ReactNode = null
  let text: string | undefined
  if (result.kind === 'value') {
    text = result.text
    content = plain ? result.text : <ValueContent text={result.text} slot={slot} index={index} />
    // Section 4, Solve details: a dotted underline, and the details on hover.
    if (details !== null && !plain) {
      content = (
        <span className="math-element__detailed" data-tip={detailsText(details)} data-tip-when="details">
          {content}
        </span>
      )
    }
  } else if (result.kind === 'error') {
    text = result.message
    content = result.message
  } else if (result.kind === 'roots') {
    // Section 9, Roots: written out in one row, the unit once in its slot, or a summary; details on hover.
    text = result.text
    if (plain) content = result.text
    else {
      const inner = result.written ? (
        <RootsContent text={result.text} slot={slot} index={index} />
      ) : (
        <SummaryContent text={result.text} />
      )
      content =
        details === null ? (
          inner
        ) : (
          <span className="math-element__detailed" data-tip={detailsText(details)} data-tip-when="details">
            {inner}
          </span>
        )
    }
  } else if (result.kind === 'list') {
    // Section 10: one row high, as a summary, its points on hover; no unit slot.
    text = result.text
    content = plain ? (
      result.text
    ) : (
      <span className="math-element__summary" data-tip={preview ?? undefined} data-tip-when="details">
        <SummaryContent text={result.text} />
      </span>
    )
  } else if (slot && slots.hovered === index && !plain) {
    // A plain input: an empty slot on hover (section 5, Unit slot).
    content = <SlotBox index={index} chosen={false} hovered unitHtml={null} />
  }
  const open = slot !== null && slots.open === index && (slots.openColumn ?? null) === null && !plain
  return (
    <span
      className={`math-element__result is-${result.kind}`}
      data-text={text}
      data-tip={result.kind === 'error' ? result.message : undefined}
      data-tip-when={result.kind === 'error' ? 'capped' : undefined}
    >
      {content}
      {open && (
        <UnitField
          slot={slot}
          isUnit={slots.isUnit}
          onApply={(unit) => slots.apply(index, unit)}
          onCancel={slots.cancel}
        />
      )}
    </span>
  )
}

/** How a solve went, for the hover (section 4, Solve details). */
function detailsText(details: SolveDetails): string {
  if (details.method === 'scan') {
    const { range, points, roots, rejected } = details
    return [
      `Scan + Brent, roots found in ${range}`,
      `${points} points`,
      ...roots.map(
        (root, i) => `Root ${i + 1}: ${root.value}${root.touching ? ' (touching)' : ''}, residual ${root.residual}`,
      ),
      ...(rejected === 0 ? [] : [`${rejected} ${rejected === 1 ? 'crossing' : 'crossings'} rejected as poles or jumps`]),
    ].join('\n')
  }
  const { method, iterations, residual, bracket } = details
  return [
    `${method}, ${iterations} ${iterations === 1 ? 'iteration' : 'iterations'}`,
    `Residual: ${residual}`,
    `Bracket: ${bracket}`,
  ].join('\n')
}

/**
 * A list's summary (section 10): the count as text, then the first and last
 * values typeset, `30 values, 12.04 … 33.18 m`.
 */
function SummaryContent({ text }: { text: string }) {
  const comma = text.indexOf(', ')
  if (comma === -1) return <>{text}</>
  const values = text.slice(comma + 2).split(' … ')
  const typeset = values.map((value) => texToHtml(typesetResult(value)))
  if (typeset.some((html) => html === null)) return <>{text}</>
  return (
    <>
      <span className="math-element__count">{text.slice(0, comma + 1)} </span>
      {typeset.map((html, i) => (
        <span key={i}>
          {i > 0 && ' … '}
          <Html html={html!} />
        </span>
      ))}
    </>
  )
}

/**
 * A solved value's roots written out (section 9, Roots): `1, 2, 3 m`, each
 * number typeset, the unit once, after the last, in the line's slot.
 */
function RootsContent({ text, slot, index }: { text: string; slot: SheetLine['unitSlot']; index: number }) {
  const parts = text.split(', ')
  const last = parts[parts.length - 1]
  const earlier = parts.slice(0, -1).map((part) => texToHtml(typesetResult(part)))
  if (earlier.some((html) => html === null)) return <>{text}</>
  return (
    <>
      {earlier.map((html, i) => (
        <span key={i}>
          <Html html={html!} />
          {', '}
        </span>
      ))}
      <ValueContent text={last} slot={slot} index={index} />
    </>
  )
}

/**
 * A value: its number, then its unit in the slot. A value that isn't a number
 * with a unit (a complex number, a matrix) shows whole, with no slot.
 */
function ValueContent({ text, slot, index }: { text: string; slot: SheetLine['unitSlot']; index: number }) {
  const slots = useContext(SlotsContext)
  const split = leadingNumber(text)
  if (!slot || !split || !(split.rest === '' || split.rest.startsWith(' '))) {
    const html = texToHtml(typesetResult(text))
    return html === null ? <>{text}</> : <Html html={html} />
  }
  const number = texToHtml(typesetResult(split.number))
  const unit = split.rest.trim()
  const unitHtml = unit === '' ? null : texToHtml(typesetUnit(unit))
  return (
    <>
      {number === null ? split.number : <Html html={number} />}
      {(unit !== '' || slots.hovered === index) && (
        <SlotBox
          index={index}
          chosen={slot.chosen !== null}
          hovered={slots.hovered === index}
          unitHtml={unitHtml}
          unitText={unit}
        />
      )}
    </>
  )
}

/**
 * The unit slot (section 5): the result's unit, outlined while its row is
 * hovered, tinted when chosen. It takes no pointer events: the canvas's own
 * click opens it (section 14), found by `data-unit-slot`.
 */
function SlotBox({
  index,
  column,
  chosen,
  hovered,
  unitHtml,
  unitText = '',
}: {
  index: number
  column?: number
  chosen: boolean
  hovered: boolean
  unitHtml: string | null
  unitText?: string
}) {
  return (
    <span
      className={`math-element__unit${chosen ? ' is-chosen' : ''}${hovered ? ' is-hovered' : ''}${
        unitText === '' ? ' is-empty' : ''
      }`}
      data-unit-slot={column === undefined ? index : `${index}:${column}`}
    >
      {unitHtml === null ? unitText : <Html html={unitHtml} />}
    </span>
  )
}

interface EditingRowProps {
  edit: LineEdit
  result: LineResult
  warnings: readonly string[]
  isEmpty: boolean
  onType: (text: string) => void
  onRewrite: (text: string, caret: number) => void
  onMove: (move: LineMove) => void
  onEscape: () => void
  onBlur: () => void
}

/**
 * The line being edited (section 4, While editing a line): a source field over
 * the name, `≔` and expression cells, the live result as plain text, and an
 * empty note cell, since the note is in the field. A hidden copy of the typed
 * text shares the field's cell, so the column widens as you type, and the
 * element with it, without the field's value ever being set from code.
 */
function EditingRow({ edit, result, warnings, isEmpty, onRewrite, ...field }: EditingRowProps) {
  const fieldRef = useRef<HTMLInputElement>(null)
  const form = readLine(edit.text)
  const format = form.kind === 'code' ? form.format : null

  // Writes the clause into the line's text. The caret stays where it was in
  // the code; from the clause on, the text moved, so it goes to the code's end.
  const setFormat = (next: LineFormat) => {
    const text = writeFormat(edit.text, next)
    const caret = fieldRef.current?.selectionStart ?? text.length
    onRewrite(text, Math.min(caret, codeLength(text)))
  }

  return (
    <>
      <Gutter result={result} warnings={warnings} />
      <span className={`math-element__field-cell${isEmpty ? ' is-empty-element' : ''}`}>
        <span className="math-element__field-text" aria-hidden="true">
          {edit.text}
        </span>
        <LineField
          key={edit.revision ?? 0}
          fieldRef={fieldRef}
          edit={edit}
          onFormat={format && ((change) => setFormat({ ...format, ...change(format) }))}
          {...field}
        />
      </span>
      <ResultCell result={result} plain />
      <FormatBar format={format} onChange={setFormat} onTitle={() => field.onMove({ kind: 'title' })} />
    </>
  )
}

/**
 * The bar beside the open line (section 4, While editing a line): Title, then
 * Bold, Underline, the five highlight colours and no colour. Title moves the
 * edit to the element's title; each format press is one line commit. A line
 * with no code takes no format, so its bar has Title alone. A press mustn't take the keyboard from the field, or the blur would
 * leave the line, so its buttons never take focus. It is outside the body's
 * layout, so it never counts toward the element's size.
 */
function FormatBar({
  format,
  onChange,
  onTitle,
}: {
  format: LineFormat | null
  onChange: (format: LineFormat) => void
  onTitle: () => void
}) {
  const button = (label: string, pressed: boolean, next: LineFormat, className: string, text = '') => (
    <button
      type="button"
      className={`math-format-bar__button ${className}`}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onChange(next)}
    >
      {text}
    </button>
  )
  const titleButton = (
    <button
      type="button"
      className="math-format-bar__button is-title"
      aria-label="Title (↑ from the first line)"
      title="Title (↑ from the first line)"
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onTitle}
    >
      T
    </button>
  )
  if (!format) {
    return (
      <span className="math-format-bar" role="toolbar" aria-label="Line format">
        {titleButton}
      </span>
    )
  }
  return (
    <span className="math-format-bar" role="toolbar" aria-label="Line format">
      {titleButton}
      <span className="math-format-bar__rule" aria-hidden="true" />
      {button('Bold (Ctrl+B)', format.bold, { ...format, bold: !format.bold }, 'is-bold', 'B')}
      {button(
        'Underline (Ctrl+U)',
        format.underline,
        { ...format, underline: !format.underline },
        'is-underline',
        'U',
      )}
      <span className="math-format-bar__rule" aria-hidden="true" />
      {FORMAT_COLORS.map((color) => (
        <span key={color}>
          {button(
            `Highlight ${color}`,
            format.color === color,
            { ...format, color: format.color === color ? null : color },
            `is-color is-${color}`,
          )}
        </span>
      ))}
      {button('No highlight', format.color === null, { ...format, color: null }, 'is-color is-none')}
    </span>
  )
}

interface LineFieldProps {
  fieldRef: RefObject<HTMLInputElement | null>
  /** What the field is, for assistive tech: a line's source, or the title. */
  label?: string
  edit: LineEdit
  /** Ctrl+B and Ctrl+U: null on a line with no code, which takes no format. */
  onFormat: ((change: (format: LineFormat) => Partial<LineFormat>) => void) | null
  onType: (text: string) => void
  onMove: (move: LineMove) => void
  onEscape: () => void
  onBlur: () => void
}

/**
 * The line being edited. It takes only what the user types: setting the value
 * from code clears the browser's text undo, so it is uncontrolled. Each line
 * gets its own field, which is why that text undo starts fresh on each line; a
 * format from the bar rewrites the text, so it mounts a new field too. Its
 * Ctrl+Z never reaches the sheet's undo, because Excalidraw only hears keys
 * inside its own container.
 */
function LineField({
  fieldRef,
  label = 'Line source',
  edit,
  onFormat,
  onType,
  onMove,
  onEscape,
  onBlur,
}: LineFieldProps) {
  // Only what the field opens with: from then on the text and caret are the user's.
  const [opening] = useState(edit)

  // Suggestions for the word at the caret (section 4), on a line only: the
  // title is prose. Nothing is highlighted until ↓, so Enter still commits.
  const suggest = useContext(SuggestContext)
  const offers = label === 'Line source' ? suggest : null
  const [list, setList] = useState<{ suggested: Suggested; highlight: number | null } | null>(null)
  // The input a suggestion writes doesn't ask for another list.
  const accepting = useRef(false)
  const refresh = (field: HTMLInputElement) => {
    if (accepting.current || !offers) return setList(null)
    const suggested = offers(field.value, field.selectionStart ?? field.value.length)
    setList(suggested && { suggested, highlight: null })
  }
  const acceptSuggestion = (item: Suggestion) => {
    const field = fieldRef.current
    if (!field || !list) return
    const { from, to } = list.suggested
    accepting.current = true
    field.focus()
    field.setSelectionRange(from, to)
    // `insertText` keeps the field's own Ctrl+Z; where it isn't there, write the text and say so.
    if (!document.execCommand?.('insertText', false, item.insert)) {
      field.setRangeText(item.insert, from, to, 'end')
      field.dispatchEvent(new Event('input', { bubbles: true }))
    }
    accepting.current = false
    setList(null)
  }

  useLayoutEffect(() => {
    const field = fieldRef.current
    field?.focus()
    field?.setSelectionRange(opening.caret, opening.caret)
  }, [opening, fieldRef])

  // A double-click on another line while editing: its first click moved the
  // edit here, and its second lands in this field, where the browser would
  // select the word under the pointer. The line opens with the caret at the end
  // (docs/spec-v1.md section 4), so a press that continues a click begun
  // elsewhere is ignored. A double-click made inside the field selects as usual.
  const pressedHere = useRef(false)
  const onMouseDown = (event: MouseEvent<HTMLInputElement>) => {
    if (event.detail >= 2 && !pressedHere.current) event.preventDefault()
    pressedHere.current = true
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    const field = event.currentTarget
    const from = field.selectionStart ?? 0
    const to = field.selectionEnd ?? from
    const take = (run: () => void) => {
      event.preventDefault()
      run()
    }
    if (list) {
      const { items } = list.suggested
      const { highlight } = list
      const plain = !event.ctrlKey && !event.metaKey && !event.altKey
      switch (event.key) {
        case 'ArrowDown':
          return take(() => setList({ ...list, highlight: Math.min((highlight ?? -1) + 1, items.length - 1) }))
        case 'ArrowUp':
          // From the top of the list, ↑ goes back to the text; with nothing
          // highlighted it moves to the line above, as without a list.
          if (highlight === null) break
          return take(() => setList({ ...list, highlight: highlight === 0 ? null : highlight - 1 }))
        case 'Tab':
          if (!plain || event.shiftKey) break
          return take(() => acceptSuggestion(items[highlight ?? 0]))
        case 'Enter':
          if (highlight === null) break
          return take(() => acceptSuggestion(items[highlight]))
        case 'Escape':
          // The first Esc closes the list; the line stays open.
          return take(() => setList(null))
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'Home':
        case 'End':
          setList(null)
      }
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && onFormat) {
      const key = event.key.toLowerCase()
      if (key === 'b') return take(() => onFormat(({ bold }) => ({ bold: !bold })))
      if (key === 'u') return take(() => onFormat(({ underline }) => ({ underline: !underline })))
    }
    switch (event.key) {
      case 'ArrowUp':
        return take(() => onMove({ kind: 'up' }))
      case 'ArrowDown':
        return take(() => onMove({ kind: 'down' }))
      case 'Enter':
        return take(() => onMove({ kind: 'split', from, to }))
      case 'Escape':
        return take(onEscape)
      case 'Backspace':
        if (from === 0 && to === 0 && edit.lineIndex > 0) {
          return take(() => onMove({ kind: 'join' }))
        }
    }
  }

  return (
    <>
      <input
        ref={fieldRef}
        className="math-element__field"
        aria-label={label}
        aria-autocomplete={offers ? 'list' : undefined}
        aria-expanded={offers ? list !== null : undefined}
        aria-controls={list ? SUGGEST_LIST_ID : undefined}
        aria-activedescendant={list && list.highlight !== null ? `${SUGGEST_LIST_ID}-${list.highlight}` : undefined}
        defaultValue={opening.text}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        onInput={(event) => {
          onType(event.currentTarget.value)
          refresh(event.currentTarget)
        }}
        onKeyDown={onKeyDown}
        onMouseDown={(event) => {
          setList(null)
          onMouseDown(event)
        }}
        onBlur={(event) => {
          setList(null)
          // The window lost focus, not the field: the edit hasn't left its line.
          if (document.activeElement !== event.currentTarget) onBlur()
        }}
      />
      {list && (
        <ul className="math-suggest" id={SUGGEST_LIST_ID} role="listbox" aria-label="Suggestions">
          {list.suggested.items.map((item, i) => (
            <li
              key={`${item.kind}:${item.name}`}
              id={`${SUGGEST_LIST_ID}-${i}`}
              role="option"
              aria-selected={i === list.highlight}
              className={`math-suggest__option is-${item.kind}${i === list.highlight ? ' is-highlighted' : ''}`}
              // Chosen on `mousedown`, so the field keeps the keyboard and the line stays open.
              onMouseDown={(event) => {
                event.preventDefault()
                acceptSuggestion(item)
              }}
            >
              <span className="math-suggest__name">{item.name}</span>
              <span className="math-suggest__detail">{item.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

const SUGGEST_LIST_ID = 'math-suggest-list'
