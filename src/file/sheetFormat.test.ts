import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  FORMAT,
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
  // v1 has none, so the step loop runs on a made-up format 3.
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
