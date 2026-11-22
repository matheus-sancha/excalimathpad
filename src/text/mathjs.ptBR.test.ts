import { describe, expect, it } from 'vitest'
import { evaluateSheet } from '../math/evaluate.ts'
import type { EngineMessage } from '../math/messages.ts'
import { en } from './en.ts'
import { wordMessage } from './engine.ts'
import { MATHJS_PATTERNS, mathjsInPortuguese } from './mathjs.ptBR.ts'
import { ptBR } from './ptBR.ts'

/**
 * math.js's own errors (docs/spec-v1.md section 13, math.js's own errors; ADR
 * 0007). Each known pattern is checked against the text math.js itself
 * throws, read from a line the engine runs, so a math.js upgrade that rewords
 * one fails here. English shows math.js's text as it is.
 */

/** The message of the one line of a one-line sheet. */
function messageOf(line: string): EngineMessage {
  const result = evaluateSheet([{ id: 'a', source: line }]).get('a')![0].result
  if (result.kind !== 'error') throw new Error(`${line} is not an error`)
  return result.message
}

// The line that makes math.js throw each pattern, its text, and the Português.
const KNOWN: readonly (readonly [line: string, mathjs: string, portuguese: string])[] = [
  ['a = (1 + 2', 'Parenthesis ) expected (char 11)', 'Parêntese ) esperado (caractere 11)'],
  ['a = [1, 2', 'End of matrix ] expected (char 10)', 'Fim da matriz ] esperado (caractere 10)'],
  ['a = "abc', 'End of string " expected (char 9)', 'Fim do texto " esperado (caractere 9)'],
  ['a = 3 +', 'Unexpected end of expression (char 8)', 'Fim inesperado da expressão (caractere 8)'],
  ['a = 2 ]', 'Unexpected operator ] (char 7)', 'Operador inesperado ] (caractere 7)'],
  ['a = 3 3', 'Unexpected part "3" (char 7)', 'Parte inesperada "3" (caractere 7)'],
  ['a = 3 +* 2', 'Value expected (char 8)', 'Valor esperado (caractere 8)'],
  ['a = 2 m + 3 s', 'Units do not match', 'As unidades não correspondem'],
  [
    'a = sin(1, 2)',
    'Too many arguments in function sin (expected: 1, actual: 2)',
    'Argumentos demais na função sin (esperado: 1, recebido: 2)',
  ],
  [
    'a = max()',
    'Too few arguments in function max (expected: any, index: 0)',
    'Argumentos de menos na função max (esperado: any, índice: 0)',
  ],
  [
    'a = 1 m + 1',
    'Unexpected type of argument in function addScalar (expected: Unit, actual: number, index: 1)',
    'Tipo de argumento inesperado na função addScalar (esperado: Unit, recebido: number, índice: 1)',
  ],
  ['a = concat([1, 2], [[1]])', 'Dimension mismatch (1 != 2)', 'Dimensões incompatíveis (1 != 2)'],
  [
    'a = [1, 2] * [3, 4, 5]',
    'Dimension mismatch in multiplication. Vectors must have the same length',
    'Dimensões incompatíveis na multiplicação: os vetores devem ter o mesmo comprimento',
  ],
  ['a = sqrt("x")', 'Cannot convert "x" to a number', 'Não é possível converter "x" em número'],
  ['a = det([1, 2])', 'Matrix must be square (size: [2])', 'A matriz deve ser quadrada (tamanho: [2])'],
  [
    'a = gcd(1.5, 2)',
    'Parameters in function gcd must be integer numbers',
    'Os parâmetros da função gcd devem ser números inteiros',
  ],
  ['a = foo', 'Undefined symbol foo', 'Símbolo indefinido foo'],
  ['a = foo(2)', 'Undefined function foo', 'Função indefinida foo'],
  ['a = zeros(2, 2)[3, 1]', 'Index out of range (3 > 2)', 'Índice fora do intervalo (3 > 2)'],
  ['a = 1 kg > 2 m', 'Cannot compare units with different base', 'Não é possível comparar unidades de bases diferentes'],
  [
    'a = inv([1, 2; 2, 4])',
    'Cannot calculate inverse, determinant is zero',
    'Não é possível calcular a inversa: o determinante é zero',
  ],
]

describe('math.js’s own errors, the known patterns (section 13)', () => {
  it.each(KNOWN)('%s: math.js writes its text, worded in Português', (line, mathjs, portuguese) => {
    const message = messageOf(line)
    expect(message).toEqual({ code: 'mathjs', text: mathjs })
    expect(wordMessage(en.engine, message)).toBe(mathjs)
    expect(wordMessage(ptBR.engine, message)).toBe(portuguese)
  })

  it('has a line above for every pattern in the table, and each pattern words only its own text', () => {
    const heads = KNOWN.map(([, mathjs]) => mathjs.replace(/ \(char \d+\)$/, ''))
    for (const { pattern } of MATHJS_PATTERNS) {
      expect(heads.filter((head) => pattern.test(head))).toHaveLength(1)
    }
  })

  it('passes anything else through as math.js wrote it, in both languages', () => {
    const message = messageOf('a = factorial(-1)')
    expect(message).toEqual({ code: 'mathjs', text: 'Value must be non-negative' })
    expect(wordMessage(ptBR.engine, message)).toBe('Value must be non-negative')
    expect(mathjsInPortuguese('Something new (char 4)')).toBe('Something new (char 4)')
  })

  it('words a known error inside the app’s own words: a call’s body, a rule', () => {
    const lines = evaluateSheet([{ id: 'a', source: 'k(t) = t + 1 m\nk(1 s)\nv = 1 m/s @text-red if v > 3 kg' }]).get('a')!
    expect(wordMessage(ptBR.engine, (lines[1].result as { message: EngineMessage }).message)).toBe(
      'em k(1 s): As unidades não correspondem',
    )
    expect(lines[2].warnings.map((warning) => wordMessage(ptBR.engine, warning))).toEqual([
      'if v > 3 kg: As unidades não correspondem',
    ])
  })
})
