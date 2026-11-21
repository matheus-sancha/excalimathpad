import { describe, expect, it } from 'vitest'
import { elementLabel } from '../panel/sheetPanel.ts'
import type { SheetBlock } from '../math/evaluate.ts'
import { followOffers, noteCommit, offerLines, OFFER_WORDS, type RenameOffer } from './renameOffer.ts'

/**
 * The offer on a committed line, as state (docs/spec-v1.md section 4,
 * Renaming a name: The offer, on a committed line): when a commit makes one,
 * and when one goes.
 */

const offer = (line: number, from: string, to: string, key = 1, anchorId = 'a'): RenameOffer => ({ anchorId, line, from, to, key })
const commit = (line: number, before: string | null, after: string | null) => ({ anchorId: 'a', line, before, after })

describe('a commit (noteCommit)', () => {
  it('makes an offer when the line’s name changed, and none when it didn’t or a side assigns nothing', () => {
    expect(noteCommit([], commit(0, 'rho', 'rho_w'), 1)).toEqual([offer(0, 'rho', 'rho_w')])
    expect(noteCommit([], commit(0, 'rho', 'rho'), 1)).toEqual([])
    expect(noteCommit([], commit(0, null, 'rho'), 1)).toEqual([])
    expect(noteCommit([], commit(0, 'rho', null), 1)).toEqual([])
  })

  it('keeps the offers as they are when nothing changes: the same array', () => {
    const waiting = [offer(0, 'rho', 'rho_w')]
    expect(noteCommit(waiting, commit(1, 'a', 'a'), 2)).toBe(waiting)
    expect(noteCommit(waiting, commit(0, 'rho_w', 'rho_w'), 2)).toBe(waiting)
  })

  it('asks about the newest name when the line’s name changes again, and goes if the old name is back', () => {
    const waiting = [offer(0, 'rho', 'rho_w')]
    expect(noteCommit(waiting, commit(0, 'rho_w', 'rho_x'), 2)).toEqual([offer(0, 'rho', 'rho_x', 2)])
    expect(noteCommit(waiting, commit(0, 'rho_w', 'rho'), 2)).toEqual([])
    expect(noteCommit(waiting, commit(0, 'rho_w', null), 2)).toEqual([])
  })

  it('lets two offers wait at once, the newest last', () => {
    const waiting = noteCommit([offer(0, 'rho', 'rho_w')], commit(3, 'mu', 'mu_w'), 2)
    expect(waiting).toEqual([offer(0, 'rho', 'rho_w'), offer(3, 'mu', 'mu_w', 2)])
  })
})

describe('following the scene (followOffers)', () => {
  const blocks = (...sources: string[]): SheetBlock[] => sources.map((source, i) => ({ id: i === 0 ? 'a' : `b${i}`, source }))

  it('keeps an offer while its line assigns the new name and a line in its reach reads the old one', () => {
    const [shown] = followOffers([offer(0, 'rho', 'rho_w')], blocks('rho_w = 1000\na = rho * 2', 'b = rho'))
    expect(shown.offer).toEqual(offer(0, 'rho', 'rho_w'))
    expect(shown.plan.lines.map(({ id, line, text }) => [id, line, text])).toEqual([
      ['a', 1, 'a = rho_w * 2'],
      ['b1', 0, 'b = rho_w'],
    ])
    expect(shown.plan.changes).toEqual([])
  })

  it('drops it when the uses are edited by hand, on an undo of the line, and when its element is removed', () => {
    const waiting = [offer(0, 'rho', 'rho_w')]
    expect(followOffers(waiting, blocks('rho_w = 1000\na = rho_w * 2'))).toEqual([])
    expect(followOffers(waiting, blocks('rho = 1000\na = rho * 2'))).toEqual([])
    expect(followOffers(waiting, [{ id: 'other', source: 'a = rho' }])).toEqual([])
  })

  it('follows its line when a split or a join above it moves it, if one line there assigns the new name', () => {
    const [shown] = followOffers([offer(0, 'rho', 'rho_w')], blocks('# Fluid\nrho_w = 1000\na = rho * 2'))
    expect(shown.offer.line).toBe(1)
    expect(followOffers([offer(0, 'rho', 'rho_w')], blocks('x = 1\nrho_w = 1\nrho_w = 2\na = rho'))).toEqual([])
  })
})

describe('the card’s words and lines (section 13, Rename and Language)', () => {
  it('words the question, the count, Keep and a phone’s count of offers', () => {
    expect(OFFER_WORDS.ask('rho', 'rho_w', 6)).toBe('Rename rho to rho_w in 6 lines?')
    expect(OFFER_WORDS.ask('rho', 'rho_w', 1)).toBe('Rename rho to rho_w in 1 line?')
    expect(OFFER_WORDS.keep('rho')).toBe('Keep rho')
    expect(OFFER_WORDS.of(1, 2)).toBe('1 of 2')
    expect(OFFER_WORDS.results(2)).toBe('This changes 2 results:')
  })

  it('names each line’s element as the Sheet panel does, by its title or its place', () => {
    const sheet: SheetBlock[] = [
      { id: 'a', source: 'rho_w = 1000' },
      { id: 'b', source: 'x = 1\ny = rho' },
    ]
    const titles = new Map([['a', 'Fluid'], ['b', null]])
    const lines = offerLines([{ id: 'b', line: 1, uses: [{ start: 4, end: 7 }] }], sheet, titles)
    expect(lines.map(({ where }) => where)).toEqual([`${elementLabel({ anchorId: 'b', title: null, lines: [] } as never, 1)}, line 2`])
    expect(lines[0].text).toEqual([
      { text: 'y = ', marked: false },
      { text: 'rho', marked: true },
    ])
    expect(offerLines([{ id: 'a', line: 0 }], sheet, titles)[0].where).toBe('Fluid, line 1')
  })
})
