import { all, create } from 'mathjs'
import { describe, expect, it } from 'vitest'
import doc from '../../docs/acceptance/pump-sizing.md?raw'
import { evaluateSheet, type SheetLine } from './evaluate.ts'

/**
 * The pump sheet in CI (docs/spec-v1.md sections 15 and 16): the acceptance
 * sheet's lines, read from `docs/acceptance/pump-sizing.md` so the two can't
 * drift, run through `evaluateSheet` and compared with the reference
 * (`pump-sizing.py`) at 4 significant figures, in the unit the reference
 * shows, whatever prefix the sheet picks. It grows each milestone: M2 checks
 * lines 1-13, 16 and 17; M3 adds lines 14-28, the solves.
 */

/** The sheet's lines by their number in the doc (`c`, `1`, ..., `24a`), in order. */
const SHEET = [...doc.matchAll(/^\| (c|\d+[a-z]?) \| `(.+?)` \|/gm)].map(([, id, source]) => ({
  id,
  source,
}))

/** Lines the CI test runs at this milestone, in reading order: every line up to the ranges (M4). */
const M3_LINES = SHEET.map((line) => line.id).filter((id) => !['29', '30', '31'].includes(id))

/** The 4" column of the doc's Expected results, for the lines M3 runs. */
const EXPECTED_4IN: Record<string, { value: number; unit: string }> = {
  '6': { value: 5.4, unit: '' },
  '11': { value: 82.19, unit: 'cm^2' },
  '16': { value: 1.825, unit: 'm/s' },
  '17': { value: 1.86e5, unit: '' },
  '18': { value: 0.01864, unit: '' },
  '19': { value: 45.43, unit: 'kPa' },
  '20': { value: 8.976, unit: 'kPa' },
  '21': { value: 117.5, unit: 'kPa' },
  '22': { value: 17.56, unit: 'm' },
  '23': { value: 3.683, unit: 'kW' },
  '26': { value: 18.81, unit: 'L/s' },
  '27': { value: 20.58, unit: 'm' },
  '28': { value: 5.412, unit: 'kW' },
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

function run(ids: readonly string[]): Map<string, SheetLine> {
  const lines = ids.map((id) => {
    const line = SHEET.find((entry) => entry.id === id)
    if (!line) throw new Error(`Line ${id} is not in pump-sizing.md`)
    return line
  })
  const results = evaluateSheet([{ id: 'sheet', source: lines.map((l) => l.source).join('\n') }])
  const shown = results.get('sheet')!
  return new Map(ids.map((id, i) => [id, shown[i]]))
}

describe('the pump sheet (acceptance, M3: lines 1-28)', () => {
  const lines = run(M3_LINES)
  const results = new Map([...lines].map(([id, line]) => [id, line.result]))

  it('reads the sheet from the acceptance doc', () => {
    expect(M3_LINES).toEqual(['c', ...Array.from({ length: 23 }, (_, i) => `${i + 1}`), '24a', '24b', '24c', '25', '26', '27', '28'])
    expect(SHEET.find((line) => line.id === '2')?.source).toBe('mu = 1.002 cP')
  })

  it('runs every line without an error', () => {
    for (const [id, result] of results) {
      expect(result.kind, `line ${id}`).not.toBe('error')
    }
  })

  it('leaves plain inputs and functions empty, line 2 and the solve function included', () => {
    for (const id of ['1', '2', '3', '4', '5', '7', '8', '9', '10', '12', '13', '14', '15', '24a', '24b', '24c', '25']) {
      expect(results.get(id), `line ${id}`).toEqual({ kind: 'empty' })
    }
  })

  it.each(Object.entries(EXPECTED_4IN))('line %s matches the reference', (id, expected) => {
    const result = results.get(id)
    if (result?.kind !== 'value') throw new Error(`line ${id} shows no value`)
    expect(inUnit(result.text, expected.unit)).toBe(expected.value)
  })

  // Step 1 of the acceptance: `K` shadows kelvin on purpose (section 16).
  it('warns on line 6 only', () => {
    for (const [id, line] of lines) {
      expect(line.warnings, `line ${id}`).toEqual(id === '6' ? ['K shadows the unit K'] : [])
    }
  })

  it('shows the results in 4 significant digits', () => {
    expect(results.get('6')).toEqual({ kind: 'value', text: '5.4' })
    expect(results.get('16')).toEqual({ kind: 'value', text: '1.825 m / s' })
    expect(results.get('17')).toEqual({ kind: 'value', text: '1.86·10⁵' })
    expect(results.get('18')).toEqual({ kind: 'value', text: '0.01864' })
    expect(results.get('26')).toEqual({ kind: 'value', text: '18.81 L / s' })
  })

  // Section 4, Solve details: a solve line and a direct call to a solve function, nothing deeper.
  it('gives solve details to lines 18 and 26 only', () => {
    for (const [id, line] of lines) {
      if (id === '18' || id === '26') expect(line.solveDetails?.method, `line ${id}`).toBe('Brent')
      else expect(line.solveDetails, `line ${id}`).toBeNull()
    }
  })

  // Section 17, verify first (#71): the whole sheet, nested solves included, runs on every keystroke.
  it('runs the whole sheet well inside a keystroke', () => {
    const source = M3_LINES.map((id) => SHEET.find((line) => line.id === id)!.source).join('\n')
    const started = performance.now()
    for (let i = 0; i < 5; i++) evaluateSheet([{ id: 'sheet', source }])
    expect((performance.now() - started) / 5).toBeLessThan(200)
  })
})
