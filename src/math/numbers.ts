/**
 * How a number reads (docs/spec-v1.md section 5, Numbers). Pure: it takes the
 * text `math.format` wrote with `formatOptions` and turns it into the sheet's
 * plain-text form, which is what a result carries and what the typeset cell is
 * built from.
 */

/** Significant digits when the sheet sets none (section 5). */
export const DEFAULT_DIGITS = 4

/**
 * `math.format`'s options for a result at `digits` significant digits:
 * scientific at 10^digits and above and below 0.001, so no digit is invented
 * (section 14, Number format). Trailing zeros are dropped.
 */
export function formatOptions(digits: number) {
  return { precision: digits, notation: 'auto', lowerExp: -3, upperExp: digits } as const
}

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
}

const DIGIT = Object.fromEntries(Object.entries(SUPERSCRIPT).map(([plain, sup]) => [sup, plain]))

/**
 * `math.format`'s text in the sheet's plain form: `1.235e+4` becomes
 * `1.235·10⁴` and `Infinity` becomes `∞` (`math.format` already writes `-0`
 * as `0`). Anything else (a unit, a complex number's `i`) is left as written.
 */
export function plainNumbers(text: string): string {
  return text
    .replace(/(\d)e([+-])(\d+)/g, (_, digit: string, sign: string, exponent: string) => {
      const power = `${sign === '-' ? '-' : ''}${exponent.replace(/^0+(?=\d)/, '')}`
      return `${digit}·10${[...power].map((char) => SUPERSCRIPT[char]).join('')}`
    })
    .replace(/\bInfinity\b/g, '∞')
}

/**
 * The number at the start of a plain result (`-1.235·10⁴`, `∞`), split from
 * what follows it. Null when the text doesn't start with one.
 */
export function leadingNumber(text: string): { number: string; rest: string } | null {
  const match = /^(-?(?:∞|\d[\d.]*(?:·10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)?))(.*)$/s.exec(text)
  return match ? { number: match[1], rest: match[2] } : null
}

/** A plain number (`1.235·10⁻⁴`, `-∞`) as TeX: `1.235 \cdot 10^{-4}`. */
export function numberTex(number: string): string {
  if (/^-?∞$/.test(number)) return number.replace('∞', '\\infty')
  const scientific = /^(-?[\d.]+)·10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/.exec(number)
  if (!scientific) return number
  const power = [...scientific[2]].map((char) => DIGIT[char]).join('')
  return `${scientific[1]} \\cdot 10^{${power}}`
}

/**
 * A column of plain numbers as a table shows them (section 5, Numbers): each
 * padded with trailing zeros to `digits` significant digits (`24.8` → `24.80`,
 * `1.86·10⁵` → `1.860·10⁵`), unless every number in the column is whole, which
 * stays whole (`1`, `19`, `30`). Zero stays `0`.
 */
export function tableColumn(numbers: readonly string[], digits: number): string[] {
  const whole = numbers.every((number) => /^-?\d+$/.test(number))
  return whole ? [...numbers] : numbers.map((number) => padNumber(number, digits))
}

function padNumber(number: string, digits: number): string {
  const match = /^(-?)(\d+)(?:\.(\d*))?(·10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)?$/.exec(number)
  if (!match) return number
  const [, sign, whole, fraction = '', power = ''] = match
  const significant = `${whole}${fraction}`.replace(/^0+/, '')
  if (significant === '') return number
  const missing = digits - significant.length
  if (missing <= 0) return number
  return `${sign}${whole}.${fraction}${'0'.repeat(missing)}${power}`
}
