import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { printSheet, type PrintRoute, type SheetToPrint } from './printSheet.ts'
import { showLanguage } from '../text/words.ts'

/**
 * Print…'s steps (docs/spec-v1.md section 11, Print flow and Changed on
 * 2026-11-15; section 8, the window title), against a route of fakes. jsdom
 * has no constructed style sheets, so the document is given an
 * `adoptedStyleSheets` list as Chromium has.
 */
beforeEach(() => {
  Object.defineProperty(document, 'adoptedStyleSheets', { value: [], writable: true, configurable: true })
})
afterEach(() => {
  delete (document as { adoptedStyleSheets?: unknown }).adoptedStyleSheets
  document.body.replaceChildren()
})

const sheet = (overrides: Partial<SheetToPrint> = {}): SheetToPrint => ({
  drawings: [{ x: 0, y: 0, width: 100, height: 40 }],
  elements: [],
  page: { size: 'A4', orientation: 'portrait' },
  colors: {},
  drawingsOn: () => Promise.resolve(null),
  rowNodes: () => [],
  ...overrides,
})

function route(overrides: Partial<PrintRoute> = {}) {
  let title = '● pump-sizing'
  const seen: { title: string; view: boolean; sheets: number }[] = []
  const notify = vi.fn()
  const print = vi.fn(() => {
    seen.push({ title, view: !!document.querySelector('.print-view'), sheets: document.adoptedStyleSheets.length })
  })
  const r: PrintRoute = {
    doc: document,
    sheet: () => sheet(),
    name: 'pump-sizing.excalimathpad',
    title: { get: () => title, set: (next) => (title = next), plain: 'pump-sizing' },
    print,
    notify,
    now: () => new Date(2026, 10, 16),
    ...overrides,
  }
  return { route: r, seen, notify, print, title: () => title }
}

describe('printSheet', () => {
  it('opens the dialog on the built pages, the title the plain name, then puts everything back', async () => {
    const { route: r, seen, notify, title } = route()

    await expect(printSheet(r)).resolves.toBe(true)

    expect(seen).toEqual([{ title: 'pump-sizing', view: true, sheets: 1 }])
    expect(title()).toBe('● pump-sizing')
    expect(document.querySelector('.print-view')).toBeNull()
    expect(document.adoptedStyleSheets).toEqual([])
    expect(notify).not.toHaveBeenCalled()
  })

  it('asks for each page’s drawings by its slice', async () => {
    const drawingsOn = vi.fn(() => Promise.resolve(null))
    const { route: r } = route({ sheet: () => sheet({ drawingsOn }) })

    await printSheet(r)

    expect(drawingsOn).toHaveBeenCalledWith(0, 40)
  })

  it.each([
    ['reading the sheet throws', { sheet: () => { throw new Error('no') } }],
    ['the drawings’ export fails', { sheet: () => sheet({ drawingsOn: () => Promise.reject(new Error('no')) }) }],
  ])('when %s: no dialog, the notice, nothing left behind', async (_case, overrides: Partial<PrintRoute>) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { route: r, print, notify, title } = route(overrides)

    await expect(printSheet(r)).resolves.toBe(false)

    expect(print).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith("The pages couldn't be built, so nothing was printed.")
    expect(title()).toBe('● pump-sizing')
    expect(document.querySelector('.print-view')).toBeNull()
    expect(document.adoptedStyleSheets).toEqual([])
  })

  it('without constructed style sheets, the pages can’t be built', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    delete (document as { adoptedStyleSheets?: unknown }).adoptedStyleSheets
    const { route: r, print, notify } = route()

    await expect(printSheet(r)).resolves.toBe(false)

    expect(print).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith("The pages couldn't be built, so nothing was printed.")
    expect(document.querySelector('.print-view')).toBeNull()
  })

  it('words the notice in the language shown, when it shows (section 13, App, 0.6.0)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    delete (document as { adoptedStyleSheets?: unknown }).adoptedStyleSheets
    showLanguage('pt-BR')
    onTestFinished(() => showLanguage('en'))
    const { route: r, notify } = route()

    await expect(printSheet(r)).resolves.toBe(false)

    expect(notify).toHaveBeenCalledWith('Não foi possível montar as páginas, então nada foi impresso.')
  })

  it('puts the title and the document back even if the dialog throws', async () => {
    const { route: r, title } = route({ print: () => { throw new Error('dialog') } })

    await expect(printSheet(r)).rejects.toThrow('dialog')

    expect(title()).toBe('● pump-sizing')
    expect(document.querySelector('.print-view')).toBeNull()
    expect(document.adoptedStyleSheets).toEqual([])
  })

  it('adds a frame’s copied styles with its own, and takes both off', async () => {
    const { route: r, seen } = route({ styles: ['.katex { color: red }'] })

    await printSheet(r)

    expect(seen[0].sheets).toBe(2)
    expect(document.adoptedStyleSheets).toEqual([])
  })
})
