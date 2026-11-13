import {
  isAccessorNode,
  isConstantNode,
  isFunctionNode,
  isSymbolNode,
  type EvalFunction,
  type MathJsInstance,
  type MathNode,
} from 'mathjs'
import { SheetError } from './functions.ts'
import { isSheetList } from './lists.ts'

/**
 * The index (docs/spec-v1.md section 3, An index; section 10): `x_r[2]` takes
 * one value out of a list, counting from 1. It is the app's, read before
 * math.js (ADR 0005, step 5): lists are the app's and never math.js matrices.
 *
 * After the parse, every `name[…]` becomes a call to `INDEX_FN`, whose
 * arguments are the indexed node, the index node and the accessor as typed
 * (for messages). The function takes its arguments raw, so the name is read
 * whole: a list stays a list, and a name inside an index never makes the line
 * an iterating line (`withoutIndexes`).
 */

/** The name of the app's index function in the math.js namespace. */
export const INDEX_FN = '__index'

/** Every single-dimension `object[index]` in a node, as a call to `INDEX_FN`. */
export function readIndexes(node: MathNode, math: MathJsInstance): MathNode {
  return node.transform((child) => {
    if (!isAccessorNode(child) || child.index.dotNotation || child.index.dimensions.length !== 1) return child
    const label = child.toString()
    return new math.FunctionNode(new math.SymbolNode(INDEX_FN), [
      readIndexes(child.object, math),
      readIndexes(child.index.dimensions[0], math),
      new math.ConstantNode(label),
    ])
  })
}

/** A call to the app's index. */
export function isIndexCall(node: MathNode): boolean {
  return isFunctionNode(node) && isSymbolNode(node.fn) && node.fn.name === INDEX_FN
}

/**
 * The node with every index taken out (a constant in its place), for what
 * decides iteration: neither the indexed name nor a name inside the index
 * makes the line run once per point.
 */
export function withoutIndexes(node: MathNode, math: MathJsInstance): MathNode {
  return node.transform((child) => (isIndexCall(child) ? new math.ConstantNode(0) : child))
}

/** The indexed node and the index as typed: the parts of an index call. */
export function indexParts(node: MathNode): { object: MathNode; index: MathNode; label: string } | null {
  if (!isFunctionNode(node) || !isSymbolNode(node.fn) || node.fn.name !== INDEX_FN) return null
  const [object, index, label] = node.args
  return { object, index, label: isConstantNode(label) ? String(label.value) : node.toString() }
}

/** The index function, raw-args, for the namespace. */
export function createIndex(math: MathJsInstance) {
  const compiled = new WeakMap<MathNode, EvalFunction>()
  const run = (node: MathNode, scope: unknown): unknown => {
    let code = compiled.get(node)
    if (code === undefined) {
      code = node.compile()
      compiled.set(node, code)
    }
    return code.evaluate(scope as Map<string, unknown>)
  }

  const index = (args: MathNode[], _math: unknown, scope: unknown): unknown => {
    const [object, at, labelNode] = args
    const label = isConstantNode(labelNode) ? String(labelNode.value) : 'x_r[2]'
    if (!isSymbolNode(object)) throw new SheetError('an index goes on a name: x_r[2]')
    const name = object.name
    const value = run(object, scope)
    const i = run(at, scope)
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 1) {
      throw new SheetError(`${label}: an index is a whole number from 1`)
    }
    if (isSheetList(value)) {
      if (i > value.length) throw new SheetError(`${name} has ${count(value.length)}`)
      const point = value.points[i - 1]
      if (!point.ok) throw new SheetError(point.message)
      return point.value
    }
    if (math.isMatrix(value) || Array.isArray(value)) {
      const size = math.size(value as never) as unknown as number[] | { valueOf(): number[] }
      const length = (Array.isArray(size) ? size : size.valueOf())[0]
      if (i > length) throw new SheetError(`${name} has ${count(length)}`)
      return math.subset(value as never, math.index(i - 1))
    }
    // A single value is a list of one: `x[1]` is the value itself.
    if (i > 1) throw new SheetError(`${name} has ${count(1)}`)
    return value
  }
  return Object.assign(index, { rawArgs: true as const })
}

function count(n: number): string {
  return n === 1 ? '1 value' : `${n} values`
}
