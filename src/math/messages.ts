import type { Kind } from './unitSystems.ts'

/**
 * The engine's messages (ADR 0007; docs/spec-v1.md section 13, and section
 * 14, 0.6.0: the engine returns codes, never words). Every error, warning,
 * rule warning and rename refusal the engine gives is one of these: a `code`
 * and its arguments. The engine holds no words and doesn't know the language;
 * the places that show a message word it through the text table of the
 * language shown (`wordMessage` in `src/text/engine.ts`).
 *
 * An argument is code as typed or a value as the sheet shows it (both the
 * same in every language), a number, or another message: `in k(1 s): …`
 * holds the body's own message, worded in its turn. A math.js error is
 * `mathjs` with math.js's raw text, which the Português table words when it
 * is one of the known patterns of section 13 and passes through otherwise.
 *
 * A new message adds a code here and its wording in both tables: the type
 * check fails a missing one. An argument that is an object never has a
 * `code` of its own: that marks a message inside a message.
 */
export type EngineMessage =
  // Reading and names
  | { code: 'definedBelow'; name: string }
  | { code: 'errorAbove'; name: string }
  | { code: 'lineFormName'; name: string }
  | { code: 'ifIsFunction' }
  | { code: 'oneStatement' }
  /** A warning: `K shadows the unit K`, or `the built-in`. */
  | { code: 'shadows'; name: string; what: ShadowedKind }
  /** A warning: `V reads as the unit V here: the variable is defined below`, or `its definition failed`. */
  | { code: 'readsAsUnit'; name: string; what: ShadowedKind; failed: boolean }
  /** A warning: `y isn't defined above this line`. */
  | { code: 'notDefinedAbove'; name: string }
  // Functions
  | { code: 'valueNotFunction'; name: string }
  | { code: 'isFunction'; name: string }
  | { code: 'argumentCount'; name: string; expected: number; got: number }
  | { code: 'endlessRecursion'; name: string }
  /**
   * An error inside a body, on the calling line: `in k(1 s): …`. Each
   * argument as the sheet shows it; null for a function that isn't the
   * sheet's, which has no name to show.
   */
  | { code: 'inCall'; name: string; args: readonly (string | null)[]; inner: EngineMessage }
  | { code: 'functionDisplayUnit' }
  /** A function the app turns off (`help`, `typed.clear`). */
  | { code: 'notSupported'; name: string }
  // Units and formats
  | { code: 'unknownUnit'; name: string }
  | { code: 'complexWithUnit' }
  /** `word` with its `@`. */
  | { code: 'unknownFormat'; word: string }
  /** `part` and `word` with their `@`: `Unknown format @blod in @text-red+blod`. */
  | { code: 'unknownFormatIn'; part: string; word: string }
  | { code: 'commentOnly'; word: string }
  | { code: 'rulesNeedMathLine' }
  // Conditionals and text
  | { code: 'textWithNumber' }
  | { code: 'textCompare' }
  | { code: 'ifArguments' }
  | { code: 'conditionBoolean' }
  | { code: 'conditionOneValue' }
  | { code: 'unitWithNumber'; unit: string; number: string }
  /** `unit` as typed after `in`. */
  | { code: 'textNoUnit'; unit: string }
  // Rules
  /** A rule's warning on its line: `if v > 3 kg: …`; the Rules list shows `inner` alone. */
  | { code: 'rule'; condition: string; inner: EngineMessage }
  | { code: 'notTrueOrFalse' }
  | { code: 'ruleAssigns' }
  | { code: 'ruleNeedsValue' }
  | { code: 'ruleTableResult' }
  /** A list in a condition of another length than the line's. */
  | { code: 'ruleListLength'; name: string; length: number; lineLength: number }
  /** Units of different kinds in a condition, as the sheet words it. */
  | { code: 'unitsDoNotMatch' }
  // Solve
  | { code: 'solveNeedsRange'; unknown: string }
  | { code: 'solveFunctionGuess'; unknown: string }
  | { code: 'solveNeedsGuess'; unknown: string }
  | { code: 'solveNeedsEquation' }
  | { code: 'solveParameter'; name: string }
  /** `range` is the range as the sheet shows it, `-10 .. 10`, `1 .. 30 L/s`. */
  | { code: 'noRootIn'; unknown: string; range: string; noValue: boolean; inner: EngineMessage | null }
  | { code: 'tooManyRoots'; unknown: string; range: string }
  | { code: 'rangeSolveList'; name: string }
  | { code: 'forNeedsEnds'; unknown: string }
  /** `from` and `to` as typed. */
  | { code: 'fromBelowTo'; unknown: string; from: string; to: string }
  | { code: 'endsSameKind'; unknown: string; from: string; to: string }
  /** A clause's own failure: `for Q: …`, `guess Q: …`; `clause` is code. */
  | { code: 'clause'; clause: string; inner: EngineMessage }
  /** `guess Q: not a number or a quantity`; `clause` is code. */
  | { code: 'notNumberOrQuantity'; clause: string }
  /** `label` is the clause as typed (`guess Q = 15 m`), `equation` the residual (`Hp(Q) - Hs(Q)`). */
  | { code: 'sidesUnits'; label: string; equation: string }
  /** `guess` is `Q = 15 L/s`; `searched` the range searched, or null when no point near it had a value. */
  | { code: 'noRootNear'; guess: string; searched: string | null; inner: EngineMessage | null }
  | { code: 'noConvergence'; unknown: string; iterations: number }
  | { code: 'sideNotNumber' }
  // Ranges, tables, plots
  /** `unit` is the start's unit, or empty. */
  | { code: 'rangeNeedsStep'; unit: string }
  | { code: 'stepNeverReaches'; step: string }
  | { code: 'rangeSameKind' }
  /** `what` is the name or the code; null for an unnamed range. */
  | { code: 'tooManyPoints'; what: string | null; limit: number }
  | { code: 'tooManyValues'; what: string; limit: number }
  | { code: 'lengthsDiffer'; a: string; aLength: number; b: string; bLength: number }
  | { code: 'passAsArgument'; name: string }
  /** `1 of 30 points failed. At Q_s = 0 L/s: …` */
  | { code: 'pointsFailed'; failed: number; of: number; at: PointAt; inner: EngineMessage }
  | { code: 'hasFailedPoint'; name: string }
  | { code: 'mixedKinds'; a: string; aKind: ValueKind; b: string; bKind: ValueKind }
  | { code: 'unknownPlotSetting'; text: string }
  | { code: 'logNeedsPositive'; axis: 'x' | 'y' }
  | { code: 'everyPointFailed'; name: string; at: PointAt; inner: EngineMessage }
  | { code: 'plotNeedsY' }
  | { code: 'xMustBeList'; text: string }
  | { code: 'markKind'; text: string }
  | { code: 'axisRangeKind'; axis: 'x' | 'y'; range: string }
  | { code: 'plotUnits' }
  | { code: 'tableNeedsList' }
  | { code: 'tableUnits' }
  | { code: 'rangePartNotNumber'; part: RangePart }
  | { code: 'rangeSingleValues' }
  | { code: 'indexPastEnd'; name: string; length: number }
  /** `label` is the index as typed, `x_r[0]`. */
  | { code: 'indexWhole'; label: string }
  | { code: 'indexOnName' }
  /** A range's end that isn't finite: by its code (`log(0)`), or, where that can't be found, by its part. */
  | { code: 'notFinite'; end: { text: string } | { part: RangePart }; value: number }
  | { code: 'tooLarge'; call: string }
  | { code: 'pointShape'; text: string }
  | { code: 'circleRadius'; text: string }
  | { code: 'circleCentre'; text: string }
  | { code: 'equalKinds' }
  | { code: 'equalRanges' }
  /** A list's hover row for a failed point: `3: failed: …`, its index from 1. */
  | { code: 'previewFailed'; index: number; inner: EngineMessage }
  // The app's own failure (section 4, Unexpected failures)
  | { code: 'unexpectedLine' }
  // A rename's refusals (section 4, Renaming a name)
  | { code: 'renameNotAName'; name: string }
  | { code: 'renameReserved'; name: string }
  | { code: 'renameTaken'; name: string }
  /** math.js's own error, as math.js wrote it. */
  | { code: 'mathjs'; text: string }

/** What a sheet name hides: a math.js unit or a built-in. */
export type ShadowedKind = 'unit' | 'builtIn'

/** A part of a range, `start .. end step s`. */
export type RangePart = 'start' | 'end' | 'step'

/** Where a list's first failed point is: at a value of the list it ran over, or by its index from 1. */
export type PointAt = { name: string; value: string } | { index: number }

/**
 * A value's kind, for the one-kind message of a plot: one of the unit kinds,
 * a plain number, the composed SI units of a kind off the list, any other
 * value, or a failed point.
 */
export type ValueKind = { kind: Kind } | { units: string } | 'number' | 'value' | 'failed'

export type MessageCode = EngineMessage['code']

/** One code's message. */
export type MessageOf<C extends MessageCode> = Extract<EngineMessage, { code: C }>

/** A math.js error's message, from its raw text. */
export function mathjsMessage(text: string): EngineMessage {
  return { code: 'mathjs', text }
}

/** Whether a value is an engine message: an object with a string `code`. */
export function isEngineMessage(value: unknown): value is EngineMessage {
  return typeof value === 'object' && value !== null && typeof (value as { code?: unknown }).code === 'string'
}
