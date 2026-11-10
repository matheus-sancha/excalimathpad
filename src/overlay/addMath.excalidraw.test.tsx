import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { SheetCanvas, type SheetCanvasHandle } from '../canvas/SheetCanvas.tsx'
import { createMathAnchorElements, isMathAnchor } from '../canvas/mathAnchor.ts'
import { AppShell } from '../shell/AppShell.tsx'
import { sceneLoaded, undoControls } from '../test/excalidraw.ts'
import { clickOnCanvas, doubleClickLine, linePoint } from '../test/gestures.ts'
import { MathOverlay } from './MathOverlay.tsx'

/**
 * Add math and empty removal against the real Excalidraw 0.18.1
 * (docs/spec-v1.md sections 4, 6, 8 and 14): the custom tool, the placing
 * click from `onPointerUp`, and what each adds to Excalidraw's one undo stack.
 * `without the overlay` is the control: what Excalidraw does by itself. The
 * scene is unscrolled at zoom 1, and jsdom puts the stage at the page's origin,
 * so client points equal scene points.
 */
const existing = createMathAnchorElements([
  { id: 'm1', x: 100, y: 50, width: 400, height: 72, source: 'R = 10 kohm\nI = 2 mA' },
])

function Harness({
  elements,
  overlay,
  onReady,
}: {
  elements: readonly ExcalidrawElement[]
  overlay: boolean
  onReady: (handle: SheetCanvasHandle) => void
}) {
  const [canvas, setCanvas] = useState<SheetCanvasHandle | null>(null)
  return (
    <AppShell
      canvas={
        <SheetCanvas
          initialElements={elements}
          onReady={(handle) => {
            setCanvas(handle)
            onReady(handle)
          }}
        />
      }
      overlay={
        overlay &&
        canvas && (
          <MathOverlay
            api={canvas.api}
            canvasRoot={canvas.root}
            forwardWheel={canvas.forwardWheel}
            focusCanvas={canvas.focusCanvas}
          />
        )
      }
    />
  )
}

async function mount({ elements = existing, overlay = true } = {}) {
  let handle: SheetCanvasHandle | undefined
  render(<Harness elements={elements} overlay={overlay} onReady={(h) => (handle = h)} />)
  await waitFor(() => expect(handle).toBeDefined())
  const { api } = handle!
  await sceneLoaded(api)
  const container = document.querySelector<HTMLElement>('.excalidraw')!
  const anchors = () => api.getSceneElements().filter(isMathAnchor)
  return {
    api,
    ...undoControls(document),
    anchors,
    /** The elements placed in the test, as the scene holds them now. */
    placed: () => anchors().filter(({ id }) => id !== 'm1'),
    tool: () => api.getAppState().activeTool,
    selected: () => Object.keys(api.getAppState().selectedElementIds),
    sourceOf: (id: string) =>
      api.getSceneElements().find((e) => e.id === id)?.customData?.source as string | undefined,
    key: (key: string) =>
      act(() => {
        fireEvent.keyDown(container, { key })
      }),
  }
}

const field = () => screen.queryByRole<HTMLInputElement>('textbox', { name: 'Line source' })
const type = (text: string) => fireEvent.input(field()!, { target: { value: text } })
const escapeField = () => fireEvent.keyDown(field()!, { key: 'Escape' })
const empty = { clientX: 300, clientY: 400 }

describe('M and the placing click', () => {
  it('without the overlay, M is no shortcut of Excalidraw’s', async () => {
    const { key, tool } = await mount({ overlay: false })

    key('m')

    expect(tool().type).toBe('selection')
  })

  it('M starts the custom tool, and nothing is in the scene or on the undo stack', async () => {
    const { key, tool, anchors, canUndo } = await mount()

    key('m')

    expect(tool()).toMatchObject({ type: 'custom', customType: 'add-math' })
    expect(anchors()).toHaveLength(1)
    expect(canUndo()).toBe(false)
  })

  it('the next click places one empty element there, selected, with its line open', async () => {
    const { key, tool, placed, selected } = await mount()
    key('m')

    clickOnCanvas(empty)

    expect(placed()).toHaveLength(1)
    const [anchor] = placed()
    expect(anchor).toMatchObject({ x: 300, y: 400, customData: { kind: 'math', source: '' } })
    expect(selected()).toEqual([anchor.id])
    expect(tool().type).toBe('selection')
    expect(field()).toHaveFocus()
  })

  it('Esc before the click cancels: no element and no undo step', async () => {
    const { key, tool, anchors, canUndo } = await mount()
    key('m')

    key('Escape')
    clickOnCanvas(empty)

    expect(tool().type).toBe('selection')
    expect(anchors()).toHaveLength(1)
    expect(canUndo()).toBe(false)
  })

  it('places on top of an existing element, which is neither selected nor moved', async () => {
    const { key, placed, selected, anchors } = await mount()
    key('m')

    clickOnCanvas(linePoint('m1', 1, 200))

    expect(placed()).toHaveLength(1)
    expect(selected()).toEqual([placed()[0].id])
    expect(anchors().find(({ id }) => id === 'm1')).toMatchObject({ x: 100, y: 50 })
  })
})

describe('undo (section 6)', () => {
  it('Add math is one step: undo removes the element, redo brings it back selected', async () => {
    const { key, placed, selected, undo, redo, canUndo } = await mount()
    key('m')
    clickOnCanvas(empty)
    const { id } = placed()[0]
    type('a = 1')
    escapeField()

    // The first undo takes back the line; the second, Add math.
    undo()
    await waitFor(() => expect(placed()[0].customData?.source).toBe(''))
    undo()
    await waitFor(() => expect(placed()).toHaveLength(0))
    expect(canUndo()).toBe(false)

    redo()
    await waitFor(() => expect(placed()).toHaveLength(1))
    expect(selected()).toEqual([id])
  })

  // Starting the tool clears the selection, which Excalidraw records. Selecting
  // the new element in the same write keeps Add math to one step (section 14).
  it('with something selected before, one undo removes the element and restores the selection', async () => {
    const { key, placed, selected, undo } = await mount()
    clickOnCanvas(linePoint('m1', 1, 200))
    expect(selected()).toEqual(['m1'])
    key('m')
    clickOnCanvas(empty)
    type('a = 1')
    escapeField()

    undo()
    await waitFor(() => expect(placed()[0].customData?.source).toBe(''))
    undo()

    await waitFor(() => expect(placed()).toHaveLength(0))
    expect(selected()).toEqual(['m1'])
  })

  it('an empty Add math is removed as one step, and undo brings back the empty box', async () => {
    const { key, placed, selected, undo } = await mount()
    key('m')
    clickOnCanvas(empty)

    escapeField()
    expect(placed()).toHaveLength(0)
    expect(selected()).toEqual([])

    undo()
    await waitFor(() => expect(placed()).toHaveLength(1))
    expect(placed()[0].customData?.source).toBe('')

    undo()
    await waitFor(() => expect(placed()).toHaveLength(0))
  })

  it('an emptied element is removed as one step, and undo brings it back with its text', async () => {
    const [single] = createMathAnchorElements([
      { id: 'm1', x: 100, y: 50, width: 400, height: 48, source: 'U = 5 V' },
    ])
    const { anchors, sourceOf, undo, canUndo } = await mount({ elements: [single] })
    doubleClickLine('m1', 1)
    type('   ')

    escapeField()
    expect(anchors()).toHaveLength(0)

    undo()
    await waitFor(() => expect(sourceOf('m1')).toBe('U = 5 V'))
    // The removal was the only step of the edit: the selecting click is under it.
    undo()
    await waitFor(() => expect(canUndo()).toBe(false))
    expect(sourceOf('m1')).toBe('U = 5 V')
  })
})
