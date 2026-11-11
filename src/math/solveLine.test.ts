import { describe, expect, it } from 'vitest'
import { readSolve } from './solveLine.ts'

describe('readSolve (docs/spec-v1.md sections 3 and 9)', () => {
  it('reads the value form', () => {
    expect(readSolve('Q_op = solve Hp(Q) = Hs(Q), guess Q = 15 L/s')).toEqual({
      kind: 'solve',
      name: 'Q_op',
      params: null,
      lhs: 'Hp(Q)',
      rhs: 'Hs(Q)',
      unknown: 'Q',
      guess: '15 L/s',
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
    })
    expect(readSolve('g(a) = solve max(x, a) = 2, guess x = 1')).toMatchObject({ lhs: 'max(x, a)', rhs: '2' })
  })

  it('takes a guess that is any expression, and leaves comparisons in the equation alone', () => {
    expect(readSolve('x = solve (x >= 1) * x = 2, guess x = Q_d * 2')).toMatchObject({
      lhs: '(x >= 1) * x',
      rhs: '2',
      guess: 'Q_d * 2',
    })
  })

  it('leaves lines that only look alike to math.js', () => {
    expect(readSolve('x = solve_rate * 2')).toBeNull()
    expect(readSolve('x = solve(3)')).toBeNull()
    expect(readSolve('x == solve y = 1, guess y = 1')).toBeNull()
    expect(readSolve('2 * x')).toBeNull()
  })

  it('needs a guess, naming the unknown it can see', () => {
    expect(readSolve('Q_op = solve Hp(Q) = Hs(Q)')).toEqual({
      kind: 'malformed',
      name: 'Q_op',
      message: 'solve needs a guess: ", guess Q = <value>"',
    })
    expect(readSolve('x = solve 5 m = y, guess')).toMatchObject({
      message: 'solve needs a guess: ", guess y = <value>"',
    })
  })

  it('needs exactly one equation', () => {
    expect(readSolve('x = solve x^2, guess x = 1')).toMatchObject({
      kind: 'malformed',
      message: 'solve needs one equation: "<left side> = <right side>"',
    })
    expect(readSolve('x = solve a = b = c, guess x = 1')).toMatchObject({ kind: 'malformed' })
  })
})
