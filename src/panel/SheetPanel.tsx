import { useCallback, useMemo, useState } from 'react'
import type { DisplaySettings } from '../math/display.ts'
import { listConstants, typesetUnit } from '../math/evaluate.ts'
import type { RenameTarget } from '../math/rename.ts'
import { texToHtml, useKatexReady } from '../overlay/katex.ts'
import { FailureActions } from '../failure/FailureActions.tsx'
import {
  problemRows,
  variableGroups,
  type PanelElement,
  type PanelTarget,
} from './sheetPanel.ts'
import { InsertButton, OPEN_A_LINE, type InsertProps } from './SymbolsTab.tsx'
import { RenameForm, type RenameRequest } from './RenameForm.tsx'
import { RENAME_WORDS, type RenameElement } from './renameForm.ts'
import { wordMessage } from '../text/engine.ts'
import { useWords } from '../text/words.ts'
import './SheetPanel.css'

/**
 * The Sheet panel's Variables, Problems and Constants tabs (docs/spec-v1.md
 * section 8); the Format tab is `FormatTab.tsx`, the Symbols tab `SymbolsTab.tsx`.
 * They render inside Excalidraw's sidebar, which `src/canvas/` draws; this
 * module knows no Excalidraw. A click on a row asks to jump to its line; a
 * Variables row's ✎ opens the rename form (`RenameForm.tsx`, 0.5.0).
 */

interface TabProps {
  sheet: readonly PanelElement[]
  onJump: (target: PanelTarget) => void
}

/** What the Variables tab's rename form needs (section 4, Renaming a name, 0.5.0). */
export interface RenameProps {
  /** The sheet's unit system and Digits: "changes a result" compares results as they show. */
  settings?: DisplaySettings
  /** Rename: writes the plan the form showed. */
  onRename: (request: RenameRequest) => void
  /** The form closed with nothing written (Cancel, Esc, its ✎ again). */
  onCancel?: () => void
}

/**
 * A filter box, then every name in reading order, grouped by element. From
 * 0.5.0 every row ends in a ✎ that opens the rename form under it, one form
 * at a time; a press on the ✎ or in the form doesn't jump.
 */
export function VariablesTab({
  sheet,
  onJump,
  settings,
  onRename,
  onCancel,
}: { sheet: readonly RenameElement[]; onJump: (target: PanelTarget) => void } & RenameProps) {
  const [filter, setFilter] = useState('')
  // The row whose form is open: its key, and the assignment it renames.
  const [renaming, setRenaming] = useState<{ key: string; target: RenameTarget } | null>(null)
  const katexReady = useKatexReady()
  const groups = variableGroups(sheet, filter)
  const close = useCallback(() => setRenaming(null), [])
  const cancel = useCallback(() => {
    setRenaming(null)
    onCancel?.()
  }, [onCancel])
  return (
    <div className="sheet-panel">
      <input
        className="sheet-panel__filter"
        // Not `type="search"`: Excalidraw counts only text, number and password
        // inputs as fields, and runs its shortcuts on keys from any other.
        type="text"
        role="searchbox"
        placeholder="Filter names"
        aria-label="Filter names"
        value={filter}
        onChange={(event) => {
          setFilter(event.target.value)
          // The rows change under an open form: it closes, and never comes back to take the keyboard.
          setRenaming(null)
        }}
      />
      {groups.length === 0 ? (
        <p className="sheet-panel__empty">{filter ? 'No name matches.' : 'No variables yet.'}</p>
      ) : (
        groups.map((group) => (
          <section key={group.anchorId} className="sheet-panel__group" aria-label={group.label}>
            <h3 className="sheet-panel__group-label">{group.label}</h3>
            <ul className="sheet-panel__list">
              {group.rows.map((row) => {
                const html = katexReady ? texToHtml(row.tex) : null
                const unitHtml = katexReady && row.unit ? texToHtml(typesetUnit(row.unit)) : null
                const open = renaming?.key === row.key
                return (
                  <li key={row.key}>
                    <div className="sheet-panel__variable">
                      <button
                        type="button"
                        className={`sheet-panel__row is-${row.kind}`}
                        aria-label={`${row.name}: ${row.value}${row.unit ? ` ${row.unit}` : ''}`}
                        onClick={() => onJump(row)}
                      >
                        <span className="sheet-panel__name">
                          {html === null ? row.name : <span dangerouslySetInnerHTML={{ __html: html }} />}
                        </span>
                        <span className="sheet-panel__value">{row.value}</span>
                        <span className="sheet-panel__unit">
                          {unitHtml === null ? row.unit : <span dangerouslySetInnerHTML={{ __html: unitHtml }} />}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="sheet-panel__rename"
                        aria-label={RENAME_WORDS.start(row.name)}
                        title={RENAME_WORDS.start(row.name)}
                        aria-expanded={open}
                        onClick={() =>
                          open
                            ? cancel()
                            : setRenaming({ key: row.key, target: { id: row.anchorId, line: row.line, name: row.name } })
                        }
                      >
                        ✎
                      </button>
                    </div>
                    {open && (
                      <RenameForm
                        sheet={sheet}
                        target={renaming.target}
                        settings={settings}
                        onRename={(request) => {
                          setRenaming(null)
                          onRename(request)
                        }}
                        onCancel={cancel}
                        onGone={close}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

/** Errors ● and warnings ⚠ in one list, in reading order. */
export function ProblemsTab({ sheet, onJump }: TabProps) {
  const rows = problemRows(sheet)
  const { engine } = useWords()
  return (
    <div className="sheet-panel">
      {rows.length === 0 ? (
        <p className="sheet-panel__empty">No problems.</p>
      ) : (
        <ul className="sheet-panel__list">
          {rows.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                className={`sheet-panel__problem is-${row.severity}`}
                onClick={() => onJump(row)}
              >
                <span className="sheet-panel__mark" aria-label={row.severity}>
                  {row.severity === 'error' ? '●' : '⚠'}
                </span>
                <span className="sheet-panel__message">{wordMessage(engine, row.message)}</span>
                {row.unexpected && <span className="sheet-panel__raw">{row.unexpected.text}</span>}
                <span className="sheet-panel__where">{row.where}</span>
              </button>
              {/* Section 4, Unexpected failures: the app's own failure can be reported from its row. */}
              {row.unexpected && (
                <div className="sheet-panel__report">
                  <FailureActions what="line" failure={row.unexpected} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * The built-in constants (docs/spec-v1.md section 8, Constants tab): a filter
 * box, then every constant in its group, each as Mathcad lists one: its
 * symbol, its value in the sheet's system, then what it is and the names a
 * line can read it by. Nothing here is the sheet's, so no row jumps: from
 * M4d a row is a no-focus button that inserts its short name, else its
 * math.js name, by the Symbols tab's rules (section 4, Symbols tab).
 */
export function ConstantsTab({ settings, canInsert, onInsert }: { settings: DisplaySettings } & InsertProps) {
  const [filter, setFilter] = useState('')
  const katexReady = useKatexReady()
  const all = useMemo(() => listConstants(settings), [settings])
  const wanted = filter.trim().toLowerCase()
  const groups = all
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) =>
        [row.name, row.short ?? '', row.label].some((text) => text.toLowerCase().includes(wanted)),
      ),
    }))
    .filter((group) => group.rows.length > 0)
  return (
    <div className="sheet-panel">
      <input
        className="sheet-panel__filter"
        // Not `type="search"`: Excalidraw counts only text, number and password
        // inputs as fields, and runs its shortcuts on keys from any other.
        type="text"
        role="searchbox"
        placeholder="Filter constants"
        aria-label="Filter constants"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      {!canInsert && <p className="sheet-panel__hint">{OPEN_A_LINE}</p>}
      {groups.length === 0 ? (
        <p className="sheet-panel__empty">No constant matches.</p>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="sheet-panel__group" aria-label={group.label}>
            <h3 className="sheet-panel__group-label">{group.label}</h3>
            <ul className="sheet-panel__list">
              {group.rows.map((row) => {
                const names = row.short ? `${row.short} or ${row.name}` : row.name
                const name = row.short ?? row.name
                const symbol = katexReady ? texToHtml(row.tex) : null
                const value = katexReady ? texToHtml(row.valueTex) : null
                return (
                  <li key={row.name}>
                    <InsertButton
                      className="sheet-panel__constant"
                      label={`${row.label}: ${names} = ${row.value}`}
                      hover={`Insert ${name}`}
                      dimmed={!canInsert}
                      onPress={() => onInsert({ mode: 'name', text: name })}
                    >
                      <span className="sheet-panel__constant-symbol">
                        {symbol === null ? (row.short ?? row.name) : <span dangerouslySetInnerHTML={{ __html: symbol }} />}
                      </span>
                      <span className="sheet-panel__constant-value">
                        {value === null ? row.value : <span dangerouslySetInnerHTML={{ __html: value }} />}
                      </span>
                      <span className="sheet-panel__constant-label">{row.label}</span>
                      <code className="sheet-panel__constant-names">{names}</code>
                    </InsertButton>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
