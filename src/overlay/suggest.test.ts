import { describe, expect, it } from 'vitest'
import { evaluateSheet, listConstants } from '../math/evaluate.ts'
import {
  accept,
  constantSuggestions,
  FUNCTION_SUGGESTIONS,
  sheetNames,
  suggest,
  unitSuggestions,
  wordAt,
  type SuggestSources,
  type Suggestion,
} from './suggest.ts'

const variable = (name: string, detail = '1'): Suggestion => ({ name, kind: 'variable', detail, insert: name })

const sources = (sheet: Suggestion[] = []): SuggestSources => ({
  sheet,
  constants: constantSuggestions(listConstants()),
  functions: FUNCTION_SUGGESTIONS,
  units: unitSuggestions(),
})

const names = (text: string, sheet: Suggestion[] = [], caret = text.length) =>
  suggest(text, caret, sources(sheet))?.items.map((item) => item.name) ?? null

describe('wordAt', () => {
  it('is the name that ends at the caret', () => {
    expect(wordAt('P = rho * gr', 12)).toEqual({ from: 10, word: 'gr', unitsOnly: false })
    expect(wordAt('H_s', 3)).toEqual({ from: 0, word: 'H_s', unitsOnly: false })
  })

  it('is nothing inside a word, after a number, in a comment or in a quoted title', () => {
    expect(wordAt('speed', 3)).toBeNull()
    expect(wordAt('x = 10k', 7)).toBeNull()
    expect(wordAt('x = 2e', 6)).toBeNull()
    expect(wordAt('x = 1 # no', 10)).toBeNull()
    expect(wordAt('plot(x, y), title "Sys', 22)).toBeNull()
    expect(wordAt('x = ', 4)).toBeNull()
  })

  it('reads units only after in or to', () => {
    expect(wordAt('v = 2 m/s in k', 14)?.unitsOnly).toBe(true)
    expect(wordAt('v = 2 m/s to km/h', 17)?.unitsOnly).toBe(true)
    expect(wordAt('table(Q in L/s, H in m', 22)?.unitsOnly).toBe(true)
    expect(wordAt('inlet = p', 9)?.unitsOnly).toBe(false)
  })
})

describe('suggest', () => {
  it('offers the sheet’s names first, then the rest with shorter names first', () => {
    expect(names('x = sp', [variable('speed'), variable('sp_max')])).toEqual(['speed', 'sp_max', 'speedOfLight'])
    expect(names('x = c')).toEqual(['cm', 'cP', 'cos', 'cfm', 'cSt', 'cbrt', 'ceil', 'cosh'])
  })

  it('offers nothing after a unit typed in full, and again from the next letter', () => {
    expect(names('v = 3 m/s')).toBeNull()
    expect(names('x = 5 m')).toBeNull()
    expect(names('x = si')).toEqual(['sin', 'sign', 'sinh', 'sigma'])
  })

  it('matches from the start of a name, the same capitals first', () => {
    expect(names('x = sq')).toEqual(['sqrt', 'SQRT2', 'SQRT1_2'])
    expect(names('x = SQ')).toEqual(['SQRT2', 'SQRT1_2', 'sqrt'])
    expect(names('x = gra')).toEqual(['gravity', 'gravitationConstant'])
    expect(names('x = sp')).toEqual(['speedOfLight'])
  })

  it('leaves out a name already typed in full, and offers nothing when no name starts with the word', () => {
    // `sqrt` is typed: `SQRT2` differs in its capitals, so it stays away.
    expect(names('x = sqrt')).toBeNull()
    expect(names('x = zzz')).toBeNull()
    expect(names('x = ')).toBeNull()
  })

  it('offers a name once: the sheet’s own wins over a constant of the same name', () => {
    const items = suggest('x = R_', 6, sources([variable('R_1', '10 kohm'), variable('R_inf', '5')]))?.items ?? []
    expect(items.map((item) => [item.name, item.kind])).toEqual([
      ['R_1', 'variable'],
      ['R_inf', 'variable'],
    ])
    expect(names('x = R_')).toEqual(['R_inf'])
  })

  it('offers only units after in or to', () => {
    expect(names('v = 2 m/s in k')).toEqual(['kg', 'kJ', 'km', 'kN', 'kV', 'kW', 'kgf', 'kHz'])
    expect(names('v = 2 m/s in km/h')).toEqual(['hp', 'hr', 'hour', 'H', 'Hz'])
  })

  it('shows at most eight', () => {
    expect(names('x = c')?.length).toBe(8)
  })
})

describe('accept', () => {
  it('replaces the typed word and puts the caret after it', () => {
    const suggested = suggest('y = sq * 2', 6, sources())!
    expect(accept('y = sq * 2', suggested, suggested.items[0])).toEqual({ text: 'y = sqrt( * 2', caret: 9 })
  })
})

describe('sheetNames', () => {
  const blocks = (list: { id: string; source: string }[]) => {
    const lines = evaluateSheet(list)
    return list.map(({ id }) => ({ id, lines: lines.get(id)! }))
  }

  it('lists the names defined above the line, the nearest first, with their values', () => {
    const sheet = blocks([
      { id: 'a', source: 'D = 100 mm\nf(x) = x^2' },
      { id: 'b', source: 'L = 2 m\nA = D * L\nz = 1' },
    ])
    expect(sheetNames(sheet, { anchorId: 'b', lineIndex: 1 })).toEqual([
      { name: 'L', kind: 'variable', detail: '2 m', insert: 'L' },
      { name: 'f', kind: 'function', detail: 'f(x)', insert: 'f(' },
      { name: 'D', kind: 'variable', detail: '100 mm', insert: 'D' },
    ])
  })

  it('stops at the line being edited, in the first element too', () => {
    const sheet = blocks([{ id: 'a', source: 'D = 100 mm\nq = 1\nz = 2' }])
    expect(sheetNames(sheet, { anchorId: 'a', lineIndex: 0 })).toEqual([])
    expect(sheetNames(sheet, { anchorId: 'a', lineIndex: 2 }).map((item) => item.name)).toEqual(['q', 'D'])
  })
})

describe('the fixed lists', () => {
  it('every function, constant and unit is a name the engine reads', () => {
    const all = [...FUNCTION_SUGGESTIONS.filter((item) => item.kind === 'function'), ...constantSuggestions(listConstants()), ...unitSuggestions()]
    for (const item of all) {
      if (item.name === 'plot' || item.name === 'table') continue
      const source = item.kind === 'unit' ? `1 ${item.name}` : `u = ${item.name}`
      const [line] = evaluateSheet([{ id: 'a', source }]).get('a')!
      expect(line.result.kind, `${item.kind} ${item.name}`).not.toBe('error')
    }
  })
})

describe('suggestions in a format clause (docs/spec-v1.md section 4, Suggestions, M4c)', () => {
  const none = { sheet: [], constants: [], functions: [], units: [] }
  const names = (text: string) => suggest(text, text.length, none)?.items.map((item) => item.name) ?? null

  it('offers the format words after @, filtered by what is typed', () => {
    expect(names('v = 1 @')).toEqual(['bold', 'underline', 'text-black', 'text-blue', 'text-red', 'text-green', 'text-orange', 'text-gray'])
    expect(names('v = 1 @text-r')).toEqual(['text-red'])
    expect(names('v = 1 @y')).toEqual(['yellow'])
    expect(suggest('v = 1 @text-r', 13, none)).toMatchObject({ from: 7, to: 13 })
  })

  it('offers if after a whole format word', () => {
    expect(names('v = 1 @text-red ')).toEqual(['if'])
    expect(names('v = 1 @text-red i')).toEqual(['if'])
    expect(names('v = 1 @blod ')).toBeNull()
  })

  it('offers nothing in a note or a string', () => {
    expect(names('v = 1 # @')).toBeNull()
    expect(names('s = "@')).toBeNull()
  })
})
