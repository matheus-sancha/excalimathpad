import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { isInSheetPanel } from './panelPresses.ts'
import { SheetCanvas, type SheetCanvasHandle, type SheetPanelSlot } from './SheetCanvas.tsx'

/**
 * The Sheet panel on a phone (docs/spec-v1.md section 8, On a phone, M4d), on
 * the real Excalidraw: a bottom sheet in place of the sidebar, driven by the
 * same handle and reporting the same changes, so App's open-then-restore rule
 * holds on it unchanged.
 */
async function mount(slot: Partial<SheetPanelSlot> = {}) {
  let handle: SheetCanvasHandle | null = null
  const onChange = vi.fn()
  const panel: SheetPanelSlot = {
    errors: 2,
    format: <p>Format here</p>,
    variables: <p>Variables here</p>,
    problemsTab: <p>Problems here</p>,
    onChange,
    ...slot,
  }
  const view = render(<SheetCanvas phone onReady={(ready) => (handle = ready)} sheetPanel={panel} />)
  await waitFor(() => expect(handle).not.toBeNull())
  const rerender = (next: Partial<SheetPanelSlot>) =>
    view.rerender(<SheetCanvas phone onReady={(ready) => (handle = ready)} sheetPanel={{ ...panel, ...next }} />)
  return { canvas: handle!, onChange, rerender }
}

const sheet = () => document.querySelector<HTMLElement>('.sheet-bottom')

describe('the bottom sheet', () => {
  it('opens on a tab from the handle, inside Excalidraw’s box, in place of the sidebar', async () => {
    const { canvas, onChange } = await mount()

    act(() => canvas.showSheetPanel({ open: true, tab: 'format' }))

    await waitFor(() => expect(sheet()).not.toBeNull())
    expect(sheet()!.closest('.excalidraw')).not.toBeNull()
    expect(canvas.root.contains(sheet())).toBe(true)
    expect(document.querySelector('.sidebar')).toBeNull()
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Format here')
    expect(canvas.sheetPanel()).toEqual({ open: true, tab: 'format' })
    expect(onChange).toHaveBeenLastCalledWith(true, 'format')
  })

  it('switches tabs and closes from its own buttons, and Math settings opens it on the last tab', async () => {
    const { canvas, onChange } = await mount()
    act(() => canvas.showSheetPanel({ open: true, tab: 'format' }))
    await waitFor(() => expect(sheet()).not.toBeNull())

    fireEvent.click(screen.getByRole('tab', { name: /Variables/ }))
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Variables here')
    expect(screen.getByRole('tab', { name: /Variables/ })).toHaveAttribute('aria-selected', 'true')
    expect(onChange).toHaveBeenLastCalledWith(true, 'variables')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(sheet()).toBeNull()
    expect(canvas.sheetPanel()).toEqual({ open: false, tab: 'variables' })
    expect(onChange).toHaveBeenLastCalledWith(false, 'variables')

    act(() => canvas.toggleSheetPanel())
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Variables here')
  })

  it('closes from the handle, keeping the tab Math settings opens next', async () => {
    const { canvas } = await mount()
    act(() => canvas.showSheetPanel({ open: true, tab: 'problems' }))
    await waitFor(() => expect(sheet()).not.toBeNull())

    act(() => canvas.showSheetPanel({ open: false, tab: 'format' }))

    expect(sheet()).toBeNull()
    expect(canvas.sheetPanel()).toEqual({ open: false, tab: 'format' })
  })

  it('is short while a line is open, and pins the quick keys above the tab icons', async () => {
    const { canvas, rerender } = await mount()
    act(() => canvas.showSheetPanel({ open: true, tab: 'format' }))
    await waitFor(() => expect(sheet()).not.toBeNull())
    expect(sheet()).not.toHaveClass('is-compact')

    rerender({ compact: true, quickKeys: <div className="sheet-quick-keys">keys</div> })

    expect(sheet()).toHaveClass('is-compact')
    const keys = sheet()!.querySelector('.sheet-quick-keys')!
    const tabs = screen.getByRole('tablist')
    expect(keys.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('is the Sheet panel to the gestures: a press in it is not the canvas’s', async () => {
    const { canvas } = await mount()
    act(() => canvas.showSheetPanel({ open: true, tab: 'format' }))
    await waitFor(() => expect(sheet()).not.toBeNull())

    expect(isInSheetPanel(screen.getByRole('tab', { name: /Format/ }))).toBe(true)
    expect(screen.getByRole('tab', { name: /Problems/ })).toHaveTextContent('2')
  })
})
