import { describe, expect, it } from 'vitest'
import { readPlot, splitClauses } from './plotLine.ts'

describe('readPlot (docs/spec-v1.md section 10, Plots)', () => {
  it('reads the arguments, each with its own unit, and the clauses', () => {
    expect(readPlot('plot(Q_s in L/s, Hs(Q_s), Hp(Q_s)), mark Q_op')).toEqual({
      args: [
        { expression: 'Q_s', displayUnit: 'L/s' },
        { expression: 'Hs(Q_s)', displayUnit: null },
        { expression: 'Hp(Q_s)', displayUnit: null },
      ],
      clauses: [{ kind: 'mark', expression: 'Q_op' }],
    })
  })

  it('reads every setting', () => {
    const plot = readPlot(
      'plot(x, y), mark a, mark max(b, c), labels direct, points, x log, y log, x 0 .. 10, y 0 m .. 40 m, size L, title "Pump, system"',
    )
    expect(plot?.clauses).toEqual([
      { kind: 'mark', expression: 'a' },
      { kind: 'mark', expression: 'max(b, c)' },
      { kind: 'labels-direct' },
      { kind: 'points' },
      { kind: 'log', axis: 'x' },
      { kind: 'log', axis: 'y' },
      { kind: 'range', axis: 'x', start: '0', end: '10' },
      { kind: 'range', axis: 'y', start: '0 m', end: '40 m' },
      { kind: 'size', size: 'L' },
      { kind: 'title', text: 'Pump, system' },
    ])
  })

  it('keeps an unknown clause, for the line’s error', () => {
    expect(readPlot('plot(x, y), wobble')?.clauses).toEqual([{ kind: 'unknown', text: 'wobble' }])
    expect(readPlot('plot(x, y), size XL')?.clauses).toEqual([{ kind: 'unknown', text: 'size XL' }])
  })

  it('reads only a plot(…) call at the start, followed by clauses', () => {
    expect(readPlot('plot(x, y) * 2')).toBeNull()
    expect(readPlot('y = plot(x)')).toBeNull()
    expect(readPlot('plots(x, y)')).toBeNull()
  })

  it('splits clauses at top-level commas only', () => {
    expect(splitClauses(' mark max(a, b), title "a, b"')).toEqual(['mark max(a, b)', 'title "a, b"'])
  })
})
