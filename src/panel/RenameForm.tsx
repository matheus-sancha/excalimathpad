import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { DisplaySettings } from '../math/display.ts'
import type { RenamePlan, RenameTarget } from '../math/rename.ts'
import { renameFormView, type MarkedPart, type RenameElement, type RenameFormLine } from './renameForm.ts'
import { wordMessage } from '../text/engine.ts'
import { useWords } from '../text/words.ts'

/**
 * The rename form under a Variables row (docs/spec-v1.md section 4, Renaming
 * a name: The form, on a Variables row; section 13, Rename and Language). It
 * shows what `planRename` returns for the name in its field, and Rename hands
 * that plan over to be written: nothing is written before.
 *
 * Its field is a `type="text"` field inside the panel's key box (section 14,
 * 0.5.0), so it takes the keyboard, which leaves an open line first, and
 * Enter, Esc and every letter typed in it reach nothing else.
 */

/** A rename to write: the assignment, the new name and the plan the form showed. */
export interface RenameRequest {
  target: RenameTarget
  newName: string
  plan: RenamePlan
}

interface RenameFormProps {
  sheet: readonly RenameElement[]
  target: RenameTarget
  settings?: DisplaySettings
  onRename: (request: RenameRequest) => void
  /** Cancel or Esc. */
  onCancel: () => void
  /** The row's line no longer assigns the name (an undo, an edit): there is nothing to rename. */
  onGone: () => void
}

export function RenameForm({ sheet, target, settings, onRename, onCancel, onGone }: RenameFormProps) {
  const { engine } = useWords()
  const [name, setName] = useState(target.name)
  const w = useWords()
  const words = w.panel.rename
  // "Changes a result" runs the sheet twice (section 14, 0.5.0): the check
  // follows the typing, so a key is drawn before its check is made (section 17).
  const checked = useDeferredValue(name)
  const view = useMemo(() => renameFormView(sheet, target, checked, settings, w), [sheet, target, checked, settings, w])
  const field = useRef<HTMLInputElement>(null)
  const form = useRef<HTMLDivElement>(null)

  // The field takes the keyboard, the old name selected; the form is brought into the panel's view.
  useEffect(() => {
    field.current?.focus()
    field.current?.select()
    form.current?.scrollIntoView?.({ block: 'nearest' })
  }, [])

  const gone = view === null
  useEffect(() => {
    if (gone) onGone()
  }, [gone, onGone])
  if (view === null) return null

  const submit = () => {
    // The plan for the name as it stands, if the check hasn't caught up with the typing.
    const now = checked === name ? view : renameFormView(sheet, target, name, settings, w)
    if (now?.canRename) onRename({ target, newName: name.trim(), plan: now.plan })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <div ref={form} className="sheet-rename" role="group" aria-label={words.start(target.name)}>
      <label className="sheet-rename__heading">
        <span>
          {words.heading.before} <code>{target.name}</code> {words.heading.after}
        </span>
        <input
          ref={field}
          className="sheet-rename__field"
          // Not `search`: Excalidraw runs its shortcuts on keys from any input but text, number and password.
          type="text"
          aria-label={words.field(target.name)}
          aria-invalid={view.reason?.kind === 'refused'}
          value={name}
          // A name, not prose: no spelling, capitals or corrections.
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={onKeyDown}
        />
      </label>
      {view.reason && (
        <p className={`sheet-rename__reason is-${view.reason.kind}`} role="status">
          {view.reason.kind === 'warning' ? `⚠ ${wordMessage(engine, view.reason.message)}` : wordMessage(engine, view.reason.message)}
        </p>
      )}
      <p className="sheet-rename__count">{words.lines(view.lines.length)}</p>
      <Lines lines={view.lines} label={words.lines(view.lines.length)} />
      {view.changes.length > 0 && (
        <>
          <p className="sheet-rename__count is-warning" role="status">
            {words.results(view.changes.length)}
          </p>
          <Lines lines={view.changes} label={words.results(view.changes.length)} />
        </>
      )}
      <div className="sheet-rename__actions">
        <button type="button" className="sheet-rename__button is-primary" disabled={!view.canRename} onClick={submit}>
          {words.rename}
        </button>
        <button type="button" className="sheet-rename__button" onClick={onCancel}>
          {words.cancel}
        </button>
      </div>
    </div>
  )
}

/** The lines as "Fluid and pipe, line 2" and their source, the name marked. */
function Lines({ lines, label }: { lines: readonly RenameFormLine[]; label: string }) {
  return (
    <ul className="sheet-rename__lines" aria-label={label}>
      {lines.map((line) => (
        <li key={line.key} className="sheet-rename__line">
          <span className="sheet-rename__where">{line.where}</span>
          <code className="sheet-rename__source">
            <Parts parts={line.text} />
            {line.stored.length > 0 && (
              <span className="sheet-rename__stored">
                {' '}
                <Parts parts={line.stored} />
              </span>
            )}
          </code>
        </li>
      ))}
    </ul>
  )
}

function Parts({ parts }: { parts: readonly MarkedPart[] }) {
  return parts.map((part, i) => (part.marked ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))
}
