import { useState, type MouseEvent, type ReactNode } from 'react'
import { filterSymbols, SYMBOL_GROUPS, symbolHover, SYMBOLS, type SymbolEntry, type SymbolInsert } from '../math/symbols.ts'
import { useWords, type Words } from '../text/words.ts'

/**
 * The Symbols tab (docs/spec-v1.md section 4, Symbols tab, M4d): a filter
 * box, then the catalogue's five groups of buttons. Every button types, at
 * the open line's caret, text the engine already reads. With nothing to
 * insert into, the buttons are dimmed under the hint, and their hovers still
 * show each spelling, so the tab works as a reference. Its words, the hints
 * included, are the text table's, in the language shown (0.6.0).
 */

/** Where a press can go: what App knows from the open edit and the selection. */
export interface InsertProps {
  /** A line or the title is open, or one math element is selected (its last line opens). */
  canInsert: boolean
  onInsert: (insert: SymbolInsert) => void
}

export function SymbolsTab({ canInsert, onInsert }: InsertProps) {
  const [filter, setFilter] = useState('')
  const w = useWords()
  const shown = filterSymbols(filter, SYMBOLS, w)
  return (
    <div className="sheet-panel sheet-symbols">
      <input
        className="sheet-panel__filter"
        // Not `type="search"`: Excalidraw counts only text, number and password
        // inputs as fields, and runs its shortcuts on keys from any other.
        type="text"
        role="searchbox"
        placeholder={w.panel.symbols.filter}
        aria-label={w.panel.symbols.filter}
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      {!canInsert && <p className="sheet-panel__hint">{w.panel.openALine}</p>}
      {shown.length === 0 ? (
        <p className="sheet-panel__empty">{w.panel.symbols.noMatch}</p>
      ) : (
        SYMBOL_GROUPS.map((group) => {
          const entries = shown.filter((entry) => entry.group === group)
          if (entries.length === 0) return null
          // Greek keeps its rows: the letters, the variants, the capitals.
          const rows = group === 'greek' ? ([1, 2, 3] as const).map((row) => entries.filter((e) => e.row === row)) : [entries]
          return (
            <section key={group} className="sheet-panel__group" aria-label={w.symbols.groups[group]}>
              <h3 className="sheet-panel__group-label">{w.symbols.groups[group]}</h3>
              {rows
                .filter((row) => row.length > 0)
                .map((row, index) => (
                  <div key={index} className={`sheet-symbols__buttons is-${group}`}>
                    {row.map((entry) => (
                      <SymbolButton
                        key={`${entry.group}:${entry.spelling}`}
                        entry={entry}
                        dimmed={!canInsert}
                        onInsert={onInsert}
                        w={w}
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

function SymbolButton({
  entry,
  dimmed,
  onInsert,
  w,
}: {
  entry: SymbolEntry
  dimmed: boolean
  onInsert: InsertProps['onInsert']
  w: Words
}) {
  return (
    <InsertButton
      className={`sheet-symbols__button${entry.constant ? ' is-constant' : ''}`}
      label={entry.spelling}
      hover={symbolHover(entry, w)}
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
