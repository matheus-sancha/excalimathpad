import { describe, expect, it } from 'vitest'
import { evaluateSheet } from '../math/evaluate.ts'
import { elementLabel, problemCount, problemRows, variableGroups, type PanelElement } from './sheetPanel.ts'

/** Elements in reading order, evaluated as one sheet, as the overlay hands them over. */
function sheetOf(...elements: { source: string; title?: string }[]): PanelElement[] {
  const lines = evaluateSheet(elements.map(({ source }, i) => ({ id: `m${i}`, source })))
  return elements.map(({ title }, i) => ({
    anchorId: `m${i}`,
    title: title ?? null,
    lines: lines.get(`m${i}`)!,
  }))
}

describe('Variables (docs/spec-v1.md section 8)', () => {
  it('lists every name in reading order, grouped by element, values in the system', () => {
    const groups = variableGroups(
      sheetOf({ source: '# Inputs\nD = 102.3 mm\nP = 5412 W # rated' }, { source: 'A_p = pi D^2 / 4' }),
    )

    expect(groups.map((group) => group.label)).toEqual(['Element 1', 'Element 2'])
    expect(groups[0].rows.map(({ name, value, unit, line }) => [name, value, unit, line])).toEqual([
      ['D', '102.3', 'mm', 1],
      ['P', '5.412', 'kW', 2],
    ])
    expect(groups[1].rows[0]).toMatchObject({ name: 'A_p', value: '82.19', unit: 'cm^2', anchorId: 'm1' })
  })

  it('names an element by its title', () => {
    const sheet = sheetOf({ source: 'x = 2', title: 'Pipe flow' }, { source: 'y = 3', title: '  ' })
    expect(variableGroups(sheet).map((group) => group.label)).toEqual(['Pipe flow', 'Element 2'])
    expect(elementLabel(sheet[1], 1)).toBe('Element 2')
  })

  it('shows a name defined twice twice', () => {
    const rows = variableGroups(sheetOf({ source: 'x = 1\nx = x + 1' }))[0].rows
    expect(rows.map(({ name, value }) => [name, value])).toEqual([
      ['x', '1'],
      ['x', '2'],
    ])
  })

  it('shows a function by its signature, "function", and no unit; an error as "error"', () => {
    const rows = variableGroups(sheetOf({ source: 'Hs(Q) = Q * 2\nbad = 1 m + 1 s' }))[0].rows
    expect(rows[0]).toMatchObject({
      name: 'Hs',
      tex: '\\mathit{Hs}\\left(Q\\right)',
      value: 'function',
      unit: '',
      kind: 'function',
    })
    expect(rows[1]).toMatchObject({ name: 'bad', value: 'error', unit: '', kind: 'error' })
  })

  it('filters by name, ignoring case, and drops groups left empty', () => {
    const sheet = sheetOf({ source: 'Q_d = 15 L/s\nD = 2 m' }, { source: 'q = 1' })
    const groups = variableGroups(sheet, 'q')
    expect(groups.map((group) => group.rows.map((row) => row.name))).toEqual([['Q_d'], ['q']])
    expect(variableGroups(sheet, 'zz')).toEqual([])
  })
})

describe('Problems (docs/spec-v1.md section 8)', () => {
  it('lists errors and warnings in one list, in reading order, with where they are', () => {
    const sheet = sheetOf(
      { source: 'K = 5.4 # fittings\nx = 1 m + 1 s', title: 'Pipe flow' },
      { source: '# note only\n2 + ' },
    )

    expect(problemRows(sheet).map(({ severity, message, where, line }) => [severity, message, where, line])).toEqual([
      ['warning', 'K shadows the unit K', 'Pipe flow, line 1 · K', 0],
      ['error', 'Units do not match', 'Pipe flow, line 2 · x', 1],
      ['error', 'Unexpected end of expression (char 4)', 'Element 2, line 2', 1],
    ])
    expect(problemCount(sheet)).toBe(3)
  })

  it('keeps a line’s error before its warnings', () => {
    expect(problemRows(sheetOf({ source: 'K = 1 m + 1 s' })).map((row) => row.severity)).toEqual([
      'error',
      'warning',
    ])
  })

  it('is empty for a clean sheet', () => {
    expect(problemCount(sheetOf({ source: '# all good\nx = 2' }))).toBe(0)
  })
})
