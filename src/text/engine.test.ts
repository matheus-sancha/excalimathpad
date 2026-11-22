import { afterEach, describe, expect, it } from 'vitest'
import { evaluateSheet } from '../math/evaluate.ts'
import type { EngineMessage } from '../math/messages.ts'
import { planRename } from '../math/rename.ts'
import { en } from './en.ts'
import { wordMessage, wordPreview } from './engine.ts'
import { ptBR } from './ptBR.ts'
import { showLanguage, words } from './words.ts'

/**
 * The engine's messages in words (ADR 0007; docs/spec-v1.md section 13, and
 * section 14, 0.6.0): the engine returns codes, and each table words them.
 * The English wording is held by the engine's own tests, through the English
 * table; these hold section 13's Português column, and that a result is the
 * same whichever language shows.
 */

afterEach(() => showLanguage('en'))

const sheet = (source: string) => evaluateSheet([{ id: 'a', source }]).get('a')!

/** Each line's problem (its error, or a list's failed points) and its warnings, in a table's words. */
function problems(source: string, table = ptBR) {
  return sheet(source).map(({ result, warnings }) => {
    const error = result.kind === 'error' ? result.message : result.kind === 'list' ? result.failed : null
    return [error === null ? null : wordMessage(table.engine, error), ...warnings.map((w) => wordMessage(table.engine, w))]
  })
}

describe('the engine returns codes (ADR 0007)', () => {
  it('gives the same results whichever language shows, so a choice re-words without a run', () => {
    const source = 'x = foo\nK = 5 K\nQ_s = 1 .. 3\nH_s = Q_s < 2 ? Q_s : nope\nmu = 2 @blod'
    const english = sheet(source)
    showLanguage('pt-BR')
    expect(sheet(source)).toEqual(english)
    expect(wordMessage(words().engine, english[0].result.kind === 'error' ? english[0].result.message : { code: 'oneStatement' })).toBe(
      'Símbolo indefinido foo',
    )
  })

  it('holds no words: a message is a code and its arguments', () => {
    expect(sheet('y = x\nx = 2')[0].result).toEqual({ kind: 'error', message: { code: 'definedBelow', name: 'x' } })
    expect(sheet('K = 5')[0].warnings).toEqual([{ code: 'shadows', name: 'K', what: 'unit' }])
  })
})

describe('section 13 in Português', () => {
  it('words reading and names', () => {
    expect(problems('y = x\nx = 2\nz = 1 m + 1 s\nw = z')).toEqual([
      ['x é definido abaixo'],
      [null],
      ['As unidades não correspondem'],
      ['z tem um erro acima'],
    ])
    expect(problems('table = 2\nif = 3\nx1 = 5; y1 = 2')).toEqual([
      ['table é uma forma de linha: escolha outro nome'],
      ['if é uma função: escolha outro nome', 'if encobre o nome interno if'],
      ['uma instrução por linha: divida a linha no ;'],
    ])
    expect(problems('K = 5\nf(x) = x + y')).toEqual([
      [null, 'K encobre a unidade K'],
      [null, 'y não está definido acima desta linha'],
    ])
    expect(problems('a = V * 2\nV = 3')[0]).toEqual([null, 'V é lido como a unidade V aqui: a variável é definida abaixo'])
  })

  it('words functions, with a count’s singular and plural', () => {
    expect(problems('fa(x, y) = x + y\nfa(1)\nfb(x) = x\nfb(1, 2)\nloop(n) = loop(n)\nloop(1)')).toEqual([
      [null],
      ['fa precisa de 2 argumentos, recebeu 1'],
      [null],
      ['fb precisa de 1 argumento, recebeu 2'],
      [null],
      ['loop chama a si mesma sem fim'],
    ])
    expect(problems('f_d = 2\nf_d(3)\nq(x) = x\nq + 1\nhelp(sin)')).toEqual([
      [null],
      ['f_d é um valor, não uma função: escreva f_d * (...) para multiplicar'],
      [null],
      ['q é uma função: chame-a com q(...)'],
      ['help não é aceito em um bloco de cálculo'],
    ])
  })

  it('words units, formats and text', () => {
    expect(problems('a = 2 m in xyz\nb1 = 2 @bolt\nc = 2 @text-red+blod\nd = 2 @L\n@bold if x > 1 # t\ne1 = "a" in kPa')).toEqual([
      ['Unidade desconhecida xyz'],
      ['Formato desconhecido @bolt'],
      ['Formato desconhecido @blod em @text-red+blod'],
      ['@L é para comentários'],
      ['regras precisam de uma linha de cálculo'],
      ['texto não tem unidade: retire "in kPa"'],
    ])
    expect(problems('a = "x" == 2\nb1 = "x" < "y"\nc = if(1, 2)\nd = 3 m/s > 0')).toEqual([
      ['não é possível comparar texto com um número'],
      ['texto só pode ser comparado com == ou !='],
      ['if precisa de 3 argumentos: if(cond, a, b)'],
      ['não é possível comparar 3 m / s com 0: dê uma unidade ao 0'],
    ])
  })

  it('words a rule’s warning, on the line and alone for the Rules list', () => {
    const [line] = sheet('v = 1 m/s @text-red if v > 3 kg @bold if v = 3')
    // A condition that can't be read warns before one that fails to run.
    expect(line.warnings.map((w) => wordMessage(ptBR.engine, w))).toEqual([
      'if v = 3: uma regra não pode atribuir; escreva ==',
      'if v > 3 kg: As unidades não correspondem',
    ])
    expect(line.ruleStates.map((state) => (state.kind === 'warning' ? wordMessage(ptBR.engine, state.message) : state.kind))).toEqual([
      'As unidades não correspondem',
      'uma regra não pode atribuir; escreva ==',
    ])
  })

  it('words solve', () => {
    expect(problems('x = solve x^2 = -1, for x = -10 .. 10')).toEqual([['nenhuma raiz encontrada para x em -10 .. 10']])
    expect(wordMessage(ptBR.engine, { code: 'tooManyRoots', unknown: 'x', range: '0 .. 1000' })).toBe(
      'mais de 100 raízes para x em 0 .. 1000: estreite o intervalo',
    )
    expect(problems('Q = solve Q = 2, for Q = 30 .. 1\nf(a) = solve x = a, for x = 0 .. 1\nsolv(a) = solve x = a, guess x = "t"\nsolv(1)')).toEqual([
      ['for Q = 30 .. 1: o início deve ser menor que o fim'],
      ['uma função solve usa uma estimativa inicial: ", guess x = <value>"'],
      [null],
      ['em solv(1): guess x: não é um número nem um valor com unidade'],
    ])
  })

  it('words ranges, lists and plots, with articles and grouped numbers', () => {
    expect(problems('Q_s = 1 .. 1e5\nx = 1:1e7\nz = zeros(1e8)')).toEqual([
      ['Q_s tem mais de 10 000 pontos'],
      ['1:1e7 tem mais de 10 000 pontos'],
      ['zeros(1e8) tem mais de 10 000 valores'],
    ])
    expect(problems('x = -1 .. 1\nr(t) = t < 0 ? nope : t\ny = r(x)')[2]).toEqual([
      '1 de 3 pontos falhou. Em x = -1: em r(-1): Símbolo indefinido nope',
    ])
    expect(problems('x = -2 .. 1\ny = x < 0 ? nope : x')[1]).toEqual(['2 de 4 pontos falharam. Em x = -2: Símbolo indefinido nope'])
    expect(problems('Q_s = 1 m .. 3 m step 1 m\nP = Q_s * 1 W / m\nplot(Q_s, Q_s, P)')[2]).toEqual([
      'Q_s é um comprimento, P é uma potência: um gráfico mostra uma grandeza',
    ])
    expect(problems('x_r = 1 .. 2\nx_r[3]\nx_r[0]\nplot(2 m, 3 m, 4 m)')).toEqual([
      [null],
      ['x_r tem 2 valores'],
      ['x_r[0]: um índice é um número inteiro a partir de 1'],
      ['x deve ser uma lista: 2 m é um valor único'],
    ])
    expect(problems('a = log(0):5\nb1 = 0:0/0')).toEqual([
      ['as extremidades de um intervalo devem ser números finitos: log(0) é -∞'],
      ['as extremidades de um intervalo devem ser números finitos: 0/0 não é um número'],
    ])
  })

  it('words a list’s hover row for a failed point', () => {
    const [, line] = sheet('x = -1 .. 1\ny = x < 0 ? nope : x')
    expect(wordPreview(ptBR.engine, line.listPreview!)).toBe('1: falhou: Símbolo indefinido nope\n2: 0\n3: 1')
    expect(wordPreview(en.engine, line.listPreview!)).toBe('1: failed: Undefined symbol nope\n2: 0\n3: 1')
  })

  it('words a rename’s refusals and its shadow warning', () => {
    const blocks = [{ id: 'a', source: 'rho = 1000\nmu = 2\nx = rho * 2' }]
    const refusal = (to: string) => {
      const message = planRename(blocks, { id: 'a', line: 0, name: 'rho' }, to)!.refusal?.message
      return message == null ? message : wordMessage(ptBR.engine, message as EngineMessage)
    }
    expect([refusal('mu'), refusal('2x'), refusal('plot')]).toEqual([
      'mu já é um nome nesta folha.',
      '2x não é um nome.',
      'plot é reservado.',
    ])
    const warning = planRename(blocks, { id: 'a', line: 0, name: 'rho' }, 'm')!.warning
    expect(warning && wordMessage(ptBR.engine, warning)).toBe('m encobre a unidade m')
  })

  it('words the app’s own failure on a line', () => {
    expect(wordMessage(ptBR.engine, { code: 'unexpectedLine' })).toBe('esta linha encontrou um erro inesperado no Excalimathpad')
  })
})
