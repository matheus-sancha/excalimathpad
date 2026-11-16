import { describe, expect, it } from 'vitest'
import doc from '../../docs/acceptance/true-position.md?raw'
import { evaluateSheet, type SheetLine } from './evaluate.ts'
import { storeFormats } from './lineForm.ts'

/**
 * The true-position sheet in CI (docs/spec-v1.md sections 15 and 16, M4e): the
 * second acceptance sheet's lines and the `check` line's stored format, read
 * from `docs/acceptance/true-position.md` so the two can't drift, run through
 * `evaluateSheet` with the format where the file keeps it (beside the line,
 * `customData.formats`), and compared at 4 significant figures: `TP`,
 * `check`, `used`, `margin`, and a chart with one point and one circle. With
 * `dx = 0.12 mm`, `check` is "Fail".
 */

interface Row {
  id: string
  source: string
  format: string
}

/** The sheet's rows by their number in the doc (`c`, `1`, …, `8`), each with its stored format (`—` is none). */
const SHEET: Row[] = [...doc.matchAll(/^\| (c|\d+) \| `(.+?)` \| (—|`(.+?)`) \|/gm)].map(([, id, source, , format]) => ({
  id,
  source,
  format: format ?? '',
}))

/** The doc's Expected results: each line's value at `dx = 0.08 mm` and at `0.12 mm`. */
const EXPECTED = new Map(
  [...doc.matchAll(/^\| `(\w+)` \| (.+?) \| (.+?) \|$/gm)].map(([, name, base, moved]) => [name, { base, moved }]),
)

/** The sheet, with `dx` changed if asked, run as the app runs a math element: sources and stored formats. */
function run(dx?: string): Map<string, SheetLine> {
  const sources = SHEET.map((row) => (row.id === '1' && dx ? `dx = ${dx}` : row.source))
  const shown = evaluateSheet([{ id: 'sheet', source: sources.join('\n'), formats: storeFormats(SHEET.map((row) => row.format)) }]).get('sheet')!
  return new Map(SHEET.map((row, i) => [row.id, shown[i]]))
}

/** The line that assigns `name`. */
function line(lines: Map<string, SheetLine>, name: string): SheetLine {
  const row = SHEET.find((entry) => entry.source.startsWith(`${name} = `))
  if (!row) throw new Error(`${name} is not in true-position.md`)
  return lines.get(row.id)!
}

/** A shown number and its unit, the number at 4 significant figures (`0.1887 mm`, `75.47`). */
function at4(text: string): string {
  const match = /^(-?[\d.]+)(.*)$/.exec(text.replace('−', '-'))
  if (!match) return text
  return `${Number(Number(match[1]).toPrecision(4))}${match[2].replace(/\s+/g, ' ')}`
}

describe('the true-position sheet (acceptance, M4e)', () => {
  it('reads the nine lines and the check line’s stored format from the acceptance doc', () => {
    expect(SHEET.map((row) => row.id)).toEqual(['c', '1', '2', '3', '4', '5', '6', '7', '8'])
    expect(SHEET.map((row) => row.source)).toEqual([
      '# True position, RFS (ASME Y14.5)',
      'dx = 0.08 mm',
      'dy = -0.05 mm',
      'T_p = 0.25 mm',
      'TP = 2 sqrt(dx^2 + dy^2) in mm',
      'check = if(TP <= T_p, "Pass", "Fail")',
      'used = TP / T_p * 100',
      'margin = T_p - TP in mm',
      'plot(dx, dy), circle T_p / 2, title "True position"',
    ])
    expect(SHEET.filter((row) => row.format !== '').map((row) => [row.id, row.format])).toEqual([
      ['5', '@text-green if result == "Pass" @text-red if result == "Fail"'],
    ])
    expect([...EXPECTED.keys()]).toEqual(['TP', 'check', 'used', 'margin'])
  })

  it('runs every line without an error or a warning, and leaves the inputs and the plot line empty', () => {
    const lines = run()
    for (const [id, shown] of lines) {
      expect(shown.result.kind, `line ${id}`).not.toBe('error')
      expect(shown.warnings, `line ${id}`).toEqual([])
    }
    for (const id of ['c', '1', '2', '3', '8']) expect(lines.get(id)?.result, `line ${id}`).toEqual({ kind: 'empty' })
  })

  it.each([
    ['0.08 mm', 'base', 'green'],
    ['0.12 mm', 'moved', 'red'],
  ] as const)('matches the expected results at dx = %s, the check line in its colour', (dx, column, colour) => {
    const lines = run(column === 'base' ? undefined : dx)
    for (const [name, expected] of EXPECTED) {
      const { result } = line(lines, name)
      if (result.kind !== 'value') throw new Error(`${name} shows no value`)
      if (name === 'check') expect(result.text).toBe(expected[column].replace(/, \w+$/, ''))
      else expect(at4(result.text), name).toBe(expected[column])
    }
    const check = line(lines, 'check')
    expect(check.typeset.kind === 'math' && check.typeset.format.textColor).toBe(colour)
    expect(check.unitSlot).toBeNull()
  })

  it('shows Pass and Fail as the acceptance asks', () => {
    expect(line(run(), 'check').result).toEqual({ kind: 'value', text: 'Pass' })
    expect(line(run('0.12 mm'), 'check').result).toEqual({ kind: 'value', text: 'Fail' })
  })

  it('reads the format from where it is stored: the line’s text holds none', () => {
    const lines = run()
    expect(SHEET.find((row) => row.id === '5')?.source).not.toContain('@')
    // The control: the same sheet with nothing stored has no colour on the check line.
    const bare = evaluateSheet([{ id: 'sheet', source: SHEET.map((row) => row.source).join('\n') }]).get('sheet')!
    const check = bare[SHEET.findIndex((row) => row.id === '5')]
    expect(check.typeset.kind === 'math' && check.typeset.format.textColor).toBeNull()
    expect(line(lines, 'check').ruleTruth).toEqual([true, false])
  })

  it('draws one point and one circle, with equal scales, on a square chart', () => {
    const plot = run().get('8')!.plot!
    expect(plot.series).toEqual([])
    expect(plot.failed).toEqual([])
    expect(plot.dots).toHaveLength(1)
    expect(plot.circles).toHaveLength(1)
    const [dot] = plot.dots
    expect([dot.x, dot.y]).toEqual([0.08, -0.05])
    expect(dot.label).toBe('(0.08, −0.05) mm')
    const [circle] = plot.circles
    expect([circle.cx, circle.cy, circle.rx, circle.ry]).toEqual([0, 0, 0.125, 0.125])
    expect(plot.equal).toBe(1)
    expect([plot.width, plot.height]).toEqual([280, 280])
    expect([plot.x.label, plot.y.label]).toEqual(['dx [mm]', 'dy [mm]'])
    expect(plot.title).toBe('True position')
  })

  it('moves the point out of the circle at dx = 0.12 mm', () => {
    const plot = run('0.12 mm').get('8')!.plot!
    const [dot] = plot.dots
    const [circle] = plot.circles
    expect(Math.hypot(dot.x - circle.cx, dot.y - circle.cy)).toBeGreaterThan(circle.rx)
    expect(Math.hypot(0.08, -0.05)).toBeLessThan(circle.rx)
  })
})
