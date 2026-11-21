import { describe, expect, it, vi } from 'vitest'
import { evaluateSheet, UNEXPECTED_LINE } from './evaluate.ts'

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

// The same for the parse: reading the form of a line that mentions `parseboom` throws.
vi.mock('./lineForm.ts', async (original) => {
  const real = await original<typeof import('./lineForm.ts')>()
  return {
    ...real,
    readLine: (text: string) => {
      if (text.includes('parseboom')) throw new TypeError('unexpected in the parse')
      return real.readLine(text)
    },
  }
})

describe('an unexpected throw on one line (#179, section 4, Unexpected failures)', () => {
  it('is that line’s error, and the lines around it keep their results', () => {
    const lines = evaluateSheet([
      { id: 'a', source: 'x = 2 m\ny = boom + 1\nx * 3\ny' },
      { id: 'b', source: 'x + 1 m' },
    ])

    expect(lines.get('a')!.map(({ result }) => result)).toEqual([
      { kind: 'empty' },
      { kind: 'error', message: UNEXPECTED_LINE, unexpected: { text: 'Error: unexpected', stack: expect.stringContaining('lineWarnings') as string } },
      { kind: 'value', text: '6 m' },
      { kind: 'error', message: { code: 'errorAbove', name: 'y' } },
    ])
    expect(lines.get('a')![1].typeset).toEqual({ kind: 'unparsed', source: 'y = boom + 1' })
    expect(lines.get('a')![1].variables).toEqual([{ name: 'y', kind: 'error' }])
    expect(lines.get('b')!.map(({ result }) => result)).toEqual([{ kind: 'value', text: '3 m' }])
  })

  it('is the line’s error when its parse throws, and a name it assigns has an error above', () => {
    const lines = evaluateSheet([{ id: 'a', source: 'x = 2 m\ny = parseboom + 1\nx * 3\ny' }]).get('a')!

    expect(lines.map(({ result }) => result)).toEqual([
      { kind: 'empty' },
      { kind: 'error', message: UNEXPECTED_LINE, unexpected: { text: 'TypeError: unexpected in the parse', stack: expect.any(String) as string } },
      { kind: 'value', text: '6 m' },
      { kind: 'error', message: { code: 'errorAbove', name: 'y' } },
    ])
    expect(lines[1].typeset).toEqual({ kind: 'unparsed', source: 'y = parseboom + 1' })
    expect(lines[1].variables).toEqual([{ name: 'y', kind: 'error' }])
  })
})
