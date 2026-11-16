import { useLayoutEffect, useRef } from 'react'
import type { MathAnchor } from '../canvas/mathAnchor.ts'
import { isLineField } from '../canvas/panelPresses.ts'
import { FailureActions } from '../failure/FailureActions.tsx'
import { FAILURE_MESSAGES, type Failure } from '../failure/details.ts'
import { splitLines } from '../math/evaluate.ts'
import { TITLE_LINE, type LineEdit, type LineMove } from './lineEdit.ts'
import { sceneToStage, type Viewport } from './viewport.ts'

interface FailedElementProps {
  anchor: MathAnchor
  viewport: Viewport
  source: string
  edit: LineEdit | null
  failure: Failure
  onType: (text: string) => void
  onMove: (move: LineMove) => void
  onEscape: () => void
  onBlurLine: (lineIndex: number) => void
}

/**
 * A math element whose view failed (docs/spec-v1.md section 4, Unexpected
 * failures): its lines as plain text under a red `●` and the notice, where the
 * element was. It shares nothing with `MathElementView` but the stylesheet, so
 * what broke that view can't break this one. Each row keeps its `data-line`
 * box, so the gestures still open a line, and the open line or title is a
 * plain field with the line's keys: the element can still be edited, and each
 * change tries the real view again.
 */
export function FailedElement({ anchor, viewport, source, edit, failure, onType, onMove, onEscape, onBlurLine }: FailedElementProps) {
  const { x, y } = sceneToStage(anchor, viewport)
  const field = (lineIndex: number) =>
    edit?.lineIndex === lineIndex ? (
      <PlainField
        label={lineIndex === TITLE_LINE ? 'Title' : 'Line source'}
        edit={edit}
        onType={onType}
        onMove={onMove}
        onEscape={onEscape}
        onBlur={() => onBlurLine(lineIndex)}
      />
    ) : null
  return (
    <div
      className="math-element is-failed"
      data-anchor-id={anchor.id}
      style={{
        width: anchor.width,
        height: anchor.height,
        transform: `translate(${x}px, ${y}px) scale(${viewport.zoom})`,
      }}
    >
      <div
        className="math-element__body"
        style={
          anchor.angle
            ? { transform: `rotate(${anchor.angle}rad)`, transformOrigin: `${anchor.width / 2}px ${anchor.height / 2}px` }
            : undefined
        }
      >
        <div className="math-element__failed" role="alert" data-tip={failure.text}>
          <span className="math-element__gutter">●</span>
          <span className="math-element__failed-text">{FAILURE_MESSAGES.element}</span>
          <FailureActions what="element" failure={failure} />
        </div>
        {(anchor.title !== '' || edit?.lineIndex === TITLE_LINE) && (
          <div className="math-element__title" data-title aria-label="Title">
            {field(TITLE_LINE) ?? anchor.title}
          </div>
        )}
        <ol className="math-element__grid" aria-label="Lines">
          {splitLines(source).map((text, i) => (
            <li key={i} className="math-element__row is-plain" data-line={i} aria-label={text}>
              <span className="math-element__gutter" />
              {field(i) ?? <span className="math-element__source">{text}</span>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

/** The open line as a plain field: what the user types, and the keys that move or leave the edit. */
function PlainField({
  label,
  edit,
  onType,
  onMove,
  onEscape,
  onBlur,
}: {
  label: string
  edit: LineEdit
  onType: (text: string) => void
  onMove: (move: LineMove) => void
  onEscape: () => void
  onBlur: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  // Only what it opens with: from then on the text and the caret are the user's.
  const opening = useRef(edit)
  useLayoutEffect(() => {
    const input = ref.current
    input?.focus()
    input?.setSelectionRange(opening.current.caret, opening.current.caret)
  }, [])
  return (
    <input
      ref={ref}
      className="math-element__plain-field"
      type="text"
      aria-label={label}
      defaultValue={edit.text}
      size={Math.max(24, edit.text.length + 2)}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      data-prevent-outside-click
      data-line-field
      onInput={(event) => onType(event.currentTarget.value)}
      // The keyboard gone to a rule's condition leaves the line open (section 4, Rules list).
      onBlur={(event) => {
        if (!isLineField(event.relatedTarget)) onBlur()
      }}
      onKeyDown={(event) => {
        const input = event.currentTarget
        const from = input.selectionStart ?? input.value.length
        const to = input.selectionEnd ?? from
        const move: LineMove | null =
          event.key === 'Enter'
            ? { kind: 'split', from, to }
            : event.key === 'ArrowUp'
              ? { kind: 'up' }
              : event.key === 'ArrowDown'
                ? { kind: 'down' }
                : event.key === 'Backspace' && from === 0 && to === 0
                  ? { kind: 'join' }
                  : null
        if (event.key === 'Escape') {
          event.preventDefault()
          onEscape()
        } else if (move) {
          event.preventDefault()
          onMove(move)
        }
      }}
    />
  )
}
