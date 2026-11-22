/**
 * math.js's own errors in Português (docs/spec-v1.md section 13, math.js's own
 * errors; ADR 0007). math.js words its errors in English and doesn't
 * translate, so the known ones are matched here by pattern, on math.js
 * 15.2's exact text, and worded in Português; a trailing ` (char N)` becomes
 * ` (caractere N)`. Anything else passes through as math.js wrote it.
 *
 * Each pattern has a test against math.js's own text (`mathjs.ptBR.test.ts`),
 * so a math.js upgrade that rewords one fails CI. The list is section 13's
 * table.
 */

/** math.js's list of types, `number or Complex or BigNumber`, with its `or` in Português. */
const types = (text: string) => text.replace(/ or /g, ' ou ')

/** One known pattern: math.js's text, whole, and its wording. */
interface KnownPattern {
  pattern: RegExp
  words: (match: RegExpExecArray) => string
}

export const MATHJS_PATTERNS: readonly KnownPattern[] = [
  { pattern: /^Parenthesis (\S+) expected$/, words: ([, p]) => `Parêntese ${p} esperado` },
  { pattern: /^End of matrix \] expected$/, words: () => 'Fim da matriz ] esperado' },
  { pattern: /^End of string " expected$/, words: () => 'Fim do texto " esperado' },
  { pattern: /^Unexpected end of expression$/, words: () => 'Fim inesperado da expressão' },
  { pattern: /^Unexpected operator (.+)$/, words: ([, op]) => `Operador inesperado ${op}` },
  { pattern: /^Unexpected part "(.*)"$/, words: ([, part]) => `Parte inesperada "${part}"` },
  { pattern: /^Value expected$/, words: () => 'Valor esperado' },
  { pattern: /^Units do not match$/, words: () => 'As unidades não correspondem' },
  {
    pattern: /^Too many arguments in function (\S+) \(expected: (.+), actual: (.+)\)$/,
    words: ([, fn, expected, actual]) => `Argumentos demais na função ${fn} (esperado: ${expected}, recebido: ${actual})`,
  },
  {
    pattern: /^Too few arguments in function (\S+) \(expected: (.+), index: (\d+)\)$/,
    words: ([, fn, expected, index]) => `Argumentos de menos na função ${fn} (esperado: ${types(expected)}, índice: ${index})`,
  },
  {
    pattern: /^Unexpected type of argument in function (\S+) \(expected: (.+), actual: (.+), index: (\d+)\)$/,
    words: ([, fn, expected, actual, index]) =>
      `Tipo de argumento inesperado na função ${fn} (esperado: ${types(expected)}, recebido: ${actual}, índice: ${index})`,
  },
  { pattern: /^Dimension mismatch \((.+)\)$/, words: ([, sizes]) => `Dimensões incompatíveis (${sizes})` },
  {
    pattern: /^Dimension mismatch in multiplication\. Vectors must have the same length$/,
    words: () => 'Dimensões incompatíveis na multiplicação: os vetores devem ter o mesmo comprimento',
  },
  { pattern: /^Cannot convert "(.*)" to a number$/, words: ([, text]) => `Não é possível converter "${text}" em número` },
  { pattern: /^Matrix must be square \(size: (.+)\)$/, words: ([, size]) => `A matriz deve ser quadrada (tamanho: ${size})` },
  {
    pattern: /^Parameters in function (\S+) must be integer numbers$/,
    words: ([, fn]) => `Os parâmetros da função ${fn} devem ser números inteiros`,
  },
  { pattern: /^Undefined symbol (\S+)$/, words: ([, name]) => `Símbolo indefinido ${name}` },
  { pattern: /^Undefined function (\S+)$/, words: ([, name]) => `Função indefinida ${name}` },
  { pattern: /^Index out of range \((.+)\)$/, words: ([, sizes]) => `Índice fora do intervalo (${sizes})` },
  {
    pattern: /^Cannot compare units with different base$/,
    words: () => 'Não é possível comparar unidades de bases diferentes',
  },
  {
    pattern: /^Cannot calculate inverse, determinant is zero$/,
    words: () => 'Não é possível calcular a inversa: o determinante é zero',
  },
]

// math.js's position suffix on a parse error (pinned by the tests).
const CHAR = / \(char (\d+)\)$/

/** A math.js error's text in Português: a known pattern worded, anything else as math.js wrote it. */
export function mathjsInPortuguese(text: string): string {
  const char = CHAR.exec(text)
  const head = char === null ? text : text.slice(0, char.index)
  for (const { pattern, words } of MATHJS_PATTERNS) {
    const match = pattern.exec(head)
    if (match !== null) return `${words(match)}${char === null ? '' : ` (caractere ${char[1]})`}`
  }
  return text
}
