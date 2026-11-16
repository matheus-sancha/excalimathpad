import { useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import type { Suggested, Suggestion } from '../overlay/suggest.ts'

export interface ConditionFieldProps {
  /** What the field is, for assistive tech: "Condition of rule 2". */
  label: string
  /** The condition as it shows: as typed while it is being typed, else the rule's own. */
  value: string
  /** Hands the field's element to the list, which puts the keyboard in a new rule's field. */
  fieldRef: (field: HTMLInputElement | null) => void
  onType: (text: string) => void
  /** Enter, with no suggestion highlighted: the condition is saved. */
  onEnter: () => void
  onBlur: (event: FocusEvent<HTMLInputElement>) => void
  /** The suggestions the open line's field offers (section 4, Suggestions); null for none. */
  suggest: (text: string, caret: number) => Suggested | null
}

const LIST_ID = 'sheet-rules-suggestions'

/**
 * A rule's condition, in the Rules list (docs/spec-v1.md section 4, Rules
 * list, M4e): a text field on the rule's row. It is the one typed field in the
 * panel that doesn't leave the open line: it carries `LINE_FIELD`
 * (`panelPresses.ts`), so the line's field lets the keyboard go to it and
 * stays open. `type="text"`, as every field inside Excalidraw's container
 * (section 14). It offers the names and units the line's own field offers,
 * with the same keys: ↓ ↑ to highlight, Tab or Enter to take one, Esc to close
 * the list.
 */
export function ConditionField({ label, value, fieldRef, onType, onEnter, onBlur, suggest }: ConditionFieldProps) {
  const field = useRef<HTMLInputElement | null>(null)
  const [list, setList] = useState<{ suggested: Suggested; highlight: number | null } | null>(null)
  // The input a suggestion writes doesn't ask for another list.
  const accepting = useRef(false)
  // The browser keeps one text undo for all the page's fields (Chromium), and
  // the open line's is its own (section 6). So this field is a new element
  // each time it loses the keyboard, which drops what was typed in it from
  // that undo: Ctrl+Z back in the line takes back the line's typing. And with
  // nothing of its own to take back, its Ctrl+Z does nothing, where the
  // browser would go on to the line's typing.
  const [mounted, setMounted] = useState(0)
  const atFocus = useRef(value)

  // The panel's content scrolls: a list that opens past its edge is brought into it.
  const listRef = useRef<HTMLUListElement>(null)
  const shown = list !== null
  useLayoutEffect(() => {
    if (shown) listRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [shown])

  const accept = (item: Suggestion) => {
    const input = field.current
    if (!input || !list) return
    const { from, to } = list.suggested
    accepting.current = true
    input.focus()
    input.setSelectionRange(from, to)
    // `insertText` keeps the field's own Ctrl+Z; where it isn't there, write the text and say so.
    if (!input.ownerDocument.execCommand?.('insertText', false, item.insert)) {
      input.setRangeText(item.insert, from, to, 'end')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    accepting.current = false
    setList(null)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    const take = (run: () => void) => {
      event.preventDefault()
      run()
    }
    if (list) {
      const { items } = list.suggested
      const { highlight } = list
      switch (event.key) {
        case 'ArrowDown':
          return take(() => setList({ ...list, highlight: Math.min((highlight ?? -1) + 1, items.length - 1) }))
        case 'ArrowUp':
          if (highlight === null) break
          return take(() => setList({ ...list, highlight: highlight === 0 ? null : highlight - 1 }))
        case 'Tab':
          if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) break
          return take(() => accept(items[highlight ?? 0]))
        case 'Enter':
          if (highlight === null) break
          return take(() => accept(items[highlight]))
        case 'Escape':
          return take(() => setList(null))
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'Home':
        case 'End':
          setList(null)
      }
    }
    if (event.key === 'Enter') return take(onEnter)
    const undo = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'z'
    if (undo && event.currentTarget.value === atFocus.current) event.preventDefault()
  }

  return (
    <>
      <input
        key={mounted}
        ref={(input) => {
          field.current = input
          fieldRef(input)
        }}
        className="sheet-rules__field"
        // Not `search`: Excalidraw runs its shortcuts on keys from any input but text, number and password.
        type="text"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={list !== null}
        aria-controls={list ? LIST_ID : undefined}
        aria-activedescendant={list && list.highlight !== null ? `${LIST_ID}-${list.highlight}` : undefined}
        value={value}
        // Source, not prose: no spelling, capitals or corrections.
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        // `LINE_FIELD`: the keyboard here leaves the open line open.
        data-line-field
        // A press here keeps a floating Sheet panel open, as one in the line's field does.
        data-prevent-outside-click
        onChange={(event) => {
          const input = event.currentTarget
          onType(input.value)
          if (accepting.current) return setList(null)
          const suggested = suggest(input.value, input.selectionStart ?? input.value.length)
          setList(suggested && { suggested, highlight: null })
        }}
        onKeyDown={onKeyDown}
        onMouseDown={() => setList(null)}
        onFocus={(event) => {
          atFocus.current = event.currentTarget.value
        }}
        onBlur={(event) => {
          setList(null)
          // Not when the window lost focus: the field still has the keyboard.
          if (event.currentTarget.ownerDocument.activeElement !== event.currentTarget) setMounted((n) => n + 1)
          onBlur(event)
        }}
      />
      {list && (
        <ul ref={listRef} className="sheet-rules__suggest" id={LIST_ID} role="listbox" aria-label="Suggestions">
          {list.suggested.items.map((item, i) => (
            <li
              key={`${item.kind}:${item.name}`}
              id={`${LIST_ID}-${i}`}
              role="option"
              aria-selected={i === list.highlight}
              className={`sheet-rules__option${i === list.highlight ? ' is-highlighted' : ''}`}
              // Taken on `mousedown`, so the field keeps the keyboard.
              onMouseDown={(event) => {
                event.preventDefault()
                accept(item)
              }}
            >
              <span className="sheet-rules__option-name">{item.name}</span>
              <span className="sheet-rules__option-detail">{item.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
