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

  it('reads a unit that starts with the inch whole (#229)', () => {
    expect(readTable('table(A in in^2, v in in/s, D in in)')).toEqual({
      args: [
        { expression: 'A', displayUnit: 'in^2' },
        { expression: 'v', displayUnit: 'in/s' },
        { expression: 'D', displayUnit: 'in' },
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
    expect(writeArgumentUnit('table(A in in^2, H_s)', 0, null)).toBe('table(A, H_s)')
  })

  it('replaces a unit that starts with the inch (#229)', () => {
    expect(writeArgumentUnit('table(A, H_s)', 0, 'in^2')).toBe('table(A in in^2, H_s)')
    expect(writeArgumentUnit('table(A in in^2, H_s)', 0, 'cm^2')).toBe('table(A in cm^2, H_s)')
    expect(writeArgumentUnit('plot(Q_s, A in in^2), x log', 1, 'ft^2')).toBe('plot(Q_s, A in ft^2), x log')
  })
})
