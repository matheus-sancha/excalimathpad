import { useState } from 'react'
import { typesetUnit } from '../math/evaluate.ts'
import { texToHtml, useKatexReady } from '../overlay/katex.ts'
import {
  problemRows,
  variableGroups,
  type PanelElement,
  type PanelTarget,
} from './sheetPanel.ts'
import './SheetPanel.css'

/**
 * The Sheet panel's Variables and Problems tabs (docs/spec-v1.md section 8).
 * They render inside Excalidraw's sidebar, which `src/canvas/` draws; this
 * module knows no Excalidraw. A click on a row asks to jump to its line.
 */

interface TabProps {
  sheet: readonly PanelElement[]
  onJump: (target: PanelTarget) => void
}

/** A filter box, then every name in reading order, grouped by element. */
export function VariablesTab({ sheet, onJump }: TabProps) {
  const [filter, setFilter] = useState('')
  const katexReady = useKatexReady()
  const groups = variableGroups(sheet, filter)
  return (
    <div className="sheet-panel">
      <input
        className="sheet-panel__filter"
        type="search"
        placeholder="Filter names"
        aria-label="Filter names"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
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
                return (
                  <li key={row.key}>
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
                <span className="sheet-panel__message">{row.message}</span>
                <span className="sheet-panel__where">{row.where}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
