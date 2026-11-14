import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { modals, notices, type FuzzySuggestModal, type WorkspaceLeaf } from './obsidian.ts'
import { readSheet, writeSheet, DEFAULT_SETTINGS } from '../../src/file/sheetFormat.ts'
import { MESSAGES } from '../../src/file/sheetSession.ts'
import { doubleClickLine } from '../../src/test/gestures.ts'
import { linesOf } from '../../src/test/sheetView.ts'
import { PICK_IMAGE_PLACEHOLDER } from '../ImagePicker.ts'
import { conflictNotice, SheetView, writeFailedNotice } from '../SheetView.ts'
import { vaultWith, type Vault } from './harness.ts'

/**
 * A sheet in a vault (docs/spec-v1.md section 7, A sheet in a vault): autosave
 * by `saveKey`, a failed write, rename, outside changes to an idle and a busy
 * tab, the conflict copy, and a dropped sheet file. Against the fake
 * `obsidian` and the real Excalidraw.
 */

const SHEET = 'Calcs/pump.excalimathpad'

/** A sheet of one math element, `calc`, holding `lines`. */
function sheetOf(lines: string[], settings = DEFAULT_SETTINGS) {
  return writeSheet(
    JSON.stringify({
      type: 'excalidraw',
      version: 2,
      elements: [
        {
          id: 'calc',
          type: 'rectangle',
          x: 0,
          y: 0,
          width: 320,
          height: 80,
          customData: { kind: 'math', source: lines.join('\n') },
        },
      ],
      appState: {},
      files: {},
    }),
    settings,
  )
}

const START = sheetOf(['a = 2 m', 'b = a * 3'])

const open: WorkspaceLeaf[] = []
let vault: Vault

beforeEach(() => {
  notices.length = 0
})

afterEach(async () => {
  for (const leaf of open.splice(0)) await act(() => leaf.detach())
  vi.useRealTimers()
})

/** Opens `path` in a new tab and waits for its sheet to show. */
async function openTab(path = SHEET) {
  const leaf = await act(() => vault.open(path))
  open.push(leaf)
  await screen.findAllByRole('list', { name: 'Lines' }, { timeout: 10_000 })
  // The sheet loads once Excalidraw is ready, and then it is what the file holds.
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
  return { leaf, view: leaf.view as unknown as SheetView & { saveRequests: number } }
}

async function setUp(files: Record<string, string> = { [SHEET]: START }) {
  vault = await vaultWith(files)
  return openTab()
}

const shownLines = () => linesOf(screen.getAllByRole('list', { name: 'Lines' })[0])
const writes = () => vault.app.vault.writes
const fileText = (path = SHEET) => vault.app.vault.files.get(path) ?? ''
const sourceIn = (text: string) => {
  const read = readSheet(text)
  if (read.kind !== 'sheet') throw new Error(`not a sheet: ${read.kind}`)
  const elements = read.scene.elements as { id: string; customData?: { source?: string } }[]
  return elements.find((element) => element.id === 'calc')?.customData?.source
}

/** Opens line `n` (1-based) and types over it, leaving it open. */
function typeLine(n: number, text: string) {
  doubleClickLine('calc', n)
  const field = screen.getByRole('textbox', { name: 'Line source' })
  fireEvent.input(field, { target: { value: text } })
  return field
}

/** Edits a line and leaves it: one line commit. */
function commitLine(n: number, text: string) {
  fireEvent.keyDown(typeLine(n, text), { key: 'Escape' })
}

const lineField = () => screen.queryByRole('textbox', { name: 'Line source' })

describe('autosave (section 7: only a change of saveKey writes)', () => {
  it('asks Obsidian to save after a line commit, and the save writes the sheet', async () => {
    const { view } = await setUp()
    expect(view.saveRequests).toBe(0)
    commitLine(2, 'b = a * 4')
    expect(view.saveRequests).toBeGreaterThan(0)
    await act(() => view.save())
    expect(writes()).toHaveLength(1)
    expect(sourceIn(fileText())).toBe('a = 2 m\nb = a * 4')
    // The block and its settings travel with it, so the web app opens it unchanged.
    expect(readSheet(fileText())).toMatchObject({ kind: 'sheet', settings: DEFAULT_SETTINGS })
    // Written once: a second save has nothing to write.
    await act(() => view.save())
    expect(writes()).toHaveLength(1)
  })

  it('writes 2 s after a line commit by itself, through requestSave', async () => {
    await setUp()
    commitLine(1, 'a = 3 m')
    expect(writes()).toHaveLength(0)
    await waitFor(() => expect(writes()).toHaveLength(1), { timeout: 4000 })
    expect(sourceIn(fileText())).toBe('a = 3 m\nb = a * 3')
  })

  it('never writes while viewing: opening, selecting, scrolling, a theme change, closing', async () => {
    const { leaf, view } = await setUp()
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.interactive')!
    act(() => {
      fireEvent.wheel(canvas, { deltaY: 120, clientX: 100, clientY: 100 })
      fireEvent.wheel(canvas, { deltaY: -40, ctrlKey: true, clientX: 100, clientY: 100 })
    })
    // Excalidraw's own Dark mode key.
    act(() => {
      fireEvent.keyDown(document.querySelector('.excalidraw')!, { key: 'D', code: 'KeyD', altKey: true, shiftKey: true })
    })
    await waitFor(() => expect(document.querySelector('.excalidraw.theme--dark')).not.toBeNull())
    doubleClickLine('calc', 1)
    fireEvent.keyDown(lineField()!, { key: 'Escape' })
    await act(() => view.save())
    await act(() => leaf.detach())
    open.splice(open.indexOf(leaf), 1)
    expect(view.saveRequests).toBe(0)
    expect(writes()).toEqual([])
    expect(fileText()).toBe(START)
  })

  it('writes at once when the tab closes, committing the open line first', async () => {
    const { leaf } = await setUp()
    typeLine(2, 'b = a * 5')
    await act(() => leaf.detach())
    open.splice(open.indexOf(leaf), 1)
    expect(writes()).toHaveLength(1)
    expect(sourceIn(fileText())).toBe('a = 2 m\nb = a * 5')
  })

  it("writes at once on Obsidian's Save current file, and the line stays open", async () => {
    const { view } = await setUp()
    typeLine(1, 'a = 7 m')
    await act(() => view.save())
    expect(sourceIn(fileText())).toBe('a = 7 m\nb = a * 3')
    expect(lineField()).toHaveValue('a = 7 m')
  })

  it('writes at once when Obsidian quits', async () => {
    await setUp()
    commitLine(1, 'a = 9 m')
    await act(() => vault.app.workspace.quit())
    expect(sourceIn(fileText())).toBe('a = 9 m\nb = a * 3')
  })

  it('a Settings change writes too: it is saved with the sheet', async () => {
    const { view } = await setUp()
    const sheet = (view as unknown as { sheet: { setSettings: (s: typeof DEFAULT_SETTINGS) => void } }).sheet
    act(() => sheet.setSettings({ ...DEFAULT_SETTINGS, digits: 6 }))
    expect(view.saveRequests).toBeGreaterThan(0)
    await act(() => view.save())
    expect(readSheet(fileText())).toMatchObject({ kind: 'sheet', settings: { digits: 6 } })
  })
})

describe('a failed write (section 7; section 13, In a vault)', () => {
  it('shows the notice, keeps the work, and the next save writes it', async () => {
    const { view } = await setUp()
    commitLine(2, 'b = a * 8')
    vault.app.vault.failNext = new Error('Permission denied.')
    await act(() => view.save())
    expect(notices).toEqual([writeFailedNotice('pump.excalimathpad', 'Permission denied')])
    expect(notices[0]).toBe("Couldn't save pump.excalimathpad: Permission denied. Your work is still open.")
    expect(fileText()).toBe(START)
    expect(shownLines()).toContain('b = a * 8')
    await act(() => view.save())
    expect(sourceIn(fileText())).toBe('a = 2 m\nb = a * 8')
  })
})

describe('rename and move (section 7: the tab stays open)', () => {
  it('keeps the tab and writes to the new path', async () => {
    const { leaf, view } = await setUp()
    await act(() => vault.app.vault.rename(view.file!, 'Archive/pump 2.excalimathpad'))
    expect(leaf.view).toBe(view)
    commitLine(1, 'a = 4 m')
    await act(() => view.save())
    expect(writes().map(({ path }) => path)).toEqual(['Archive/pump 2.excalimathpad'])
    expect(sourceIn(fileText('Archive/pump 2.excalimathpad'))).toBe('a = 4 m\nb = a * 3')
  })
})

describe('an outside change (section 7: sync, git, another app, another tab)', () => {
  const OUTSIDE = sheetOf(['a = 2 m', 'b = a * 3', 'c = b + 1 m'])

  it('reloads an idle tab in place: no write, no undo step, the history cleared', async () => {
    const { view } = await setUp()
    act(() => vault.app.vault.changeOutside(SHEET, OUTSIDE))
    await waitFor(() => expect(shownLines()).toEqual(['a = 2 m', 'b = a * 3', 'c = b + 1 m']))
    expect(fileText()).toBe(OUTSIDE)
    expect(notices).toEqual([])
    expect(vault.app.vault.creates).toEqual([])
    // Ctrl+Z doesn't reach back to before the reload.
    act(() => {
      fireEvent.keyDown(document.querySelector('.excalidraw')!, { key: 'z', code: 'KeyZ', ctrlKey: true })
    })
    expect(shownLines()).toEqual(['a = 2 m', 'b = a * 3', 'c = b + 1 m'])
    await act(() => view.save())
    expect(writes()).toEqual([])
  })

  it('keeps scroll and zoom on an idle reload', async () => {
    await setUp()
    act(() => {
      fireEvent.wheel(document.querySelector('canvas.interactive')!, { deltaY: 200, clientX: 50, clientY: 50 })
    })
    const element = () => document.querySelector<HTMLElement>('[data-anchor-id="calc"]')!
    await waitFor(() => expect(element().style.transform).toMatch(/translate/))
    const before = element().style.transform
    act(() => vault.app.vault.changeOutside(SHEET, OUTSIDE))
    await waitFor(() => expect(shownLines()).toHaveLength(3))
    expect(element().style.transform).toBe(before)
  })

  it('a busy tab keeps the outside version in the file and writes its own beside it, with a notice', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 14, 15, 32))
    const { view } = await setUp()
    commitLine(2, 'b = a * 10')
    act(() => vault.app.vault.changeOutside(SHEET, OUTSIDE))
    const copy = 'Calcs/pump (conflict 2026-11-14 1532).excalimathpad'
    await waitFor(() => expect(vault.app.vault.creates.map(({ path }) => path)).toEqual([copy]))
    expect(sourceIn(vault.app.vault.creates[0].data)).toBe('a = 2 m\nb = a * 10')
    expect(notices).toEqual([conflictNotice('pump', 'pump (conflict 2026-11-14 1532)')])
    expect(notices[0]).toBe('pump changed elsewhere. Your version was saved beside it as pump (conflict 2026-11-14 1532).')
    // Then it reloads: the tab shows the outside version, which stays in the file.
    await waitFor(() => expect(shownLines()).toEqual(['a = 2 m', 'b = a * 3', 'c = b + 1 m']))
    await act(() => view.save())
    expect(writes()).toEqual([])
    expect(fileText()).toBe(OUTSIDE)
  })

  it('a line still being typed goes into the copy, and the line closes', async () => {
    await setUp()
    typeLine(1, 'a = 11 m')
    act(() => vault.app.vault.changeOutside(SHEET, OUTSIDE))
    await waitFor(() => expect(vault.app.vault.creates).toHaveLength(1))
    expect(sourceIn(vault.app.vault.creates[0].data)).toBe('a = 11 m\nb = a * 3')
    await waitFor(() => expect(shownLines()).toHaveLength(3))
    expect(lineField()).toBeNull()
    expect(fileText()).toBe(OUTSIDE)
  })

  it('a line open but unchanged has nothing to keep: the tab reloads with no copy', async () => {
    await setUp()
    doubleClickLine('calc', 1)
    expect(lineField()).not.toBeNull()
    act(() => vault.app.vault.changeOutside(SHEET, OUTSIDE))
    await waitFor(() => expect(shownLines()).toHaveLength(3))
    expect(vault.app.vault.creates).toEqual([])
    expect(notices).toEqual([])
  })

  it('never overwrites a file: a taken copy name gets a number', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 14, 15, 32))
    const taken = 'Calcs/pump (conflict 2026-11-14 1532).excalimathpad'
    await setUp({ [SHEET]: START, [taken]: 'someone else' })
    commitLine(1, 'a = 12 m')
    act(() => vault.app.vault.changeOutside(SHEET, OUTSIDE))
    await waitFor(() => expect(vault.app.vault.creates).toHaveLength(1))
    expect(vault.app.vault.creates[0].path).toBe('Calcs/pump (conflict 2026-11-14 1532) 1.excalimathpad')
    expect(vault.app.vault.files.get(taken)).toBe('someone else')
  })

  it("is Obsidian's setViewData too, when it reads the same file again", async () => {
    const { view } = await setUp()
    // The file changed with no `modify` reaching the view; Obsidian's call is the only word of it.
    vault.app.vault.files.set(SHEET, OUTSIDE)
    act(() => view.setViewData(OUTSIDE, false))
    await waitFor(() => expect(shownLines()).toHaveLength(3))
    expect(writes()).toEqual([])
  })

  it('a second tab on the same file is another view: its write reloads the idle one', async () => {
    const first = await setUp()
    const second = await openTab()
    const [, secondLines] = screen.getAllByRole('list', { name: 'Lines' })
    expect(linesOf(secondLines)).toEqual(['a = 2 m', 'b = a * 3'])
    // The first tab's edit, written.
    commitLine(2, 'b = a * 6')
    await act(() => first.view.save())
    expect(writes()).toHaveLength(1)
    await waitFor(() =>
      expect(screen.getAllByRole('list', { name: 'Lines' }).map((list) => linesOf(list)[1])).toEqual([
        'b = a * 6',
        'b = a * 6',
      ]),
    )
    await act(() => second.view.save())
    expect(writes()).toHaveLength(1)
    expect(vault.app.vault.creates).toEqual([])
  })

  it('an outside version this app can’t open shows its message, and the tab never writes it', async () => {
    const { leaf, view } = await setUp()
    const newer = JSON.stringify({ type: 'excalidraw', elements: [], excalimathpad: { format: 99 } })
    act(() => vault.app.vault.changeOutside(SHEET, newer))
    await waitFor(() => expect(view.containerEl).toHaveTextContent(MESSAGES.newer))
    await act(() => leaf.detach())
    open.splice(open.indexOf(leaf), 1)
    expect(writes()).toEqual([])
    expect(fileText()).toBe(newer)
  })
})

describe("the tab's own writes coming back (section 7: never a conflict, 0.1.0's beta)", () => {
  // Found in the 0.1.0 beta: typing in a line made a conflict copy on every
  // save, and the copy's tab made its own. Each case below is the tab's own
  // write reaching it again, with a line open as it is while typing.

  it('Obsidian reading the file again hands back the version from before the save: no copy', async () => {
    const { view } = await setUp()
    typeLine(1, 'a = 11 m')
    await act(() => view.save())
    const written = fileText()
    act(() => view.setViewData(START, false))
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(vault.app.vault.creates).toEqual([])
    expect(notices).toEqual([])
    expect(fileText()).toBe(written)
    expect(lineField()).toHaveValue('a = 11 m')
  })

  it('a write caught half-done (an empty read) is no outside change: no copy, the sheet stays', async () => {
    const { view } = await setUp()
    typeLine(1, 'a = 11 m')
    await act(() => view.save())
    act(() => view.setViewData('', false))
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(vault.app.vault.creates).toEqual([])
    expect(notices).toEqual([])
    expect(view.containerEl).not.toHaveTextContent(MESSAGES.notASheet)
    expect(lineField()).toHaveValue('a = 11 m')
  })

  it('two saves close together: the first coming back after the second started is no outside change', async () => {
    const { view } = await setUp()
    const field = typeLine(1, 'a = 11 m')
    let first!: Promise<void>
    act(() => {
      first = view.save()
    })
    fireEvent.input(field, { target: { value: 'a = 12 m' } })
    await act(() => Promise.all([first, view.save()]))
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(vault.app.vault.creates).toEqual([])
    expect(notices).toEqual([])
    expect(sourceIn(fileText())).toBe('a = 12 m\nb = a * 3')
    expect(lineField()).toHaveValue('a = 12 m')
  })
})

describe('a sheet file dropped on the canvas (section 7: ignored in a vault)', () => {
  const drop = (file: File) => {
    const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent
    const files = Object.assign([file], { item: (i: number) => [file][i] ?? null })
    Object.defineProperty(event, 'dataTransfer', { value: { files, items: [], types: ['Files'], getData: () => '' } })
    document.querySelector('canvas.interactive')!.dispatchEvent(event)
    return event
  }

  it('is stopped before Excalidraw, and the sheet stays', async () => {
    await setUp()
    const reached = vi.fn()
    document.querySelector('.excalidraw')!.addEventListener('drop', reached)
    let event: DragEvent | null = null
    act(() => {
      event = drop(new File([sheetOf(['x = 1'])], 'other.excalimathpad'))
    })
    expect(event!.defaultPrevented).toBe(true)
    expect(reached).not.toHaveBeenCalled()
    expect(shownLines()).toEqual(['a = 2 m', 'b = a * 3'])
    expect(writes()).toEqual([])
  })

  it('an image goes on to Excalidraw, as it does on the web', async () => {
    await setUp()
    const reached = vi.fn()
    document.querySelector('.excalidraw')!.addEventListener('drop', reached)
    act(() => {
      drop(new File([new Uint8Array([137, 80, 78, 71])], 'photo.png', { type: 'image/png' }))
    })
    expect(reached).toHaveBeenCalled()
  })
})

describe('the vault image picker (section 12a, Reach: one image the user picks)', () => {
  const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer
  const files = {
    [SHEET]: START,
    'Notes/meeting.md': '# private notes',
    'Notes/other.excalimathpad': START,
    'Assets/pump-curve.png': PNG,
    'Assets/logo.SVG': new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>').buffer,
  }

  const pressImageTool = () =>
    act(() => {
      fireEvent.click(document.querySelector('[data-testid="toolbar-image"]')!.closest('label')!)
    })
  const picker = () => modals.at(-1) as FuzzySuggestModal<unknown>

  beforeEach(() => {
    modals.length = 0
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 300
        naturalHeight = 150
        onload: (() => void) | null = null
        set src(_value: string) {
          queueMicrotask(() => this.onload?.())
        }
      },
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('lists only image files, by path, and reads nothing before the pick', async () => {
    vault = await vaultWith(files)
    await openTab()
    pressImageTool()
    expect(picker().isOpen).toBe(true)
    expect(picker().placeholder).toBe(PICK_IMAGE_PLACEHOLDER)
    expect(picker().shown()).toEqual(['Assets/logo.SVG', 'Assets/pump-curve.png'])
    expect(vault.app.vault.binaryReads).toEqual([])
  })

  it('reads only the picked image and copies it into the sheet, which then saves it', async () => {
    vault = await vaultWith(files)
    const { view } = await openTab()
    pressImageTool()
    act(() => picker().choose('Assets/pump-curve.png'))
    await waitFor(() => expect(view.saveRequests).toBeGreaterThan(0))
    expect(vault.app.vault.binaryReads).toEqual(['Assets/pump-curve.png'])
    await act(() => view.save())
    const saved = JSON.parse(fileText()) as { elements: { type: string; fileId?: string }[]; files: Record<string, { dataURL: string }> }
    const image = saved.elements.find(({ type }) => type === 'image')!
    expect(saved.files[image.fileId!].dataURL).toBe(`data:image/png;base64,${btoa(String.fromCharCode(137, 80, 78, 71, 13, 10, 26, 10))}`)
    // The image file itself is untouched; only the sheet was written.
    expect(writes().map(({ path }) => path)).toEqual([SHEET])
  })

  it('closing the picker without a pick places nothing', async () => {
    vault = await vaultWith(files)
    const { view } = await openTab()
    pressImageTool()
    act(() => picker().close())
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(view.saveRequests).toBe(0)
    expect(vault.app.vault.binaryReads).toEqual([])
  })
})
