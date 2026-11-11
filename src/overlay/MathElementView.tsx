import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import type { MathAnchor } from '../canvas/mathAnchor.ts'
import type { ForwardWheel } from '../canvas/SheetCanvas.tsx'
import {
  splitLines,
  typesetResult,
  type LineResult,
  type SheetLine,
  type TypesetLine,
} from '../math/evaluate.ts'
import { texToHtml, useKatexReady } from './katex.ts'
import { hasText, type LineEdit, type LineMove } from './lineEdit.ts'
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
  onMove: (move: LineMove) => void
  onEscape: () => void
  onBlurLine: (lineIndex: number) => void
  forwardWheel: ForwardWheel
}

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
  onMove,
  onEscape,
  onBlurLine,
  forwardWheel,
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
        <ol className="math-element__grid" aria-label="Lines">
          {splitLines(source).map((text, i) => {
            const line = lines[i] ?? EMPTY_LINE
            const editing = edit?.lineIndex === i
            return (
              <li
                key={i}
                className={`math-element__row is-${editing ? 'editing' : line.typeset.kind}`}
                data-line={i}
                aria-label={text}
              >
                {editing ? (
                  <EditingRow
                    edit={edit}
                    result={line.result}
                    isEmpty={isEmpty}
                    onType={onType}
                    onMove={onMove}
                    onEscape={onEscape}
                    onBlur={() => onBlurLine(i)}
                  />
                ) : (
                  <TypesetRow text={text} line={line} katexReady={katexReady} />
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

const EMPTY_LINE: SheetLine = {
  result: { kind: 'empty' },
  typeset: { kind: 'blank' },
}

/** A row's cells, by line form (section 3, section 4 Problems). */
function TypesetRow({
  text,
  line,
  katexReady,
}: {
  text: string
  line: SheetLine
  katexReady: boolean
}) {
  const { typeset, result } = line
  switch (typeset.kind) {
    case 'blank':
      return <ResultCell result={result} />
    case 'comment':
      return <span className="math-element__comment">{typeset.text}</span>
    case 'unparsed':
      return (
        <>
          <Gutter result={result} />
          <span className="math-element__raw">{typeset.source}</span>
          <ResultCell result={result} />
        </>
      )
    case 'math':
      // Until KaTeX has loaded, the line shows as its source.
      if (!katexReady) {
        return (
          <>
            <Gutter result={result} />
            <span className="math-element__source">{text}</span>
            <ResultCell result={result} plain />
          </>
        )
      }
      return <MathCells typeset={typeset} result={result} fallback={text} />
  }
}

function MathCells({
  typeset,
  result,
  fallback,
}: {
  typeset: Extract<TypesetLine, { kind: 'math' }>
  result: LineResult
  fallback: string
}) {
  const name = typeset.name === null ? null : texToHtml(typeset.name)
  const defines = texToHtml(DEFINES)
  const expression = texToHtml(typeset.expression)
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
      </span>
    )
  return (
    <>
      <Gutter result={result} />
      {cells}
      <ResultCell result={result} />
      {typeset.note !== null && <span className="math-element__note">{typeset.note}</span>}
    </>
  )
}

/** `≔`, Mathcad's definition sign, in KaTeX's font (`\coloneqq`). */
const DEFINES = '\\coloneqq'

function Html({ html }: { html: string }) {
  return <span className="math-element__tex" dangerouslySetInnerHTML={{ __html: html }} />
}

function Gutter({ result }: { result: LineResult }) {
  return (
    <span className="math-element__gutter" aria-hidden="true">
      {result.kind === 'error' ? '●' : ''}
    </span>
  )
}

/**
 * The result cell, after the column rule. A value shows typeset, with no
 * leading `=`; an error shows its message, capped with an ellipsis, the whole
 * text on hover (section 4, Problems). `data-text` holds the result as text.
 */
function ResultCell({ result, plain = false }: { result: LineResult; plain?: boolean }) {
  let content: ReactNode = null
  let text: string | undefined
  if (result.kind === 'value') {
    text = result.text
    const html = plain ? null : texToHtml(typesetResult(result.text))
    content = html === null ? result.text : <Html html={html} />
  } else if (result.kind === 'error') {
    text = result.message
    content = result.message
  }
  return (
    <span
      className={`math-element__result is-${result.kind}`}
      data-text={text}
      title={result.kind === 'error' ? result.message : undefined}
    >
      {content}
    </span>
  )
}

interface EditingRowProps {
  edit: LineEdit
  result: LineResult
  isEmpty: boolean
  onType: (text: string) => void
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
function EditingRow({ edit, result, isEmpty, ...field }: EditingRowProps) {
  return (
    <>
      <Gutter result={result} />
      <span className={`math-element__field-cell${isEmpty ? ' is-empty-element' : ''}`}>
        <span className="math-element__field-text" aria-hidden="true">
          {edit.text}
        </span>
        <LineField edit={edit} {...field} />
      </span>
      <ResultCell result={result} plain />
    </>
  )
}

interface LineFieldProps {
  edit: LineEdit
  onType: (text: string) => void
  onMove: (move: LineMove) => void
  onEscape: () => void
  onBlur: () => void
}

/**
 * The line being edited. It takes only what the user types: setting the value
 * from code clears the browser's text undo, so it is uncontrolled. Each line
 * gets its own field, which is why that text undo starts fresh on each line. Its
 * Ctrl+Z never reaches the sheet's undo, because Excalidraw only hears keys
 * inside its own container.
 */
function LineField({ edit, onType, onMove, onEscape, onBlur }: LineFieldProps) {
  const fieldRef = useRef<HTMLInputElement>(null)
  // Only what the field opens with: from then on the text and caret are the user's.
  const [opening] = useState(edit)

  useLayoutEffect(() => {
    fieldRef.current?.focus()
    fieldRef.current?.setSelectionRange(opening.caret, opening.caret)
  }, [opening])

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
    <input
      ref={fieldRef}
      className="math-element__field"
      aria-label="Line source"
      defaultValue={opening.text}
      spellCheck={false}
      autoCapitalize="off"
      autoComplete="off"
      onInput={(event) => onType(event.currentTarget.value)}
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDown}
      onBlur={(event) => {
        // The window lost focus, not the field: the edit hasn't left its line.
        if (document.activeElement !== event.currentTarget) onBlur()
      }}
    />
  )
}
