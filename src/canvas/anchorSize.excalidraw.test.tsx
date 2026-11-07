import { act, render, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SheetCanvas, type SheetCanvasHandle } from './SheetCanvas.tsx'
import { snapBackResizes, writeAnchorSizes } from './anchorSize.ts'
import { createMathAnchorElements, writeAnchorSource } from './mathAnchor.ts'
import { sceneLoaded, undoControls } from '../test/excalidraw.ts'
import { clickOnCanvas, dragOnCanvas } from '../test/gestures.ts'

/**
 * Contracts against the real, installed Excalidraw (docs/spec-v1.md section 4,
 * Size, and section 14): size writes add no undo step and leave a line commit
 * one step, and resize handles snap back.
 */
const SOURCE = 'R = 10 kohm'
const BOX = { x: 100, y: 100, width: 300, height: 80 }

async function mount({ snapBack = false, drawing = false } = {}) {
  let handle: SheetCanvasHandle | undefined
  const anchors = createMathAnchorElements([{ id: 'm1', ...BOX, source: SOURCE }])
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
    const off = snapBackResizes(api, (write) => write())
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

  it('snap back to where the anchor was when the handle is let go', async () => {
    const { anchor } = await mount({ snapBack: true })
    clickOnCanvas({ clientX: 150, clientY: 140 })

    await dragOnCanvas(corner, { clientX: corner.clientX + 90, clientY: corner.clientY + 60 })

    expect(anchor()).toMatchObject(BOX)
  })

  it('restore y too after the top-right handle, which moves it', async () => {
    const { anchor } = await mount({ snapBack: true })
    clickOnCanvas({ clientX: 150, clientY: 140 })

    await dragOnCanvas(topRight, { clientX: topRight.clientX + 60, clientY: topRight.clientY - 45 })

    expect(anchor()).toMatchObject(BOX)
  })

  it('snap the anchor back and leave the drawing resized when both are selected', async () => {
    const { anchor, api } = await mount({ snapBack: true, drawing: true })
    act(() => {
      api.updateScene({ appState: { selectedElementIds: { m1: true, r1: true } } })
    })
    // The corner of the box around both.
    const both = { clientX: BOX.x + BOX.width + 8, clientY: 250 + BOX.height + 8 }

    await dragOnCanvas(both, { clientX: both.clientX + 90, clientY: both.clientY + 60 })

    expect(anchor()).toMatchObject(BOX)
    expect(anchor('r1').width).toBeGreaterThan(BOX.width)
  })

  it('leave nothing for undo to take back', async () => {
    const { anchor, undo } = await mount({ snapBack: true })
    clickOnCanvas({ clientX: 150, clientY: 140 })
    await dragOnCanvas(corner, { clientX: corner.clientX + 90, clientY: corner.clientY + 60 })

    undo()

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(anchor()).toMatchObject(BOX)
  })
})
