import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { PlotClause, PlotSize } from '../math/plotLine.ts'

/**
 * The plot's settings popover (docs/spec-v1.md section 10, Plots): Mark,
 * Series names, Points, x axis, y axis, Size and Title. Each change hands back
 * the line's whole clause list, which the overlay writes as one line commit;
 * the popover stays open. Esc, or focus leaving it (a click outside), closes it.
 *
 * Like the unit field, it is one of the overlay's few controls that take
 * pointer events (section 14), and the canvas's keys stay away while it has
 * the keyboard. Screen only.
 */
export function PlotSettings({
  clauses,
  onChange,
  onClose,
}: {
  clauses: readonly PlotClause[]
  onChange: (clauses: PlotClause[]) => void
  onClose: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    root.current?.querySelector<HTMLElement>('input, select')?.focus()
  }, [])

  const marks = clauses.flatMap((clause) => (clause.kind === 'mark' ? [clause.expression] : []))
  const has = (kind: PlotClause['kind']) => clauses.some((clause) => clause.kind === kind)
  const log = (axis: 'x' | 'y') => clauses.some((clause) => clause.kind === 'log' && clause.axis === axis)
  const range = (axis: 'x' | 'y') => {
    const found = clauses.find((clause) => clause.kind === 'range' && clause.axis === axis)
    return found?.kind === 'range' ? found : null
  }
  const size = clauses.find((clause) => clause.kind === 'size')
  const title = clauses.find((clause) => clause.kind === 'title')

  /** The clauses with every clause `drop` matches replaced by `add`, in the popover's order. */
  const change = (drop: (clause: PlotClause) => boolean, add: PlotClause[]) => {
    const kept = clauses.filter((clause) => !drop(clause))
    onChange(order([...kept, ...add]))
  }

  const keys = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
    // The canvas's own keys stay away while the popover has the keyboard.
    event.stopPropagation()
  }

  return (
    <div
      ref={root}
      className="math-plot-settings"
      role="dialog"
      aria-label="Plot settings"
      onKeyDown={keys}
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node | null)) onClose()
      }}
    >
      <Row label="Mark">
        <TextSetting
          label="Mark"
          value={marks.join('; ')}
          placeholder="Q_op; Q_d"
          onCommit={(text) =>
            change(
              (clause) => clause.kind === 'mark',
              text
                .split(';')
                .map((part) => part.trim())
                .filter((part) => part !== '')
                .map((expression) => ({ kind: 'mark', expression })),
            )
          }
        />
      </Row>
      <Row label="Series names">
        <select
          aria-label="Series names"
          value={has('labels-direct') ? 'direct' : 'legend'}
          onChange={(event) =>
            change((clause) => clause.kind === 'labels-direct', event.target.value === 'direct' ? [{ kind: 'labels-direct' }] : [])
          }
        >
          <option value="legend">Legend</option>
          <option value="direct">At line ends</option>
        </select>
      </Row>
      <Row label="Points">
        <input
          type="checkbox"
          aria-label="Points"
          checked={has('points')}
          onChange={(event) => change((clause) => clause.kind === 'points', event.target.checked ? [{ kind: 'points' }] : [])}
        />
      </Row>
      {(['x', 'y'] as const).map((axis) => (
        <Row key={axis} label={`${axis} axis`}>
          <select
            aria-label={`${axis} scale`}
            value={log(axis) ? 'log' : 'linear'}
            onChange={(event) =>
              change(
                (clause) => clause.kind === 'log' && clause.axis === axis,
                event.target.value === 'log' ? [{ kind: 'log', axis }] : [],
              )
            }
          >
            <option value="linear">Linear</option>
            <option value="log">Log</option>
          </select>
          <TextSetting
            label={`${axis} from`}
            value={range(axis)?.start ?? ''}
            placeholder="auto"
            onCommit={(start) => setRange(axis, start, range(axis)?.end ?? '')}
          />
          <span className="math-plot-settings__dots">..</span>
          <TextSetting
            label={`${axis} to`}
            value={range(axis)?.end ?? ''}
            placeholder="auto"
            onCommit={(end) => setRange(axis, range(axis)?.start ?? '', end)}
          />
        </Row>
      ))}
      <Row label="Size">
        <select
          aria-label="Size"
          value={size?.kind === 'size' ? size.size : 'M'}
          onChange={(event) => {
            const chosen = event.target.value as PlotSize
            change((clause) => clause.kind === 'size', chosen === 'M' ? [] : [{ kind: 'size', size: chosen }])
          }}
        >
          <option value="S">S (360 × 220)</option>
          <option value="M">M (480 × 280)</option>
          <option value="L">L (640 × 360)</option>
        </select>
      </Row>
      <Row label="Title">
        <TextSetting
          label="Title"
          value={title?.kind === 'title' ? title.text : ''}
          placeholder="None"
          onCommit={(text) =>
            change((clause) => clause.kind === 'title', text.trim() === '' ? [] : [{ kind: 'title', text: text.trim() }])
          }
        />
      </Row>
    </div>
  )

  /** A range needs both ends: with either empty, the axis fits its data. */
  function setRange(axis: 'x' | 'y', start: string, end: string) {
    const both = start.trim() !== '' && end.trim() !== ''
    change(
      (clause) => clause.kind === 'range' && clause.axis === axis,
      both ? [{ kind: 'range', axis, start: start.trim(), end: end.trim() }] : [],
    )
  }
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="math-plot-settings__row">
      <span className="math-plot-settings__label">{label}</span>
      <span className="math-plot-settings__controls">{children}</span>
    </div>
  )
}

/** A text box that commits on Enter or when it loses focus, and only if its text changed. */
function TextSetting({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string
  value: string
  placeholder: string
  onCommit: (text: string) => void
}) {
  // What is typed, until the line's own value changes under it (another write, an undo).
  const [draft, setDraft] = useState({ from: value, text: value })
  const text = draft.from === value ? draft.text : value
  const setText = (next: string) => setDraft({ from: value, text: next })
  const commit = () => {
    if (text !== value) onCommit(text)
  }
  return (
    <input
      aria-label={label}
      spellCheck={false}
      autoComplete="off"
      value={text}
      placeholder={placeholder}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
        }
      }}
      onBlur={commit}
    />
  )
}

/** The clauses in the popover's order, so a written line reads the same however it was set. */
const ORDER: PlotClause['kind'][] = ['mark', 'labels-direct', 'points', 'log', 'range', 'size', 'title', 'unknown']

function order(clauses: PlotClause[]): PlotClause[] {
  const axis = (clause: PlotClause) => ('axis' in clause && clause.axis === 'y' ? 1 : 0)
  return [...clauses].sort(
    (a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || axis(a) - axis(b),
  )
}
