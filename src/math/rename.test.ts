import { describe, expect, it } from 'vitest'
import pumpDoc from '../../docs/acceptance/pump-sizing.md?raw'
import truePositionDoc from '../../docs/acceptance/true-position.md?raw'
import { examples, sections } from '../test/guideExamples.ts'
import { evaluateSheet, type SheetBlock } from './evaluate.ts'
import { lineFormats, storeFormats } from './lineForm.ts'
import { applyRename, planRename, type RenamePlan } from './rename.ts'
import renameSource from './rename.ts?raw'

/**
 * A rename in the engine (docs/spec-v1.md section 4, Renaming a name; section
 * 14, 0.5.0): its reach, its uses, what it leaves alone, what it refuses and
 * what it says would change.
 */

/** One element holding `lines`, each with its stored clause if `formats` gives one. */
function sheet(lines: readonly string[], formats?: readonly string[]): SheetBlock[] {
  return [{ id: 'a', source: lines.join('\n'), ...(formats ? { formats: storeFormats(formats) } : {}) }]
}

/** The plan for renaming the name line `line` (from 0) assigns. */
function plan(lines: readonly string[], line: number, name: string, to: string, formats?: readonly string[]): RenamePlan {
  const found = planRename(sheet(lines, formats), { id: 'a', line, name }, to)
  if (found === null) throw new Error(`line ${line} doesn't assign ${name}`)
  return found
}

/** The sheet's lines after that rename. */
function renamed(lines: readonly string[], line: number, name: string, to: string): string[] {
  const found = plan(lines, line, name, to)
  expect(found.refusal).toBeNull()
  return applyRename(sheet(lines), found.lines)[0].source.split('\n')
}

/** The lines a plan writes, by their index. */
const written = (found: RenamePlan) => found.lines.map((line) => line.line)

describe('the module (section 14, 0.5.0)', () => {
  it('is the engine’s alone: no React, no Excalidraw, nothing outside src/math but math.js’s node tests', () => {
    const imports = [...renameSource.matchAll(/from '([^']+)'/g)].map(([, from]) => from)
    expect(imports.length).toBeGreaterThan(0)
    for (const from of imports) expect(from === 'mathjs' || /^\.\/\w+\.ts$/.test(from), from).toBe(true)
  })
})

describe('the reach of a rename (section 4, What a rename changes)', () => {
  const twice = ['rho = 1000', 'a = rho * 2', 'rho = rho * 1.1 # rho, hotter', 'b = rho * 2']

  it('changes the assigning line and every use down to the next line that assigns the name', () => {
    const found = plan(twice, 0, 'rho', 'rho_w')
    expect(applyRename(sheet(twice), found.lines)[0].source.split('\n')).toEqual([
      'rho_w = 1000',
      'a = rho_w * 2',
      'rho = rho_w * 1.1 # rho, hotter',
      'b = rho * 2',
    ])
    expect(written(found)).toEqual([0, 1, 2])
    expect(found.changes).toEqual([])
  })

  it('renames the second reach of a name assigned twice from its own line: the right side there is the first reach', () => {
    const found = plan(twice, 2, 'rho', 'rho_h')
    expect(applyRename(sheet(twice), found.lines)[0].source.split('\n')).toEqual([
      'rho = 1000',
      'a = rho * 2',
      'rho_h = rho * 1.1 # rho, hotter',
      'b = rho_h * 2',
    ])
    expect(found.changes).toEqual([])
  })

  it('never touches a use above the assignment', () => {
    expect(renamed(['a = rho', 'rho = 2', 'b = rho'], 1, 'rho', 'rho_w')).toEqual(['a = rho', 'rho_w = 2', 'b = rho_w'])
  })

  it('reaches into the elements below, in reading order', () => {
    const blocks: SheetBlock[] = [
      { id: 'top', source: 'y = rho\nrho = 1000' },
      { id: 'mid', source: 'a = rho * 2\nb = 3' },
      { id: 'low', source: 'rho = 5\nc = rho' },
    ]
    const found = planRename(blocks, { id: 'top', line: 1, name: 'rho' }, 'rho_w')!
    expect(found.lines.map(({ id, line, text }) => [id, line, text])).toEqual([
      ['top', 1, 'rho_w = 1000'],
      ['mid', 0, 'a = rho_w * 2'],
    ])
    expect(applyRename(blocks, found.lines).map((block) => block.source)).toEqual([
      'y = rho\nrho_w = 1000',
      'a = rho_w * 2\nb = 3',
      'rho = 5\nc = rho',
    ])
  })

  it('reads a rule on the line that ends a reach as that line’s own assignment', () => {
    const lines = ['rho = 1000', 'rho = rho * 1.1 @bold if rho > 1050']
    expect(renamed(lines, 0, 'rho', 'rho_w')).toEqual(['rho_w = 1000', 'rho = rho_w * 1.1 @bold if rho > 1050'])
    expect(renamed(lines, 1, 'rho', 'rho_h')).toEqual(['rho = 1000', 'rho_h = rho * 1.1 @bold if rho_h > 1050'])
  })

  it('ends at a line that assigns the name and doesn’t parse, which is left as typed', () => {
    expect(renamed(['rho = 1000', 'a = rho', 'rho = rho *', 'b = rho'], 0, 'rho', 'rho_w')).toEqual([
      'rho_w = 1000',
      'a = rho_w',
      'rho = rho *',
      'b = rho',
    ])
  })

  it('is no plan for a line that doesn’t assign the name', () => {
    const blocks = sheet(['rho = 1000', 'a = rho * 2', '# rho'])
    expect(planRename(blocks, { id: 'a', line: 1, name: 'rho' }, 'x')).toBeNull()
    expect(planRename(blocks, { id: 'a', line: 2, name: 'rho' }, 'x')).toBeNull()
    expect(planRename(blocks, { id: 'a', line: 9, name: 'rho' }, 'x')).toBeNull()
    expect(planRename(blocks, { id: 'none', line: 0, name: 'rho' }, 'x')).toBeNull()
  })
})

describe('what a use is (section 4, What a rename changes)', () => {
  it('a rule’s condition, typed in the line and stored beside it', () => {
    const lines = ['lim = 3', 'v = 2 * lim @bold if v > lim']
    const formats = ['', '@text-red if v > 2 * lim @yellow']
    const found = plan(lines, 0, 'lim', 'v_max', formats)
    expect(found.lines).toEqual([
      { id: 'a', line: 0, text: 'v_max = 3', stored: '', uses: [{ start: 0, end: 3 }], storedUses: [] },
      {
        id: 'a',
        line: 1,
        text: 'v = 2 * v_max @bold if v > v_max',
        stored: '@text-red if v > 2 * v_max @yellow',
        uses: [
          { start: 8, end: 11 },
          { start: 25, end: 28 },
        ],
        storedUses: [{ start: 21, end: 24 }],
      },
    ])
    expect(applyRename(sheet(lines, formats), found.lines)[0].formats).toBe('\n@text-red if v > 2 * v_max @yellow')
    expect(found.changes).toEqual([])
  })

  it('a line whose only use is in its stored clause is written', () => {
    const found = plan(['lim = 3', 'v = 2'], 0, 'lim', 'v_max', ['', '@bold if result < lim'])
    expect(found.lines[1]).toMatchObject({ line: 1, text: 'v = 2', stored: '@bold if result < v_max' })
  })

  it('an index: the list indexed and the name inside the brackets', () => {
    const lines = ['xs = 1 .. 5', 'i = 2', 'y = xs[i] + xs[1]']
    expect(renamed(lines, 0, 'xs', 'Q_s')).toEqual(['Q_s = 1 .. 5', 'i = 2', 'y = Q_s[i] + Q_s[1]'])
    expect(renamed(lines, 1, 'i', 'n')).toEqual(['xs = 1 .. 5', 'n = 2', 'y = xs[n] + xs[1]'])
  })

  it('a solve line’s equation, search range and guess', () => {
    const lines = [
      'c = 4',
      'r = solve c * t = 8, for t = 0 .. c',
      'g(t) = solve t * c = u, guess u = c',
    ]
    expect(renamed(lines, 0, 'c', 'c_0')).toEqual([
      'c_0 = 4',
      'r = solve c_0 * t = 8, for t = 0 .. c_0',
      'g(t) = solve t * c_0 = u, guess u = c_0',
    ])
  })

  it('a table’s and a plot’s arguments and clauses: a mark, a range, a point, a circle', () => {
    const lines = [
      'k = 2',
      'xs = 1 .. 10',
      'table(xs, xs * k in m, k)',
      'plot(xs, xs * k in m), mark k, x 0 .. 5 k, y k .. 20, point (k, 2 k), circle (k, k) k / 2, title "k times x"',
    ]
    expect(renamed(lines, 0, 'k', 'gain')).toEqual([
      'gain = 2',
      'xs = 1 .. 10',
      'table(xs, xs * gain in m, gain)',
      'plot(xs, xs * gain in m), mark gain, x 0 .. 5 gain, y gain .. 20, point (gain, 2 gain), circle (gain, gain) gain / 2, title "k times x"',
    ])
    expect(renamed(lines, 1, 'xs', 'Q_s').slice(2)).toEqual([
      'table(Q_s, Q_s * k in m, k)',
      'plot(Q_s, Q_s * k in m), mark k, x 0 .. 5 k, y k .. 20, point (k, 2 k), circle (k, k) k / 2, title "k times x"',
    ])
  })

  it('a range line’s ends and its step', () => {
    expect(renamed(['n = 2', 'xs = n .. 5 n step n'], 0, 'n', 'dx')).toEqual(['dx = 2', 'xs = dx .. 5 dx step dx'])
  })

  it('a function body that reads the sheet’s name', () => {
    expect(renamed(['rho = 1000', 'm_of(V) = rho * V', 'y = m_of(2)'], 0, 'rho', 'rho_w')).toEqual([
      'rho_w = 1000',
      'm_of(V) = rho_w * V',
      'y = m_of(2)',
    ])
  })

  it('a function’s own name: its definition, every call and every alias in its reach', () => {
    const lines = ['sq(x) = x^2', 'alias = sq', 'y = sq(2) + alias(3)', 'fact(n) = n <= 1 ? 1 : n * fact(n - 1)']
    expect(renamed(lines, 0, 'sq', 'square')).toEqual([
      'square(x) = x^2',
      'alias = square',
      'y = square(2) + alias(3)',
      'fact(n) = n <= 1 ? 1 : n * fact(n - 1)',
    ])
    // A function that calls itself reads its own assignment.
    expect(renamed(lines, 3, 'fact', 'factorial')[3]).toBe('factorial(n) = n <= 1 ? 1 : n * factorial(n - 1)')
  })

  it('a function defined again ends the reach, and its body isn’t in it: the body runs after the line', () => {
    const lines = ['sq(x) = x^2', 'y = sq(2)', 'sq(x) = sq(x) + 1']
    expect(renamed(lines, 0, 'sq', 'square')).toEqual(['square(x) = x^2', 'y = square(2)', 'sq(x) = sq(x) + 1'])
  })

  it('a solve function reads its own name as itself, a solved value as the assignment above', () => {
    const lines = ['w = 2', 'w = solve w * t = 8, for t = 0 .. 10', 'h(a) = solve h(a - 1) + u = a, guess u = 1']
    expect(renamed(lines, 0, 'w', 'w_0')[1]).toBe('w = solve w_0 * t = 8, for t = 0 .. 10')
    expect(renamed(lines, 2, 'h', 'height')[2]).toBe('height(a) = solve height(a - 1) + u = a, guess u = 1')
  })
})

describe('what a rename leaves alone (section 4)', () => {
  it('a text in quotes', () => {
    expect(renamed(['ok = 1', 'label = ok == 1 ? "ok" : "not ok"'], 0, 'ok', 'pass')).toEqual([
      'pass = 1',
      'label = pass == 1 ? "ok" : "not ok"',
    ])
  })

  it('a note, and a line that only mentions the name in one', () => {
    const found = plan(['rho = 1000 # rho of water', 'a = 2 # times rho', 'b = rho'], 0, 'rho', 'rho_w')
    expect(found.lines.map((line) => line.text)).toEqual(['rho_w = 1000 # rho of water', 'b = rho_w'])
    expect(written(found)).toEqual([0, 2])
  })

  it('a comment line, with or without a format', () => {
    const lines = ['rho = 1000', '# rho is the density', '@bold @L # rho', 'a = rho']
    expect(renamed(lines, 0, 'rho', 'rho_w')).toEqual(['rho_w = 1000', '# rho is the density', '@bold @L # rho', 'a = rho_w'])
  })

  it('the unit after in, on a line and on a table’s or a plot’s argument', () => {
    const lines = ['m = 3 kg', 'a = 2 km in m', 'xs = 1 km .. 3 km', 'table(xs in m, xs * m)', 'plot(xs in m, xs * m in m^2)']
    expect(renamed(lines, 0, 'm', 'mass')).toEqual([
      'mass = 3 kg',
      'a = 2 km in m',
      'xs = 1 km .. 3 km',
      'table(xs in m, xs * mass)',
      'plot(xs in m, xs * mass in m^2)',
    ])
  })

  it('a name that shadows a unit is followed where the engine reads the name: 5 m against in m, below m = …', () => {
    const lines = ['a = 5 m', 'm = 3 kg', 'b = 5 m', 'c = 2 m in m', 'd = 4 kg / m^2']
    expect(renamed(lines, 1, 'm', 'mass')).toEqual(['a = 5 m', 'mass = 3 kg', 'b = 5 mass', 'c = 2 mass in m', 'd = 4 kg / mass^2'])
    expect(plan(lines, 1, 'm', 'mass').changes).toEqual([])
  })

  it('a function whose parameter has that name: inside it the name is the parameter', () => {
    const lines = ['x = 2', 'f(x) = x^2 + 1', 'g(a, x) = solve a * u = x, guess u = x', 'y = f(x)']
    expect(renamed(lines, 0, 'x', 'x_0')).toEqual(['x_0 = 2', 'f(x) = x^2 + 1', 'g(a, x) = solve a * u = x, guess u = x', 'y = f(x_0)'])
  })

  it('a solve whose unknown has that name, in its equation, its range and its guess', () => {
    const lines = ['t = 3', 'r = solve t^2 = 4, for t = 0 .. 10', 'g(a) = solve a * t = 8, guess t = 1', 'y = t']
    expect(renamed(lines, 0, 't', 't_0')).toEqual([
      't_0 = 3',
      'r = solve t^2 = 4, for t = 0 .. 10',
      'g(a) = solve a * t = 8, guess t = 1',
      'y = t_0',
    ])
  })

  it('a solved value named as its own unknown keeps the unknown', () => {
    expect(renamed(['x = solve x^2 = 4, for x = 0 .. 10', 'y = x'], 0, 'x', 'root')).toEqual([
      'root = solve x^2 = 4, for x = 0 .. 10',
      'y = root',
    ])
  })

  it('a rule’s result, which is the line’s own value', () => {
    const lines = ['result = 5', 'y = result * 2 @bold if result > 7', 'z = 1 @bold if y > result']
    expect(renamed(lines, 0, 'result', 'total')).toEqual(['total = 5', 'y = total * 2 @bold if result > 7', 'z = 1 @bold if y > result'])
  })

  it('a plot’s own words and its title: x, y, mark and step stay keywords', () => {
    const lines = ['x = 2', 'y = 20', 'step = 1', 'xs = 1 .. 10 step step', 'plot(xs, xs * x), mark x, x 0 .. x, y 0 .. y, x log, title "x"']
    expect(renamed(lines, 0, 'x', 'x_0')[4]).toBe('plot(xs, xs * x_0), mark x_0, x 0 .. x_0, y 0 .. y, x log, title "x"')
    expect(renamed(lines, 1, 'y', 'y_0')[4]).toBe('plot(xs, xs * x), mark x, x 0 .. x, y 0 .. y_0, x log, title "x"')
    expect(renamed(lines, 2, 'step', 'dx')[3]).toBe('xs = 1 .. 10 step dx')
  })

  it('a longer name, a number’s exponent and a property that hold the same letters', () => {
    const lines = ['e3 = 5', 'e3x = 2e3', 'xe3 = e3x + 2e3 + e3', 'o = {e3: 1}', 'p = o.e3 + e3']
    expect(renamed(lines, 0, 'e3', 'k')).toEqual(['k = 5', 'e3x = 2e3', 'xe3 = e3x + 2e3 + k', 'o = {e3: 1}', 'p = o.e3 + k'])
  })

  it('a line that doesn’t parse, except the name it assigns when it is the line renamed', () => {
    const lines = ['rho = 1000', 'a = rho * (', 'b = rho']
    expect(renamed(lines, 0, 'rho', 'rho_w')).toEqual(['rho_w = 1000', 'a = rho * (', 'b = rho_w'])
    const broken = ['rho = 1000 *', 'b = rho']
    expect(renamed(broken, 0, 'rho', 'rho_w')).toEqual(['rho_w = 1000 *', 'b = rho_w'])
    expect(plan(broken, 0, 'rho', 'rho_w').changes).toEqual([])
  })

  it('every character that isn’t the name: spacing, the note, the format and the rules, as typed', () => {
    const lines = ['  rho   =  1000   kg/m^3   in  g/L  @bold   @text-red if  rho>999 kg/m^3    #  rho, water ', '\tm_w=rho*2 L+rho  *3 L in kg@yellow#rho']
    const formats = ['@underline   @red if rho  <  1 kg/m^3', '']
    const found = plan(lines, 0, 'rho', 'rho_w', formats)
    expect(found.lines.map((line) => [line.text, line.stored])).toEqual([
      ['  rho_w   =  1000   kg/m^3   in  g/L  @bold   @text-red if  rho_w>999 kg/m^3    #  rho, water ', '@underline   @red if rho_w  <  1 kg/m^3'],
      ['\tm_w=rho_w*2 L+rho_w  *3 L in kg@yellow#rho', ''],
    ])
    expect(found.changes).toEqual([])
  })
})

describe('what a rename refuses, and what it allows with a warning (section 4, The form)', () => {
  const lines = ['mu = 1', 'rho = 1000', 'a = rho * mu', 'nu = 3', 'broken = 2 *']
  const refusal = (to: string) => plan(lines, 1, 'rho', to).refusal

  it('a name the sheet already assigns, above or below, even on a line that doesn’t parse', () => {
    expect(refusal('mu')).toEqual({ kind: 'taken', message: 'mu is already a name on this sheet.' })
    expect(refusal('nu')).toEqual({ kind: 'taken', message: 'nu is already a name on this sheet.' })
    expect(refusal('a')).toEqual({ kind: 'taken', message: 'a is already a name on this sheet.' })
    expect(refusal('broken')).toEqual({ kind: 'taken', message: 'broken is already a name on this sheet.' })
  })

  it.each(['table', 'plot', 'solve', 'if'])('the reserved word %s', (word) => {
    expect(refusal(word)).toEqual({ kind: 'reserved', message: `${word} is reserved.` })
  })

  it.each(['2x', 'a b', 'rho w', 'x.y', 'f(x)', 'rho-w', ' x', 'true', '"x"', 'a = b', '5'])('text that isn’t a name: %s', (text) => {
    expect(refusal(text)).toEqual({ kind: 'not-a-name', message: `${text} isn't a name.` })
  })

  it('the old name and an empty field, with nothing to say', () => {
    expect(refusal('rho')).toEqual({ kind: 'same', message: null })
    expect(refusal('')).toEqual({ kind: 'empty', message: null })
    expect(refusal('  ')).toEqual({ kind: 'empty', message: null })
  })

  it('still lists the lines when it refuses, and writes none of them', () => {
    const found = plan(lines, 1, 'rho', 'mu')
    expect(found.lines.map((line) => [line.line, line.text, line.uses])).toEqual([
      [1, 'rho = 1000', [{ start: 0, end: 3 }]],
      [2, 'a = rho * mu', [{ start: 4, end: 7 }]],
    ])
    expect(found.changes).toEqual([])
    expect(found.warning).toBeNull()
    expect(applyRename(sheet(lines), found.lines)).toEqual(sheet(lines))
  })

  it('allows a unit’s name, with the shadow warning in the warning’s own words', () => {
    const found = plan(lines, 1, 'rho', 'm')
    expect(found.refusal).toBeNull()
    expect(found.warning).toBe('m shadows the unit m')
    expect(found.lines.map((line) => line.text)).toEqual(['m = 1000', 'a = m * mu'])
    const shown = evaluateSheet(applyRename(sheet(lines), found.lines)).get('a')!
    expect(shown[1].warnings).toContain(found.warning)
  })

  it('allows a built-in’s name, with its warning', () => {
    const found = plan(lines, 1, 'rho', 'sqrt')
    expect(found.refusal).toBeNull()
    expect(found.warning).toBe('sqrt shadows the built-in sqrt')
  })

  it('has no warning for a plain name, or for a constant’s short name, which a sheet may take', () => {
    expect(plan(lines, 1, 'rho', 'rho_w')).toMatchObject({ refusal: null, warning: null })
    expect(plan(lines, 1, 'rho', 'R')).toMatchObject({ refusal: null, warning: null })
  })
})

describe('a rename that would change a result is said, not refused (section 4, The form)', () => {
  it('a new name that shadows a unit used below', () => {
    const lines = ['d = 50 mm', 'L = 5 m', 'A = d * L', 'V = 2 m^3']
    const found = plan(lines, 0, 'd', 'm')
    expect(found.refusal).toBeNull()
    expect(found.warning).toBe('m shadows the unit m')
    // `L` and `V` now read the variable; `A` follows `L`.
    expect(found.changes).toEqual([
      { id: 'a', line: 1 },
      { id: 'a', line: 2 },
      { id: 'a', line: 3 },
    ])
  })

  it('a new name that is the parameter of a function whose body reads the old name', () => {
    const lines = ['rho = 1000', 'm_of(V) = rho * V', 'y = m_of(2)', 'z = rho']
    const found = plan(lines, 0, 'rho', 'V')
    expect(found.refusal).toBeNull()
    expect(found.lines.map((line) => line.text)).toEqual(['V = 1000', 'm_of(V) = V * V', 'z = V'])
    expect(found.changes).toEqual([{ id: 'a', line: 2 }])
  })

  it('a function that reads the name across a second assignment', () => {
    const lines = ['rho = 1000', 'm_of(V) = rho * V', 'rho = 800', 'y = m_of(2)']
    const found = plan(lines, 0, 'rho', 'rho_w')
    expect(found.refusal).toBeNull()
    expect(found.lines.map((line) => line.text)).toEqual(['rho_w = 1000', 'm_of(V) = rho_w * V'])
    // The call read 800 before, and reads 1000 after.
    expect(found.changes).toEqual([{ id: 'a', line: 3 }])
  })

  it('a table’s cells and a plot’s points count as their line’s result', () => {
    const lines = ['k = 2', 'gain(x) = k * x', 'k = 3', 'xs = 1 .. 3', 'table(xs, gain(xs))', 'plot(xs, gain(xs))']
    expect(plan(lines, 0, 'k', 'k_0').changes).toEqual([
      { id: 'a', line: 4 },
      { id: 'a', line: 5 },
    ])
  })

  it('an error that names the renamed name is the same error under the new name', () => {
    const lines = ['a = rho', 'rho = 1 m + 1 s', 'b = rho', 'c = 2 * (rho']
    const found = plan(lines, 1, 'rho', 'rho_w')
    expect(evaluateSheet(sheet(lines)).get('a')![2].result).toEqual({ kind: 'error', message: 'rho has an error above' })
    // The use above read "rho is defined below", and no line defines rho now.
    expect(found.changes).toEqual([{ id: 'a', line: 0 }])
  })

  it('keeps nothing from the runs: the same plan twice', () => {
    const lines = ['d = 50 mm', 'L = 5 m']
    expect(plan(lines, 0, 'd', 'm')).toEqual(plan(lines, 0, 'd', 'm'))
  })
})

describe('writing a plan (applyRename)', () => {
  it('keeps every line end and every untouched element as it is', () => {
    const blocks: SheetBlock[] = [
      { id: 'a', source: 'rho = 1\r\nb = rho\n\nc = rho\r\n', formats: '@bold\n\n\n@red if rho > 0' },
      { id: 'b', source: 'x = 1' },
    ]
    const found = planRename(blocks, { id: 'a', line: 0, name: 'rho' }, 'r')!
    const after = applyRename(blocks, found.lines)
    // One stored clause per line, as every write of the formats pads them (section 7).
    expect(after[0]).toEqual({ id: 'a', source: 'r = 1\r\nb = r\n\nc = r\r\n', formats: '@bold\n\n\n@red if r > 0\n' })
    expect(after[1]).toBe(blocks[1])
  })

  it('leaves the stored formats untouched, text for text, when no stored clause changes', () => {
    const blocks: SheetBlock[] = [{ id: 'a', source: 'rho = 1\nb = rho', formats: '@bold\n\n\n' }]
    const found = planRename(blocks, { id: 'a', line: 0, name: 'rho' }, 'r')!
    expect(applyRename(blocks, found.lines)[0]).toEqual({ id: 'a', source: 'r = 1\nb = r', formats: '@bold\n\n\n' })
  })
})

/**
 * The test that holds the rename (section 14, 0.5.0): for every name in the
 * Math guide's examples and in the two acceptance sheets, a rename to a name
 * the sheet doesn't hold changes no line's result, and renaming it back gives
 * the sheet's text again, character for character.
 *
 * Two of the guide's examples read a name above the line that assigns it, to
 * show what that does. A use above the assignment is never touched, so each
 * is a result the rename changes, and says so: `CHANGED` names them. One
 * example assigns a reserved word to show its error; no rename starts there.
 */
const CHANGED: Record<string, readonly string[]> = {
  // "Functions": `y_u(x) = x + z_u` is above `z_u = 1`, and its body runs at the call below.
  z_u: ['y_u(1)'],
  // "Common messages": the line read "b_1 is defined below"; no line defines b_1 afterwards.
  b_1: ['a_1 = b_1 + 1'],
}
const RESERVED = ['table']

describe('every name of the Math guide and the acceptance sheets, renamed and renamed back', () => {
  const pump = [...pumpDoc.matchAll(/^\| (c|\d+[a-z]?) \| `(.+?)` \|/gm)].map(([, , source]) => source)
  const truePosition = [...truePositionDoc.matchAll(/^\| (c|\d+) \| `(.+?)` \| (—|`(.+?)`) \|/gm)].map(([, , source, , format]) => ({
    source,
    format: format ?? '',
  }))
  const sheets: { title: string; block: SheetBlock }[] = [
    ...sections().flatMap((section) => {
      const found = examples(section)
      return found.length === 0 ? [] : [{ title: `the guide's "${section.title}"`, block: { id: 'a', source: found.map(({ source }) => source).join('\n') } }]
    }),
    { title: 'the pump sheet', block: { id: 'a', source: pump.join('\n') } },
    {
      title: 'the true-position sheet',
      block: { id: 'a', source: truePosition.map((row) => row.source).join('\n'), formats: storeFormats(truePosition.map((row) => row.format)) },
    },
  ]

  it('reads the sheets from the documents', () => {
    expect(sheets.map(({ title }) => title)).toHaveLength(15)
    expect(pump).toHaveLength(43)
    expect(truePosition).toHaveLength(9)
  })

  /** A plan's lines with `name` written at each place found, whether or not the plan was refused. */
  const writtenAnyway = (found: RenamePlan, name: string) =>
    found.lines.map((line) => ({
      ...line,
      text: [...line.uses].reverse().reduce((text, span) => `${text.slice(0, span.start)}${name}${text.slice(span.end)}`, line.text),
      stored: [...line.storedUses].reverse().reduce((text, span) => `${text.slice(0, span.start)}${name}${text.slice(span.end)}`, line.stored),
    }))

  for (const { title, block } of sheets) {
    it(`in ${title}`, () => {
      const blocks = [block]
      const count = block.source.split('\n').length
      const all = `${block.source}\n${block.formats ?? ''}`
      const sources = block.source.split('\n')
      const targets = evaluateSheet(blocks)
        .get('a')!
        .flatMap((line, index) => line.variables.map(({ name }) => ({ id: 'a', line: index, name })))
        .filter(({ name }) => !RESERVED.includes(name))
      expect(targets.length).toBeGreaterThan(0)
      const failures: string[] = []
      for (const target of targets) {
        let fresh = `${target.name}_zz`
        while (all.includes(fresh)) fresh += 'z'
        const where = `${target.name} on line ${target.line + 1}`
        const there = planRename(blocks, target, fresh)
        if (there === null || there.refusal !== null) {
          failures.push(`${where}: ${there === null ? 'no plan' : JSON.stringify(there.refusal)}`)
          continue
        }
        const changed = there.changes.map((change) => sources[change.line])
        if (changed.join('\n') !== (CHANGED[target.name] ?? []).join('\n')) {
          failures.push(`${where}: changes the result of ${changed.length === 0 ? 'no line' : changed.join(' and ')}`)
        }
        const moved = applyRename(blocks, there.lines)
        const back = planRename(moved, { ...target, name: fresh }, target.name)
        if (back === null) {
          failures.push(`${where}: no plan back`)
          continue
        }
        // A name the sheet assigns twice is refused on the way back: the other reach still holds it.
        const assignedOnce = targets.filter(({ name }) => name === target.name).length === 1
        if ((back.refusal === null) !== assignedOnce) failures.push(`${where}: on the way back, ${JSON.stringify(back.refusal)}`)
        const restored = applyRename(moved, back.refusal === null ? back.lines : writtenAnyway(back, target.name))[0]
        if (restored.source !== block.source) failures.push(`${where}: the text came back different`)
        if (storeFormats(lineFormats(restored.formats ?? '', count)) !== storeFormats(lineFormats(block.formats ?? '', count))) {
          failures.push(`${where}: the stored formats came back different`)
        }
      }
      expect(failures.join('\n')).toBe('')
      // The pump sheet's solves run four times for each of its names.
    }, 60_000)
  }

  it('meets each example it sets aside', () => {
    const names = sheets.flatMap(({ block }) => evaluateSheet([block]).get('a')!.flatMap((line) => line.variables.map(({ name }) => name)))
    for (const name of [...Object.keys(CHANGED), ...RESERVED]) expect(names).toContain(name)
  })
})
