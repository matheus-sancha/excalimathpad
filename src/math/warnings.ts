import {
  isAssignmentNode,
  isFunctionAssignmentNode,
  isFunctionNode,
  isSymbolNode,
  type MathNode,
} from 'mathjs'

/**
 * Warnings (docs/spec-v1.md section 5, Warnings; wording in section 13). A
 * warning never changes a result: the name wins, and the line's value still
 * shows. Pure: what the sheet and the engine know comes in as `WarningFacts`.
 *
 * - **A name that shadows a unit or built-in:** a variable, a function name or
 *   a parameter named like one of math.js's units (the app units included) or
 *   built-ins. A parameter that hides a sheet function doesn't warn
 *   (`f(Re, r)` hides `Re(Q)` on purpose).
 * - **A use that falls back to the unit:** the name is a unit or built-in, the
 *   sheet defines it, but not above this line (it is defined below, or its
 *   definition failed), so here it reads as the unit.
 * - **A function body name not defined above:** any name in the body except the
 *   function's own, its parameters, units and math.js's functions and
 *   constants. Functions bind late, so it still works if the name exists by
 *   the time of the call.
 */

/** What the engine and the sheet know at the line being read. */
export interface WarningFacts {
  /** A math.js unit, the app units included, whatever the sheet defines. */
  isUnit(name: string): boolean
  /** A name math.js has built in (`pi`, `sqrt`). */
  isBuiltIn(name: string): boolean
  /** The name has a value in the sheet's scope before this line runs. */
  inScope(name: string): boolean
  /** The value it has there is a function the sheet defined. */
  isSheetFunction(name: string): boolean
  /** The sheet assigns the name on a line above this one. */
  definedAbove(name: string): boolean
  /** The sheet assigns the name on a line below this one. */
  definedBelow(name: string): boolean
  /** The name's latest assignment above failed. */
  failed(name: string): boolean
}

export function lineWarnings(node: MathNode, facts: WarningFacts): string[] {
  const warnings: string[] = []
  const add = (message: string) => {
    if (!warnings.includes(message)) warnings.push(message)
  }
  const what = (name: string) => (facts.isUnit(name) ? 'the unit' : 'the built-in')
  const clashes = (name: string) => facts.isUnit(name) || facts.isBuiltIn(name)

  for (const { name, parameter } of definedNames(node)) {
    if (!clashes(name)) continue
    if (parameter && facts.isSheetFunction(name)) continue
    add(`${name} shadows ${what(name)} ${name}`)
  }

  for (const name of usedNames(node)) {
    if (!clashes(name) || facts.inScope(name)) continue
    if (facts.failed(name)) add(`${name} reads as ${what(name)} ${name} here: its definition failed`)
    else if (facts.definedBelow(name)) {
      add(`${name} reads as ${what(name)} ${name} here: the variable is defined below`)
    }
  }

  for (const definition of functionDefinitions(node)) {
    const own = new Set([definition.name, ...definition.params])
    for (const name of bodyNames(definition.expr)) {
      if (own.has(name) || clashes(name)) continue
      if (facts.inScope(name) || facts.definedAbove(name)) continue
      add(`${name} isn't defined above this line`)
    }
  }
  return warnings
}

/** The names a line defines: variables, function names and their parameters. */
function definedNames(node: MathNode): { name: string; parameter: boolean }[] {
  return statements(node).flatMap((statement) => {
    if (isFunctionAssignmentNode(statement)) {
      return [
        { name: statement.name, parameter: false },
        ...statement.params.map((name) => ({ name, parameter: true })),
      ]
    }
    if (isAssignmentNode(statement) && !statement.index) return [{ name: statement.name, parameter: false }]
    return []
  })
}

function functionDefinitions(node: MathNode) {
  return statements(node).filter(isFunctionAssignmentNode)
}

/** A line's statements: one, or several separated by `;`. */
function statements(node: MathNode): MathNode[] {
  const block = node as MathNode & { blocks?: { node: MathNode }[] }
  return node.type === 'BlockNode' && block.blocks ? block.blocks.map((entry) => entry.node) : [node]
}

/**
 * The names a line reads as values when it runs: not a function's body, which
 * binds late, not the name of a function it calls, and not what it assigns.
 */
export function usedNames(node: MathNode): string[] {
  if (isFunctionAssignmentNode(node)) return []
  if (isSymbolNode(node)) return [node.name]
  if (isAssignmentNode(node)) {
    const target = node.index ? [...usedNames(node.object), ...usedNames(node.index)] : []
    return [...target, ...usedNames(node.value)]
  }
  if (isFunctionNode(node)) {
    const callee = isSymbolNode(node.fn) ? [] : usedNames(node.fn)
    return [...callee, ...node.args.flatMap(usedNames)]
  }
  return children(node).flatMap(usedNames)
}

/** Every name in a function body, called ones included. */
function bodyNames(node: MathNode): string[] {
  if (isSymbolNode(node)) return [node.name]
  if (isFunctionAssignmentNode(node)) {
    // A function defined inside a body: its own parameters are local to it.
    return bodyNames(node.expr).filter((name) => !node.params.includes(name))
  }
  return children(node).flatMap(bodyNames)
}

function children(node: MathNode): MathNode[] {
  const found: MathNode[] = []
  node.forEach((child) => found.push(child))
  return found
}
