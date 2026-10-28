import { describe, expect, it, vi } from 'vitest'
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

    // Regression (PR #5 review, round 3): simplifyCore parses with the real
    // parser, and the returned Node evaluates against the shared namespace,
    // where `typed` is the real registry, not the per-block stub.
    it('typed cannot be reached through a parsed Node', async () => {
      // A fresh engine, so sqrt/cos/to are first built after the attack.
      vi.resetModules()
      const fresh = await import('./evaluate.ts')

      fresh.evaluateBlock('n = simplifyCore("typed.clear()")\nn.evaluate()')

      expect(fresh.evaluateBlock('20 V to mV\nsqrt(16)\ncos(0)')).toEqual([
        { kind: 'value', text: '20000 mV' },
        { kind: 'value', text: '4' },
        { kind: 'value', text: '1' },
      ])
    })

    // Regression (PR #5 review, round 2): math.js exposes its `typed` registry
    // to expressions. typed.clear() broke every function not yet built (in
    // all blocks, until reload); typed.addConversion() leaked into other
    // blocks and failed on re-evaluation.
    it('typed cannot break or extend the engine for other blocks', () => {
      const addConversion =
        'g(x) = 0\ntyped.addConversion({from: "boolean", to: "Unit", convert: g})'
      evaluateBlock('typed.clear()')
      evaluateBlock(addConversion)

      // Functions this file has not used yet, so they are built after clear().
      expect(evaluateBlock('20 V to mV\nsqrt(16)\ncos(0)\nmean(1, 2, 3)')).toEqual([
        { kind: 'value', text: '20000 mV' },
        { kind: 'value', text: '4' },
        { kind: 'value', text: '1' },
        { kind: 'value', text: '2' },
      ])
      // No boolean -> Unit conversion leaked in.
      expect(evaluateBlock('true + 1 V')[0].kind).toBe('error')
    })

    it('reports typed methods as errors, the same on every evaluation', () => {
      const source =
        'typed.clear()\ng(x) = 0\ntyped.addConversion({from: "boolean", to: "Unit", convert: g})'
      const first = evaluateBlock(source)

      expect(evaluateBlock(source)).toEqual(first)
      expect(first[0]).toEqual({ kind: 'error', message: 'No access to method "clear"' })
      expect(first[2]).toEqual({
        kind: 'error',
        message: 'No access to method "addConversion"',
      })
    })

    // Why the other stubs live in the namespace, not the block scope: a
    // scope-only stub is bypassed through parser(), which resolves names in
    // the namespace.
    it('cannot reach the disabled functions through parser()', () => {
      const viaParser = evaluateBlock(
        'p = parser()\np.evaluate("createUnit(\\"knot2\\", \\"1 m/s\\")")',
      )

      expect(viaParser[1]).toEqual({
        kind: 'error',
        message: 'evaluate is not supported in a math element',
      })
      expect(evaluateBlock('2 knot2')[0]).toEqual({
        kind: 'error',
        message: 'Undefined symbol knot2',
      })
    })

    it("keeps a user's own `typed` variable local to its block", () => {
      expect(evaluateBlock('typed = 1\ntyped + 1')[1]).toEqual({
        kind: 'value',
        text: '2',
      })
      expect(evaluateBlock('typed.clear()')[0].kind).toBe('error')
    })
  })
})
