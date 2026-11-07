import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import type { MathAnchor } from '../canvas/mathAnchor.ts'
import type { ForwardWheel } from '../canvas/SheetCanvas.tsx'
import { splitLines, type LineResult } from '../math/evaluate.ts'
import type { LineEdit, LineMove } from './lineEdit.ts'
import { sceneToStage, type Viewport } from './viewport.ts'

export interface MathElementViewProps {
  anchor: MathAnchor
  viewport: Viewport
  /** The element's lines, with any typed text in place. */
  source: string
  /** One per line of `source`, from the sheet's evaluation (MathOverlay). */
  results: readonly LineResult[]
  /** The sheet's line edit, when it is in this element. */
  edit: LineEdit | null
  onType: (text: string) => void
  onMove: (move: LineMove) => void
  onEscape: () => void
  onBlurLine: (lineIndex: number) => void
  forwardWheel: ForwardWheel
}

/**
 * One math element: one row per source line on the left, one result per line on
 * the right. Laid out in scene units and scaled by the zoom, so it moves and
 * scales exactly like the anchor Excalidraw draws underneath.
 *
 * Takes no pointer events, except the open field: Excalidraw gets every click
 * and drag on the anchor underneath, and the overlay's gestures find the line
 * from each row's `offsetTop` and `offsetHeight` (`data-line`). The field sits
 * over the source column, with the live result beside it as plain text; #44's
 * grid gives it its final layout. Rows and results keep one line height each,
 * so they stay beside each other.
 */
export function MathElementView({
  anchor,
  viewport,
  source,
  results,
  edit,
  onType,
  onMove,
  onEscape,
  onBlurLine,
  forwardWheel,
}: MathElementViewProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const { x, y } = sceneToStage(anchor, viewport)

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
        transform: `translate(${x}px, ${y}px) scale(${viewport.zoom})`,
      }}
    >
      <div
        className="math-element__body"
        style={anchor.angle ? { transform: `rotate(${anchor.angle}rad)` } : undefined}
      >
        <ol className="math-element__lines" aria-label="Lines">
          {splitLines(source).map((line, i) => (
            <li key={i} className="math-element__row" data-line={i}>
              {edit?.lineIndex === i ? (
                <LineField
                  edit={edit}
                  onType={onType}
                  onMove={onMove}
                  onEscape={onEscape}
                  onBlur={() => onBlurLine(i)}
                />
              ) : (
                <span className="math-element__line">{line}</span>
              )}
            </li>
          ))}
        </ol>
        <ol className="math-element__results" aria-label="Results">
          {results.map((result, i) => (
            <li
              key={i}
              className={`math-element__result is-${result.kind}`}
              // Long results are cut to fit (MathOverlay.css); this keeps the whole text.
              title={result.kind === 'empty' ? undefined : formatResult(result)}
            >
              {formatResult(result)}
            </li>
          ))}
        </ol>
      </div>
    </div>
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

function formatResult(result: LineResult): string {
  switch (result.kind) {
    case 'value':
      return `= ${result.text}`
    case 'error':
      return result.message
    case 'empty':
      return ' '
  }
}
