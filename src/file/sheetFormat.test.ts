import { describe, expect, it } from 'vitest'
import pumpSheet from '../../docs/acceptance/pump-sizing.md?raw'
import { evaluateSheet } from '../math/evaluate.ts'
import { FORMAT_COLORS, TEXT_COLORS } from '../math/lineForm.ts'
import {
  DEFAULT_SETTINGS,
  FORMAT,
  MIGRATIONS,
  moveFormatsOut,
  readSettings,
  readSheet,
  writeSheet,
  type Migration,
  type SheetSettings,
} from './sheetFormat.ts'

const scene = {
  type: 'excalidraw',
  version: 2,
  source: 'test',
  elements: [{ id: 'm1', type: 'rectangle', customData: { kind: 'math', source: 'a = 1' } }],
  appState: { viewBackgroundColor: '#fff' },
  files: {},
}

const custom: SheetSettings = {
  units: { system: 'uscs', custom: { pressure: 'bar' } },
  digits: 6,
  resultColor: 'red',
  page: { size: 'Letter', orientation: 'landscape' },
}

describe('writeSheet and readSheet', () => {
  it('round-trips the scene and the settings', () => {
    const text = writeSheet(JSON.stringify(scene), custom)

    expect(JSON.parse(text).excalimathpad).toEqual({ format: FORMAT, settings: custom })
    expect(readSheet(text)).toEqual({ kind: 'sheet', scene, settings: custom })
  })

  it("keeps Excalidraw's own keys, so a renamed file is still a drawing", () => {
    const data = JSON.parse(writeSheet(JSON.stringify(scene), DEFAULT_SETTINGS))

    expect(data).toMatchObject(scene)
  })

  it('opens a plain drawing with no block as format 1 with default settings', () => {
    expect(readSheet(JSON.stringify(scene))).toEqual({
      kind: 'sheet',
      scene,
      settings: DEFAULT_SETTINGS,
    })
  })

  it('refuses a newer format', () => {
    const newer = { ...scene, excalimathpad: { format: FORMAT + 1, settings: {} } }

    expect(readSheet(JSON.stringify(newer))).toEqual({ kind: 'newer' })
  })

  it.each([
    ['not JSON', '{ nope'],
    ['JSON but not an object', '[1, 2]'],
    ['not Excalidraw', JSON.stringify({ type: 'other', elements: [] })],
    ['no elements', JSON.stringify({ type: 'excalidraw' })],
    ['a block with no format', JSON.stringify({ ...scene, excalimathpad: {} })],
    ['a format of zero', JSON.stringify({ ...scene, excalimathpad: { format: 0 } })],
    ['a fractional format', JSON.stringify({ ...scene, excalimathpad: { format: 1.5 } })],
  ])('refuses a file that is %s', (_, text) => {
    expect(readSheet(text)).toEqual({ kind: 'not-a-sheet' })
  })
})

describe('migrations', () => {
  // The step loop, on made-up steps to a made-up format 3.
  const steps: Migration[] = [
    (data) => ({ ...data, one: true, excalimathpad: { format: 2, settings: { digits: 5 } } }),
    (data) => ({ ...data, two: true, excalimathpad: { ...(data.excalimathpad as object), format: 3 } }),
  ]

  it('upgrades an older file one step at a time, in order', () => {
    const old = JSON.stringify({ ...scene, excalimathpad: { format: 1 } })

    const read = readSheet(old, steps, 3)

    expect(read).toMatchObject({ kind: 'sheet', scene: { one: true, two: true } })
    expect(read.kind === 'sheet' && read.settings.digits).toBe(5)
  })

  it('starts from the file format, skipping the steps before it', () => {
    const fromTwo = JSON.stringify({ ...scene, excalimathpad: { format: 2 } })

    const read = readSheet(fromTwo, steps, 3)

    expect(read).toMatchObject({ kind: 'sheet', scene: { two: true } })
    expect(read.kind === 'sheet' && 'one' in read.scene).toBe(false)
  })

  it('refuses a format with no step to upgrade it', () => {
    const old = JSON.stringify({ ...scene, excalimathpad: { format: 1 } })

    expect(readSheet(old, [], 2)).toEqual({ kind: 'not-a-sheet' })
  })
})

// docs/spec-v1.md section 7, The file (M4e, #195): the first migration. A sheet
// saved by 0.2.x keeps each line's format in the line's text; format 2 keeps it
// beside the line, in the anchor's `customData.formats`.
describe('format 2: a line’s format is stored beside it', () => {
  const anchorOf = (customData: Record<string, unknown>, id = 'm1') => ({ id, type: 'rectangle', x: 0, y: 0, customData })
  /** A sheet as 0.2.x saved it: format 1, the clause in each line's text. */
  const format1 = (elements: unknown[], block: unknown = { format: 1, settings: DEFAULT_SETTINGS }) =>
    JSON.stringify({ type: 'excalidraw', version: 2, elements, appState: {}, files: {}, ...(block === null ? {} : { excalimathpad: block }) })
  const mathOf = (source: string, more: Record<string, unknown> = {}) => anchorOf({ kind: 'math', source, ...more })
  const opened = (text: string) => {
    const read = readSheet(text)
    if (read.kind !== 'sheet') throw new Error(`not a sheet: ${read.kind}`)
    return (read.scene.elements as { id: string; customData: Record<string, unknown> }[]).map(({ customData }) => customData)
  }
  /** One element's lines, migrated: its text and its stored formats. */
  const migrate = (source: string) => {
    const [data] = opened(format1([mathOf(source)]))
    return { source: data.source as string, formats: data.formats as string | undefined }
  }
  const evaluate = (source: string, formats?: string) => evaluateSheet([{ id: 'm1', source, formats }]).get('m1')!

  it('is what this app writes, and its one step is registered', () => {
    expect(FORMAT).toBe(2)
    expect(MIGRATIONS).toEqual([moveFormatsOut])
    expect(JSON.parse(writeSheet(JSON.stringify(scene), DEFAULT_SETTINGS)).excalimathpad.format).toBe(2)
  })

  it('moves each line’s clause out of its text, one entry per line, the math and the note as typed', () => {
    expect(
      migrate(
        [
          'U = I_load * R in V @bold @text-red @yellow # check',
          'D = 102.3 mm',
          '',
          'v = Q / A @bold @text-red if v > 3 m/s @text-orange if v > 2 m/s # speed',
          '# Water at 20 C',
        ].join('\n'),
      ),
    ).toEqual({
      source: ['U = I_load * R in V # check', 'D = 102.3 mm', '', 'v = Q / A # speed', '# Water at 20 C'].join('\n'),
      formats: ['@bold @text-red @yellow', '', '', '@bold @text-red if v > 3 m/s @text-orange if v > 2 m/s', ''].join('\n'),
    })
  })

  const WORDS = [
    'bold',
    'underline',
    ...FORMAT_COLORS,
    ...TEXT_COLORS.map((color) => `text-${color}`),
    'bold+underline',
    'text-red+red+bold',
  ]

  it.each(WORDS)('@%s on a math line moves out, and the line reads as it did', (word) => {
    const line = `x = 2 m @${word} # two`
    expect(migrate(line)).toEqual({ source: 'x = 2 m # two', formats: `@${word}` })
    expect(evaluate('x = 2 m # two', `@${word}`)).toEqual(evaluate(line))
    expect(evaluate(line)[0].typeset).toMatchObject({ kind: 'math' })
    expect(evaluate('x = 2 m # two', `@${word}`)[0].typeset).not.toEqual(evaluate('x = 2 m # two')[0].typeset)
  })

  it.each([...WORDS.slice(0, -1), 'upright', 'S', 'L', 'XL', 'bold+L+text-blue'])(
    '@%s on a comment line moves out from in front of its #, and the comment reads as it did',
    (word) => {
      const line = `@${word} # Pumps and pipes`
      expect(migrate(line)).toEqual({ source: '# Pumps and pipes', formats: `@${word}` })
      expect(evaluate('# Pumps and pipes', `@${word}`)).toEqual(evaluate(line))
      expect(evaluate('# Pumps and pipes', `@${word}`)).not.toEqual(evaluate('# Pumps and pipes'))
    },
  )

  it.each([
    ['a rule', 'v = 4 m/s @text-red if v > 3 m/s'],
    ['rules, first true wins, with a plain format', 'v = 2.5 m/s @text-blue @text-red if v > 3 m/s @text-orange if v > 2 m/s # speed'],
    ['a rule on result', '2 * 3 @red if result > 5'],
    ['a rule on a text, with an @ in its string', 's = "a@b" @text-green if s == "a@b" @text-red if s != "a@b"'],
    ['a rule whose condition can’t be decided: a warning', 'v = 4 m/s @text-red if v > 3 kg'],
    ['a display unit before the clause', 'p = 2 bar in kPa @bold @yellow # gauge'],
    ['a conditional with text', 'check = if(2 > 1, "Approved", "Rejected") @text-green if result == "Approved" @text-red if result != "Approved"'],
    ['a list, its rule per point', 'q = 1 .. 4 @red if q > 2'],
    ['a function definition', 'f(x) = x^2 @bold'],
    ['a word that isn’t a format: still the line’s error', 'x = 1 @blod @red'],
    ['a comment word on a math line: still its error', 'x = 1 @L'],
    ['a rule on a comment line: still its error', '@bold @red if x > 1 # Pumps'],
    ['a clause with no comment text: a blank line', '@bold #'],
    ['a clause alone: a blank line', '@bold'],
  ])('%s reads as it did', (_, line) => {
    const moved = migrate(line)
    expect(moved.source).not.toContain(' @')
    expect(moved.formats).toMatch(/^@/)
    expect(evaluate(moved.source, moved.formats)).toEqual(evaluate(line))
  })

  it('a line that doesn’t parse keeps its error and its names; it shows as its text, without the stored clause', () => {
    const moved = migrate('x = (1 @bold # broken')
    expect(moved).toEqual({ source: 'x = (1 # broken', formats: '@bold' })
    const [was] = evaluate('x = (1 @bold # broken')
    const [now] = evaluate(moved.source, moved.formats)
    expect(now.result).toEqual(was.result)
    expect(now.variables).toEqual(was.variables)
    expect(now.typeset).toEqual({ kind: 'unparsed', source: 'x = (1 # broken' })
  })

  it('leaves alone what isn’t a clause: an @ in a string, in a note, in a comment', () => {
    const source = ['s = "a @bold"', 'x = 1 # see @bold', '# call me @home', '', 'y = x\'', "t = 'it@s'"].join('\n')
    expect(migrate(source)).toEqual({ source, formats: undefined })
  })

  it('leaves an element with no clause exactly as it was, with no formats key', () => {
    const [data] = opened(format1([mathOf('a = 1\r\nb = 2 # two', { title: 'Inputs @ 20 C', titleFormat: 'centre L text-red', width: 420 })]))
    expect(data).toEqual({ kind: 'math', source: 'a = 1\r\nb = 2 # two', title: 'Inputs @ 20 C', titleFormat: 'centre L text-red', width: 420 })
  })

  it('keeps the title, its format and the chosen width beside the moved formats, and touches no other element', () => {
    const drawing = { id: 'r1', type: 'rectangle', x: 5, y: 5, customData: { note: 'x = 1 @bold' } }
    const text = { id: 't1', type: 'text', text: 'call me @home' }
    const data = opened(
      format1([
        mathOf('x = 1 @bold', { title: 'Pump @ 50 Hz', titleFormat: 'italic text-blue', width: 300 }),
        drawing,
        text,
        mathOf('@L @bold # Results\ny = 2 @green', {}),
        anchorOf({ kind: 'math' }, 'm3'),
        anchorOf({ kind: 'math', source: 7 }, 'm4'),
      ]),
    )
    expect(data[0]).toEqual({ kind: 'math', source: 'x = 1', formats: '@bold', title: 'Pump @ 50 Hz', titleFormat: 'italic text-blue', width: 300 })
    expect(data[1]).toEqual(drawing.customData)
    expect(data[2]).toBeUndefined()
    expect(data[3]).toEqual({ kind: 'math', source: '# Results\ny = 2', formats: '@L @bold\n@green' })
    expect(data[4]).toEqual({ kind: 'math' })
    expect(data[5]).toEqual({ kind: 'math', source: 7 })
  })

  it('migrates a drawing with no block, which opens as format 1', () => {
    expect(opened(format1([mathOf('x = 1 @bold')], null))).toEqual([{ kind: 'math', source: 'x = 1', formats: '@bold' }])
  })

  it('reads the settings of a format 1 file as they were', () => {
    expect(readSheet(format1([mathOf('x = 1 @bold')], { format: 1, settings: custom }))).toMatchObject({ kind: 'sheet', settings: custom })
  })

  it('is a pure step that raises the format by one and changes nothing else', () => {
    const before = JSON.parse(format1([mathOf('x = 1 @bold')])) as Record<string, unknown>
    const copy = structuredClone(before)
    const after = moveFormatsOut(before)
    expect(before).toEqual(copy)
    expect(after.excalimathpad).toEqual({ format: 2, settings: DEFAULT_SETTINGS })
    expect({ ...after, elements: null, excalimathpad: null }).toEqual({ ...before, elements: null, excalimathpad: null })
  })

  it('round-trips: a migrated sheet saved as format 2 opens the same, and is not migrated twice', () => {
    const source = 'v = 4 m/s @bold @text-red if v > 3 m/s # speed\n@L # Pumps\nx = 1'
    const first = readSheet(format1([mathOf(source)]))
    if (first.kind !== 'sheet') throw new Error('not a sheet')
    const saved = writeSheet(JSON.stringify(first.scene), first.settings)
    expect(JSON.parse(saved).excalimathpad.format).toBe(2)
    expect(readSheet(saved)).toEqual(first)
    expect(opened(saved)).toEqual([
      { kind: 'math', source: 'v = 4 m/s # speed\n# Pumps\nx = 1', formats: '@bold @text-red if v > 3 m/s\n@L\n' },
    ])
  })

  it('a format 2 file is read as it is: a clause in a line’s text (a hand-edited file) stays there', () => {
    const element = mathOf('x = 1 @red', { formats: '@bold @yellow' })
    const text = format1([element], { format: 2, settings: DEFAULT_SETTINGS })
    expect(opened(text)).toEqual([element.customData])
  })

  it('a file from a newer format is refused, so this app never overwrites it', () => {
    expect(readSheet(format1([mathOf('x = 1')], { format: 3, settings: DEFAULT_SETTINGS }))).toEqual({ kind: 'newer' })
    expect(readSheet(format1([mathOf('x = 1')], { format: 99 }))).toEqual({ kind: 'newer' })
  })

  it('a format 1 file that already holds formats (it never should) keeps them behind the typed clause', () => {
    expect(opened(format1([mathOf('x = 1 @red\ny = 2', { formats: '@bold @yellow\n@green' })]))).toEqual([
      { kind: 'math', source: 'x = 1\ny = 2', formats: '@red @bold\n@green' },
    ])
  })

  // Section 16: the pump sheet's check line reads its format from the store.
  it('the pump sheet, migrated, runs as it did, its check line’s format stored beside it', () => {
    const lines = [...pumpSheet.matchAll(/^\| (c|\d+[a-z]?) \| `(.+?)` \|/gm)].map(([, , source]) => source)
    const check = lines.findIndex((line) => line.startsWith('NPSH = if('))
    expect(lines[check]).toContain('@text-green if result == "OK"')

    const moved = migrate(lines.join('\n'))
    const movedLines = moved.source.split('\n')
    expect(movedLines).toHaveLength(lines.length)
    expect(movedLines[check]).toBe('NPSH = if(NPSH_a >= NPSH_r, "OK", "NOT OK")')
    expect(moved.source).not.toContain('@')
    expect(moved.formats!.split('\n')[check]).toBe('@text-green if result == "OK" @text-red if result != "OK"')

    const now = evaluate(moved.source, moved.formats)
    expect(now).toEqual(evaluate(lines.join('\n')))
    expect(now[check].result).toMatchObject({ kind: 'value', text: 'OK' })
    expect(now[check].typeset).toMatchObject({ kind: 'math', format: { textColor: 'green' } })
    expect(now[check].ruleStates).toHaveLength(2)
  })
})

describe('readSettings', () => {
  it('fills every missing setting with its default', () => {
    expect(readSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(readSettings({ digits: 7 })).toEqual({ ...DEFAULT_SETTINGS, digits: 7 })
    // A file saved before M4c has no result colour: blue.
    expect(readSettings({ digits: 4 }).resultColor).toBe('blue')
  })

  it('reads a result colour, one of the six text colours', () => {
    expect(readSettings({ resultColor: 'green' }).resultColor).toBe('green')
    expect(readSettings({ resultColor: 'purple' }).resultColor).toBe('blue')
  })

  it('replaces values it cannot read with the default', () => {
    expect(
      readSettings({
        units: { system: 'imperial', custom: { pressure: 'bar', length: 3 } },
        digits: 99,
        page: { size: 'A3', orientation: 'sideways' },
      }),
    ).toEqual({ ...DEFAULT_SETTINGS, units: { system: 'si-prefixed', custom: { pressure: 'bar' } } })
    expect(readSettings({ digits: 1 }).digits).toBe(4)
    expect(readSettings({ digits: 4.5 }).digits).toBe(4)
  })
})
