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

  it('keeps evaluating after a failed assignment, without its variable', () => {
    const results = evaluateBlock('R = 10 kohm +\nI = 2 mA\nI * R')

    expect(results[0].kind).toBe('error')
    expect(results[1]).toEqual({ kind: 'value', text: '2 mA' })
    expect(results[2]).toEqual({ kind: 'error', message: 'Undefined symbol R' })
  })

  it('rejects Mathcad-style := (plain math.js = only, for now)', () => {
    expect(evaluateBlock('R := 10 kohm')[0].kind).toBe('error')
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

  it('does not share variables between blocks', () => {
    evaluateBlock('x = 5')
    expect(evaluateBlock('x')[0]).toEqual({
      kind: 'error',
      message: 'Undefined symbol x',
    })
  })
})
