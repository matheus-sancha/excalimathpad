import { afterEach, describe, expect, it } from 'vitest'
import { en, type Words } from './en.ts'
import { ptBR } from './ptBR.ts'
import { onLanguage, showLanguage, shownLanguage, words, wordsFor } from './words.ts'

/**
 * The two text tables and the reader (docs/spec-v1.md section 14, 0.6.0: two
 * text tables, one shape; one answer to "which language").
 */

afterEach(() => showLanguage('en'))

/** Every key of a table, nested ones as `group.key`, with what kind of word it holds. */
function shape(table: object, prefix = ''): string[] {
  return Object.entries(table).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null ? shape(value, `${prefix}${key}.`) : [`${prefix}${key}: ${typeof value}`],
  )
}

describe('the two text tables', () => {
  it('have the same keys, each holding the same kind of word', () => {
    expect(shape(ptBR)).toEqual(shape(en))
  })

  it('leave no word empty, and the Portuguese one is not the English one', () => {
    const strings = (table: object): string[] =>
      Object.values(table).flatMap((value) => (typeof value === 'object' ? strings(value) : typeof value === 'string' ? [value] : []))
    expect(strings(en).every((word) => word.trim().length > 0)).toBe(true)
    expect(strings(ptBR).every((word) => word.trim().length > 0)).toBe(true)
    expect(ptBR.menu.open).not.toBe(en.menu.open)
  })

  it('give a count its own plural in each language', () => {
    expect([en.tools.errors(1), en.tools.errors(3)]).toEqual(['1 error', '3 errors'])
    expect([ptBR.tools.errors(1), ptBR.tools.errors(3)]).toEqual(['1 erro', '3 erros'])
  })

  // The type check is the test: `tsc -b` fails when either line below stops
  // being an error, so a table missing a key, or adding one alone, never builds.
  it('fail the type check with a key missing or a key added', () => {
    const { open: _open, ...withoutOpen } = en.menu
    // @ts-expect-error: a table without `menu.open` isn't a text table.
    const missing: Words = { ...en, menu: withoutOpen }
    // @ts-expect-error: a key only one table has isn't a key.
    const extra: Words = { ...en, menu: { ...en.menu, opened: 'Aberto' } }
    // @ts-expect-error: a count is a function of it, never a fixed word.
    const fixed: Words = { ...en, tools: { ...en.tools, errors: 'errors' } }
    expect([missing, extra, fixed, _open]).toHaveLength(4)
  })
})

describe('the reader', () => {
  it('answers English until the canvas shows another language', () => {
    expect(shownLanguage()).toBe('en')
    expect(words()).toBe(en)
  })

  it('answers the language shown, and tells each listener once of a change', () => {
    const heard: string[] = []
    const stop = onLanguage(() => heard.push(shownLanguage()))
    showLanguage('pt-BR')
    showLanguage('pt-BR')
    expect(words()).toBe(ptBR)
    expect(words().menu.mathGuide).toBe('Guia de cálculo')
    stop()
    showLanguage('en')
    expect(heard).toEqual(['pt-BR'])
    expect(words()).toBe(en)
  })

  it('gives either table by its language, whichever is shown', () => {
    showLanguage('pt-BR')
    expect(wordsFor('en')).toBe(en)
    expect(wordsFor('pt-BR')).toBe(ptBR)
  })
})
