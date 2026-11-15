import { useState, type MouseEvent, type ReactNode } from 'react'
import { filterSymbols, SYMBOL_GROUPS, symbolHover, type SymbolEntry, type SymbolInsert } from '../math/symbols.ts'

/**
 * The Symbols tab (docs/spec-v1.md section 4, Symbols tab, M4d): a filter
 * box, then the catalogue's five groups of buttons. Every button types, at
 * the open line's caret, text the engine already reads. With nothing to
 * insert into, the buttons are dimmed under the hint, and their hovers still
 * show each spelling, so the tab works as a reference.
 */

/** Where a press can go: what App knows from the open edit and the selection. */
export interface InsertProps {
  /** A line or the title is open, or one math element is selected (its last line opens). */
  canInsert: boolean
  onInsert: (insert: SymbolInsert) => void
}

export const OPEN_A_LINE = 'Open a line to insert'

export function SymbolsTab({ canInsert, onInsert }: InsertProps) {
  const [filter, setFilter] = useState('')
  const shown = filterSymbols(filter)
  return (
    <div className="sheet-panel sheet-symbols">
      <input
        className="sheet-panel__filter"
        // Not `type="search"`: Excalidraw counts only text, number and password
        // inputs as fields, and runs its shortcuts on keys from any other.
        type="text"
        role="searchbox"
        placeholder="Filter symbols"
        aria-label="Filter symbols"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      {!canInsert && <p className="sheet-panel__hint">{OPEN_A_LINE}</p>}
      {shown.length === 0 ? (
        <p className="sheet-panel__empty">No symbol matches.</p>
      ) : (
        SYMBOL_GROUPS.map((group) => {
          const entries = shown.filter((entry) => entry.group === group.id)
          if (entries.length === 0) return null
          // Greek keeps its rows: the letters, the variants, the capitals.
          const rows = group.id === 'greek' ? ([1, 2, 3] as const).map((row) => entries.filter((e) => e.row === row)) : [entries]
          return (
            <section key={group.id} className="sheet-panel__group" aria-label={group.label}>
              <h3 className="sheet-panel__group-label">{group.label}</h3>
              {rows
                .filter((row) => row.length > 0)
                .map((row, index) => (
                  <div key={index} className={`sheet-symbols__buttons is-${group.id}`}>
                    {row.map((entry) => (
                      <SymbolButton
                        key={`${entry.group}:${entry.spelling}`}
                        entry={entry}
                        dimmed={!canInsert}
                        onInsert={onInsert}
                      />
                    ))}
                  </div>
                ))}
            </section>
          )
        })
      )}
    </div>
  )
}

function SymbolButton({ entry, dimmed, onInsert }: { entry: SymbolEntry; dimmed: boolean; onInsert: InsertProps['onInsert'] }) {
  return (
    <InsertButton
      className={`sheet-symbols__button${entry.constant ? ' is-constant' : ''}`}
      label={entry.spelling}
      hover={symbolHover(entry)}
      dimmed={dimmed}
      onPress={() => onInsert(entry.insert)}
    >
      {entry.label}
    </InsertButton>
  )
}

/**
 * A no-focus insert button (section 14, Panel controls that act on the open
 * line): its `mousedown` is prevented and it is out of the tab order, so the
 * open field keeps the keyboard. Dimmed, it stays hoverable (`aria-disabled`,
 * not `disabled`, which would hide its tooltip) and a press does nothing.
 */
export function InsertButton({
  className,
  label,
  hover,
  dimmed,
  onPress,
  children,
}: {
  className: string
  label: string
  hover: string
  dimmed: boolean
  onPress: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`${className}${dimmed ? ' is-dimmed' : ''}`}
      aria-label={label}
      aria-disabled={dimmed || undefined}
      title={hover}
      tabIndex={-1}
      onMouseDown={(event: MouseEvent) => event.preventDefault()}
      onClick={() => {
        if (!dimmed) onPress()
      }}
    >
      {children}
    </button>
  )
}
