import type { PointAt, RangePart, ShadowedKind, ValueKind } from '../math/messages.ts'
import type { EngineWords } from './engine.ts'

/**
 * The engine's messages in English (docs/spec-v1.md section 13, the Message
 * column; 0.6.0, ADR 0007): `en.engine`. Each code's wording, with its
 * arguments; a message inside one arrives already worded.
 */

/** `10,000`: the app's own grouped numbers in English (section 13, Grouped numbers). */
const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const what = (kind: ShadowedKind) => (kind === 'unit' ? 'the unit' : 'the built-in')

const at = (point: PointAt) => ('name' in point ? `At ${point.name} = ${point.value}` : `At point ${point.index}`)

const part = (which: RangePart) => `the ${which}`

const infinite = (value: number) => (Number.isNaN(value) ? 'not a number' : value < 0 ? '-∞' : '∞')

/** A value's kind with its article, for the one-kind message of a plot: `a length`, `an area`. */
function kindName(kind: ValueKind): string {
  if (kind === 'failed') return 'a failed point'
  if (kind === 'value') return 'a value'
  if (kind === 'number') return 'a number'
  if ('units' in kind) return `in ${kind.units}`
  const words = kind.kind.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`)
  return /^[aeiou]/.test(words) ? `an ${words}` : `a ${words}`
}

export const engineEn: EngineWords = {
  definedBelow: ({ name }) => `${name} is defined below`,
  errorAbove: ({ name }) => `${name} has an error above`,
  lineFormName: ({ name }) => `${name} is a line form: choose another name`,
  ifIsFunction: () => 'if is a function: choose another name',
  oneStatement: () => 'one statement per line: split the line at the ;',
  shadows: ({ name, what: kind }) => `${name} shadows ${what(kind)} ${name}`,
  readsAsUnit: ({ name, what: kind, failed }) =>
    `${name} reads as ${what(kind)} ${name} here: ${failed ? 'its definition failed' : 'the variable is defined below'}`,
  notDefinedAbove: ({ name }) => `${name} isn't defined above this line`,

  valueNotFunction: ({ name }) => `${name} is a value, not a function: write ${name} * (...) to multiply`,
  isFunction: ({ name }) => `${name} is a function: call it with ${name}(...)`,
  argumentCount: ({ name, expected, got }) => `${name} needs ${expected} ${expected === 1 ? 'argument' : 'arguments'}, got ${got}`,
  endlessRecursion: ({ name }) => `${name} calls itself without end`,
  inCall: ({ name, args, inner }) => `in ${name}(${args.map((arg) => arg ?? 'function').join(', ')}): ${inner}`,
  functionDisplayUnit: () => "Set a function's display unit on the line that calls it",
  notSupported: ({ name }) => `${name} is not supported in a math element`,

  unknownUnit: ({ name }) => `Unknown unit ${name}`,
  complexWithUnit: () => "a complex value with a unit can't be shown",
  unknownFormat: ({ word }) => `Unknown format ${word}`,
  unknownFormatIn: ({ part: inner, word }) => `Unknown format ${inner} in ${word}`,
  commentOnly: ({ word }) => `${word} is for comment lines`,
  rulesNeedMathLine: () => 'rules need a math line',

  textWithNumber: () => "can't compare text with a number",
  textCompare: () => 'text can only be compared with == or !=',
  ifArguments: () => 'if needs 3 arguments: if(cond, a, b)',
  conditionBoolean: () => 'if: the condition must be true or false',
  conditionOneValue: () => 'if: the condition must be one value; use a list line instead',
  unitWithNumber: ({ unit, number }) => `can't compare ${unit} with ${number}: give the ${number} a unit`,
  textNoUnit: ({ unit }) => `text has no unit: take off "in ${unit}"`,

  rule: ({ condition, inner }) => `if ${condition}: ${inner}`,
  notTrueOrFalse: () => 'not true or false',
  ruleAssigns: () => "a rule can't assign; write ==",
  ruleNeedsValue: () => 'a rule needs a value',
  ruleTableResult: () => 'a table has no result; use its list names',
  ruleListLength: ({ name, length, lineLength }) => `${name} has ${length} values, the line has ${lineLength}`,
  unitsDoNotMatch: () => 'Units do not match',

  solveNeedsRange: ({ unknown }) => `solve needs a range: ", for ${unknown} = <from> .. <to>"`,
  solveFunctionGuess: ({ unknown }) => `a solve function takes a guess: ", guess ${unknown} = <value>"`,
  solveNeedsGuess: ({ unknown }) => `solve needs a guess: ", guess ${unknown} = <value>"`,
  solveNeedsEquation: () => 'solve needs one equation: "<left side> = <right side>"',
  solveParameter: ({ name }) => `${name}: a parameter isn't a name`,
  noRootIn: ({ unknown, range, noValue, inner }) =>
    `no root found for ${unknown} in ${range}${noValue ? ' (the equation has no value in the range)' : inner !== null ? `; last inner error: ${inner}` : ''}`,
  tooManyRoots: ({ unknown, range }) => `more than 100 roots for ${unknown} in ${range}: narrow the range`,
  rangeSolveList: ({ name }) => `a range solve can't use the list ${name}; use a solve function with a guess`,
  forNeedsEnds: ({ unknown }) => `for ${unknown} needs two ends and no step: "for ${unknown} = <from> .. <to>"`,
  fromBelowTo: ({ unknown, from, to }) => `for ${unknown} = ${from} .. ${to}: from must be below to`,
  endsSameKind: ({ unknown, from, to }) => `for ${unknown} = ${from} .. ${to}: the ends must be the same kind`,
  clause: ({ clause, inner }) => `${clause}: ${inner}`,
  notNumberOrQuantity: ({ clause }) => `${clause}: not a number or a quantity`,
  sidesUnits: ({ label, equation }) => `${label}: ${equation} units do not match`,
  noRootNear: ({ guess, searched, inner }) =>
    `no root near ${guess} (${searched === null ? 'the equation has no value near the guess' : `searched ${searched}`})${inner === null ? '' : `; last inner error: ${inner}`}`,
  noConvergence: ({ unknown, iterations }) => `no convergence for ${unknown} after ${iterations} iterations`,
  sideNotNumber: () => 'a side of the equation is not a number or a quantity',

  rangeNeedsStep: ({ unit }) => `a range with units needs a step, such as "step 1${unit ? ` ${unit}` : ''}"`,
  stepNeverReaches: ({ step }) => `step ${step} never reaches the end`,
  rangeSameKind: () => 'start, end and step must be the same kind',
  tooManyPoints: ({ what: name, limit }) => `${name ?? 'the range'} has more than ${grouped(limit)} points`,
  tooManyValues: ({ what: name, limit }) => `${name} has more than ${grouped(limit)} values`,
  lengthsDiffer: ({ a, aLength, b, bLength }) => `${a} has ${aLength} values, ${b} has ${bLength}`,
  passAsArgument: ({ name }) => `pass ${name} as an argument`,
  pointsFailed: ({ failed, of, at: point, inner }) => `${failed} of ${of} points failed. ${at(point)}: ${inner}`,
  hasFailedPoint: ({ name }) => `${name} has a failed point`,
  mixedKinds: ({ a, aKind, b, bKind }) => `${a} is ${kindName(aKind)}, ${b} is ${kindName(bKind)}: one plot shows one kind`,
  unknownPlotSetting: ({ text }) => `Unknown plot setting ${text}`,
  logNeedsPositive: ({ axis }) => `${axis} log needs values above 0`,
  everyPointFailed: ({ name, at: point, inner }) => `${name}: every point failed. ${at(point)}: ${inner}`,
  plotNeedsY: () => 'a plot needs x and at least one y: plot(Q_s, Hs(Q_s))',
  xMustBeList: ({ text }) => `x must be a list: ${text} is a single value`,
  markKind: ({ text }) => `mark ${text}: one value of x's kind`,
  axisRangeKind: ({ axis, range }) => `${axis} ${range}: the range must be the axis's kind`,
  plotUnits: () => 'a plot takes its units on its arguments: plot(Q_s in L/s, …)',
  tableNeedsList: () => 'a table needs a list, such as table(Q_s)',
  tableUnits: () => 'a table takes its units on its arguments: table(Q_s in L/s)',
  rangePartNotNumber: ({ part: which }) => `the range's ${which} must be a number or a quantity`,
  rangeSingleValues: () => 'a range takes single values, not a list',
  indexPastEnd: ({ name, length }) => `${name} has ${length === 1 ? '1 value' : `${length} values`}`,
  indexWhole: ({ label }) => `${label}: an index is a whole number from 1`,
  indexOnName: () => 'an index goes on a name: x_r[2]',
  notFinite: ({ end, value }) =>
    `a range's ends must be finite numbers: ${'part' in end ? part(end.part) : end.text} is ${infinite(value)}`,
  tooLarge: ({ call }) => `${call} is too large to compute`,
  pointShape: ({ text }) => `point ${text}: a point is two single values, (x, y)`,
  circleRadius: ({ text }) => `circle ${text}: the radius is one positive value of the axes' kind`,
  circleCentre: ({ text }) => `circle ${text}: the centre is two single values, (x0, y0)`,
  equalKinds: () => 'equal scales need x and y of the same kind',
  equalRanges: () => 'equal with both x and y ranges typed: leave one out',
  previewFailed: ({ index, inner }) => `${index}: failed: ${inner}`,

  unexpectedLine: () => 'this line hit an unexpected error in Excalimathpad',

  renameNotAName: ({ name }) => `${name} isn't a name.`,
  renameReserved: ({ name }) => `${name} is reserved.`,
  renameTaken: ({ name }) => `${name} is already a name on this sheet.`,

  mathjs: ({ text }) => text,
}
