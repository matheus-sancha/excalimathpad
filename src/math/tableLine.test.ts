import { describe, expect, it } from 'vitest'
import { readTable, writeArgumentUnit } from './tableLine.ts'

describe('readTable (docs/spec-v1.md section 10, Tables)', () => {
  it('reads each argument, with its own display unit', () => {
    expect(readTable('table(Q_s in L/s, Hs(Q_s), max(a, b) in m)')).toEqual({
      args: [
        { expression: 'Q_s', displayUnit: 'L/s' },
        { expression: 'Hs(Q_s)', displayUnit: null },
        { expression: 'max(a, b)', displayUnit: 'm' },
      ],
    })
  })

  it('reads only a whole table(…) call', () => {
    expect(readTable('table(x) * 2')).toBeNull()
    expect(readTable('tables(x)')).toBeNull()
    expect(readTable('x = table(1)')).toBeNull()
    expect(readTable('table()')).toEqual({ args: [] })
  })
})

describe('writeArgumentUnit (a column header’s unit slot)', () => {
  it('writes or replaces one argument’s unit, and keeps the rest as typed', () => {
    expect(writeArgumentUnit('table(Q_s, Hs(Q_s)) @bold # note', 1, 'cm')).toBe('table(Q_s, Hs(Q_s) in cm) @bold # note')
    expect(writeArgumentUnit('table(Q_s in L/s, H_s)', 0, 'L/minute')).toBe('table(Q_s in L/minute, H_s)')
  })

  it('takes a unit off for Sheet units', () => {
    expect(writeArgumentUnit('table(Q_s in L/s, H_s)', 0, null)).toBe('table(Q_s, H_s)')
  })
})
