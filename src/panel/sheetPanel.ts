import type { SheetLine } from '../math/evaluate.ts'
import { leadingNumber } from '../math/numbers.ts'
import { nameTex } from '../math/typeset.ts'

/**
 * The Sheet panel's rows (docs/spec-v1.md section 8, Sheet panel), from the
 * sheet as evaluated. Pure: the tabs render these, and a click on a row jumps
 * to its `anchorId` and `line`.
 */

/** One math element as the panel sees it, in reading order. */
export interface PanelElement {
  anchorId: string
  /** The element's optional title (#64): it names the element in place of its position. */
  title: string | null
  lines: readonly SheetLine[]
}

/** Where a row jumps to: an element and a line index (0-based). */
export interface PanelTarget {
  anchorId: string
  line: number
}

export interface VariableRow extends PanelTarget {
  key: string
  name: string
  /** The typeset name: a function's signature, `H_s(Q)`, for a function. */
  tex: string
  /** The number, `function`, `solve function`, or `error`. */
  value: string
  /** The unit, as the result shows it; blank for a function, an error or a plain number. */
  unit: string
  kind: 'value' | 'function' | 'error'
}

export interface VariableGroup {
  anchorId: string
  label: string
  rows: VariableRow[]
}

export interface ProblemRow extends PanelTarget {
  key: string
  severity: 'error' | 'warning'
  message: string
  /** "Pipe flow, line 3 · dP" or "Element 2, line 1". */
  where: string
}

/** An element's label: its title, else its position in reading order. */
export function elementLabel(element: PanelElement, index: number): string {
  const title = element.title?.trim()
  return title ? title : `Element ${index + 1}`
}

/**
 * Every name in reading order, grouped by element; a name defined twice
 * appears twice. `filter` keeps the names that contain it, ignoring case.
 * Comments and notes define nothing, so they never appear.
 */
export function variableGroups(sheet: readonly PanelElement[], filter = ''): VariableGroup[] {
  const wanted = filter.trim().toLowerCase()
  return sheet
    .map((element, index) => ({
      anchorId: element.anchorId,
      label: elementLabel(element, index),
      rows: element.lines.flatMap((line, lineIndex) =>
        line.variables
          .filter(({ name }) => name.toLowerCase().includes(wanted))
          .map((variable, i): VariableRow => {
            const base = {
              key: `${element.anchorId}:${lineIndex}:${i}`,
              anchorId: element.anchorId,
              line: lineIndex,
              name: variable.name,
            }
            switch (variable.kind) {
              case 'function':
                return {
                  ...base,
                  tex: `${nameTex(variable.name)}\\left(${variable.params.map(nameTex).join(',')}\\right)`,
                  value: variable.solve ? 'solve function' : 'function',
                  unit: '',
                  kind: 'function',
                }
              case 'error':
                return { ...base, tex: nameTex(variable.name), value: 'error', unit: '', kind: 'error' }
              case 'list':
                return { ...base, tex: nameTex(variable.name), value: variable.text, unit: '', kind: 'value' }
              case 'value': {
                const split = leadingNumber(variable.text)
                const number = split && (split.rest === '' || split.rest.startsWith(' '))
                return {
                  ...base,
                  tex: nameTex(variable.name),
                  value: number ? split.number : variable.text,
                  unit: number ? split.rest.trim() : '',
                  kind: 'value',
                }
              }
            }
          }),
      ),
    }))
    .filter((group) => group.rows.length > 0)
}

/** Errors and warnings in one list, in reading order; a line's error comes before its warnings. */
export function problemRows(sheet: readonly PanelElement[]): ProblemRow[] {
  return sheet.flatMap((element, index) => {
    const label = elementLabel(element, index)
    return element.lines.flatMap((line, lineIndex) => {
      const name = line.variables[0]?.name
      const where = `${label}, line ${lineIndex + 1}${name ? ` · ${name}` : ''}`
      const target = { anchorId: element.anchorId, line: lineIndex, where }
      const rows: ProblemRow[] = []
      const error = problemOf(line.result)
      if (error !== null) {
        rows.push({ ...target, key: `${element.anchorId}:${lineIndex}:error`, severity: 'error', message: error })
      }
      line.warnings.forEach((message, i) =>
        rows.push({ ...target, key: `${element.anchorId}:${lineIndex}:w${i}`, severity: 'warning', message }),
      )
      return rows
    })
  })
}

/** The Sheet button's badge: how many errors and warnings the sheet has. */
export function problemCount(sheet: readonly PanelElement[]): number {
  return problemRows(sheet).length
}

/** A line's error: its message, or a list's failed points (section 10). */
function problemOf(result: PanelElement['lines'][number]['result']): string | null {
  if (result.kind === 'error') return result.message
  return result.kind === 'list' ? result.failed : null
}
