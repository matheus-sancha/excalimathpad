import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import type { MathAnchor, TitleFormat } from '../canvas/mathAnchor.ts'
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
  NO_FORMAT,
  readLine,
  withFormat,
  type CommentFormat,
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
import { listGoesAbove, type Suggested, type Suggestion } from './suggest.ts'
import { BOTTOM_SHEET_CLASS, isLineField } from '../canvas/panelPresses.ts'
import { sceneToStage, type Viewport } from './viewport.ts'
import { caretPlace, caretRow } from './caretRow.ts'

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
  /** The open line's stored format (section 3, Where a line's format lives, M4e); empty for none. */
  stored?: string
  /** A format key on the open math line: its new plain format, written as the Format tab writes it. */
  onFormat?: (format: LineFormat) => void
  /** The same on a comment line. */
  onCommentFormat?: (format: CommentFormat) => void
  onMove: (move: LineMove) => void
  onEscape: () => void
  onBlurLine: (lineIndex: number) => void
  forwardWheel: ForwardWheel
  /** The element's lines a jump from the Sheet panel (section 8) or a rename (section 4) flashes, with the key that restarts the flash. */
  flash?: { lines: readonly number[]; key: number } | null
  /** The unit slots (section 5): which row is hovered, which slot's field is open. */
  unitSlots?: UnitSlots
  /**
   * The room the open line's field has before it wraps (section 4, While
   * editing a line, The field wraps, M4e), in scene units; null before it is
   * measured, and where nothing is laid out.
   */
  wrapRoom?: number | null
  /** ↑ or ↓ moved the caret between the rows of the wrapped field. */
  onCaretRow?: () => void
  /** The suggestions for the open line's text and caret (section 4); none on the title. */
  suggest?: Suggest | null
  /** A title format key: the title's new format, one undo step (section 4, Title format). */
  onTitleFormat?: (format: TitleFormat) => void
}

/** What the open line offers for a text and caret: the names that start with the word there. */
export type Suggest = (text: string, caret: number) => Suggested | null

/** What the result cells need for their unit slots. */
export interface UnitSlots {
  /** The hovered row: its slot shows outlined, an empty one included. */
  hovered: number | null
  /**
   * Selected by touch (section 4, Touch, M4d): every row shows as the hovered
   * one does, its slots outlined and its plot's ⚙ shown.
   */
  revealed?: boolean
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

/** Whether a row shows as hovered: the pointer is on it, or its element is selected by touch. */
const isHovered = (slots: UnitSlots, index: number) => slots.revealed === true || slots.hovered === index

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
  stored = '',
  onFormat = () => {},
  onCommentFormat = () => {},
  onMove,
  onEscape,
  onBlurLine,
  forwardWheel,
  flash = null,
  unitSlots = NO_SLOTS,
  suggest = null,
  wrapRoom = null,
  onCaretRow = () => {},
  onTitleFormat = () => {},
}: MathElementViewProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const katexReady = useKatexReady()
  const { x, y } = sceneToStage(anchor, viewport)
  // A new or emptied element: its field starts with room to type (section 4, Size).
  const isEmpty = !hasText(anchor.source)
  // A warning at rest (section 4, Problems, M4d): the element's ⚠ marks show
  // while any of its lines or its title is open; being selected is not editing.
  const editing = edit !== null

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
        className={`math-element__body${anchor.chosenWidth !== null ? ' has-chosen-width' : ''}`}
        style={{
          // Section 4, Chosen width: never below the content, so the laid-out width is the larger.
          ...(anchor.chosenWidth !== null ? { width: anchor.chosenWidth, minWidth: 'max-content' } : {}),
          ...(anchor.angle
            ? {
                transform: `rotate(${anchor.angle}rad)`,
                transformOrigin: `${anchor.width / 2}px ${anchor.height / 2}px`,
              }
            : {}),
        }}
      >
        {(anchor.title !== '' || edit?.lineIndex === TITLE_LINE) && (
          <Header
            title={anchor.title}
            format={anchor.titleFormat}
            onFormat={onTitleFormat}
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
              const open = edit?.lineIndex === i
              const flashing = flash?.lines.includes(i) ?? false
              return (
                <li
                  // A new key restarts the flash's animation on a second jump.
                  key={flashing ? `${i}:${flash?.key}` : i}
                  className={`math-element__row is-${open ? 'editing' : line.typeset.kind}${
                    open
                      ? formatClasses(formatOf(withFormat(edit.text, stored)))
                      : line.typeset.kind === 'math'
                        ? formatClasses(line.typeset.format)
                        : line.typeset.kind === 'comment'
                          ? commentClasses(line.typeset.format)
                          : ''
                  }${flashing ? ' is-flash' : ''}`}
                  data-line={i}
                  aria-label={text}
                >
                  {open ? (
                    <EditingRow
                      edit={edit}
                      result={line.result}
                      warnings={line.warnings}
                      isEmpty={isEmpty}
                      wrapRoom={wrapRoom}
                      onCaretRow={onCaretRow}
                      onType={onType}
                      stored={stored}
                      onFormat={onFormat}
                      onCommentFormat={onCommentFormat}
                      onMove={onMove}
                      onEscape={onEscape}
                      onBlur={() => onBlurLine(i)}
                    />
                  ) : (
                    <TypesetRow
                      text={text}
                      line={line}
                      index={i}
                      katexReady={katexReady}
                      // A jump's flash or outline shows its line's ⚠ while it lasts.
                      showWarnings={editing || flashing}
                    />
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

/** Where a line's sample is drawn: the Sheet panel, or a phone's bottom sheet. */
export type SampleKind = 'panel' | 'phone'

/**
 * The open line for the Format tab's sample (section 4, Format tab): one
 * typeset row, with its result and note and its rules applied, live from the
 * evaluation of the typed text. Its ⚠ show, since its element is being edited.
 *
 * From M4e it is smaller than the sheet and wraps (`is-line-sample` in
 * `MathOverlay.css`): 13 px with 20 px rows, as wide as its box, the equation
 * breaking where KaTeX allows and the result on a row of its own when it
 * doesn't fit beside it. It never holds a chart; a table is scaled down to
 * the box's width (`ScaledTable`), and left out on a phone. Screen only.
 */
export function LineSample({ text, line, phone = false }: { text: string; line: SheetLine; phone?: boolean }) {
  const katexReady = useKatexReady()
  const { typeset } = line
  const classes =
    typeset.kind === 'math'
      ? formatClasses(typeset.format)
      : typeset.kind === 'comment'
        ? commentClasses(typeset.format)
        : ''
  // A problem's mark takes its column only when there is one: the box is narrow.
  const { result } = line
  const marked =
    result.kind === 'error' || (result.kind === 'list' && result.failed !== null) || line.warnings.length > 0
  return (
    <div className="math-element__body is-sample is-line-sample">
      <ol className="math-element__grid" aria-label="Sample">
        <li
          className={`math-element__row is-${typeset.kind}${classes}${marked ? ' has-mark' : ''}`}
          aria-label={text}
        >
          <TypesetRow
            text={text}
            line={line}
            index={0}
            katexReady={katexReady}
            showWarnings
            sample={phone ? 'phone' : 'panel'}
          />
        </li>
      </ol>
    </div>
  )
}

/**
 * A table in the sample, scaled down to the box's width (section 4, Format
 * tab, M4e): the whole table shows, since a rule colours its rows, and the
 * scale has no floor. The table is laid out at its own width and drawn
 * smaller by a transform, which `offsetWidth` ignores; the box takes the
 * scaled height. Measured again whenever the box or the table changes size
 * (the panel's drag handle, a typed line, KaTeX's fonts). jsdom lays nothing
 * out: there the table keeps its size.
 */
function ScaledTable({ children }: { children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const box = boxRef.current
    const table = box?.firstElementChild
    if (!box || !(table instanceof box.ownerDocument.defaultView!.HTMLElement)) return
    const fit = () => {
      const room = box.clientWidth
      const width = table.offsetWidth
      const scale = room > 0 && width > room ? room / width : 1
      table.style.transform = scale < 1 ? `scale(${scale})` : ''
      box.style.height = scale < 1 ? `${table.offsetHeight * scale}px` : ''
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    observer.observe(table)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={boxRef} className="math-element__sample-table">
      {children}
    </div>
  )
}

/** The open title drawn in its format, for the Format tab's sample (section 4, Title format). */
export function TitleSample({ title, format }: { title: string; format: TitleFormat }) {
  return (
    <div className="math-element__body is-sample">
      <div className={`math-element__title${titleClasses(format)}`} aria-label="Sample title">
        <span className="math-element__title-text">{title}</span>
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
  format,
  onFormat,
  edit,
  ...field
}: {
  title: string
  format: TitleFormat
  onFormat: (format: TitleFormat) => void
  edit: LineEdit | null
  onType: (text: string) => void
  onMove: (move: LineMove) => void
  onEscape: () => void
  onBlur: () => void
}) {
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const toggle = (key: FormatKey) =>
    onFormat(
      key === 'b'
        ? { ...format, bold: !format.bold }
        : key === 'i'
          ? { ...format, italic: !format.italic }
          : { ...format, underline: !format.underline },
    )
  return (
    <div
      className={`math-element__title${edit ? ' is-editing' : ''}${titleClasses(format)}`}
      data-title
      aria-label="Title"
    >
      {edit ? (
        <span className="math-element__field-cell is-title">
          <span className="math-element__field-text" aria-hidden="true">
            {edit.text}
          </span>
          <LineField fieldRef={fieldRef} label="Title" edit={edit} onFormatKey={toggle} {...field} />
        </span>
      ) : (
        <span className="math-element__title-text">{title}</span>
      )}
    </div>
  )
}

/** A title's format as classes: the stylesheet draws each option (section 4, Title format). */
function titleClasses(format: TitleFormat): string {
  return [
    format.bold ? 'is-bold' : 'is-regular',
    format.italic ? 'is-italic' : '',
    format.underline ? 'is-underline' : '',
    `is-align-${format.align}`,
    `is-size-${format.size}`,
    `is-text-${format.color}`,
    format.highlight ? `is-${format.highlight}` : '',
  ]
    .filter(Boolean)
    .map((name) => ` ${name}`)
    .join('')
}

/**
 * The format the open line's typed text asks for, live: a math line's, or a
 * comment line's bold, underline, band and text colour (the field keeps one
 * size and slant); a blank line has none.
 */
function formatOf(text: string): LineFormat {
  const form = readLine(text)
  return form.kind === 'blank' ? NO_FORMAT : form.format
}

/** A row's format as classes: the stylesheet draws bold, underline, the band and the text colour. */
function formatClasses({ bold, underline, color, textColor }: LineFormat): string {
  return `${bold ? ' is-bold' : ''}${underline ? ' is-underline' : ''}${color ? ` is-${color}` : ''}${
    textColor ? ` is-text-color is-text-${textColor}` : ''
  }`
}

/**
 * A comment row's format as classes (section 4, Typeset grid, M4d): a line's,
 * and `@upright` and a size other than M. The stylesheet sets the size, the
 * line height at 1.6 times it and the width a comment asks for, scaled by it.
 */
function commentClasses(format: CommentFormat): string {
  return `${formatClasses(format)}${format.upright ? ' is-upright' : ''}${format.size === 'M' ? '' : ` is-size-${format.size}`}`
}

/** A format key from the field: Ctrl+B, Ctrl+I or Ctrl+U. */
type FormatKey = 'b' | 'i' | 'u'

/** A row whose ⚠ is hidden: its gutter keeps its column, with no mark and no hover. */
const NO_WARNINGS: readonly string[] = []

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
  ruleTruth: [],
  ruleStates: [],
}

/** A row's cells, by line form (section 3, section 4 Problems). */
function TypesetRow({
  text,
  line,
  index,
  katexReady,
  showWarnings,
  sample,
}: {
  text: string
  line: SheetLine
  index: number
  katexReady: boolean
  /** Whether the row's ⚠ shows (section 4, A warning at rest). */
  showWarnings: boolean
  /** Set in the Format tab's sample, which draws no chart, and no table on a phone. */
  sample?: SampleKind
}) {
  const { typeset, result } = line
  const warnings = showWarnings ? line.warnings : NO_WARNINGS
  switch (typeset.kind) {
    case 'blank':
      return <ResultCell result={result} />
    case 'comment':
      // A comment has no result: its gutter shows only for its clause's error
      // (M4d), so a comment row is laid out as it always was.
      return (
        <>
          {result.kind === 'error' && <Gutter result={result} warnings={NO_WARNINGS} />}
          <span className="math-element__comment">{typeset.text}</span>
        </>
      )
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
        <MathCells
          typeset={typeset}
          result={result}
          warnings={warnings}
          fallback={text}
          line={line}
          index={index}
          sample={sample}
        />
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
  sample,
}: {
  typeset: Extract<TypesetLine, { kind: 'math' }>
  result: LineResult
  warnings: readonly string[]
  fallback: string
  line: SheetLine
  index: number
  sample?: SampleKind
}) {
  const name = typeset.name === null ? null : texToHtml(typeset.name)
  const defines = texToHtml(DEFINES)
  const expression = texToHtml(typeset.expression)
  const aside = typeset.aside === undefined ? null : texToHtml(typeset.aside)
  const lhs =
    name === null ? null : (
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
    )
  // TeX KaTeX couldn't render: the line's source, as text, rather than nothing.
  const cells =
    expression === null || (typeset.name !== null && name === null) ? (
      <span className="math-element__source">{fallback}</span>
    ) : (
      // One display, flush left: name, ≔ and expression together (section 4,
      // Typeset grid). A bare expression has no name or ≔ to indent it.
      <span className="math-element__equation">
        {lhs !== null &&
          // In the sample no row breaks between the name and its ≔: one box holds them.
          (sample === undefined ? lhs : <span className="math-element__lhs">{lhs}</span>)}
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
      {line.table !== null &&
        (sample === undefined ? (
          <TableBlock table={line.table} index={index} />
        ) : (
          sample === 'panel' && (
            <ScaledTable>
              <TableBlock table={line.table} index={index} />
            </ScaledTable>
          )
        ))}
      {line.plot !== null && sample === undefined && (
        <PlotCell plot={line.plot} source={fallback} index={index} />
      )}
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
                        hovered={isHovered(slots, index)}
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
            <tr key={r} className={formatClasses(table.rowFormats[r] ?? NO_FORMAT).trim() || undefined}>
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
      {(isHovered(slots, index) || open) && (
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
 * shows beside the mark. A `⚠` shows only while its element is being edited, or
 * on its line while a jump flashes it (section 4, A warning at rest): otherwise
 * the row passes no warnings, and the gutter keeps its fixed column, empty and
 * with no hover, so rows don't shift when an edit opens. A `●` always shows.
 * The mark's message (`data-tip`) shows on hover, found by the gestures from
 * the mark's box (`tipAt`): the overlay takes no pointer events, so a `title`
 * here would never show. Screen only: print and the file never carry it.
 */
function Gutter({ result, warnings }: { result: LineResult; warnings: readonly string[] }) {
  // A list's failed points are the line's error (section 10).
  const message = result.kind === 'error' ? result.message : result.kind === 'list' ? result.failed : null
  const error = message !== null
  const warned = !error && warnings.length > 0
  return (
    <span
      className={`math-element__gutter${warned ? ' is-warning' : ''}`}
      data-tip={error ? problemTip(result, message) : warned ? warnings.join('\n') : undefined}
      data-warnings={warnings.length > 0 ? warnings.join('\n') : undefined}
    >
      {error ? '●' : warned ? '⚠' : ''}
    </span>
  )
}

/** A problem's hover: its message, and under it the raw text of an unexpected failure. */
function problemTip(result: LineResult, message: string): string {
  return result.kind === 'error' && result.unexpected ? `${message}\n${result.unexpected.text}` : message
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
  } else if (slot && isHovered(slots, index) && !plain) {
    // A plain input: an empty slot on hover (section 5, Unit slot).
    content = <SlotBox index={index} hovered unitHtml={null} />
  }
  const open = slot !== null && slots.open === index && (slots.openColumn ?? null) === null && !plain
  return (
    <span
      className={`math-element__result is-${result.kind}`}
      data-text={text}
      data-tip={result.kind === 'error' ? problemTip(result, result.message) : undefined}
      // An unexpected failure's raw text is under its words on every hover (section 4, Unexpected failures).
      data-tip-when={result.kind === 'error' && !result.unexpected ? 'capped' : undefined}
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
      {(unit !== '' || isHovered(slots, index)) && (
        <SlotBox
          index={index}
          hovered={isHovered(slots, index)}
          unitHtml={unitHtml}
          unitText={unit}
        />
      )}
    </>
  )
}

/**
 * The unit slot (section 5): the result's unit, outlined while its row is
 * hovered. A chosen unit has no mark (M4c). It takes no pointer events: the canvas's own
 * click opens it (section 14), found by `data-unit-slot`.
 */
function SlotBox({
  index,
  column,
  hovered,
  unitHtml,
  unitText = '',
}: {
  index: number
  column?: number
  hovered: boolean
  unitHtml: string | null
  unitText?: string
}) {
  return (
    <span
      className={`math-element__unit${hovered ? ' is-hovered' : ''}${
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
  /** The room the field has before it wraps, in scene units; null before it is measured. */
  wrapRoom: number | null
  onCaretRow: () => void
  onType: (text: string) => void
  stored: string
  onFormat: (format: LineFormat) => void
  onCommentFormat: (format: CommentFormat) => void
  onMove: (move: LineMove) => void
  onEscape: () => void
  onBlur: () => void
}

/**
 * The line being edited (section 4, While editing a line): a source field over
 * the name, `≔` and expression cells, the live result as plain text, and an
 * empty note cell, since the note is in the field. A hidden copy of the typed
 * text shares the field's cell, so the column widens as you type, and the
 * element with it, without the field's value ever being set from code. Past
 * `wrapRoom` the copy continues on the next row, and the field with it (The
 * field wraps, M4e): the element grows taller, not wider.
 */
function EditingRow({
  edit,
  result,
  warnings,
  isEmpty,
  wrapRoom,
  stored,
  onFormat,
  onCommentFormat,
  ...field
}: EditingRowProps) {
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  // The line's format is its stored one, behind any clause typed in the text.
  const form = readLine(withFormat(edit.text, stored))

  // Ctrl+B, Ctrl+U and, on a comment line, Ctrl+I (section 4, While editing a
  // line): a press in the Format tab, so the line's stored format is written
  // and its text is left alone. A blank line takes no format.
  const onFormatKey =
    form.kind === 'code'
      ? (key: FormatKey) => {
          // Ctrl+I does nothing on a math line.
          if (key === 'b') onFormat({ ...form.format, bold: !form.format.bold })
          if (key === 'u') onFormat({ ...form.format, underline: !form.format.underline })
        }
      : form.kind === 'comment'
        ? (key: FormatKey) =>
            onCommentFormat(
              key === 'b'
                ? { ...form.format, bold: !form.format.bold }
                : key === 'u'
                  ? { ...form.format, underline: !form.format.underline }
                  : { ...form.format, upright: !form.format.upright },
            )
        : null

  return (
    <>
      <Gutter result={result} warnings={warnings} />
      <span
        className={`math-element__field-cell${isEmpty ? ' is-empty-element' : ''}`}
        style={wrapRoom === null ? undefined : { maxWidth: wrapRoom }}
      >
        <span className="math-element__field-text" aria-hidden="true">
          {edit.text}
        </span>
        <LineField
          key={edit.revision ?? 0}
          fieldRef={fieldRef}
          edit={edit}
          onFormatKey={onFormatKey}
          {...field}
        />
      </span>
      <ResultCell result={result} plain />
    </>
  )
}

interface LineFieldProps {
  fieldRef: RefObject<HTMLTextAreaElement | null>
  /** What the field is, for assistive tech: a line's source, or the title. */
  label?: string
  edit: LineEdit
  /**
   * Ctrl+B, Ctrl+I and Ctrl+U (section 4, While editing a line; Title format):
   * taken from the field on a math line, a comment line and the title; null on
   * a blank line, which takes no format.
   */
  onFormatKey: ((key: FormatKey) => void) | null
  /** ↑ or ↓ moved the caret to another row of a wrapped field: the view follows it. */
  onCaretRow?: () => void
  onType: (text: string) => void
  onMove: (move: LineMove) => void
  onEscape: () => void
  onBlur: () => void
}

/** A line is one row of text: a newline that reaches the field becomes a space (section 4, The field wraps). */
const oneLine = (text: string) => text.replace(/\r\n?|\n/g, ' ')

/**
 * The line being edited. It takes only what the user types: setting the value
 * from code clears the browser's text undo, so it is uncontrolled. Each line
 * gets its own field, which is why that text undo starts fresh on each line; a
 * format press writes the line's stored format and leaves the field alone,
 * and mounts a new one only when it moved a typed clause out of the text. Its
 * Ctrl+Z never reaches the sheet's undo, because Excalidraw only hears keys
 * inside its own container.
 *
 * It is a textarea, so a line's field wraps (section 4, While editing a line,
 * M4e) where its cell ends; it still holds one line: Enter splits it, and a
 * pasted newline becomes a space. ↑ and ↓ are the browser's between its rows
 * and leave the line only from the first or the last (`caretPlace`). The
 * title's field is the same element on one row, which never wraps.
 */
function LineField({
  fieldRef,
  label = 'Line source',
  edit,
  onFormatKey,
  onCaretRow,
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

  // Above the field when below it would be covered by the on-screen keyboard
  // or a phone's bottom sheet (section 4, While editing a line, M4d), measured
  // as the list opens and again as the keyboard moves.
  const listRef = useRef<HTMLUListElement>(null)
  const [listAbove, setListAbove] = useState(false)
  // Under the caret's row of a wrapped field, or above it (M4e): the row's
  // top and bottom in the cell. Null for the field's own, where nothing is laid out.
  const [listRow, setListRow] = useState<{ top: number; bottom: number } | null>(null)
  useLayoutEffect(() => {
    const field = fieldRef.current
    const view = field?.ownerDocument.defaultView
    if (!list || !field || !view) return
    const place = () => {
      const shown = listRef.current
      if (!shown) return
      const caret = field.selectionStart ?? field.value.length
      const row = caretPlace(field, caret)
      setListRow((now) => (now?.top === row?.top && now?.bottom === row?.bottom ? now : row && { top: row.top, bottom: row.bottom }))
      const box = caretRow(field, Infinity)
      const viewport = view.visualViewport
      const sheet = field.closest('.app-shell__stage')?.querySelector(`.${BOTTOM_SHEET_CLASS}`)
      const visibleTop = viewport ? viewport.offsetTop : 0
      const viewBottom = viewport ? viewport.offsetTop + viewport.height : view.innerHeight
      const sheetTop = sheet ? sheet.getBoundingClientRect().top : Infinity
      setListAbove(
        listGoesAbove({
          fieldTop: box.top,
          fieldBottom: box.bottom,
          listHeight: shown.getBoundingClientRect().height,
          visibleTop,
          visibleBottom: Math.min(viewBottom, sheetTop),
        }),
      )
    }
    place()
    view.visualViewport?.addEventListener('resize', place)
    return () => view.visualViewport?.removeEventListener('resize', place)
  }, [list, fieldRef])
  const refresh = (field: HTMLTextAreaElement) => {
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
    if (!field.ownerDocument.execCommand?.('insertText', false, item.insert)) {
      field.setRangeText(item.insert, from, to, 'end')
      field.dispatchEvent(new Event('input', { bubbles: true }))
    }
    accepting.current = false
    setList(null)
  }

  useLayoutEffect(() => {
    const field = fieldRef.current
    // A field mounted again while a rule's condition is being typed (a typed
    // rule moved out of the text) leaves the keyboard there (section 4, Rules list).
    if (!isLineField(field?.ownerDocument.activeElement ?? null)) field?.focus()
    field?.setSelectionRange(opening.caret, opening.caret)
  }, [opening, fieldRef])

  // An on-screen keyboard's Enter can reach a textarea as a line break with no
  // key: it splits the line, as the key does.
  const split = useRef(onMove)
  useLayoutEffect(() => {
    split.current = onMove
  })
  useEffect(() => {
    const field = fieldRef.current
    if (!field) return
    const onBeforeInput = (event: InputEvent) => {
      if (event.inputType !== 'insertLineBreak' && event.inputType !== 'insertParagraph') return
      event.preventDefault()
      const from = field.selectionStart
      split.current({ kind: 'split', from, to: field.selectionEnd })
    }
    field.addEventListener('beforeinput', onBeforeInput)
    return () => field.removeEventListener('beforeinput', onBeforeInput)
  }, [fieldRef])

  // A double-click on another line while editing: its first click moved the
  // edit here, and its second lands in this field, where the browser would
  // select the word under the pointer. The line opens with the caret at the end
  // (docs/spec-v1.md section 4), so a press that continues a click begun
  // elsewhere is ignored. A double-click made inside the field selects as usual.
  const pressedHere = useRef(false)
  const onMouseDown = (event: MouseEvent<HTMLTextAreaElement>) => {
    if (event.detail >= 2 && !pressedHere.current) event.preventDefault()
    pressedHere.current = true
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && onFormatKey) {
      const key = event.key.toLowerCase()
      if (key === 'b' || key === 'i' || key === 'u') return take(() => onFormatKey(key))
    }
    switch (event.key) {
      // Between the rows of a wrapped field ↑ and ↓ are the browser's; they
      // leave the line only from its first or last row (section 4, The field wraps).
      case 'ArrowUp':
        if (caretPlace(field, from)?.first ?? true) return take(() => onMove({ kind: 'up' }))
        return onCaretRow?.()
      case 'ArrowDown':
        if (caretPlace(field, to)?.last ?? true) return take(() => onMove({ kind: 'down' }))
        return onCaretRow?.()
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
      <textarea
        ref={fieldRef}
        className="math-element__field"
        rows={1}
        aria-label={label}
        aria-autocomplete={offers ? 'list' : undefined}
        aria-expanded={offers ? list !== null : undefined}
        aria-controls={list ? SUGGEST_LIST_ID : undefined}
        aria-activedescendant={list && list.highlight !== null ? `${SUGGEST_LIST_ID}-${list.highlight}` : undefined}
        defaultValue={opening.text}
        // Source, not prose: no spelling, capitals or corrections (section 4, M4d).
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        // A press here keeps a floating Sheet panel open (section 8, On a small
        // window): Excalidraw's outside click skips this mark, which isn't public
        // API (`panelPresses.excalidraw.test.tsx`).
        data-prevent-outside-click
        // `LINE_FIELD`: the keyboard may pass to a rule's condition and back with the line still open.
        data-line-field
        onInput={(event) => {
          const field = event.currentTarget
          // A newline that got in another way (a drop): the field holds one line.
          if (field.value !== oneLine(field.value)) {
            const caret = field.selectionStart
            field.value = oneLine(field.value)
            field.setSelectionRange(caret, caret)
          }
          onType(field.value)
          refresh(field)
        }}
        onPaste={(event) => {
          // A pasted newline becomes a space (section 4, The field wraps): typed
          // in, as a suggestion is, so the field's own Ctrl+Z takes it back.
          const pasted = event.clipboardData.getData('text/plain')
          if (pasted === oneLine(pasted)) return
          event.preventDefault()
          const field = event.currentTarget
          if (!field.ownerDocument.execCommand?.('insertText', false, oneLine(pasted))) {
            field.setRangeText(oneLine(pasted), field.selectionStart, field.selectionEnd, 'end')
            field.dispatchEvent(new Event('input', { bubbles: true }))
          }
        }}
        onKeyDown={onKeyDown}
        onMouseDown={(event) => {
          setList(null)
          onMouseDown(event)
        }}
        onBlur={(event) => {
          setList(null)
          // The window lost focus, not the field: the edit hasn't left its line.
          // Nor has it when the keyboard went to a rule's condition in the
          // Rules list (section 4, Rules list, M4e): the line stays open.
          if (event.currentTarget.ownerDocument.activeElement !== event.currentTarget && !isLineField(event.relatedTarget)) onBlur()
        }}
      />
      {list && (
        <ul
          ref={listRef}
          className={`math-suggest${listAbove ? ' is-above' : ''}`}
          style={
            listRow
              ? ({
                  '--math-suggest-below': `${listRow.bottom}px`,
                  '--math-suggest-above': `calc(100% - ${listRow.top}px)`,
                } as CSSProperties)
              : undefined
          }
          id={SUGGEST_LIST_ID}
          role="listbox"
          aria-label="Suggestions"
        >
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
