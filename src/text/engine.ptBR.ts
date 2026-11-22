import type { Kind } from '../math/unitSystems.ts'
import type { PointAt, RangePart, ShadowedKind, ValueKind } from '../math/messages.ts'
import type { EngineWords } from './engine.ts'
import { mathjsInPortuguese } from './mathjs.ptBR.ts'

/**
 * The engine's messages in Português (Brasil) (docs/spec-v1.md section 13,
 * the Português column; 0.6.0, ADR 0007): `ptBR.engine`. A wording the spec
 * doesn't give was drafted from the glossary (#286) and the edges (#287), for
 * review on its pull request. A code, a name, a unit and a keyword stay as
 * typed; a count has its singular and plural, and a kind its article.
 */

/** `10 000`, with a narrow no-break space (section 13, Grouped numbers). */
const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

const what = (kind: ShadowedKind) => (kind === 'unit' ? 'a unidade' : 'o nome interno')

const at = (point: PointAt) => ('name' in point ? `Em ${point.name} = ${point.value}` : `No ponto ${point.index}`)

const PARTS: Record<RangePart, string> = { start: 'o início', end: 'o fim', step: 'o passo' }

/** Each unit kind with its article, for the one-kind message of a plot (section 13: `H_s é um comprimento`). */
const KINDS: Record<Kind, string> = {
  length: 'um comprimento',
  area: 'uma área',
  volume: 'um volume',
  volumeFlow: 'uma vazão volumétrica',
  massFlow: 'uma vazão mássica',
  velocity: 'uma velocidade',
  acceleration: 'uma aceleração',
  force: 'uma força',
  pressure: 'uma pressão',
  energy: 'uma energia',
  power: 'uma potência',
  density: 'uma massa específica',
  dynamicViscosity: 'uma viscosidade dinâmica',
  kinematicViscosity: 'uma viscosidade cinemática',
  frequency: 'uma frequência',
  mass: 'uma massa',
  time: 'um tempo',
  temperature: 'uma temperatura',
}

/** `H_s é um comprimento`, `X está em kg / (m s)`: a name and its kind. */
function isKind(name: string, kind: ValueKind): string {
  if (kind === 'failed') return `${name} é um ponto com falha`
  if (kind === 'value') return `${name} é um valor`
  if (kind === 'number') return `${name} é um número`
  if ('units' in kind) return `${name} está em ${kind.units}`
  return `${name} é ${KINDS[kind.kind]}`
}

const values = (n: number) => (n === 1 ? '1 valor' : `${n} valores`)

export const enginePtBR: EngineWords = {
  definedBelow: ({ name }) => `${name} é definido abaixo`,
  errorAbove: ({ name }) => `${name} tem um erro acima`,
  lineFormName: ({ name }) => `${name} é uma forma de linha: escolha outro nome`,
  ifIsFunction: () => 'if é uma função: escolha outro nome',
  oneStatement: () => 'uma instrução por linha: divida a linha no ;',
  shadows: ({ name, what: kind }) => `${name} encobre ${what(kind)} ${name}`,
  readsAsUnit: ({ name, what: kind, failed }) =>
    `${name} é lido como ${what(kind)} ${name} aqui: ${failed ? 'sua definição falhou' : 'a variável é definida abaixo'}`,
  notDefinedAbove: ({ name }) => `${name} não está definido acima desta linha`,

  valueNotFunction: ({ name }) => `${name} é um valor, não uma função: escreva ${name} * (...) para multiplicar`,
  isFunction: ({ name }) => `${name} é uma função: chame-a com ${name}(...)`,
  argumentCount: ({ name, expected, got }) =>
    `${name} precisa de ${expected} ${expected === 1 ? 'argumento' : 'argumentos'}, recebeu ${got}`,
  endlessRecursion: ({ name }) => `${name} chama a si mesma sem fim`,
  inCall: ({ name, args, inner }) => `em ${name}(${args.map((arg) => arg ?? 'função').join(', ')}): ${inner}`,
  functionDisplayUnit: () => 'Defina a unidade de exibição de uma função na linha que a chama',
  notSupported: ({ name }) => `${name} não é aceito em um bloco de cálculo`,

  unknownUnit: ({ name }) => `Unidade desconhecida ${name}`,
  complexWithUnit: () => 'um valor complexo com unidade não pode ser exibido',
  unknownFormat: ({ word }) => `Formato desconhecido ${word}`,
  unknownFormatIn: ({ part, word }) => `Formato desconhecido ${part} em ${word}`,
  commentOnly: ({ word }) => `${word} é para comentários`,
  rulesNeedMathLine: () => 'regras precisam de uma linha de cálculo',

  textWithNumber: () => 'não é possível comparar texto com um número',
  textCompare: () => 'texto só pode ser comparado com == ou !=',
  ifArguments: () => 'if precisa de 3 argumentos: if(cond, a, b)',
  conditionBoolean: () => 'if: a condição deve ser verdadeira ou falsa',
  conditionOneValue: () => 'if: a condição deve ser um único valor; use uma linha de lista',
  unitWithNumber: ({ unit, number }) => `não é possível comparar ${unit} com ${number}: dê uma unidade ao ${number}`,
  textNoUnit: ({ unit }) => `texto não tem unidade: retire "in ${unit}"`,

  rule: ({ condition, inner }) => `if ${condition}: ${inner}`,
  notTrueOrFalse: () => 'nem verdadeiro nem falso',
  ruleAssigns: () => 'uma regra não pode atribuir; escreva ==',
  ruleNeedsValue: () => 'uma regra precisa de um valor',
  ruleTableResult: () => 'uma tabela não tem resultado; use os nomes das suas listas',
  ruleListLength: ({ name, length, lineLength }) => `${name} tem ${values(length)}, a linha tem ${lineLength}`,
  unitsDoNotMatch: () => 'As unidades não correspondem',

  solveNeedsRange: ({ unknown }) => `solve precisa de um intervalo: ", for ${unknown} = <from> .. <to>"`,
  solveFunctionGuess: ({ unknown }) => `uma função solve usa uma estimativa inicial: ", guess ${unknown} = <value>"`,
  solveNeedsGuess: ({ unknown }) => `solve precisa de uma estimativa inicial: ", guess ${unknown} = <value>"`,
  solveNeedsEquation: () => 'solve precisa de uma equação: "<lado esquerdo> = <lado direito>"',
  solveParameter: ({ name }) => `${name}: um parâmetro não é um nome`,
  noRootIn: ({ unknown, range, noValue, inner }) =>
    `nenhuma raiz encontrada para ${unknown} em ${range}${noValue ? ' (a equação não tem valor no intervalo)' : inner !== null ? `; último erro interno: ${inner}` : ''}`,
  tooManyRoots: ({ unknown, range }) => `mais de 100 raízes para ${unknown} em ${range}: estreite o intervalo`,
  rangeSolveList: ({ name }) =>
    `um solve com intervalo não pode usar a lista ${name}; use uma função solve com estimativa inicial`,
  forNeedsEnds: ({ unknown }) =>
    `for ${unknown} precisa de duas extremidades e nenhum passo: "for ${unknown} = <from> .. <to>"`,
  fromBelowTo: ({ unknown, from, to }) => `for ${unknown} = ${from} .. ${to}: o início deve ser menor que o fim`,
  endsSameKind: ({ unknown, from, to }) => `for ${unknown} = ${from} .. ${to}: as extremidades devem ser da mesma grandeza`,
  clause: ({ clause, inner }) => `${clause}: ${inner}`,
  notNumberOrQuantity: ({ clause }) => `${clause}: não é um número nem um valor com unidade`,
  sidesUnits: ({ label, equation }) => `${label}: as unidades de ${equation} não correspondem`,
  noRootNear: ({ guess, searched, inner }) =>
    `nenhuma raiz perto de ${guess} (${searched === null ? 'a equação não tem valor perto da estimativa inicial' : `buscado em ${searched}`})${inner === null ? '' : `; último erro interno: ${inner}`}`,
  noConvergence: ({ unknown, iterations }) => `sem convergência para ${unknown} após ${iterations} iterações`,
  sideNotNumber: () => 'um lado da equação não é um número nem um valor com unidade',

  rangeNeedsStep: ({ unit }) => `um intervalo com unidades precisa de um passo, como "step 1${unit ? ` ${unit}` : ''}"`,
  stepNeverReaches: ({ step }) => `step ${step} nunca chega ao fim`,
  rangeSameKind: () => 'início, fim e passo devem ser da mesma grandeza',
  tooManyPoints: ({ what: name, limit }) => `${name ?? 'o intervalo'} tem mais de ${grouped(limit)} pontos`,
  tooManyValues: ({ what: name, limit }) => `${name} tem mais de ${grouped(limit)} valores`,
  lengthsDiffer: ({ a, aLength, b, bLength }) => `${a} tem ${values(aLength)}, ${b} tem ${bLength}`,
  passAsArgument: ({ name }) => `passe ${name} como argumento`,
  pointsFailed: ({ failed, of, at: point, inner }) =>
    `${failed} de ${of} ${of === 1 ? 'ponto' : 'pontos'} ${failed === 1 ? 'falhou' : 'falharam'}. ${at(point)}: ${inner}`,
  hasFailedPoint: ({ name }) => `${name} tem um ponto com falha`,
  mixedKinds: ({ a, aKind, b, bKind }) => `${isKind(a, aKind)}, ${isKind(b, bKind)}: um gráfico mostra uma grandeza`,
  unknownPlotSetting: ({ text }) => `Configuração de gráfico desconhecida ${text}`,
  logNeedsPositive: ({ axis }) => `${axis} log precisa de valores acima de 0`,
  everyPointFailed: ({ name, at: point, inner }) => `${name}: todos os pontos falharam. ${at(point)}: ${inner}`,
  plotNeedsY: () => 'um gráfico precisa de x e de pelo menos um y: plot(Q_s, Hs(Q_s))',
  xMustBeList: ({ text }) => `x deve ser uma lista: ${text} é um valor único`,
  markKind: ({ text }) => `mark ${text}: um valor da grandeza de x`,
  axisRangeKind: ({ axis, range }) => `${axis} ${range}: o intervalo deve ser da grandeza do eixo`,
  plotUnits: () => 'um gráfico recebe as unidades nos seus argumentos: plot(Q_s in L/s, …)',
  tableNeedsList: () => 'uma tabela precisa de uma lista, como table(Q_s)',
  tableUnits: () => 'uma tabela recebe as unidades nos seus argumentos: table(Q_s in L/s)',
  rangePartNotNumber: ({ part }) => `${PARTS[part]} do intervalo deve ser um número ou um valor com unidade`,
  rangeSingleValues: () => 'um intervalo recebe valores únicos, não uma lista',
  indexPastEnd: ({ name, length }) => `${name} tem ${values(length)}`,
  indexWhole: ({ label }) => `${label}: um índice é um número inteiro a partir de 1`,
  indexOnName: () => 'um índice vai em um nome: x_r[2]',
  notFinite: ({ end, value }) => {
    const which = 'part' in end ? PARTS[end.part] : end.text
    const is = Number.isNaN(value) ? 'não é um número' : `é ${value < 0 ? '-∞' : '∞'}`
    return `as extremidades de um intervalo devem ser números finitos: ${which} ${is}`
  },
  tooLarge: ({ call }) => `${call} é grande demais para calcular`,
  pointShape: ({ text }) => `point ${text}: um ponto são dois valores únicos, (x, y)`,
  circleRadius: ({ text }) => `circle ${text}: o raio é um valor positivo da grandeza dos eixos`,
  circleCentre: ({ text }) => `circle ${text}: o centro são dois valores únicos, (x0, y0)`,
  equalKinds: () => 'escalas iguais precisam de x e y da mesma grandeza',
  equalRanges: () => 'equal com os intervalos de x e de y digitados: deixe um de fora',
  previewFailed: ({ index, inner }) => `${index}: falhou: ${inner}`,

  unexpectedLine: () => 'esta linha encontrou um erro inesperado no Excalimathpad',

  renameNotAName: ({ name }) => `${name} não é um nome.`,
  renameReserved: ({ name }) => `${name} é reservado.`,
  renameTaken: ({ name }) => `${name} já é um nome nesta folha.`,

  mathjs: ({ text }) => mathjsInPortuguese(text),
}
