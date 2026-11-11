import { all, create } from 'mathjs'
import { describe, expect, it } from 'vitest'
import doc from '../../docs/acceptance/pump-sizing.md?raw'
import { evaluateSheet, type LineResult } from './evaluate.ts'

/**
 * The pump sheet in CI (docs/spec-v1.md sections 15 and 16): the acceptance
 * sheet's lines, read from `docs/acceptance/pump-sizing.md` so the two can't
 * drift, run through `evaluateSheet` and compared with the reference
 * (`pump-sizing.py`) at 4 significant figures, in the unit the reference
 * shows, whatever prefix the sheet picks. It grows each milestone: M2 checks
 * lines 1-13, 16 and 17.
 */

/** The sheet's lines by their number in the doc (`c`, `1`, ..., `24a`), in order. */
const SHEET = [...doc.matchAll(/^\| (c|\d+[a-z]?) \| `(.+?)` \|/gm)].map(([, id, source]) => ({
  id,
  source,
}))

/** Lines the CI test runs at this milestone, in reading order. */
const M2_LINES = ['c', ...Array.from({ length: 13 }, (_, i) => `${i + 1}`), '16', '17']

/** The 4" column of the doc's Expected results, for the lines M2 runs. */
const EXPECTED_4IN: Record<string, { value: number; unit: string }> = {
  '6': { value: 5.4, unit: '' },
  '11': { value: 82.19, unit: 'cm^2' },
  '16': { value: 1.825, unit: 'm/s' },
  '17': { value: 1.86e5, unit: '' },
}

const reference = create(all)

/** A shown result in `unit`, rounded to 4 significant figures. */
function inUnit(text: string, unit: string): number {
  const source = text.replace(/·10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/, (_, power: string) =>
    `e${[...power].map((char) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(char)).map((i) => (i === 0 ? '-' : i - 1)).join('')}`,
  )
  const quantity: unknown = reference.evaluate(source)
  const number =
    unit === '' ? (quantity as number) : (quantity as { toNumber(u: string): number }).toNumber(unit)
  return Number(number.toPrecision(4))
}

function run(ids: readonly string[]): Map<string, LineResult> {
  const lines = ids.map((id) => {
    const line = SHEET.find((entry) => entry.id === id)
    if (!line) throw new Error(`Line ${id} is not in pump-sizing.md`)
    return line
  })
  const results = evaluateSheet([{ id: 'sheet', source: lines.map((l) => l.source).join('\n') }])
  const shown = results.get('sheet')!
  return new Map(ids.map((id, i) => [id, shown[i].result]))
}

describe('the pump sheet (acceptance, M2: lines 1-13, 16, 17)', () => {
  const results = run(M2_LINES)

  it('reads the sheet from the acceptance doc', () => {
    expect(SHEET.map((line) => line.id)).toEqual(expect.arrayContaining(M2_LINES))
    expect(SHEET.find((line) => line.id === '2')?.source).toBe('mu = 1.002 cP')
  })

  it('runs every line without an error', () => {
    for (const [id, result] of results) {
      expect(result.kind, `line ${id}`).not.toBe('error')
    }
  })

  it('leaves plain inputs and functions empty, line 2 included', () => {
    for (const id of ['1', '2', '3', '4', '5', '7', '8', '9', '10', '12', '13']) {
      expect(results.get(id), `line ${id}`).toEqual({ kind: 'empty' })
    }
  })

  it.each(Object.entries(EXPECTED_4IN))('line %s matches the reference', (id, expected) => {
    const result = results.get(id)
    if (result?.kind !== 'value') throw new Error(`line ${id} shows no value`)
    expect(inUnit(result.text, expected.unit)).toBe(expected.value)
  })

  it('shows the results in 4 significant digits', () => {
    expect(results.get('6')).toEqual({ kind: 'value', text: '5.4' })
    expect(results.get('16')).toEqual({ kind: 'value', text: '1.825 m / s' })
    expect(results.get('17')).toEqual({ kind: 'value', text: '1.86·10⁵' })
  })
})
