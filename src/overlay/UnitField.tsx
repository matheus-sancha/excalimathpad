import { useEffect, useRef, useState } from 'react'
import type { SheetLine } from '../math/evaluate.ts'

/**
 * The unit slot's field (docs/spec-v1.md section 5, Unit slot): a text field
 * with a list under it. **Sheet units** comes first, with the value in the
 * system, then the units of the same kind, each with the value in it.
 *
 * - Typing filters the list. ↑ / ↓ move the highlight.
 * - Enter applies the highlighted unit, or what was typed if nothing matches;
 *   an empty field goes back to Sheet units. An unknown unit turns the field
 *   red and isn't applied.
 * - Esc, or leaving the field, cancels.
 *
 * It is one of the overlay's few controls that take pointer events (section
 * 14); an entry is chosen on `mousedown`, so the field keeps the keyboard.
 */
export function UnitField({
  slot,
  isUnit,
  onApply,
  onCancel,
}: {
  slot: NonNullable<SheetLine['unitSlot']>
  isUnit: (text: string) => boolean
  /** The unit chosen, or null for Sheet units. */
  onApply: (unit: string | null) => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(slot.chosen ?? '')
  const [invalid, setInvalid] = useState(false)
  const typed = text.trim()
  const entries = entriesFor(slot, typed === slot.chosen ? '' : typed)
  const [highlight, setHighlight] = useState(() => {
    const at = entries.findIndex((entry) => entry.unit === slot.chosen)
    return at === -1 ? 0 : at
  })
  const current = Math.min(highlight, entries.length - 1)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  // Typing moves the highlight back to the top: Sheet units for an emptied field.
  const apply = () => {
    const chosen = entries[current]
    if (chosen) return onApply(chosen.unit)
    if (typed === '') return onApply(null)
    if (isUnit(typed)) return onApply(typed)
    setInvalid(true)
  }

  return (
    <span className="math-unit-field">
      <input
        ref={inputRef}
        className="math-unit-field__input"
        aria-label="Unit"
        aria-invalid={invalid}
        aria-controls="math-unit-list"
        spellCheck={false}
        autoComplete="off"
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setInvalid(false)
          setHighlight(0)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setHighlight(Math.min(current + 1, entries.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setHighlight(Math.max(current - 1, 0))
          } else if (event.key === 'Enter') {
            event.preventDefault()
            apply()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
          // The canvas's own keys stay away while typing here.
          event.stopPropagation()
        }}
        onBlur={onCancel}
      />
      {entries.length > 0 && (
        <ul className="math-unit-field__list" id="math-unit-list" role="listbox" aria-label="Units">
          {entries.map((entry, i) => (
            <li
              key={entry.unit ?? 'sheet'}
              role="option"
              aria-selected={i === current}
              className={`math-unit-field__option${i === current ? ' is-highlighted' : ''}`}
              onMouseDown={(event) => {
                event.preventDefault()
                onApply(entry.unit)
              }}
            >
              <span className="math-unit-field__label">{entry.unit ?? 'Sheet units'}</span>
              <span className="math-unit-field__value">{entry.text}</span>
            </li>
          ))}
        </ul>
      )}
    </span>
  )
}

interface Entry {
  /** Null for Sheet units. */
  unit: string | null
  text: string
}

/** The list for what's typed: everything when nothing is, else the units containing it, best first. */
function entriesFor(slot: NonNullable<SheetLine['unitSlot']>, typed: string): Entry[] {
  const units = slot.options.map((option): Entry => ({ unit: option.unit, text: option.text }))
  if (typed === '') return [{ unit: null, text: slot.system }, ...units]
  const wanted = typed.toLowerCase()
  // An exact match first, then the units that start with it: `bar` before `mbar`.
  const rank = (unit: string) => (unit === typed ? 0 : unit.toLowerCase().startsWith(wanted) ? 1 : 2)
  return units
    .filter((entry) => entry.unit!.toLowerCase().includes(wanted))
    .sort((a, b) => rank(a.unit!) - rank(b.unit!))
}
