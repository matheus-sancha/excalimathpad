import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, onTestFinished } from 'vitest'
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
    { units: { system: 'si-prefixed', custom: {} }, digits: 4, page: { size: 'A4', orientation: 'portrait' } },
  )

const linesOnScreen = () =>
  screen.getAllByRole('list', { name: 'Lines' }).map((list) => linesOf(list).join(''))

describe('the ☰ menu', () => {
  it("has Open…, Save and Save as… first, and none of Excalidraw's own file items", async () => {
    await mount()

    fireEvent.click(screen.getByTestId('main-menu-trigger'))

    const items = Array.from(
      document.querySelectorAll('.dropdown-menu .dropdown-menu-item__text'),
      (item) => item.textContent?.trim(),
    )
    expect(items.slice(0, 3)).toEqual(['Open…', 'Save', 'Save as…'])
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
      text: JSON.stringify({ type: 'excalidraw', elements: [], excalimathpad: { format: 2 } }),
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
