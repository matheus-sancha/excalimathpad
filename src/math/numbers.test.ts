import { describe, expect, it } from 'vitest'
import { leadingNumber, numberTex, plainNumbers } from './numbers.ts'

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
