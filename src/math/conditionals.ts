import type { EvalFunction, MathJsInstance, MathNode } from 'mathjs'
import { SheetError } from './functions.ts'
import { isSheetList } from './lists.ts'

/**
 * Conditionals and text (docs/spec-v1.md section 3, Conditionals and text;
 * section 14, Engine; ADR 0005, the M4d amendment). The engine hands in its
 * math.js instance at setup, before `import` is disabled; this module never
 * imports math.js at runtime.
 *
 * - **`if(cond, a, b)`** is an app function that takes its arguments raw, so
 *   only the branch taken runs, as `? :` does.
 * - **A condition is true or false.** Both `if()` and `? :` refuse anything
 *   else, where math.js would read `0`, `""` or `1 m` as true or false.
 * - **Text compares with `==` and `!=` only,** exactly, case included. Text
 *   against a number or a unit is an error, never a conversion: math.js would
 *   read `"10" == 10` as true.
 * - **A unit against a bare number** says which number needs a unit, in place
 *   of math.js's "Unexpected type of argument".
 */

/** The name of the app's `if` in the math.js namespace: a reserved name (section 3). */
export const IF_FN = 'if'

/** A condition's value, as `if()` and `? :` take it: a boolean, or the sheet's error. */
export function testCondition(value: unknown, math: MathJsInstance): boolean {
  if (typeof value === 'boolean') return value
  if (isSheetList(value) || math.isMatrix(value) || Array.isArray(value)) {
    throw new SheetError({ code: 'conditionOneValue' })
  }
  throw new SheetError({ code: 'conditionBoolean' })
}

/** `if(cond, a, b)`, raw-args, for the namespace. */
export function createIf(math: MathJsInstance) {
  const compiled = new WeakMap<MathNode, EvalFunction>()
  const run = (node: MathNode, scope: unknown): unknown => {
    let code = compiled.get(node)
    if (code === undefined) {
      code = node.compile()
      compiled.set(node, code)
    }
    return code.evaluate(scope as Map<string, unknown>)
  }
  const choose = (args: MathNode[], _math: unknown, scope: unknown): unknown => {
    if (args.length !== 3) throw new SheetError({ code: 'ifArguments' })
    const [condition, then, otherwise] = args
    return run(testCondition(run(condition, scope), math) ? then : otherwise, scope)
  }
  return Object.assign(choose, { rawArgs: true as const })
}

type Evaluator = (scope: unknown, args: unknown, context: unknown) => unknown
interface CompilingNode {
  _compile(math: unknown, argNames: unknown): Evaluator
}

/**
 * Makes this instance's `? :` take its condition as `if()` does. math.js
 * builds each node class per instance, so the change stays in the app's
 * engine. `_compile` is how math.js's custom nodes compile (its
 * "Customization" guide); a test pins it, so an upgrade that renames it fails
 * CI. Only the branch taken still runs.
 */
export function strictConditionals(math: MathJsInstance) {
  const conditional = math.ConditionalNode.prototype as unknown as CompilingNode & {
    condition: CompilingNode
    trueExpr: CompilingNode
    falseExpr: CompilingNode
  }
  if (typeof conditional._compile !== 'function') throw new Error('math.js ConditionalNode has no _compile')
  conditional._compile = function (this: typeof conditional, namespace, argNames) {
    const condition = this.condition._compile(namespace, argNames)
    const then = this.trueExpr._compile(namespace, argNames)
    const otherwise = this.falseExpr._compile(namespace, argNames)
    return (scope, args, context) =>
      testCondition(condition(scope, args, context), math)
        ? then(scope, args, context)
        : otherwise(scope, args, context)
  }
}

/** The comparison functions and what each does with two texts. */
const COMPARISONS = {
  equal: (a: string, b: string) => a === b,
  unequal: (a: string, b: string) => a !== b,
  larger: null,
  largerEq: null,
  smaller: null,
  smallerEq: null,
} as const

/**
 * Signatures for the comparisons, to merge into math.js's own at setup
 * (`math.import` merges typed functions of the same name). Each is more
 * specific than math.js's, so numbers, units and matrices compare as before.
 * `show` writes a value in the sheet's plain-text form, for the message.
 */
export function comparisonSignatures(math: MathJsInstance, show: (value: unknown) => string) {
  const textWithNumber = () => {
    throw new SheetError({ code: 'textWithNumber' })
  }
  const unitWithNumber = (unit: unknown, number: unknown) => {
    throw new SheetError({ code: 'unitWithNumber', unit: show(unit), number: show(number) })
  }
  return Object.fromEntries(
    Object.entries(COMPARISONS).map(([name, texts]) => [
      name,
      math.typed(name, {
        'string, string':
          texts ??
          (() => {
            throw new SheetError({ code: 'textCompare' })
          }),
        'string, number': textWithNumber,
        'number, string': textWithNumber,
        'string, Unit': textWithNumber,
        'Unit, string': textWithNumber,
        'Unit, number': (unit: unknown, number: unknown) => unitWithNumber(unit, number),
        'number, Unit': (number: unknown, unit: unknown) => unitWithNumber(unit, number),
      }),
    ]),
  )
}
