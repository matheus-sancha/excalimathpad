import { describe, expect, it } from 'vitest'
import { en } from '../text/en.ts'
import { evaluateSheet } from './evaluate.ts'
import { filterSymbols, SYMBOL_GROUPS, symbolHover, SYMBOLS, type SymbolGroupId } from './symbols.ts'
import { nameTex } from './typeset.ts'

const tab = SYMBOLS.filter((entry) => !entry.hidden)
const spellings = (group: SymbolGroupId) => tab.filter((entry) => entry.group === group).map((entry) => entry.spelling)

describe('the Symbols catalogue (docs/spec-v1.md section 4, Symbols tab)', () => {
  it('holds the five groups, top to bottom', () => {
    expect(SYMBOL_GROUPS.map((group) => en.symbols.groups[group])).toEqual(['Greek', 'Operators', 'Functions', 'Logic', 'Sheet forms'])
  })

  it('Greek: 23 letters (no omicron), the 6 variants on a second row, the 11 capitals unlike Latin', () => {
    const greek = tab.filter((entry) => entry.group === 'greek')
    expect(greek.filter((entry) => entry.row === 1)).toHaveLength(23)
    expect(greek.filter((entry) => entry.row === 1).map((e) => e.spelling)).not.toContain('omicron')
    expect(greek.filter((entry) => entry.row === 2).map((e) => e.spelling)).toEqual([
      'varepsilon', 'vartheta', 'varpi', 'varrho', 'varsigma', 'varphi',
    ])
    expect(greek.filter((entry) => entry.row === 3).map((e) => e.label).join('')).toBe('ΓΔΘΛΞΠΣΥΦΨΩ')
    expect(greek.find((entry) => entry.spelling === 'rho')).toMatchObject({ label: 'ρ', insert: { mode: 'name', text: 'rho' } })
  })

  it('every Greek spelling typesets as its letter', () => {
    for (const entry of tab.filter((each) => each.group === 'greek')) {
      expect(nameTex(entry.spelling), entry.spelling).toBe(`\\${entry.spelling}`)
    }
  })

  it('marks the letters that are also constants, from the constants list', () => {
    const dotted = tab.filter((entry) => entry.constant).map((entry) => entry.spelling)
    expect(dotted).toEqual(expect.arrayContaining(['pi', 'sigma', 'alpha']))
    expect(dotted.sort()).toEqual(['alpha', 'phi', 'pi', 'sigma', 'tau'])
    expect(symbolHover(tab.find((entry) => entry.spelling === 'sigma')!)).toBe(
      'sigma — also the constant Stefan–Boltzmann constant; a sheet may take the name\ntype _ for a subscript: sigma_w',
    )
    expect(symbolHover(tab.find((entry) => entry.spelling === 'rho')!)).toBe('rho — type _ for a subscript: rho_w')
  })

  it('Operators: the spec’s eighteen, each with what it types', () => {
    expect(tab.filter((entry) => entry.group === 'operators').map((entry) => `${entry.label}=${entry.spelling}`)).toEqual([
      '+=+', '−=-', '·=*', '÷=/', 'x²=^2', 'xⁿ=^', '√=sqrt', '∛=cbrt', 'ⁿ√=nthRoot', '|x|=abs', 'n!=!',
      '( )=( )', '[ ]=[ ]', '<=<', '>=>', '≤=<=', '≥=>=',
    ])
  })

  it('Functions: today’s function suggestions in their order, less those in another group', () => {
    expect(spellings('functions')).toEqual([
      'exp', 'log', 'log10', 'log2', 'pow', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh',
      'tanh', 'min', 'max', 'sum', 'mean', 'count', 'round', 'floor', 'ceil', 'sign', 'mod', 'hypot', 'factorial',
    ])
  })

  it('Logic and Sheet forms', () => {
    expect(spellings('logic')).toEqual(['if', '? :', '==', '!=', 'and', 'or', 'not', 'true', 'false', '" "'])
    expect(spellings('forms')).toEqual(['solve', 'for', '..', 'step', 'table', 'plot', 'in', '[ ]'])
  })

  it('a sheet form’s hover shows the whole form, and that form runs', () => {
    expect(symbolHover(tab.find((entry) => entry.spelling === 'solve')!)).toBe(
      'solve — a solved value\nx = solve x^2 = 2, for x = 0 .. 10',
    )
    for (const entry of SYMBOLS.filter((each) => each.example)) {
      const lines = evaluateSheet([{ id: 'a', source: entry.example!.join('\n') }]).get('a')!
      for (const line of lines) expect(line.result.kind, `${entry.spelling}: ${entry.example!.join(' / ')}`).not.toBe('error')
    }
  })

  it('the filter matches the spelling, the letter’s name and the hint', () => {
    const found = (filter: string) => filterSymbols(filter).map((entry) => entry.spelling)
    expect(found('rho')).toEqual(['rho', 'varrho'])
    expect(found('root')).toEqual(['sqrt', 'cbrt', 'nthRoot'])
    expect(found('less')).toEqual(['<', '<='])
    expect(found('  ')).toHaveLength(tab.length)
    // `guess` is a typing suggestion only, never a button.
    expect(found('guess')).toEqual([])
  })
})
