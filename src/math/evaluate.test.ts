import { describe, expect, it } from 'vitest'
import { evaluateBlock } from './evaluate.ts'

describe('evaluateBlock', () => {
  it('evaluates I * R with units to 20 V (milestone M1)', () => {
    expect(evaluateBlock('R = 10 kohm\nI = 2 mA\nI * R')).toEqual([
      { kind: 'value', text: '10 kohm' },
      { kind: 'value', text: '2 mA' },
      { kind: 'value', text: '20 V' },
    ])
  })

  it('reports incompatible units as an error on that line only', () => {
    const results = evaluateBlock('R = 10 kohm\nI = 2 mA\nR + I\nI * R')

    expect(results[2]).toEqual({ kind: 'error', message: 'Units do not match' })
    expect(results[3]).toEqual({ kind: 'value', text: '20 V' })
  })

  it('keeps evaluating after an undefined symbol on an early line', () => {
    expect(evaluateBlock('foo + 1\n2 + 2')).toEqual([
      { kind: 'error', message: 'Undefined symbol foo' },
      { kind: 'value', text: '4' },
    ])
  })

  it('keeps evaluating after a failed assignment, without its variable', () => {
    const results = evaluateBlock('R = 10 kohm +\nI = 2 mA\nI * R')

    expect(results[0]).toEqual({
      kind: 'error',
      message: 'Unexpected end of expression (char 14)',
    })
    expect(results[1]).toEqual({ kind: 'value', text: '2 mA' })
    expect(results[2]).toEqual({ kind: 'error', message: 'Undefined symbol R' })
  })

  it('rejects Mathcad-style := (plain math.js = only, for now)', () => {
    expect(evaluateBlock('R := 10 kohm')).toEqual([
      { kind: 'error', message: 'Value expected (char 4)' },
    ])
  })

  it('returns one result per line, blank and comment lines as empty', () => {
    expect(evaluateBlock('\n  \n# note\nCRLF = 1\r\n2 * CRLF')).toEqual([
      { kind: 'empty' },
      { kind: 'empty' },
      { kind: 'empty' },
      { kind: 'value', text: '1' },
      { kind: 'value', text: '2' },
    ])
  })

  describe('isolation', () => {
    it('does not share variables between blocks', () => {
      evaluateBlock('x = 5')
      expect(evaluateBlock('x')[0]).toEqual({
        kind: 'error',
        message: 'Undefined symbol x',
      })
    })

    // Regression (PR #5 review): createUnit mutated the shared instance, so
    // re-evaluating the same block (every keystroke) failed the second time,
    // and the unit leaked into other blocks.
    it('gives the same results when the same block is evaluated again', () => {
      const source = 'createUnit("knot", "0.514444 m/s")\nI = 2 mA\nI * 10 kohm'
      const first = evaluateBlock(source)

      expect(evaluateBlock(source)).toEqual(first)
      expect(first[0]).toEqual({
        kind: 'error',
        message: 'createUnit is not supported in a math element',
      })
      expect(first[2]).toEqual({ kind: 'value', text: '20 V' })
    })

    it('cannot change the engine for other blocks', () => {
      evaluateBlock('createUnit("knot", "0.514444 m/s")')
      evaluateBlock('config({number: "BigNumber"})')
      evaluateBlock('import({ pi: 3 }, { override: true })')

      expect(evaluateBlock('2 knot')[0]).toEqual({
        kind: 'error',
        message: 'Undefined symbol knot',
      })
      expect(evaluateBlock('typeOf(0.1)')[0]).toEqual({
        kind: 'value',
        text: '"number"',
      })
      expect(evaluateBlock('pi')[0]).toEqual({
        kind: 'value',
        text: '3.1415926535898',
      })
    })

    it('reports each disabled function as unsupported', () => {
      for (const call of [
        'config({number: "BigNumber"})',
        'evaluate("1 + 1")',
        'parse("1 + 1")',
        'compile("1 + 1")',
        'simplify("x + x")',
      ]) {
        expect(evaluateBlock(call)[0]).toMatchObject({
          kind: 'error',
          message: expect.stringMatching(/is not supported in a math element$/),
        })
      }
    })
  })
})
