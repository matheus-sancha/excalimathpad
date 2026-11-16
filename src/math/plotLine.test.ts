import { describe, expect, it } from 'vitest'
import { readCircle, readPair, readPlot, splitClauses, writePlotClauses } from './plotLine.ts'

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

  it('reads point, circle and equal (M4e)', () => {
    expect(readPlot('plot(dx, dy), point (a, b), point(c, d), circle T_p / 2, circle (x0, y0) r, equal, points')?.clauses).toEqual([
      { kind: 'point', expression: '(a, b)' },
      { kind: 'point', expression: '(c, d)' },
      { kind: 'circle', expression: 'T_p / 2' },
      { kind: 'circle', expression: '(x0, y0) r' },
      { kind: 'equal' },
      { kind: 'points' },
    ])
  })

  it('reads a pair, and a circle’s centre only when its bracket holds two values', () => {
    expect(readPair('(dx, max(a, b))')).toEqual(['dx', 'max(a, b)'])
    expect(readPair('(dx)')).toBeNull()
    expect(readPair('(a, b) c')).toBeNull()
    expect(readCircle('(1 m, 2 m) r')).toEqual({ centre: ['1 m', '2 m'], radius: 'r' })
    expect(readCircle('(T_p) / 2')).toEqual({ centre: null, radius: '(T_p) / 2' })
    expect(readCircle('T_p / 2')).toEqual({ centre: null, radius: 'T_p / 2' })
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

describe('writePlotClauses (the ⚙ popover)', () => {
  it('replaces the clauses, keeping the call, format and note as typed', () => {
    expect(
      writePlotClauses('plot(Q_s, Hs(Q_s)), mark Q_op @bold # curves', [
        { kind: 'mark', expression: 'Q_op' },
        { kind: 'log', axis: 'x' },
        { kind: 'title', text: 'Say "hi"' },
      ]),
    ).toBe('plot(Q_s, Hs(Q_s)), mark Q_op, x log, title "Say \\"hi\\"" @bold # curves')
  })

  it('takes every clause off, and leaves other lines alone', () => {
    expect(writePlotClauses('plot(x, y), points', [])).toBe('plot(x, y)')
    expect(writePlotClauses('y = 2', [{ kind: 'points' }])).toBe('y = 2')
  })

  it('writes clauses that read back the same', () => {
    const clauses = readPlot('plot(x, y), mark a, point (b, c), circle (0, 1) r, labels direct, points, y log, x 0 .. 10, equal, size S, title "T, U"')!.clauses
    expect(readPlot(writePlotClauses('plot(x, y)', clauses))!.clauses).toEqual(clauses)
  })
})
