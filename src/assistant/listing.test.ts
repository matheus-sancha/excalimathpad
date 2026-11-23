import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { describe, expect, it } from 'vitest'
import { sceneTexts, type SceneText } from '../canvas/sceneTexts.ts'
import { DEFAULT_SETTINGS, type SheetSettings } from '../file/sheetFormat.ts'
import { evaluateSheet, type SheetBlock, type SheetLine } from '../math/evaluate.ts'
import { storeFormats } from '../math/lineForm.ts'
import { examples, sections } from '../test/guideExamples.ts'
import { wordsFor } from '../text/words.ts'
import { chipTarget, LISTING_LIMIT, listSheet, type ListedElement, type ListingInput } from './listing.ts'

/**
 * The listing (spec section 8, Math assistant, The listing; section 14, 0.7.0), run on the
 * real engine's evaluation: its form mark for mark, what it never holds, the cap, the map and
 * a chip against the scene now, and every acceptance sheet and Math guide example.
 */

const ACCEPTANCE = import.meta.glob<string>('../../docs/acceptance/*.md', { query: '?raw', import: 'default', eager: true })

const en = wordsFor('en')
const pt = wordsFor('pt-BR')

interface Element {
  id: string
  source: string
  formats?: string
  title?: string
  /** Where its anchor is: its top, then its left. */
  at: [number, number]
}

/** The sheet's math elements as the overlay reports them, evaluated by the engine. */
function input(elements: readonly Element[], texts: readonly SceneText[] = [], settings: SheetSettings = DEFAULT_SETTINGS, words = en): ListingInput {
  const blocks: SheetBlock[] = [...elements]
    .sort((a, b) => a.at[0] - b.at[0] || a.at[1] - b.at[1])
    .map(({ id, source, formats }) => ({ id, source, formats }))
  const lines = evaluateSheet(blocks, settings)
  return {
    elements: elements.map(
      ({ id, source, formats, title }): ListedElement => ({
        anchorId: id,
        title: title ?? null,
        source,
        formats,
        lines: lines.get(id) ?? [],
      }),
    ),
    anchors: elements.map(({ id, at: [y, x] }) => ({ id, x, y, width: 200, height: 40, angle: 0 })),
    texts,
    settings,
    words,
  }
}

function text(id: string, value: string, [y, x]: [number, number]): SceneText {
  return { id, text: value, x, y, width: 100, height: 20, angle: 0 }
}

function listed(listing: ReturnType<typeof listSheet>) {
  if (listing.kind !== 'listing') throw new Error(`no listing: ${listing.kind}`)
  return listing
}

/** Every row a listing may have, by its mark (section 8, the table of marks). */
const ROW_FORMS = [
  /^unit system: .+, Digits: \d+$/,
  /^$/,
  /^E\d+ {2}(title: ".*"|\(no title\))$/,
  /^T\d+ {2}text: ".*"$/,
  /^ {2}\d+ \|( .*)?$/,
  /^ {4}= .+$/,
  /^ {4}! error: .+$/,
  /^ {4}~ warning: .+$/,
  /^ {4}solve: .+$/,
  /^ {6}.+$/, // a table's header and rows, under its `= table` row
]

/** Each listing row matches a mark, and the labels count up from 1 in reading order. */
function expectShape(listing: string) {
  const rows = listing.replace(/\n$/, '').split('\n')
  expect(rows[0]).toMatch(ROW_FORMS[0])
  for (const row of rows) expect(ROW_FORMS.some((form) => form.test(row)), row).toBe(true)
  const labels = (mark: string) => rows.flatMap((row) => (row.startsWith(mark) ? [Number(/^.(\d+)/.exec(row)![1])] : []))
  for (const mark of ['E', 'T']) labels(mark).forEach((n, i) => expect(n).toBe(i + 1))
}

describe('the listing', () => {
  it('writes the sheet in the spec’s form, mark for mark', () => {
    const sheet = input(
      [
        {
          id: 'a',
          title: 'Pipe flow',
          at: [100, 0],
          source: [
            'Q = 30 L/s',
            'D = 150 mm',
            'A_f = pi * D^2 / 4  # flow area',
            'v = Q / A_f in m/s',
            '',
            'Re = rho * v * D / mu',
            'f(x) = x^2 - 2',
            'x_r = solve f(x) = 0, for x = 0 .. 5',
            'check = v < 3 m/s',
            '# Notes',
          ].join('\n'),
          formats: storeFormats(['', '', '', '', '', '', '', '', '@text-red if result == false', '']),
        },
        { id: 'b', at: [400, 0], source: 'V = 3' },
      ],
      [text('t', 'Pump sizing,\nrev B', [0, 0])],
    )
    const listing = listed(listSheet(sheet))
    // The residual is as it falls, so its digits are the solver's: only its row is a pattern.
    const solve = /^ {4}solve: range 0 \.\. 5, scan \+ Brent, 200 points, 1 root found in the range: 1\.41421356\d*, residual \S+, 0 crossings rejected as poles or jumps$/m
    expect(listing.text).toMatch(solve)
    expect(listing.text.replace(solve, '    solve: …')).toBe(
      [
        'unit system: SI with prefixes, Digits: 4',
        '',
        'T1  text: "Pump sizing,\\nrev B"',
        '',
        'E1  title: "Pipe flow"',
        '  1 | Q = 30 L/s',
        '    = (input)',
        '  2 | D = 150 mm',
        '    = (input)',
        '  3 | A_f = pi * D^2 / 4  # flow area',
        '    = 176.7 cm^2',
        '  4 | v = Q / A_f in m/s',
        '    = 1.698 m / s',
        '  5 |',
        '  6 | Re = rho * v * D / mu',
        '    ! error: Undefined symbol rho',
        '  7 | f(x) = x^2 - 2',
        '    = (function)',
        '  8 | x_r = solve f(x) = 0, for x = 0 .. 5',
        '    = 1.414',
        '    solve: …',
        '  9 | check = v < 3 m/s @text-red if result == false',
        '    = true',
        '  10 | # Notes',
        '',
        'E2  (no title)',
        '  1 | V = 3',
        '    = (input)',
        '    ~ warning: V shadows the unit V',
        '',
      ].join('\n'),
    )
    expect(listing.counts).toEqual({ elements: 2, lines: 11, texts: 1 })
    expectShape(listing.text)
  })

  it('words results, errors and warnings in the language shown, and keeps its marks English', () => {
    const elements: Element[] = [{ id: 'a', at: [0, 0], source: 'V = 3\nx = y + 1\nz = 1.5 m' }]
    const english = listed(listSheet(input(elements)))
    const portuguese = listed(listSheet(input(elements, [], DEFAULT_SETTINGS, pt)))
    expect(portuguese.text).not.toBe(english.text)
    const marks = (listing: string) => listing.split('\n').map((row) => /^\s*(\S+)/.exec(row)?.[1] ?? '')
    expect(marks(portuguese.text)).toEqual(marks(english.text))
    expect(portuguese.text).toContain('! error: ')
    expect(portuguese.text).toContain('~ warning: ')
  })

  it('shows results in the sheet’s unit system and Digits, named on the first line', () => {
    const settings: SheetSettings = { ...DEFAULT_SETTINGS, units: { system: 'uscs', custom: {} }, digits: 6 }
    const listing = listed(listSheet(input([{ id: 'a', at: [0, 0], source: 'L = 2 m\nL2 = L * 1' }], [], settings)))
    expect(listing.text.split('\n')[0]).toBe('unit system: USCS, Digits: 6')
    expect(listing.text).toContain('= 6.56168 ft')
    const custom: SheetSettings = { ...DEFAULT_SETTINGS, units: { system: 'si-base', custom: { pressure: 'bar' } } }
    expect(listed(listSheet(input([{ id: 'a', at: [0, 0], source: 'p = 1' }], [], custom))).text.split('\n')[0]).toBe(
      'unit system: Custom, from SI base units (pressure: bar), Digits: 4',
    )
  })

  it('gives a list as its summary, a table as its headers, 20 rows and its count, a plot as its counts', () => {
    const listing = listed(
      listSheet(
        input([
          {
            id: 'a',
            at: [0, 0],
            source: ['Q_s = 1 L/s .. 30 L/s step 1 L/s', 'H_s = 2 m * Q_s / (1 L/s)', 'table(Q_s, H_s in m)', 'plot(Q_s, H_s)'].join('\n'),
          },
        ]),
      ),
    )
    const rows = listing.text.split('\n')
    expect(rows[4]).toMatch(/^ {4}= 30 values, 1 … 30 L/)
    const at = rows.indexOf('  3 | table(Q_s, H_s in m)')
    expect(rows[at + 1]).toBe('    = table, 30 rows; first 20:')
    expect(rows[at + 2]).toMatch(/^ {6}Q_s \(.+\) \| H_s \(m\)$/)
    expect(rows.slice(at + 3, at + 23)).toHaveLength(20)
    expect(rows[at + 3]).toMatch(/^ {6}1 \| 2$/)
    expect(rows[at + 23]).toBe('  4 | plot(Q_s, H_s)')
    expect(rows[at + 24]).toBe('    = plot, 30 points, 0 failed')
    expectShape(listing.text)
  })

  it('writes every text element as its text only, a label in a shape or on an arrow included', () => {
    const scene = [
      { id: 'shape-id-9f2', type: 'rectangle', isDeleted: false, x: 5, y: 5, width: 9, height: 9, angle: 0 },
      { id: 'label-id-7c1', type: 'text', isDeleted: false, x: 10, y: 10, width: 9, height: 9, angle: 0, text: 'Tank\nA', originalText: 'Tank A', containerId: 'shape-id-9f2' },
      { id: 'arrow-label-id', type: 'text', isDeleted: false, x: 0, y: 300, width: 9, height: 9, angle: 0, text: 'flow', originalText: 'flow', containerId: 'arrow-id' },
      { id: 'gone-id', type: 'text', isDeleted: true, x: 0, y: 0, width: 9, height: 9, angle: 0, text: 'deleted', originalText: 'deleted' },
    ] as unknown as ExcalidrawElement[]
    const listing = listed(listSheet(input([], sceneTexts(scene))))
    expect(listing.text).toBe('unit system: SI with prefixes, Digits: 4\n\nT1  text: "Tank A"\n\nT2  text: "flow"\n')
    expect(listing.counts).toEqual({ elements: 0, lines: 0, texts: 2 })
  })

  it('never holds an id, the file’s name, a position, an image, a shape, a title format, a rule state, Result colour or Page', () => {
    const scene = [
      { id: 'image-id-3e8', type: 'image', isDeleted: false, x: 7777.25, y: 8888.5, width: 640, height: 480, angle: 0, fileId: 'photo-file-id' },
      { id: 'shape-id-5d0', type: 'ellipse', isDeleted: false, x: 4321.75, y: 1234.5, width: 9, height: 9, angle: 0 },
      { id: 'text-id-2b4', type: 'text', isDeleted: false, x: 2468.125, y: 1357.375, width: 9, height: 9, angle: 0, text: 'Notes', originalText: 'Notes' },
    ] as unknown as ExcalidrawElement[]
    const settings: SheetSettings = {
      ...DEFAULT_SETTINGS,
      resultColor: 'purple' as SheetSettings['resultColor'],
      page: { size: 'Letter', orientation: 'landscape' },
    }
    const sheet = input(
      [
        {
          id: 'anchor-id-6a9',
          title: 'Loads',
          at: [9753.5, 8642.25],
          source: 'F = 10 N\nok = F < 5 N',
          formats: storeFormats(['', '@bold if result == true @text-red if result == false']),
        },
      ],
      sceneTexts(scene),
      settings,
    )
    const listing = listed(listSheet(sheet))
    for (const absent of [
      'anchor-id-6a9',
      'text-id-2b4',
      'image-id-3e8',
      'shape-id-5d0',
      'photo-file-id',
      'pump-sizing.excalimathpad',
      '9753',
      '8642',
      '7777',
      '1234',
      '2468',
      'ellipse',
      'image',
      'purple',
      'Letter',
      'landscape',
      'overridden',
      'centre',
    ]) {
      expect(listing.text, absent).not.toContain(absent)
    }
    expect(listing.text).toContain('E1  title: "Loads"')
    expect(listing.text).toContain('T1  text: "Notes"')
  })

  it('gives an unexpected failure’s message, never its stack', () => {
    const line: SheetLine = {
      ...evaluateSheet([{ id: 'a', source: 'x = 1' }]).get('a')![0],
      result: {
        kind: 'error',
        message: { code: 'unexpectedLine' },
        unexpected: { text: 'TypeError: boom', stack: 'TypeError: boom\n    at secretFrame (evaluate.ts:12:3)' },
      },
    }
    const listing = listed(
      listSheet({ ...input([]), elements: [{ anchorId: 'a', title: null, source: 'x = 1', lines: [line] }], anchors: [] }),
    )
    expect(listing.text).toContain('    ! error: this line hit an unexpected error in Excalimathpad: TypeError: boom')
    expect(listing.text).not.toContain('secretFrame')
  })

  it('gives no listing for a sheet with no math element and no text, and says so', () => {
    expect(listSheet(input([]))).toEqual({ kind: 'empty' })
  })

  it('refuses a listing over 200,000 characters with both numbers, and never cuts it', () => {
    const long = (n: number) => input([{ id: 'a', at: [0, 0], source: `# ${'x'.repeat(n)}` }])
    const at = listed(listSheet(long(1)))
    const overhead = at.text.length - 1
    expect(listed(listSheet(long(LISTING_LIMIT - overhead))).text).toHaveLength(LISTING_LIMIT)
    const over = listSheet(long(LISTING_LIMIT - overhead + 1))
    expect(over).toEqual({
      kind: 'tooLong',
      length: 200_001,
      limit: 200_000,
      message: 'This sheet is too long to send: 200,001 characters, and the limit is 200,000. Nothing was sent.',
    })
    const portuguese = listSheet({ ...long(412_300), words: pt })
    expect(portuguese.kind === 'tooLong' && portuguese.message).toBe(
      `Esta folha é longa demais para enviar: ${String(portuguese.kind === 'tooLong' && portuguese.length).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} caracteres, e o limite é 200 000. Nada foi enviado.`,
    )
  })
})

describe('the map', () => {
  const elements: Element[] = [
    { id: 'anchor-1', title: 'Pipe flow', at: [0, 0], source: 'Q = 30 L/s\nv = Q / (2 m^2)', formats: storeFormats(['@bold', '']) },
  ]
  const texts = [text('text-1', 'Pump sizing', [-50, 0])]
  const listing = listed(listSheet(input(elements, texts)))

  it('holds each label’s anchor or text element, its line index and the line as sent', () => {
    expect([...listing.map]).toEqual([
      ['T1', { kind: 'text', textId: 'text-1', text: 'Pump sizing' }],
      ['E1', { kind: 'element', anchorId: 'anchor-1', title: 'Pipe flow' }],
      ['E1:1', { kind: 'line', anchorId: 'anchor-1', line: 0, text: 'Q = 30 L/s @bold' }],
      ['E1:2', { kind: 'line', anchorId: 'anchor-1', line: 1, text: 'v = Q / (2 m^2)' }],
    ])
    expect(listing.text).toContain('  1 | Q = 30 L/s @bold')
  })

  it('answers a chip: jumps, changed, gone or unknown', () => {
    const now = {
      anchors: [{ id: 'anchor-1', source: 'Q = 30 L/s\nv = Q / (3 m^2)', formats: storeFormats(['@bold', '']) }],
      texts: [{ id: 'text-1', text: 'Pump sizing' }],
    }
    expect(chipTarget(listing.map, 'E1:1', now).state).toBe('jumps')
    expect(chipTarget(listing.map, 'E1', now).state).toBe('jumps')
    expect(chipTarget(listing.map, 'E1:2', now).state).toBe('changed')
    expect(chipTarget(listing.map, 'T1', now).state).toBe('jumps')
    expect(chipTarget(listing.map, 'T1', { ...now, texts: [{ id: 'text-1', text: 'Pump sizing, rev C' }] }).state).toBe('changed')
    expect(chipTarget(listing.map, 'E1:1', { ...now, anchors: [] }).state).toBe('gone')
    expect(chipTarget(listing.map, 'E1', { ...now, anchors: [] }).state).toBe('gone')
    expect(chipTarget(listing.map, 'T1', { ...now, texts: [] }).state).toBe('gone')
    // A format changed from the Format tab changes the line as sent.
    expect(chipTarget(listing.map, 'E1:1', { ...now, anchors: [{ ...now.anchors[0], formats: '' }] }).state).toBe('changed')
    expect(chipTarget(listing.map, 'E3:1', now)).toEqual({ state: 'unknown', entry: null })
    expect(chipTarget(listing.map, 'E1:9', now).state).toBe('unknown')
  })
})

describe('the listing of every acceptance sheet and Math guide example', () => {
  // The second acceptance sheet has a Stored format column (as \`true-position.test.ts\` reads it).
  const rows = (markdown: string) =>
    markdown.includes('| Stored format |')
      ? [...markdown.matchAll(/^\| (c|\d+[a-z]?) \| `(.+?)` \| (—|`(.+?)`) \|/gm)].map(([, , source, , format]) => ({
          source,
          format: format ?? '',
        }))
      : [...markdown.matchAll(/^\| (c|\d+[a-z]?) \| `(.+?)` \|/gm)].map(([, , source]) => ({ source, format: '' }))
  const sheets = [
    ...Object.entries(ACCEPTANCE).map(([path, markdown]) => {
      const found = rows(markdown)
      return { name: path, source: found.map((row) => row.source).join('\n'), formats: storeFormats(found.map((row) => row.format)) }
    }),
    ...sections()
      .map((section) => ({ name: `guide: ${section.title}`, source: examples(section).map((example) => example.source).join('\n'), formats: '' }))
      .filter((sheet) => sheet.source !== ''),
  ]

  it('finds both acceptance sheets and the guide’s examples', () => {
    expect(sheets.filter((sheet) => sheet.name.endsWith('.md')).map((sheet) => sheet.name.replace(/^.*\//, ''))).toEqual([
      'pump-sizing.md',
      'true-position.md',
    ])
    expect(sheets.length).toBeGreaterThan(10)
  })

  it.each(sheets)('$name: holds its shape, and the same sheet gives the same listing', ({ source, formats }) => {
    const elements: Element[] = [{ id: 'a', title: 'Sheet', at: [0, 0], source, formats }]
    const listing = listed(listSheet(input(elements, [text('t', 'Notes', [500, 0])])))
    expectShape(listing.text)
    expect(listing.counts).toEqual({ elements: 1, lines: source.split('\n').length, texts: 1 })
    expect(listing.map.size).toBe(1 + source.split('\n').length + 1)
    expect(listSheet(input(elements, [text('t', 'Notes', [500, 0])]))).toEqual(listing)
    const portuguese = listed(listSheet(input(elements, [text('t', 'Notes', [500, 0])], DEFAULT_SETTINGS, pt)))
    expectShape(portuguese.text)
  })
})
