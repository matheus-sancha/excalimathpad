import { describe, expect, it } from 'vitest'
import { readSolve } from './solveLine.ts'

describe('readSolve (docs/spec-v1.md sections 3 and 9)', () => {
  it('reads the value form, with its search range', () => {
    expect(readSolve('Q_op = solve Hp(Q) = Hs(Q), for Q = 1 L/s .. 30 L/s')).toEqual({
      kind: 'solve',
      name: 'Q_op',
      params: null,
      lhs: 'Hp(Q)',
      rhs: 'Hs(Q)',
      unknown: 'Q',
      guess: null,
      range: { from: '1 L/s', to: '30 L/s' },
    })
    expect(readSolve('x = solve x = max(a, b), for x = min(a, 0) .. 10')).toMatchObject({
      rhs: 'max(a, b)',
      range: { from: 'min(a, 0)', to: '10' },
    })
  })

  it('reads the function form, with commas inside the equation', () => {
    expect(
      readSolve('f(Re, r) = solve 1/sqrt(f) = -2 log10(r/3.7 + 2.51/(Re sqrt(f))), guess f = 0.02'),
    ).toEqual({
      kind: 'solve',
      name: 'f',
      params: ['Re', 'r'],
      lhs: '1/sqrt(f)',
      rhs: '-2 log10(r/3.7 + 2.51/(Re sqrt(f)))',
      unknown: 'f',
      guess: '0.02',
      range: null,
    })
    expect(readSolve('g(a) = solve max(x, a) = 2, guess x = 1')).toMatchObject({ lhs: 'max(x, a)', rhs: '2' })
  })

  it('takes a guess that is any expression, and leaves comparisons in the equation alone', () => {
    expect(readSolve('g(a) = solve (x >= 1) * x = 2, guess x = Q_d * 2')).toMatchObject({
      lhs: '(x >= 1) * x',
      rhs: '2',
      guess: 'Q_d * 2',
    })
  })

  it('leaves lines that only look alike to math.js', () => {
    expect(readSolve('x = solve_rate * 2')).toBeNull()
    expect(readSolve('x = solve(3)')).toBeNull()
    expect(readSolve('x == solve y = 1, for y = 0 .. 1')).toBeNull()
    expect(readSolve('2 * x')).toBeNull()
  })

  it('asks a solved value for a range, and a solve function for a guess, naming the unknown it can see', () => {
    expect(readSolve('Q_op = solve Hp(Q) = Hs(Q)')).toEqual({
      kind: 'malformed',
      name: 'Q_op',
      message: 'solve needs a range: ", for Q = <from> .. <to>"',
    })
    expect(readSolve('Q_op = solve Hp(Q) = Hs(Q), guess Q = 15 L/s')).toMatchObject({
      message: 'solve needs a range: ", for Q = <from> .. <to>"',
    })
    expect(readSolve('h(a) = solve 5 m = y, guess')).toMatchObject({
      message: 'solve needs a guess: ", guess y = <value>"',
    })
    expect(readSolve('h(a) = solve y = a, for y = 0 .. 1')).toMatchObject({
      message: 'a solve function takes a guess: ", guess y = <value>"',
    })
  })

  it('needs two ends and no step', () => {
    for (const clause of ['for x = 0', 'for x = 0 ..', 'for x = 0 .. 2 step 1', 'for x = 0 .. 1 .. 2']) {
      expect(readSolve(`x = solve x = 1, ${clause}`)).toMatchObject({
        kind: 'malformed',
        message: 'for x needs two ends and no step: "for x = <from> .. <to>"',
      })
    }
  })

  it('needs exactly one equation', () => {
    expect(readSolve('x = solve x^2, for x = 0 .. 1')).toMatchObject({
      kind: 'malformed',
      message: 'solve needs one equation: "<left side> = <right side>"',
    })
    expect(readSolve('x = solve a = b = c, for x = 0 .. 1')).toMatchObject({ kind: 'malformed' })
  })
})
