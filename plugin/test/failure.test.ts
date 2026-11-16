import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notices, type WorkspaceLeaf } from './obsidian.ts'
import { readSheet, writeSheet, DEFAULT_SETTINGS } from '../../src/file/sheetFormat.ts'
import { FAILURE_MESSAGES } from '../../src/failure/details.ts'
import { doubleClickLine } from '../../src/test/gestures.ts'
import { linesOf } from '../../src/test/sheetView.ts'
import type { SheetView } from '../SheetView.ts'
import { vaultWith, type Vault } from './harness.ts'

/**
 * Injected failures in a vault (docs/spec-v1.md section 14, M4e; section 4,
 * Unexpected failures): the view is made to throw in an Obsidian tab, against
 * the fake `obsidian` and the real Excalidraw. The failed view never writes
 * the file, and Reload the sheet mounts what the tab held. The web's half, and
 * the smaller failures, are `src/failure/injected.excalidraw.test.tsx`.
 */

/** Switched by a test: the overlay's own render throws while set. */
const bomb = vi.hoisted(() => ({ view: false }))
vi.mock('../../src/overlay/readingOrder.ts', async (original) => {
  const real = await original<typeof import('../../src/overlay/readingOrder.ts')>()
  return {
    ...real,
    readingOrder: (...args: Parameters<typeof real.readingOrder>) => {
      if (bomb.view) throw new Error('injected: the view')
      return real.readingOrder(...args)
    },
  }
})

const SHEET = 'Calcs/pump.excalimathpad'

function sheetOf(lines: string[]) {
  return writeSheet(
    JSON.stringify({
      type: 'excalidraw',
      version: 2,
      elements: [
        { id: 'calc', type: 'rectangle', x: 0, y: 0, width: 320, height: 80, customData: { kind: 'math', source: lines.join('\n') } },
      ],
      appState: {},
      files: {},
    }),
    DEFAULT_SETTINGS,
  )
}

const open: WorkspaceLeaf[] = []
let vault: Vault
let copied: string[]
let errors: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  notices.length = 0
  bomb.view = false
  copied = []
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text: string) => void copied.push(text) },
  })
  // React prints each caught failure.
  errors = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(async () => {
  bomb.view = false
  for (const leaf of open.splice(0)) await act(() => leaf.detach())
  errors.mockRestore()
})

async function setUp() {
  vault = await vaultWith({ [SHEET]: sheetOf(['a = 2 m', 'b = a * 3']) })
  const leaf = await act(() => vault.open(SHEET))
  open.push(leaf)
  await screen.findAllByRole('list', { name: 'Lines' }, { timeout: 10_000 })
  // The sheet loads once Excalidraw is ready, and then it is what the file holds.
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
  return { leaf, view: leaf.view as unknown as SheetView & { saveRequests: number } }
}

const shownLines = () => linesOf(screen.getAllByRole('list', { name: 'Lines' })[0])
const writes = () => vault.app.vault.writes
const sourceInFile = () => {
  const read = readSheet(vault.app.vault.files.get(SHEET) ?? '')
  if (read.kind !== 'sheet') throw new Error(`not a sheet: ${read.kind}`)
  return (read.scene.elements as { customData?: { source?: string } }[])[0].customData?.source
}

/** Opens line `n` (1-based) and types over it, leaving it open. */
function typeLine(n: number, text: string) {
  doubleClickLine('calc', n)
  const field = screen.getByRole('textbox', { name: 'Line source' })
  fireEvent.input(field, { target: { value: text } })
  return field
}

/** A line committed and not yet written, another being typed, then the view throws on the next key. */
async function failWhileTyping() {
  const tab = await setUp()
  fireEvent.keyDown(typeLine(1, 'a = 5 m'), { key: 'Escape' })
  const field = typeLine(2, 'b = a * secret_flo')
  bomb.view = true
  act(() => {
    fireEvent.input(field, { target: { value: 'b = a * secret_flow' } })
  })
  return tab
}

describe('the view failing as a whole, in a vault', () => {
  it('shows the failure screen in the tab, with the line being typed', async () => {
    const { view } = await failWhileTyping()

    const screenBox = screen.getByRole('alert')
    expect(view.contentEl).toContainElement(screenBox)
    expect(screenBox).toHaveTextContent(FAILURE_MESSAGES.view)
    expect(screenBox.querySelector('code')).toHaveTextContent('b = a * secret_flow')
    expect(document.querySelector('.excalidraw')).toBeNull()
  })

  it('never writes the file: not by autosave, Save current file, or closing the tab', async () => {
    const { leaf, view } = await failWhileTyping()
    expect(view.commands).toBeNull()

    // The save the line commit asked for comes due, and finds nothing to write.
    await act(() => new Promise((resolve) => setTimeout(resolve, 2500)))
    await act(() => view.save())
    expect(writes()).toHaveLength(0)

    open.splice(0)
    await act(() => leaf.detach())
    expect(writes()).toHaveLength(0)
    expect(sourceInFile()).toBe('a = 2 m\nb = a * 3')
    expect(notices).toEqual([])
  })

  it('copies details that say the plugin and its device, and hold no sheet text', async () => {
    await failWhileTyping()

    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: FAILURE_MESSAGES.copyDetails }))
    await waitFor(() => expect(copied).toHaveLength(1))
    const lines = copied[0].split('\n')
    expect(lines[0]).toMatch(/^Excalimathpad \d+\.\d+\.\d+/)
    expect(lines[1]).toBe('Obsidian plugin, desktop')
    expect(lines[2]).toBe('What failed: the view')
    expect(lines[3]).toBe('Error: injected: the view')
    expect(lines.at(-1)).toBe(FAILURE_MESSAGES.noContent)
    for (const text of ['secret_flow', 'a = 5 m', '5 m', 'b = a']) expect(copied[0]).not.toContain(text)
  })

  it('Reload the sheet mounts what the tab held, up to the last line commit, and autosave goes on from there', async () => {
    const { view } = await failWhileTyping()
    const asked = view.saveRequests
    bomb.view = false

    fireEvent.click(screen.getByRole('button', { name: FAILURE_MESSAGES.reload }))

    await screen.findAllByRole('list', { name: 'Lines' }, { timeout: 10_000 })
    // The committed line is there; the line that was being typed isn't put back.
    await waitFor(() => expect(shownLines()).toEqual(['a = 5 m', 'b = a * 3']))
    expect(screen.queryByRole('textbox', { name: 'Line source' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()

    // What it held was unwritten, so the reloaded sheet asks to be saved, and the save writes it.
    await waitFor(() => expect(view.saveRequests).toBeGreaterThan(asked))
    await act(() => view.save())
    expect(writes()).toHaveLength(1)
    expect(sourceInFile()).toBe('a = 5 m\nb = a * 3')
  })

  it('Reload the sheet of a sheet the file already holds writes nothing', async () => {
    const { view } = await setUp()
    const field = typeLine(2, 'b = a * 4')
    bomb.view = true
    act(() => {
      fireEvent.input(field, { target: { value: 'b = a * 44' } })
    })
    expect(screen.getByRole('alert')).toHaveTextContent(FAILURE_MESSAGES.typing)
    bomb.view = false

    fireEvent.click(screen.getByRole('button', { name: FAILURE_MESSAGES.reload }))

    await screen.findAllByRole('list', { name: 'Lines' }, { timeout: 10_000 })
    await waitFor(() => expect(shownLines()).toEqual(['a = 2 m', 'b = a * 3']))
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)))
    await act(() => view.save())
    expect(writes()).toHaveLength(0)
  })

  it('reloads from the file as last written when the failed view kept nothing', async () => {
    const { view } = await setUp()
    fireEvent.keyDown(typeLine(1, 'a = 7 m'), { key: 'Escape' })
    await act(() => view.save())
    expect(writes()).toHaveLength(1)

    // It fails, is reloaded while still failing (before its sheet loads: nothing kept), then recovers.
    const field = typeLine(2, 'b = a * 4')
    bomb.view = true
    act(() => {
      fireEvent.input(field, { target: { value: 'b = a * 44' } })
    })
    fireEvent.click(screen.getByRole('button', { name: FAILURE_MESSAGES.reload }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    bomb.view = false
    fireEvent.click(screen.getByRole('button', { name: FAILURE_MESSAGES.reload }))

    await screen.findAllByRole('list', { name: 'Lines' }, { timeout: 10_000 })
    await waitFor(() => expect(shownLines()).toEqual(['a = 7 m', 'b = a * 3']))
  })
})
