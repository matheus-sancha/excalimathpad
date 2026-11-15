import { describe, expect, it, vi } from 'vitest'
import { evaluateSheet } from './evaluate.ts'

// A stand-in for a bug: the warnings of a line that mentions `boom` throw,
// outside the line's own error handling.
vi.mock('./warnings.ts', async (original) => {
  const real = await original<typeof import('./warnings.ts')>()
  return {
    ...real,
    lineWarnings: (...args: Parameters<typeof real.lineWarnings>) => {
      if (args[0].toString().includes('boom')) throw new Error('unexpected')
      return real.lineWarnings(...args)
    },
  }
})

describe('an unexpected throw on one line (#179)', () => {
  it('is that line’s error, and the lines around it keep their results', () => {
    const lines = evaluateSheet([
      { id: 'a', source: 'x = 2 m\ny = boom + 1\nx * 3\ny' },
      { id: 'b', source: 'x + 1 m' },
    ])

    expect(lines.get('a')!.map(({ result }) => result)).toEqual([
      { kind: 'empty' },
      { kind: 'error', message: 'unexpected' },
      { kind: 'value', text: '6 m' },
      { kind: 'error', message: 'y has an error above' },
    ])
    expect(lines.get('a')![1].typeset).toEqual({ kind: 'unparsed', source: 'y = boom + 1' })
    expect(lines.get('a')![1].variables).toEqual([{ name: 'y', kind: 'error' }])
    expect(lines.get('b')!.map(({ result }) => result)).toEqual([{ kind: 'value', text: '3 m' }])
  })
})
