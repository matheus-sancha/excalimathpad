import { describe, expect, it } from 'vitest'
import { CONSTANT_GROUPS } from '../math/constants.ts'
import { filterSymbols, symbolHint, symbolHover, SYMBOLS } from '../math/symbols.ts'
import { KINDS } from '../math/unitSystems.ts'
import { constantSuggestions, functionSuggestions, unitSuggestions } from '../overlay/suggest.ts'
import { listConstants } from '../math/evaluate.ts'
import { en } from '../text/en.ts'
import { ptBR } from '../text/ptBR.ts'
import { QUICK_KEYS } from './quickKeys.ts'
import { elementLabel, problemRows, variableGroups } from './sheetPanel.ts'
import { evaluateSheet } from '../math/evaluate.ts'

/**
 * The Sheet panel's catalogues in both text tables (docs/spec-v1.md section
 * 14, 0.6.0; #293): every constant, symbol, kind and quick key the panel
 * draws is worded in English and in Português, keyed by the catalogue, so a
 * new entry with no words fails here rather than showing an empty hint.
 */

const TABLES = { en, 'pt-BR': ptBR } as const

describe.each(Object.entries(TABLES))('the %s table', (_, w) => {
  it('describes every built-in constant, and names every group', () => {
    const description = w.constants.description as Readonly<Record<string, string>>
    const names = CONSTANT_GROUPS.flatMap((group) => group.constants.map(({ name }) => name))
    expect(names).toHaveLength(62)
    expect(Object.keys(description).sort()).toEqual([...names].sort())
    for (const name of names) expect(description[name], name).toMatch(/\S/)
    for (const { id } of CONSTANT_GROUPS) expect(w.constants.groups[id], id).toMatch(/\S/)
  })

  it('gives every symbol a hint, and nothing more', () => {
    for (const entry of SYMBOLS) expect(symbolHint(entry, w), `${entry.group} ${entry.spelling}`).toMatch(/\S/)
    for (const [group, hints] of Object.entries(w.symbols.hints)) {
      const spellings = SYMBOLS.filter((entry) => entry.group === group).map((entry) => entry.spelling)
      expect(Object.keys(hints).sort(), group).toEqual([...new Set(spellings)].sort())
    }
  })

  it('names every kind, with its article', () => {
    expect(Object.keys(w.kinds.name).sort()).toEqual([...KINDS].sort())
    expect(Object.keys(w.kinds.a).sort()).toEqual([...KINDS].sort())
  })

  it('names every quick key', () => {
    for (const key of QUICK_KEYS) expect(w.panel.keys[key.name], key.label).toMatch(/\S/)
  })
})

describe('the panel’s words in Português (0.6.0)', () => {
  it('names an element, a line and a variable’s kind', () => {
    const lines = evaluateSheet([{ id: 'a', source: 'f(x) = 2 * x\ny = 1 m + 1 s' }]).get('a')!
    const sheet = [{ anchorId: 'a', title: null, lines }]
    expect(elementLabel(sheet[0], 0, ptBR)).toBe('Bloco 1')
    expect(variableGroups(sheet, '', ptBR)[0].rows.map((row) => row.value)).toEqual(['função', 'erro'])
    expect(problemRows(sheet, ptBR).map((row) => row.where)).toEqual(['Bloco 1, linha 2 · y'])
  })

  it('words the Symbols hovers and filters by the Portuguese hint', () => {
    const entry = (spelling: string) => SYMBOLS.find((each) => each.spelling === spelling)!
    expect(symbolHover(entry('rho'), ptBR)).toBe('rho — digite _ para um subscrito: rho_w')
    expect(symbolHover(entry('sigma'), ptBR)).toBe(
      'sigma — também a constante Constante de Stefan–Boltzmann; uma folha pode usar o nome\ndigite _ para um subscrito: sigma_w',
    )
    expect(symbolHover(entry('solve'), ptBR)).toBe('solve — um valor resolvido\nx = solve x^2 = 2, for x = 0 .. 10')
    expect(filterSymbols('raiz', SYMBOLS, ptBR).map((each) => each.spelling)).toEqual(['sqrt', 'cbrt'])
  })

  it('words the typing suggestions’ details', () => {
    expect(functionSuggestions(ptBR).find((item) => item.name === 'sqrt')?.detail).toBe('raiz quadrada')
    expect(unitSuggestions(ptBR).find((item) => item.name === 'kPa')?.detail).toBe('Pressão')
    expect(unitSuggestions(ptBR).find((item) => item.name === 'V')?.detail).toBe('Elétrica')
    const c = constantSuggestions(listConstants(), ptBR).find((item) => item.name === 'c')
    expect(c?.detail).toMatch(/^Velocidade da luz no vácuo · /)
  })

  it('carries each count’s plural in the Rules list', () => {
    expect([ptBR.panel.rules.count(4, 30, 'points'), ptBR.panel.rules.count(1, 1, 'rows')]).toEqual(['4 de 30 pontos', '1 de 1 linha'])
    expect([en.panel.rules.count(4, 30, 'points'), en.panel.rules.count(1, 1, 'rows')]).toEqual(['4 of 30 points', '1 of 1 row'])
  })
})
