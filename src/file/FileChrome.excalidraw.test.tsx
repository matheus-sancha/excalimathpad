import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import App from '../App.tsx'
import { fakeFileAccess, fakeRecovery } from '../test/files.ts'
import { doubleClickLine } from '../test/gestures.ts'
import { fireResizeObservers, layOutBodies } from '../test/layout.ts'
import { sampleSheet } from '../test/sheets.ts'
import { linesOf } from '../test/sheetView.ts'
import type { RecoveryCopy } from './recovery.ts'
import { writeSheet } from './sheetFormat.ts'

/**
 * The file chrome in the whole app, on the real Excalidraw: the menu, the keys
 * it takes from Excalidraw, the name and title, and the two questions.
 */
async function mount(copy: RecoveryCopy | null = null) {
  const files = fakeFileAccess()
  const recovery = fakeRecovery(copy)
  const view = render(<App files={files} recovery={recovery} initialElements={sampleSheet()} />)
  await screen.findAllByRole('list', { name: 'Lines' })
  const name = await screen.findByTestId('file-name')
  // The session takes the clean mark once Excalidraw has loaded the sheet.
  if (!copy) await waitFor(() => expect(document.title).toBe('Untitled'))
  return { files, recovery, name, container: view.container }
}

const canvasRoot = () => document.querySelector<HTMLElement>('.excalidraw')!

/** Opens line `n` (1-based) of the first element and types over it. */
function typeLine(n: number, text: string) {
  doubleClickLine('math-inputs', n)
  const field = screen.getByRole('textbox', { name: 'Line source' })
  fireEvent.input(field, { target: { value: text } })
  return field
}

/** Edits a line and leaves it: one line commit. */
function commitLine(n: number, text: string) {
  const field = typeLine(n, text)
  fireEvent.keyDown(field, { key: 'Escape' })
}

const sheetText = (sources: string[]) =>
  writeSheet(
    JSON.stringify({
      type: 'excalidraw',
      version: 2,
      elements: sources.map((source, i) => ({
        id: `m${i}`,
        type: 'rectangle',
        x: 0,
        y: i * 100,
        width: 300,
        height: 60,
        customData: { kind: 'math', source },
      })),
      appState: {},
      files: {},
    }),
    { units: { system: 'si-prefixed', custom: {} }, digits: 4, resultColor: 'blue', page: { size: 'A4', orientation: 'portrait' } },
  )

const linesOnScreen = () =>
  screen.getAllByRole('list', { name: 'Lines' }).map((list) => linesOf(list).join(''))

/**
 * Print… on the web (docs/spec-v1.md section 11, Print flow; section 8, the
 * window title). jsdom has no constructed style sheets and lays nothing out:
 * the document gets an `adoptedStyleSheets` list and the bodies a size, and
 * `window.print` stands in for the dialog. The print run holds the PDFs.
 */
function standInForPrint() {
  Object.defineProperty(document, 'adoptedStyleSheets', { value: [], writable: true, configurable: true })
  onTestFinished(() => {
    delete (document as { adoptedStyleSheets?: unknown }).adoptedStyleSheets
  })
  onTestFinished(layOutBodies(() => ({ width: 300, height: 96 })))
  const seen: { title: string; pages: number; copies: number; field: boolean }[] = []
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    seen.push({
      title: document.title,
      pages: document.querySelectorAll('.print-view__page').length,
      copies: document.querySelectorAll('.print-view .math-element').length,
      field: document.querySelector('.math-element__field') !== null,
    })
  })
  onTestFinished(() => print.mockRestore())
  return { print, seen }
}

describe('Print…', () => {
  it('prints the pages from ☰, the title the plain name while the dialog is open, then puts it back', async () => {
    const { print, seen } = standInForPrint()
    await mount()
    commitLine(1, 'x = 5')
    await waitFor(() => expect(document.title).toBe('● Untitled'))

    fireEvent.click(screen.getByTestId('main-menu-trigger'))
    fireEvent.click(screen.getByText('Print…'))

    await waitFor(() => expect(print).toHaveBeenCalledOnce())
    expect(seen[0]).toMatchObject({ title: 'Untitled', pages: 1, field: false })
    expect(seen[0].copies).toBeGreaterThan(0)
    await waitFor(() => expect(document.querySelector('.print-view')).toBeNull())
    expect(document.title).toBe('● Untitled')
    expect(await screen.findByTestId('file-name')).toHaveTextContent('● Untitled')
  })

  it('Ctrl+P prints too, ending an open line first', async () => {
    const { print, seen } = standInForPrint()
    await mount()
    const field = typeLine(1, 'x = 7')

    fireEvent.keyDown(field, { key: 'p', ctrlKey: true })

    await waitFor(() => expect(print).toHaveBeenCalledOnce())
    expect(seen[0].field).toBe(false)
    expect(linesOnScreen()[0]).toContain('7')
  })

  it("shows the notice when the pages can't be built, and opens no dialog", async () => {
    const { print } = standInForPrint()
    delete (document as { adoptedStyleSheets?: unknown }).adoptedStyleSheets
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    onTestFinished(() => error.mockRestore())
    await mount()

    fireEvent.keyDown(canvasRoot(), { key: 'p', ctrlKey: true })

    expect(await screen.findByText("The pages couldn't be built, so nothing was printed.")).toBeInTheDocument()
    expect(print).not.toHaveBeenCalled()
    expect(document.title).toBe('Untitled')
  })
})

describe('the ☰ menu', () => {
  it("has Open…, Save, Save as… and Print… first, and none of Excalidraw's own file items", async () => {
    await mount()

    fireEvent.click(screen.getByTestId('main-menu-trigger'))

    const items = Array.from(
      document.querySelectorAll('.dropdown-menu .dropdown-menu-item__text'),
      (item) => item.textContent?.trim(),
    )
    expect(items.slice(0, 4)).toEqual(['Open…', 'Save', 'Save as…', 'Print…'])
    expect(items).toEqual(expect.arrayContaining(['Find on canvas', 'Help', 'Reset the canvas']))
    expect(items).not.toContain('Open')
    expect(items.some((item) => /Save to|Export image/.test(item ?? ''))).toBe(false)
  })

  it('ends with the build stamp, which is text and not an item', async () => {
    await mount()

    fireEvent.click(screen.getByTestId('main-menu-trigger'))

    const stamp = screen.getByTestId('build-stamp')
    expect(stamp.textContent).toBe(__BUILD_STAMP__)
    expect(stamp.textContent).toMatch(/^(dev|[0-9a-f]{7} · \d{4}-\d{2}-\d{2})$/)
    expect(stamp.closest('.dropdown-menu')?.lastElementChild?.contains(stamp)).toBe(true)
    expect(stamp.closest('button, [role="menuitem"]')).toBeNull()
    expect(stamp.tabIndex).toBe(-1)
  })

  it('Save as… asks for a new file', async () => {
    const { files } = await mount()

    fireEvent.click(screen.getByTestId('main-menu-trigger'))
    fireEvent.click(screen.getByText('Save as…'))

    await waitFor(() => expect(files.saveAs).toHaveBeenCalledOnce())
  })
})

describe('keys', () => {
  it('Ctrl+S saves the sheet, and Excalidraw never hears it', async () => {
    const { files } = await mount()
    commitLine(1, 'R = 22 kohm')
    let heard = false
    canvasRoot().addEventListener('keydown', () => (heard = true))

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })
    act(() => {
      canvasRoot().dispatchEvent(event)
    })

    expect(event.defaultPrevented).toBe(true)
    expect(heard).toBe(false)
    await waitFor(() => expect(files.saveAs).toHaveBeenCalledOnce())
    expect(files.disk.get('Untitled.excalimathpad')).toContain('R = 22 kohm')
  })

  it('takes Ctrl+Shift+S and Ctrl+O as the app’s, and swallows Ctrl+Shift+E', async () => {
    const { files } = await mount()
    const press = (key: string, shiftKey = false) => {
      const event = new KeyboardEvent('keydown', { key, ctrlKey: true, shiftKey, bubbles: true, cancelable: true })
      act(() => {
        canvasRoot().dispatchEvent(event)
      })
      return event
    }

    expect(press('S', true).defaultPrevented).toBe(true)
    await waitFor(() => expect(files.saveAs).toHaveBeenCalledOnce())
    expect(press('o').defaultPrevented).toBe(true)
    await waitFor(() => expect(files.open).toHaveBeenCalledOnce())
    expect(press('E', true).defaultPrevented).toBe(true)

    // Excalidraw's image export dialog didn't open.
    expect(document.querySelector('.ImageExportModal')).toBeNull()
  })

  it('takes Ctrl+Shift+S and Ctrl+Shift+E in the line field too', async () => {
    const { files } = await mount()
    const field = typeLine(2, 'I = 7 mA')

    fireEvent.keyDown(field, { key: 'E', ctrlKey: true, shiftKey: true })
    fireEvent.keyDown(field, { key: 'S', ctrlKey: true, shiftKey: true })

    await waitFor(() => expect(files.saveAs).toHaveBeenCalledOnce())
    expect(files.disk.get('Untitled.excalimathpad')).toContain('I = 7 mA')
    expect(document.querySelector('.ImageExportModal')).toBeNull()
  })

  it('Ctrl+S in the line field saves what is typed, and the field stays open', async () => {
    const { files } = await mount()
    const field = typeLine(2, 'I = 5 mA')

    fireEvent.keyDown(field, { key: 's', ctrlKey: true })

    await waitFor(() => expect(files.disk.get('Untitled.excalimathpad')).toContain('I = 5 mA'))
    expect(screen.getByRole('textbox', { name: 'Line source' })).toBe(field)
  })
})

describe('the file name and the window title', () => {
  it('mark unsaved changes with ●, and clear it on save', async () => {
    const { name } = await mount()
    expect(name).toHaveTextContent(/^Untitled$/)

    commitLine(1, 'R = 1 kohm')
    await waitFor(() => expect(name).toHaveTextContent('● Untitled'))
    expect(document.title).toBe('● Untitled')

    fireEvent.keyDown(canvasRoot(), { key: 's', ctrlKey: true })

    await waitFor(() => expect(name).toHaveTextContent(/^Untitled\.excalimathpad$/))
    expect(document.title).toBe('Untitled')
  })

  it('stay clean for a selection or a scroll', async () => {
    const { name } = await mount()

    doubleClickLine('math-inputs', 1)
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Line source' }), { key: 'Escape' })
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    fireEvent.wheel(document.querySelector('canvas')!, { deltaY: 120 })

    expect(name).toHaveTextContent(/^Untitled$/)
  })

  // docs/spec-v1.md section 4, Size: a size write doesn't mark the sheet dirty.
  it('stay clean while the elements are sized to their content', async () => {
    let width = 250
    onTestFinished(layOutBodies(() => ({ width, height: 72 })))
    const { name } = await mount()
    const anchorWidths = () =>
      Array.from(document.querySelectorAll<HTMLElement>('.math-element')).map((el) => el.style.width)
    await waitFor(() => expect(anchorWidths()).toEqual(['250px', '250px']))
    expect(name).toHaveTextContent(/^Untitled$/)

    // Fonts arrive and the content grows.
    width = 270
    fireResizeObservers()

    await waitFor(() => expect(anchorWidths()).toEqual(['270px', '270px']))
    expect(name).toHaveTextContent(/^Untitled$/)
    expect(document.title).toBe('Untitled')
  })
})

describe('leaving the page', () => {
  const leave = () => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event
  }

  it('asks only while there are unsaved changes', async () => {
    const { name } = await mount()
    expect(leave().defaultPrevented).toBe(false)

    commitLine(1, 'R = 1 kohm')
    await waitFor(() => expect(name).toHaveTextContent('●'))

    expect(leave().defaultPrevented).toBe(true)
  })

  it('asks for a line still being typed on a clean sheet', async () => {
    await mount()
    typeLine(1, 'R = 3 kohm')

    expect(leave().defaultPrevented).toBe(true)
  })
})

describe('the recovery copy', () => {
  it('is offered at launch, and Restore brings the sheet back with its name, dirty', async () => {
    const copy = { text: sheetText(['x = 7 m']), name: 'pump.excalimathpad', handle: null }
    const { name } = await mount(copy)

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Restore unsaved changes to pump.excalimathpad?')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restore' }))

    await waitFor(() => expect(linesOnScreen()).toEqual(['x = 7 m']))
    expect(name).toHaveTextContent('● pump.excalimathpad')
    expect(document.title).toBe('● pump')
  })

  it('Discard keeps the new sheet and clears the copy', async () => {
    const { name, recovery } = await mount({ text: sheetText(['x = 7 m']), name: null, handle: null })

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Restore unsaved changes to an untitled sheet?')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))

    await waitFor(() => expect(recovery.current()).toBeNull())
    expect(linesOnScreen()).toEqual(['R = 10 kohmI = 2 mA', 'U = I * R'])
    expect(name).toHaveTextContent(/^Untitled$/)
  })
})

describe('opening', () => {
  it('asks about unsaved changes after the pick, worded as section 13, and Esc cancels', async () => {
    const { files } = await mount()
    commitLine(1, 'R = 1 kohm')
    files.open.mockResolvedValue({ name: 'pump.excalimathpad', text: sheetText(['x = 1']), handle: null })

    fireEvent.keyDown(canvasRoot(), { key: 'o', ctrlKey: true })

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Save changes to Untitled.excalimathpad?')
    expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Save',
      "Don't save",
      'Cancel',
    ])
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(linesOnScreen()).toEqual(['R = 1 kohmI = 2 mA', 'U = I * R'])
  })

  it('asks when the only change is a line still being typed, and Cancel keeps the line', async () => {
    const { files } = await mount()
    files.open.mockResolvedValue({ name: 'pump.excalimathpad', text: sheetText(['x = 1']), handle: null })
    const field = typeLine(1, 'R = 100 kohm')

    fireEvent.keyDown(field, { key: 'o', ctrlKey: true })

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Save changes to')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    // The dialog took focus, which leaves the field as any click outside does.
    expect(linesOnScreen()[0]).toBe('R = 100 kohmI = 2 mA')
  })

  it('keeps the line field open when the picker is cancelled', async () => {
    const { files } = await mount()
    const field = typeLine(1, 'R = 100 kohm')

    fireEvent.keyDown(field, { key: 'o', ctrlKey: true })

    await waitFor(() => expect(files.open).toHaveBeenCalledOnce())
    expect(screen.getByRole('textbox', { name: 'Line source' })).toBe(field)
  })

  it('replaces the sheet with the file, clean, under its name', async () => {
    const { files, name } = await mount()
    files.open.mockResolvedValue({
      name: 'pump.excalimathpad',
      text: sheetText(['D = 4 in', 'A = pi * D^2 / 4']),
      handle: files.handleFor('pump.excalimathpad'),
    })

    fireEvent.keyDown(canvasRoot(), { key: 'o', ctrlKey: true })

    await waitFor(() => expect(linesOnScreen()).toEqual(['D = 4 in', 'A = pi * D^2 / 4']))
    expect(name).toHaveTextContent(/^pump\.excalimathpad$/)
  })

  it('measures the opened sheet again, and it stays clean', async () => {
    onTestFinished(layOutBodies(() => ({ width: 230, height: 48 })))
    const { files, name } = await mount()
    files.open.mockResolvedValue({
      name: 'pump.excalimathpad',
      text: sheetText(['D = 4 in']),
      handle: files.handleFor('pump.excalimathpad'),
    })

    fireEvent.keyDown(canvasRoot(), { key: 'o', ctrlKey: true })

    await waitFor(() => expect(linesOnScreen()).toEqual(['D = 4 in']))
    // The file says 300 × 60; the content measures 230 × 48.
    await waitFor(() =>
      expect(document.querySelector<HTMLElement>('.math-element')!.style.width).toBe('230px'),
    )
    expect(name).toHaveTextContent(/^pump\.excalimathpad$/)
  })

  it('refuses a newer file with section 13’s message', async () => {
    const { files } = await mount()
    files.open.mockResolvedValue({
      name: 'future.excalimathpad',
      text: JSON.stringify({ type: 'excalidraw', elements: [], excalimathpad: { format: 3 } }),
      handle: null,
    })

    fireEvent.keyDown(canvasRoot(), { key: 'o', ctrlKey: true })

    expect(
      await screen.findByText('This sheet was saved by a newer Excalimathpad. Update the app.'),
    ).toBeInTheDocument()
    expect(linesOnScreen()).toEqual(['R = 10 kohmI = 2 mA', 'U = I * R'])
  })

  it('opens a sheet dropped on the canvas, instead of Excalidraw loading it', async () => {
    const { name } = await mount()
    const file = new File([sheetText(['dropped = 1'])], 'dropped.excalimathpad', {
      type: 'application/json',
    })
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', {
      value: { files: [file], items: [{ kind: 'file' }] },
    })

    act(() => {
      canvasRoot().dispatchEvent(drop)
    })

    expect(drop.defaultPrevented).toBe(true)
    await waitFor(() => expect(linesOnScreen()).toEqual(['dropped = 1']))
    expect(name).toHaveTextContent(/^dropped\.excalimathpad$/)
  })
})

// docs/spec-v1.md section 7, The file (M4e, #195): a format 1 sheet opens with
// every line looking as it did, clean, and its next save is format 2.
describe('a sheet saved by 0.2.x (format 1)', () => {
  const OLD = JSON.stringify({
    type: 'excalidraw',
    version: 2,
    elements: [
      {
        id: 'old',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 300,
        height: 60,
        customData: {
          kind: 'math',
          source: 'v = 4 m/s @bold @text-red if v > 3 m/s # speed\n@L @underline # Pumps\nw = v * 2 @yellow',
          title: 'Flow',
        },
      },
    ],
    appState: {},
    files: {},
    excalimathpad: { format: 1, settings: { units: { system: 'si-prefixed', custom: {} }, digits: 4, resultColor: 'blue', page: { size: 'A4', orientation: 'portrait' } } },
  })
  const row = (n: number) => document.querySelector<HTMLElement>(`[data-anchor-id="old"] [data-line="${n - 1}"]`)
  /** The sheet looks as 0.2.x drew it: each line's format on its row, the clause not in its text. */
  const looksAsItDid = async () => {
    await waitFor(() => expect(linesOnScreen()).toEqual(['v = 4 m/s # speed# Pumpsw = v * 2']))
    expect(row(1)).toHaveClass('is-math', 'is-bold', 'is-text-red')
    expect(row(2)).toHaveClass('is-comment', 'is-size-L', 'is-underline')
    expect(row(3)).toHaveClass('is-math', 'is-yellow')
    expect(row(3)!.querySelector('.math-element__result')).toHaveAttribute('data-text', '8 m / s')
  }
  const saved = (text: string | undefined) => {
    const data = JSON.parse(text ?? '{}') as {
      excalimathpad: { format: number }
      elements: { customData: Record<string, unknown> }[]
    }
    return { format: data.excalimathpad.format, customData: data.elements[0].customData }
  }
  const MIGRATED = {
    kind: 'math',
    source: 'v = 4 m/s # speed\n# Pumps\nw = v * 2',
    formats: '@bold @text-red if v > 3 m/s\n@L @underline\n@yellow',
    title: 'Flow',
  }

  it('Open… shows every line as it looked, not dirty, and the next save writes format 2', async () => {
    onTestFinished(layOutBodies(() => ({ width: 230, height: 96 })))
    const { files, name, recovery } = await mount()
    files.open.mockResolvedValue({ name: 'old.excalimathpad', text: OLD, handle: files.handleFor('old.excalimathpad') })

    fireEvent.keyDown(canvasRoot(), { key: 'o', ctrlKey: true })

    await looksAsItDid()
    // Sized to its content, and still clean: opening alone doesn't make the sheet dirty.
    await waitFor(() => expect(document.querySelector<HTMLElement>('.math-element')!.style.width).toBe('230px'))
    expect(name).toHaveTextContent(/^old\.excalimathpad$/)
    expect(document.title).toBe('old')
    expect(recovery.current()).toBeNull()
    // The open line holds the math alone.
    doubleClickLine('old', 1)
    expect(screen.getByRole('textbox', { name: 'Line source' })).toHaveValue('v = 4 m/s # speed')
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Line source' }), { key: 'Escape' })
    expect(name).toHaveTextContent(/^old\.excalimathpad$/)

    fireEvent.keyDown(canvasRoot(), { key: 's', ctrlKey: true })
    await waitFor(() => expect(files.save).toHaveBeenCalledOnce())
    expect(saved(files.disk.get('old.excalimathpad'))).toEqual({ format: 2, customData: MIGRATED })
  })

  it('a dropped file is migrated the same way', async () => {
    const { name } = await mount()
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', {
      value: { files: [new File([OLD], 'dropped.excalimathpad', { type: 'application/json' })], items: [{ kind: 'file' }] },
    })

    act(() => {
      canvasRoot().dispatchEvent(drop)
    })

    await looksAsItDid()
    expect(name).toHaveTextContent(/^dropped\.excalimathpad$/)
  })

  it('a recovery copy written by 0.2.x is migrated when it is restored', async () => {
    const { name, files } = await mount({ text: OLD, name: 'old.excalimathpad', handle: null })

    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Restore' }))

    await looksAsItDid()
    expect(name).toHaveTextContent('● old.excalimathpad')
    fireEvent.keyDown(canvasRoot(), { key: 's', ctrlKey: true })
    await waitFor(() => expect(files.saveAs).toHaveBeenCalledOnce())
    expect(saved(files.disk.get('old.excalimathpad'))).toEqual({ format: 2, customData: MIGRATED })
  })

  // Section 14: a hand-edited file with a clause both in a line's text and stored.
  it('a format 2 file with a clause both in a line’s text and stored reads the typed one in front', async () => {
    const { files, name } = await mount()
    const data = JSON.parse(OLD) as { elements: { customData: Record<string, unknown> }[]; excalimathpad: { format: number } }
    data.excalimathpad.format = 2
    data.elements[0].customData = {
      kind: 'math',
      source: 'v = 4 m/s @red @text-green if v > 2 m/s # speed',
      formats: '@bold @yellow @text-red if v > 3 m/s',
    }
    files.open.mockResolvedValue({ name: 'edited.excalimathpad', text: JSON.stringify(data), handle: files.handleFor('edited.excalimathpad') })

    fireEvent.keyDown(canvasRoot(), { key: 'o', ctrlKey: true })

    // The typed highlight replaces the stored one, the typed rule wins, and the stored bold stays.
    await waitFor(() => expect(row(1)).toHaveClass('is-bold', 'is-red', 'is-text-green'))
    expect(row(1)).not.toHaveClass('is-yellow')
    expect(row(1)).not.toHaveClass('is-text-red')
    expect(name).toHaveTextContent(/^edited\.excalimathpad$/)

    // The first edit that leaves the line moves its clause out, in front of the stored one.
    doubleClickLine('old', 1)
    expect(screen.getByRole('textbox', { name: 'Line source' })).toHaveValue('v = 4 m/s @red @text-green if v > 2 m/s # speed')
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Line source' }), { key: 'Escape' })
    fireEvent.keyDown(canvasRoot(), { key: 's', ctrlKey: true })
    await waitFor(() => expect(files.save).toHaveBeenCalledOnce())
    expect(saved(files.disk.get('edited.excalimathpad')).customData).toEqual({
      kind: 'math',
      source: 'v = 4 m/s # speed',
      formats: '@red @text-green if v > 2 m/s @bold @text-red if v > 3 m/s',
    })
    expect(row(1)).toHaveClass('is-bold', 'is-red', 'is-text-green')
  })
})
