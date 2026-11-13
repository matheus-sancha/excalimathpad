import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SheetCanvas, type SheetCanvasHandle } from './SheetCanvas.tsx'
import { settleResizes, sizeWritesWait, writeAnchorSizes } from './anchorSize.ts'
import { createMathAnchorElements, writeAnchorSource } from './mathAnchor.ts'
import { sceneLoaded, undoControls } from '../test/excalidraw.ts'
import { clickOnCanvas, dragOnCanvas, interactiveCanvas, type ClientPoint } from '../test/gestures.ts'

/**
 * Contracts against the real, installed Excalidraw (docs/spec-v1.md section 4,
 * Size, and section 14): size writes add no undo step and leave a line commit
 * one step, and resize handles set the chosen width or snap back (M4c).
 */
const SOURCE = 'R = 10 kohm'
const BOX = { x: 100, y: 100, width: 300, height: 80 }

async function mount({ snapBack = false, drawing = false, floor = 0, chosenWidth = undefined as number | undefined } = {}) {
  let handle: SheetCanvasHandle | undefined
  const anchors = createMathAnchorElements([{ id: 'm1', ...BOX, source: SOURCE, chosenWidth }])
  // A plain rectangle below the anchor, for a resize of both.
  const drawings = drawing
    ? createMathAnchorElements([{ id: 'r1', ...BOX, y: 250 }]).map((element) => ({
        ...element,
        customData: undefined,
      }))
    : []
  const view = render(
    <SheetCanvas
      initialElements={[...anchors, ...drawings]}
      onReady={(h) => (handle = h)}
    />,
  )
  await waitFor(() => expect(handle).toBeDefined())
  const { api } = handle!
  await sceneLoaded(api)
  if (snapBack) {
    const off = settleResizes(api, (write) => write(), () => floor)
    view.unmount = ((unmount) => () => {
      off()
      unmount()
    })(view.unmount)
  }
  const anchor = (id = 'm1') => api.getSceneElements().find((element) => element.id === id)!
  return {
    api,
    anchor,
    ...undoControls(view.container),
    size: (width: number, height: number) =>
      act(() => {
        writeAnchorSizes(api, new Map([['m1', { width, height }]]))
      }),
    commit: (source: string) =>
      act(() => {
        writeAnchorSource(api, 'm1', source)
      }),
  }
}

describe('size writes on real Excalidraw', () => {
  it('add no undo step', async () => {
    const { anchor, canUndo, size } = await mount()

    size(220, 48)

    expect(anchor()).toMatchObject({ x: 100, y: 100, width: 220, height: 48 })
    expect(canUndo()).toBe(false)
  })

  it('leave a line commit after them one step, which undo takes alone', async () => {
    const { anchor, canUndo, commit, size, undo } = await mount()
    size(220, 48)
    size(260, 48)

    commit('R = 20 kohm')
    undo()

    await waitFor(() => expect(anchor().customData?.source).toBe(SOURCE))
    expect(canUndo()).toBe(false)
    // The size isn't part of the step.
    expect(anchor().width).toBe(260)
  })

  it('control: a size change Excalidraw didn’t capture would be a second step', async () => {
    const { anchor, api, canUndo, commit, undo } = await mount()
    act(() => {
      // The default capture leaves the change pending, as a nudge does.
      api.updateScene({
        elements: api.getSceneElements().map((element) => ({ ...element, width: 260, version: element.version + 1 })),
      })
    })

    commit('R = 20 kohm')
    undo()

    await waitFor(() => expect(anchor().customData?.source).toBe(SOURCE))
    expect(canUndo()).toBe(true)
  })
})

describe('resize handles on real Excalidraw', () => {
  // At zoom 1, Excalidraw 0.18 centres a corner handle 8 px out from the
  // selection's corner; the controls below show the drags reach a handle.
  const corner = { clientX: BOX.x + BOX.width + 8, clientY: BOX.y + BOX.height + 8 }
  const topRight = { clientX: BOX.x + BOX.width + 8, clientY: BOX.y - 8 }

  it('control: without snapping back, dragging a handle resizes the anchor', async () => {
    const { anchor } = await mount()
    clickOnCanvas({ clientX: 150, clientY: 140 })

    await dragOnCanvas(corner, { clientX: corner.clientX + 90, clientY: corner.clientY + 60 })

    expect(anchor().width).toBeGreaterThan(BOX.width)
  })

  const chosen = () => (anchorOf().customData as { width?: number } | undefined)?.width
  let anchorOf: () => { customData?: unknown }

  it('set the chosen width on release, keeping the top and the height (M4c)', async () => {
    const { anchor } = await mount({ snapBack: true })
    anchorOf = anchor
    clickOnCanvas({ clientX: 150, clientY: 140 })

    await dragOnCanvas(corner, { clientX: corner.clientX + 90, clientY: corner.clientY + 60 })

    expect(anchor()).toMatchObject({ x: BOX.x, y: BOX.y, height: BOX.height })
    expect(anchor().width).toBeGreaterThan(BOX.width)
    expect(chosen()).toBe(anchor().width)
  })

  it('restore y after the top-right handle, which moves it, and still take the width', async () => {
    const { anchor } = await mount({ snapBack: true })
    anchorOf = anchor
    clickOnCanvas({ clientX: 150, clientY: 140 })

    await dragOnCanvas(topRight, { clientX: topRight.clientX + 60, clientY: topRight.clientY - 45 })

    expect(anchor()).toMatchObject({ x: BOX.x, y: BOX.y, height: BOX.height })
    expect(chosen()).toBe(anchor().width)
  })

  it('move the left edge with a left handle', async () => {
    const { anchor } = await mount({ snapBack: true })
    anchorOf = anchor
    clickOnCanvas({ clientX: 150, clientY: 140 })
    const left = { clientX: BOX.x - 8, clientY: BOX.y + BOX.height + 8 }

    await dragOnCanvas(left, { clientX: left.clientX - 50, clientY: left.clientY + 30 })

    expect(anchor().x).toBeLessThan(BOX.x)
    expect(anchor().x + anchor().width).toBeCloseTo(BOX.x + BOX.width, 0)
    expect(anchor()).toMatchObject({ y: BOX.y, height: BOX.height })
    expect(chosen()).toBe(anchor().width)
  })

  it('go back to automatic below the floor, the box where it was', async () => {
    const { anchor } = await mount({ snapBack: true, floor: 280, chosenWidth: 300 })
    anchorOf = anchor
    clickOnCanvas({ clientX: 150, clientY: 140 })

    await dragOnCanvas(corner, { clientX: corner.clientX - 120, clientY: corner.clientY })

    expect(anchor()).toMatchObject(BOX)
    expect(chosen()).toBeUndefined()
  })

  it('snap back when only the height changed', async () => {
    const { anchor } = await mount({ snapBack: true })
    anchorOf = anchor
    clickOnCanvas({ clientX: 150, clientY: 140 })
    const bottom = { clientX: BOX.x + BOX.width / 2, clientY: BOX.y + BOX.height + 8 }

    await dragOnCanvas(bottom, { clientX: bottom.clientX, clientY: bottom.clientY + 60 })

    expect(anchor()).toMatchObject(BOX)
    expect(chosen()).toBeUndefined()
  })

  it('set the width on the anchor and leave the drawing resized when both are selected', async () => {
    const { anchor, api } = await mount({ snapBack: true, drawing: true })
    anchorOf = anchor
    act(() => {
      api.updateScene({ appState: { selectedElementIds: { m1: true, r1: true } } })
    })
    // The corner of the box around both.
    const both = { clientX: BOX.x + BOX.width + 8, clientY: 250 + BOX.height + 8 }

    await dragOnCanvas(both, { clientX: both.clientX + 90, clientY: both.clientY + 60 })

    expect(anchor()).toMatchObject({ y: BOX.y, height: BOX.height })
    expect(chosen()).toBe(anchor().width)
    expect(anchor('r1').width).toBeGreaterThan(BOX.width)
  })

  it('make the width one undo step, which takes it back to automatic', async () => {
    const { anchor, undo } = await mount({ snapBack: true })
    anchorOf = anchor
    clickOnCanvas({ clientX: 150, clientY: 140 })
    await dragOnCanvas(corner, { clientX: corner.clientX + 90, clientY: corner.clientY + 60 })

    undo()

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(anchor()).toMatchObject(BOX)
    expect(chosen()).toBeUndefined()
  })

  it('take a second width back to the first with one undo', async () => {
    const { anchor, undo } = await mount({ snapBack: true, chosenWidth: 300 })
    anchorOf = anchor
    clickOnCanvas({ clientX: 150, clientY: 140 })
    await dragOnCanvas(corner, { clientX: corner.clientX + 90, clientY: corner.clientY })
    expect(chosen()).toBeGreaterThan(300)

    undo()

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(chosen()).toBe(300)
  })
})

// Section 17: a size write during Excalidraw's own text edit or a new shape.
// sizeWritesWait reads Excalidraw's app state; these pin each flag it reads
// against the installed package: set in the middle, clear afterwards.
describe('sizeWritesWait on real Excalidraw', () => {
  const at = (clientX: number, clientY: number): ClientPoint => ({ clientX, clientY })
  const pointer = (point: ClientPoint) => ({
    ...point,
    button: 0,
    buttons: 1,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
  })

  /** Presses at `from`, moves to `to`, checks, then lets go: a gesture held in the middle. */
  async function holdDrag(from: ClientPoint, to: ClientPoint, whileHeld: () => void) {
    const canvas = interactiveCanvas()
    await act(async () => {
      fireEvent.pointerDown(canvas, pointer(from))
    })
    for (const step of [0.5, 1]) {
      await act(async () => {
        fireEvent.pointerMove(
          canvas,
          pointer(at(from.clientX + (to.clientX - from.clientX) * step, from.clientY + (to.clientY - from.clientY) * step)),
        )
        await new Promise((resolve) => setTimeout(resolve, 20))
      })
    }
    whileHeld()
    await act(async () => {
      fireEvent.pointerUp(canvas, pointer(to))
    })
  }

  it('is idle on a still scene', async () => {
    const { api } = await mount()

    expect(sizeWritesWait(api.getAppState())).toBe(false)
  })

  it('waits while a new shape is drawn, and not after', async () => {
    const { api } = await mount()
    act(() => api.setActiveTool({ type: 'rectangle' }))

    await holdDrag(at(500, 400), at(600, 480), () => {
      expect(api.getAppState().newElement).not.toBeNull()
      expect(sizeWritesWait(api.getAppState())).toBe(true)
    })

    expect(sizeWritesWait(api.getAppState())).toBe(false)
    expect(api.getSceneElements()).toHaveLength(2)
  })

  it('waits while an element is dragged, and not after', async () => {
    const { api } = await mount()
    clickOnCanvas(at(150, 140))

    await holdDrag(at(150, 140), at(250, 200), () => {
      expect(sizeWritesWait(api.getAppState())).toBe(true)
    })

    expect(sizeWritesWait(api.getAppState())).toBe(false)
  })

  it('waits while a resize handle is held, and not after', async () => {
    const { api } = await mount()
    clickOnCanvas(at(150, 140))
    const corner = at(BOX.x + BOX.width + 8, BOX.y + BOX.height + 8)

    await holdDrag(corner, at(corner.clientX + 60, corner.clientY + 40), () => {
      expect(api.getAppState().isResizing).toBe(true)
      expect(sizeWritesWait(api.getAppState())).toBe(true)
    })

    expect(sizeWritesWait(api.getAppState())).toBe(false)
  })

  it('waits while Excalidraw’s text editor is open', async () => {
    const { api } = await mount()
    act(() => api.setActiveTool({ type: 'text' }))

    clickOnCanvas(at(500, 400))

    await waitFor(() => expect(api.getAppState().editingTextElement).not.toBeNull())
    expect(sizeWritesWait(api.getAppState())).toBe(true)
  })
})
