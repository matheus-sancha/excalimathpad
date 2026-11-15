import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import { listenToCanvas } from './canvasEvents.ts'
import { keepPanelPresses, SHEET_SIDEBAR_CLASS } from './panelPresses.ts'
import { SheetCanvas, type SheetCanvasHandle } from './SheetCanvas.tsx'

/**
 * Contract tests on the real Excalidraw 0.18.1 (ADR 0001) for a press and a
 * key in the Sheet panel (docs/spec-v1.md section 14, Panel controls that act
 * on the open line, M4d). Each leans on behaviour that isn't public API, so an
 * upgrade that changes it fails here first. Each has its control: what
 * happens without the app's measure.
 */
describe('a press and a key in the Sheet panel', () => {
  const [shape] = convertToExcalidrawElements([{ type: 'rectangle', id: 'r1', x: 10, y: 10, width: 50, height: 50 }], {
    regenerateIds: false,
  })

  async function mount() {
    let handle: SheetCanvasHandle | null = null
    render(
      <SheetCanvas
        initialElements={[shape]}
        onReady={(ready) => (handle = ready)}
        sheetPanel={{
          errors: 0,
          variables: <p>Variables</p>,
          problemsTab: <p>Problems</p>,
          settings: (
            <select aria-label="Unit system">
              <option>SI</option>
              <option>USCS</option>
            </select>
          ),
        }}
      />,
    )
    await waitFor(() => expect(handle).not.toBeNull())
    const canvas = handle!
    act(() => canvas.showSheetPanel({ open: true, tab: 'variables' }))
    await waitFor(() => expect(document.querySelector(`.${SHEET_SIDEBAR_CLASS}`)).not.toBeNull())
    return canvas
  }
  const selectedTab = () => screen.getByRole('tab', { selected: true }).textContent
  const listen = (target: EventTarget, type: string, listener: EventListener, capture = false) => {
    target.addEventListener(type, listener, capture)
    onTestFinished(() => target.removeEventListener(type, listener, capture))
  }
  const prevent = (event: Event) => event.preventDefault()

  it('draws the panel inside the box the gestures listen on, and a press there is not theirs', async () => {
    const canvas = await mount()
    const sidebar = document.querySelector(`.${SHEET_SIDEBAR_CLASS}`)!
    expect(canvas.root.contains(sidebar)).toBe(true)
    const pointerDown = vi.fn()
    onTestFinished(
      listenToCanvas(canvas.root, { doubleClick: () => false, pointerDown, click: () => {}, keyDown: () => false }),
    )

    fireEvent.pointerDown(screen.getByRole('tab', { name: 'Problems' }))
    expect(pointerDown).not.toHaveBeenCalled()
    // The control: a press on the canvas is the gestures'.
    fireEvent.pointerDown(canvas.root.querySelector('canvas.interactive')!)
    expect(pointerDown).toHaveBeenCalledOnce()
  })

  it("switches Radix's tab on its own mousedown, after a prevention heard above React's root", async () => {
    const canvas = await mount()
    onTestFinished(keepPanelPresses(canvas.root))

    const press = fireEvent.mouseDown(screen.getByRole('tab', { name: 'Problems' }))

    // Prevented, so no focus moves; and still switched.
    expect(press).toBe(false)
    await waitFor(() => expect(selectedTab()).toBe('Problems'))
  })

  it.each([
    ['in capture on the document', (sidebar: Element) => listen(sidebar.ownerDocument, 'mousedown', prevent, true)],
    ['on the sidebar itself', (sidebar: Element) => listen(sidebar, 'mousedown', prevent)],
  ])("doesn't switch tabs when the mousedown is prevented %s (the control)", async (_, register) => {
    await mount()
    register(document.querySelector(`.${SHEET_SIDEBAR_CLASS}`)!)

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Problems' }))

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(selectedTab()).toBe('Variables')
  })

  it('keeps a floating panel open on a press in a node marked data-prevent-outside-click', async () => {
    // jsdom's canvas has no width, so the panel floats and closes on an outside press.
    await mount()
    const marked = document.body.appendChild(document.createElement('input'))
    marked.setAttribute('data-prevent-outside-click', '')
    const plain = document.body.appendChild(document.createElement('div'))
    onTestFinished(() => {
      marked.remove()
      plain.remove()
    })

    fireEvent.pointerDown(marked)
    expect(document.querySelector(`.${SHEET_SIDEBAR_CLASS}`)).not.toBeNull()
    // The control: an unmarked press outside closes it.
    fireEvent.pointerDown(plain)
    await waitFor(() => expect(document.querySelector(`.${SHEET_SIDEBAR_CLASS}`)).toBeNull())
  })

  it("passes no key from a focused <select> in the panel to Excalidraw's shortcuts", async () => {
    const canvas = await mount()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Settings' }))
    // Excalidraw's own select all, as a person would select.
    fireEvent.keyDown(document.querySelector('.excalidraw')!, { key: 'a', code: 'KeyA', ctrlKey: true })
    await waitFor(() => expect(canvas.api.getAppState().selectedElementIds).toEqual({ r1: true }))
    const select = await screen.findByRole('combobox', { name: 'Unit system' })
    select.focus()

    fireEvent.keyDown(select, { key: 'Delete', code: 'Delete' })
    expect(canvas.api.getSceneElements()).toHaveLength(1)
    // The control: the same key from the sidebar's own box, outside the panel's
    // guard, reaches Excalidraw, which counts nothing but text fields as fields.
    fireEvent.keyDown(document.querySelector(`.${SHEET_SIDEBAR_CLASS}`)!, { key: 'Delete', code: 'Delete' })
    await waitFor(() => expect(canvas.api.getSceneElements()).toHaveLength(0))
  })
})
