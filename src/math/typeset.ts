import {
  isAssignmentNode,
  isConstantNode,
  isFunctionAssignmentNode,
  isFunctionNode,
  isOperatorNode,
  isParenthesisNode,
  isSymbolNode,
  type MathNode,
} from 'mathjs'
import { indexParts } from './indexes.ts'
import { leadingNumber, numberTex } from './numbers.ts'

/**
 * Sheet lines as TeX, for KaTeX (docs/spec-v1.md section 4, Typesetting names;
 * research: docs/research/mathjs-katex-typesetting.md). Pure: math.js's own
 * `toTex` with one handler, which fixes what its default gets wrong for a
 * sheet (a variable named like a unit, a parameter shown as a unit, `_` shown
 * literally) and sets quantities inline. Nothing here touches the engine: the
 * handler is a per-call option.
 */

/** What the typesetter needs to know about a name, at one line of the sheet. */
export interface Names {
  /** The sheet assigns this name on this line or above it, or it is a parameter here. */
  isSheetName(name: string): boolean
  /** A unit math.js knows, on its own (`m`, `kPa`, `um`), that no name shadows. */
  isUnit(name: string): boolean
  /** The unit's prefix is micro, which math.js writes `u`. */
  isMicro(name: string): boolean
  /** A name math.js has built in (`pi`, `sqrt`): its own TeX is right. */
  isBuiltIn(name: string): boolean
}

/** One line with code, in the grid's cells. */
export interface LineTex {
  /** The name cell: an assigned name, or a function and its parameters. Null for a bare expression. */
  name: string | null
  expression: string
}

const GREEK = [
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta',
  'vartheta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'varpi', 'rho', 'varrho',
  'sigma', 'varsigma', 'tau', 'upsilon', 'phi', 'varphi', 'chi', 'psi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',
  // Longest first, so `varepsilon` wins over `var…` and `epsilon` over `eps…`.
].sort((a, b) => b.length - a.length)

/**
 * A name as the sheet shows it:
 * - the text after the first `_` is the subscript, upright if multi-letter and
 *   italic if one letter or digits (`L_pipe`, `H_0`);
 * - a Greek word becomes its letter when it is the whole base, or a capital
 *   follows it (`rho_w`, `DeltaP`); `piston` stays a word;
 * - any other multi-letter base is one italic word (`Re`, not R·e).
 */
export function nameTex(name: string): string {
  if (name === 'hbar') return '\\hbar'
  const cut = name.indexOf('_')
  const base = cut === -1 ? name : name.slice(0, cut)
  const sub = cut === -1 ? '' : name.slice(cut + 1)
  const baseTex = base === '' ? '' : greekWordTex(base)
  return sub === '' ? baseTex : `{${baseTex}}_{${subscriptTex(sub)}}`
}

function greekWordTex(base: string): string {
  const greek = GREEK.find(
    (letter) =>
      base.startsWith(letter) &&
      (base.length === letter.length || /\p{Lu}/u.test(base[letter.length])),
  )
  if (!greek) return wordTex(base)
  const rest = base.slice(greek.length)
  return rest === '' ? `\\${greek}` : `\\${greek} ${wordTex(rest)}`
}

/** One letter stays as it is (italic); a longer word is one italic word. */
function wordTex(word: string): string {
  const escaped = word.replace(/\$/g, '\\$')
  return [...word].length === 1 ? escaped : `\\mathit{${escaped}}`
}

function subscriptTex(sub: string): string {
  if (GREEK.includes(sub)) return `\\${sub}`
  if (sub === 'inf') return '\\infty'
  if (/^(?:\p{L}|\d+)$/u.test(sub)) return sub
  return `\\mathrm{${sub.replace(/\$/g, '\\$').replace(/_/g, '\\_')}}`
}

/**
 * A line's code as the grid's cells. An assignment's name goes to the name
 * cell (the grid draws `≔` between); a function definition's name cell holds
 * its parameters too, and they are names in its body. A trailing top-level
 * `in` or `to` doesn't show: it is the result's display unit (section 4).
 */
export function lineTex(node: MathNode, names: Names): LineTex {
  if (isFunctionAssignmentNode(node)) {
    const params = node.params
    const inBody: Names = { ...names, isSheetName: (n) => params.includes(n) || names.isSheetName(n) }
    return {
      name: `${nameTex(node.name)}\\left(${params.map(nameTex).join(',')}\\right)`,
      expression: toTex(node.expr, inBody),
    }
  }
  if (isAssignmentNode(node) && !node.index) {
    return { name: nameTex(node.name), expression: toTex(withoutConversion(node.value), names) }
  }
  return { name: null, expression: toTex(withoutConversion(node), names) }
}

/**
 * A solve line (section 4): `Q_op ≔ solve H_p(Q) = H_s(Q)`, and its guess,
 * which the grid sets small and grey after the equation.
 * `names` already counts the unknown and the parameters as sheet names.
 */
export function solveTex(
  name: string,
  params: readonly string[] | null,
  parts: { unknown: string; lhs: MathNode; rhs: MathNode; guess: MathNode },
  names: Names,
): LineTex & { aside: string } {
  const head = params === null ? nameTex(name) : `${nameTex(name)}\\left(${params.map(nameTex).join(',')}\\right)`
  return {
    name: head,
    expression: `\\mathrm{solve}\\;${toTex(parts.lhs, names)}=${toTex(parts.rhs, names)}`,
    aside: `\\text{guess }${nameTex(parts.unknown)}=${toTex(parts.guess, names)}`,
  }
}

/**
 * A range line (section 4): `Q_s ≔ 1 L/s … 30 L/s`, and its step, which the
 * grid sets small and grey after it.
 */
export function rangeTex(
  name: string | null,
  parts: { start: MathNode; end: MathNode; step: MathNode | null },
  names: Names,
): LineTex & { aside?: string } {
  const expression = `${toTex(parts.start, names)}\\ldots ${toTex(parts.end, names)}`
  const tex: LineTex & { aside?: string } = { name: name === null ? null : nameTex(name), expression }
  if (parts.step !== null) tex.aside = `\\text{step }${toTex(parts.step, names)}`
  return tex
}

function withoutConversion(node: MathNode): MathNode {
  return isOperatorNode(node) && node.fn === 'to' ? node.args[0] : node
}

function toTex(node: MathNode, names: Names): string {
  const handler = (child: MathNode, options: object): string | undefined => {
    if (isSymbolNode(child)) {
      const tex = symbolTex(child.name, names)
      // math.js glues operands onto operators: `\cdot` then `v` is `\cdotv`.
      return tex === undefined ? undefined : ` ${tex}`
    }
    // An index (M4c) in square brackets after the whole name, at the baseline.
    const index = indexParts(child)
    if (index !== null) {
      return ` ${index.object.toTex(options)}\\lbrack ${index.index.toTex(options)}\\rbrack `
    }
    if (isFunctionNode(child) && isSymbolNode(child.fn) && isSheetFunction(child.fn.name, names)) {
      const args = child.args.map((arg) => arg.toTex(options)).join(',')
      return ` ${nameTex(child.fn.name)}\\left(${args}\\right)`
    }
    const quantity = quantityTex(child, names)
    return quantity === null ? undefined : ` ${quantity}`
  }
  return node.toTex({ parenthesis: 'auto', implicit: 'hide', handler } as object).trim()
}

function symbolTex(name: string, names: Names): string | undefined {
  if (names.isSheetName(name)) return nameTex(name)
  if (names.isUnit(name)) return unitNameTex(name, names)
  if (names.isBuiltIn(name)) return undefined
  return nameTex(name)
}

function isSheetFunction(name: string, names: Names): boolean {
  return names.isSheetName(name) || !names.isBuiltIn(name)
}

/** `50 m^3/h` inline, with a thin space, rather than as a fraction. Null if not a quantity. */
function quantityTex(node: MathNode, names: Names): string | null {
  if (!isOperatorNode(node) || (node.fn !== 'multiply' && node.fn !== 'divide')) return null
  const [left, right] = node.args
  const unit = unitTex(right, names)
  if (unit === null) return null
  if (isConstantNode(left) && typeof left.value === 'number' && node.fn === 'multiply') {
    return `${sourceNumberTex(String(left.value))}\\,${unit}`
  }
  const quantity = quantityTex(left, names)
  if (quantity === null) return null
  return node.fn === 'multiply' ? `${quantity}\\,${unit}` : `${quantity}/${unit}`
}

/** A pure unit expression (`m`, `kg/(m s^2)`) as TeX, or null if it isn't one. */
export function unitTex(node: MathNode, names: Names): string | null {
  if (isSymbolNode(node)) {
    return names.isUnit(node.name) && !names.isSheetName(node.name)
      ? unitNameTex(node.name, names)
      : null
  }
  if (isParenthesisNode(node)) {
    const inner = unitTex(node.content, names)
    return inner === null ? null : `\\left(${inner}\\right)`
  }
  if (!isOperatorNode(node)) return null
  if (node.fn === 'pow') {
    const base = unitTex(node.args[0], names)
    const exponent = exponentText(node.args[1])
    return base === null || exponent === null ? null : `{${base}}^{${exponent}}`
  }
  if (node.fn !== 'multiply' && node.fn !== 'divide') return null
  const left = unitTex(node.args[0], names)
  const right = unitTex(node.args[1], names)
  if (left === null || right === null) return null
  if (node.fn === 'multiply') return `${left}\\,${right}`
  const grouped = isOperatorNode(node.args[1]) && node.args[1].fn !== 'pow'
  return `${left}/${grouped ? `\\left(${right}\\right)` : right}`
}

function exponentText(node: MathNode): string | null {
  if (isConstantNode(node) && typeof node.value === 'number') return String(node.value)
  if (isOperatorNode(node) && node.fn === 'unaryMinus') {
    const inner = exponentText(node.args[0])
    return inner === null ? null : `-${inner}`
  }
  return null
}

/** `kPa` upright; micro as `\mu`, not math.js's `u`; ohm as Ω; degrees as °. */
function unitNameTex(name: string, names: Names): string {
  if (name === 'deg') return '{}^{\\circ}'
  const ohm = /^(.*)ohm$/.exec(name)
  if (ohm) return `\\mathrm{${prefixTex(ohm[1], names)}}\\Omega`
  if (names.isMicro(name)) return `\\mathrm{\\mu ${name.slice(1)}}`
  return `\\mathrm{${name}}`
}

function prefixTex(prefix: string, names: Names): string {
  return prefix === 'u' && names.isMicro(`${prefix}ohm`) ? '\\mu ' : prefix
}

/** A number in source: never reformatted (section 5), so `1.2e-5` stays as written. */
function sourceNumberTex(text: string): string {
  return /^-?[\d.]+$/.test(text) ? text : `\\text{${text}}`
}

/**
 * A result's plain text (section 5, Numbers) typeset (section 4): the number
 * in KaTeX's form (`1.235 \cdot 10^{4}`), then the unit typeset as a unit.
 * `parseUnit` reads the unit text; anything that isn't a number with an
 * optional unit, such as a complex number, shows as plain text.
 */
export function resultTex(
  text: string,
  parseUnit: (text: string) => MathNode,
  names: Names,
): string {
  const split = leadingNumber(text)
  if (split && (split.rest === '' || split.rest.startsWith(' '))) {
    const number = numberTex(split.number)
    if (split.rest === '') return number
    try {
      const unit = unitTex(parseUnit(split.rest.slice(1)), names)
      if (unit !== null) return `${number}\\,${unit}`
    } catch {
      // Not a unit: shown as text below.
    }
  }
  return textTex(text)
}

/** Literal text in TeX's text mode. */
export function textTex(text: string): string {
  const escaped = text.replace(/[\\{}$&#^_%~]/g, (char) => {
    switch (char) {
      case '\\':
        return '\\textbackslash{}'
      case '^':
        return '\\textasciicircum{}'
      case '~':
        return '\\textasciitilde{}'
      default:
        return `\\${char}`
    }
  })
  return `\\text{${escaped}}`
}
