import { describe, expect, it } from 'vitest'
import { leadingNumber, numberTex, plainNumbers, tableColumn } from './numbers.ts'

describe('plainNumbers (section 5, Numbers)', () => {
  it.each([
    ['1.235e+4', '1.235·10⁴'],
    ['1.86e+5 m', '1.86·10⁵ m'],
    ['4.399e-4', '4.399·10⁻⁴'],
    ['1e+15 Pa', '1·10¹⁵ Pa'],
    ['Infinity', '∞'],
    ['-Infinity', '-∞'],
    ['NaN', 'NaN'],
    ['2 + 3i', '2 + 3i'],
    ['12.35 MPa', '12.35 MPa'],
  ])('%s reads %s', (text, plain) => {
    expect(plainNumbers(text)).toBe(plain)
  })
})

describe('leadingNumber', () => {
  it('splits the number from the unit', () => {
    expect(leadingNumber('-1.235·10⁻⁴ m / s')).toEqual({ number: '-1.235·10⁻⁴', rest: ' m / s' })
    expect(leadingNumber('∞')).toEqual({ number: '∞', rest: '' })
  })

  it('is null for text that does not start with a number', () => {
    expect(leadingNumber('NaN')).toBeNull()
    expect(leadingNumber('[1, 2]')).toBeNull()
  })
})

describe('numberTex', () => {
  it.each([
    ['1234', '1234'],
    ['1.235·10⁴', '1.235 \\cdot 10^{4}'],
    ['-4.399·10⁻⁴', '-4.399 \\cdot 10^{-4}'],
    ['∞', '\\infty'],
  ])('%s as %s', (number, tex) => {
    expect(numberTex(number)).toBe(tex)
  })
})

describe('tableColumn (section 5: a table column keeps its zeros)', () => {
  it('pads to the significant digits, scientific values included; zero stays 0', () => {
    expect(tableColumn(['24.8', '20', '0.0186', '1.86·10⁵', '0', '-3.5'], 4)).toEqual([
      '24.80',
      '20.00',
      '0.01860',
      '1.860·10⁵',
      '0',
      '-3.500',
    ])
  })

  it('keeps a whole-number column whole', () => {
    expect(tableColumn(['1', '19', '30'], 4)).toEqual(['1', '19', '30'])
  })
})
