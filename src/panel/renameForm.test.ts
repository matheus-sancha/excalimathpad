import { describe, expect, it } from 'vitest'
import { RENAME_WORDS, renameBlocks, renameFormView, type RenameElement } from './renameForm.ts'

/**
 * The rename form's view (docs/spec-v1.md section 4, Renaming a name: The
 * form, on a Variables row; section 13, Rename and Language).
 */

const element = (anchorId: string, source: string, title: string | null = null, formats?: string): RenameElement => ({
  anchorId,
  title,
  lines: [],
  source,
  ...(formats === undefined ? {} : { formats }),
})

const SHEET = [
  element('a', 'rho = 1000 kg/m^3\nmu = 1 mPa s # of rho\nm_dot = rho * 2 L/s', 'Fluid and pipe'),
  element('b', 'P = rho * 9.81 m/s^2 * 3 m\nlabel = "rho"', null, '@bold if rho > 1 kg/m^3\n'),
]
const RHO = { id: 'a', line: 0, name: 'rho' }

/** A line's source as the form shows it, the marked name in brackets. */
const shown = (parts: readonly { text: string; marked: boolean }[]) =>
  parts.map(({ text, marked }) => (marked ? `[${text}]` : text)).join('')

describe('the rename form’s view', () => {
  it('lists what will be written: the assigning line and each line with a use, named by element, the name marked', () => {
    const view = renameFormView(SHEET, RHO, 'rho_w')!

    expect(view.lines.map(({ where, text }) => `${where}: ${shown(text)}`)).toEqual([
      'Fluid and pipe, line 1: [rho] = 1000 kg/m^3',
      'Fluid and pipe, line 3: m_dot = [rho] * 2 L/s',
      'Element 2, line 1: P = [rho] * 9.81 m/s^2 * 3 m',
    ])
    expect(RENAME_WORDS.lines(view.lines.length)).toBe('Changes 3 lines:')
    expect(view.canRename).toBe(true)
    expect(view.reason).toBeNull()
    expect(view.changes).toEqual([])
    // A line that only mentions the name in a note or a text isn't listed.
    expect(view.lines.some(({ where }) => where === 'Fluid and pipe, line 2' || where === 'Element 2, line 2')).toBe(false)
  })

  it('shows a line’s stored clause where the name stands in it', () => {
    const [, , power] = renameFormView(SHEET, RHO, 'rho_w')!.lines

    expect(shown(power.stored)).toBe('@bold if [rho] > 1 kg/m^3')
    // A line whose clause holds no use shows its text alone.
    expect(renameFormView(SHEET, RHO, 'rho_w')!.lines[0].stored).toEqual([])
  })

  it('is the plan Rename writes', () => {
    const view = renameFormView(SHEET, RHO, 'rho_w')!

    expect(view.plan.lines.map(({ id, line, text, stored }) => [id, line, text, stored])).toEqual([
      ['a', 0, 'rho_w = 1000 kg/m^3', ''],
      ['a', 2, 'm_dot = rho_w * 2 L/s', ''],
      ['b', 0, 'P = rho_w * 9.81 m/s^2 * 3 m', '@bold if rho_w > 1 kg/m^3'],
    ])
  })

  it('drops the spaces around the typed name: a name is one word', () => {
    const view = renameFormView(SHEET, RHO, '  rho_w ')!

    expect(view.canRename).toBe(true)
    expect(view.plan.lines[0].text).toBe('rho_w = 1000 kg/m^3')
  })

  it.each([
    ['mu', 'mu is already a name on this sheet.'],
    ['plot', 'plot is reserved.'],
    ['2x', "2x isn't a name."],
  ])('refuses %s with Rename dimmed and the reason', (name, message) => {
    const view = renameFormView(SHEET, RHO, name)!

    expect(view.canRename).toBe(false)
    expect(view.reason).toEqual({ kind: 'refused', text: message })
    // The list still shows the lines as they are.
    expect(view.lines).toHaveLength(3)
  })

  it.each(['rho', '', '  '])('dims Rename and says nothing for the old name or an empty field (%j)', (name) => {
    const view = renameFormView(SHEET, RHO, name)!

    expect(view.canRename).toBe(false)
    expect(view.reason).toBeNull()
  })

  it('allows a unit’s name, with the shadow warning in the warning’s own words', () => {
    const view = renameFormView(SHEET, RHO, 'm')!

    expect(view.canRename).toBe(true)
    expect(view.reason).toEqual({ kind: 'warning', text: 'm shadows the unit m' })
  })

  it('says which lines’ results a rename would change, and still allows it', () => {
    // `m` then shadows the unit in the line below.
    const sheet = [element('a', 'L = 2\nd = 3 m * L', 'Pipe')]

    const view = renameFormView(sheet, { id: 'a', line: 0, name: 'L' }, 'm')!

    expect(view.canRename).toBe(true)
    expect(view.changes.map(({ where, text }) => `${where}: ${shown(text)}`)).toEqual(['Pipe, line 2: d = 3 m * L'])
    expect(RENAME_WORDS.results(view.changes.length)).toBe('This changes 1 result:')
  })

  it('a name assigned twice has two forms, each with its own reach', () => {
    const sheet = [element('a', 'k = 1\nx = k\nk = k + 1\ny = k')]

    const first = renameFormView(sheet, { id: 'a', line: 0, name: 'k' }, 'k_1')!
    const second = renameFormView(sheet, { id: 'a', line: 2, name: 'k' }, 'k_2')!

    expect(first.lines.map(({ text }) => shown(text))).toEqual(['[k] = 1', 'x = [k]', 'k = [k] + 1'])
    expect(second.lines.map(({ text }) => shown(text))).toEqual(['[k] = k + 1', 'y = [k]'])
  })

  it('is no form for a line that no longer assigns the name', () => {
    expect(renameFormView(SHEET, { id: 'a', line: 1, name: 'rho' }, 'x')).toBeNull()
    expect(renameFormView(SHEET, { id: 'gone', line: 0, name: 'rho' }, 'x')).toBeNull()
  })

  it('hands the engine the sheet as the panel holds it', () => {
    expect(renameBlocks(SHEET)).toEqual([
      { id: 'a', source: SHEET[0].source },
      { id: 'b', source: SHEET[1].source, formats: '@bold if rho > 1 kg/m^3\n' },
    ])
  })
})

describe('the rename’s words (section 13)', () => {
  it('names the ✎, the field and the counts', () => {
    expect(RENAME_WORDS.start('rho')).toBe('Rename rho')
    expect(RENAME_WORDS.field('rho')).toBe('Rename rho to')
    expect([RENAME_WORDS.lines(7), RENAME_WORDS.lines(1)]).toEqual(['Changes 7 lines:', 'Changes 1 line:'])
    expect([RENAME_WORDS.results(2), RENAME_WORDS.results(1)]).toEqual(['This changes 2 results:', 'This changes 1 result:'])
  })

  it('the toast names Ctrl+Z, and Undo on touch', () => {
    expect(RENAME_WORDS.renamed('rho', 'rho_w', 7, false)).toBe('Renamed rho to rho_w in 7 lines. Ctrl+Z takes it back.')
    expect(RENAME_WORDS.renamed('rho', 'rho_w', 1, true)).toBe('Renamed rho to rho_w in 1 line. Undo takes it back.')
  })
})
