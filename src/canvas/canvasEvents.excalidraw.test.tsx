import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { clickOnCanvas, doubleClickOnCanvas, interactiveCanvas } from '../test/gestures.ts'
import { sceneLoaded } from '../test/excalidraw.ts'
import { listenToCanvas, type CanvasEventHandlers } from './canvasEvents.ts'
import { createMathAnchorElements } from './mathAnchor.ts'
import { SheetCanvas, type SheetCanvasHandle } from './SheetCanvas.tsx'

/**
 * The event phases `listenToCanvas` relies on, against the installed
 * Excalidraw (ADR 0001): a handler that takes a double-click or a key keeps it
 * from Excalidraw, and one that doesn't leaves Excalidraw's own behaviour, the
 * control. An upgrade that moves Excalidraw's handlers to the capture phase, or
 * onto `document`, fails here.
 */
async function mount(take: boolean) {
  let handle: SheetCanvasHandle | undefined
  const anchors = createMathAnchorElements([
    { id: 'm1', x: 100, y: 100, width: 300, height: 80, source: 'a = 1' },
  ])
  render(<SheetCanvas initialElements={anchors} onReady={(h) => (handle = h)} />)
  await waitFor(() => expect(handle).toBeDefined())
  const { api, root } = handle!
  await sceneLoaded(api)
  const handlers: CanvasEventHandlers = {
    doubleClick: vi.fn(() => take),
    pointerDown: vi.fn(),
    click: vi.fn(),
    keyDown: vi.fn(() => take),
  }
  onTestFinished(listenToCanvas(root, handlers))
  return {
    api,
    handlers,
    editingText: () => api.getAppState().editingTextElement !== null,
    textElements: () => api.getSceneElements().filter((e) => e.type === 'text').length,
  }
}

/** Excalidraw's text editor cleans up a frame after it closes. */
async function closeTextEditor() {
  fireEvent.keyDown(document.querySelector('textarea.excalidraw-wysiwyg')!, { key: 'Escape' })
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
}

const inside = { clientX: 250, clientY: 140 }
const key = (key: string) =>
  act(() => {
    fireEvent.keyDown(document.querySelector('.excalidraw')!, { key })
  })

describe('listenToCanvas on real Excalidraw', () => {
  it('a double-click the app takes never reaches Excalidraw', async () => {
    const { editingText, textElements } = await mount(true)

    doubleClickOnCanvas(inside)

    expect(editingText()).toBe(false)
    expect(textElements()).toBe(0)
  })

  it('a double-click the app leaves is Excalidraw’s own (the control)', async () => {
    const { handlers, editingText } = await mount(false)

    doubleClickOnCanvas(inside)

    expect(handlers.doubleClick).toHaveBeenCalledOnce()
    expect(editingText()).toBe(true)
    await closeTextEditor()
  })

  it('a key the app takes never reaches Excalidraw', async () => {
    const { editingText } = await mount(true)
    clickOnCanvas(inside)

    key('Enter')

    expect(editingText()).toBe(false)
  })

  it('a key the app leaves is Excalidraw’s own (the control)', async () => {
    const { handlers, editingText } = await mount(false)
    clickOnCanvas(inside)

    key('Enter')

    expect(handlers.keyDown).toHaveBeenCalledOnce()
    expect(editingText()).toBe(true)
    await closeTextEditor()
  })

  it('hears each press before Excalidraw, and its click after', async () => {
    const order: string[] = []
    const { api, handlers } = await mount(false)
    vi.mocked(handlers.pointerDown).mockImplementation(() => {
      order.push(`press, selected: ${Object.keys(api.getAppState().selectedElementIds)}`)
    })
    vi.mocked(handlers.click).mockImplementation(() => {
      order.push(`click, selected: ${Object.keys(api.getAppState().selectedElementIds)}`)
    })

    clickOnCanvas(inside)

    expect(order).toEqual(['press, selected: ', 'click, selected: m1'])
    expect(handlers.pointerDown).toHaveBeenCalledWith(
      expect.objectContaining({ target: interactiveCanvas() }),
    )
  })

  it('leaves keys aimed outside the canvas, such as the app’s own dialogs, alone', async () => {
    const { handlers } = await mount(true)
    const dialog = document.body.appendChild(document.createElement('div'))
    onTestFinished(() => dialog.remove())

    const notStopped = fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(notStopped).toBe(true)
    expect(handlers.keyDown).not.toHaveBeenCalled()
  })
})
