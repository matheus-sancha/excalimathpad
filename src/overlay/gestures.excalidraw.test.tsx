import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { SheetCanvas, type SheetCanvasHandle } from '../canvas/SheetCanvas.tsx'
import { createMathAnchorElements } from '../canvas/mathAnchor.ts'
import { AppShell } from '../shell/AppShell.tsx'
import { sceneLoaded, undoControls } from '../test/excalidraw.ts'
import {
  clickOnCanvas,
  doubleClickLine,
  doubleClickOnCanvas,
  dragOnCanvas,
  linePoint,
} from '../test/gestures.ts'
import { MathOverlay } from './MathOverlay.tsx'

/**
 * The gestures against the real Excalidraw 0.18.1 (docs/spec-v1.md sections 4,
 * 6 and 14). Each `without the overlay` case is the control: what Excalidraw
 * does by itself, which the overlay's capture listeners must change. jsdom
 * runs Excalidraw's own hit-testing (#43), so clicks and drags are real input
 * on its interactive canvas. The scene is unscrolled at zoom 1, and jsdom puts
 * the stage at the page's origin, so client points equal scene points.
 */
const anchors = createMathAnchorElements([
  { id: 'm1', x: 100, y: 50, width: 400, height: 72, source: 'R = 10 kohm\nI = 2 mA' },
  { id: 'm2', x: 100, y: 200, width: 400, height: 48, source: 'U = I * R' },
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

async function mount({ elements = anchors, overlay = true } = {}) {
  let handle: SheetCanvasHandle | undefined
  render(<Harness elements={elements} overlay={overlay} onReady={(h) => (handle = h)} />)
  await waitFor(() => expect(handle).toBeDefined())
  const { api } = handle!
  await sceneLoaded(api)
  if (overlay) await screen.findAllByRole('list', { name: 'Lines' })
  const container = document.querySelector<HTMLElement>('.excalidraw')!
  return {
    api,
    ...undoControls(document),
    selected: () => Object.keys(api.getAppState().selectedElementIds),
    sourceOf: (id = 'm1') =>
      api.getSceneElements().find((e) => e.id === id)?.customData?.source as string,
    textElements: () => api.getSceneElements().filter((e) => e.type === 'text').length,
    editingText: () => api.getAppState().editingTextElement !== null,
    /** A key as Excalidraw hears it: on its container, where its handler is. */
    key: (key: string, target: Element = container) =>
      act(() => {
        fireEvent.keyDown(target, { key })
      }),
    positionOf: (id = 'm1') => {
      const element = api.getSceneElements().find((e) => e.id === id)!
      return { x: element.x, y: element.y }
    },
  }
}

/**
 * Closes Excalidraw's text editor and lets it clean up, which it does a frame
 * later: after the test, that cleanup would throw on an unmounted scene.
 */
async function closeTextEditor() {
  const editor = document.querySelector('textarea.excalidraw-wysiwyg')!
  fireEvent.keyDown(editor, { key: 'Escape' })
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
}

const field = () => screen.queryByRole<HTMLInputElement>('textbox', { name: 'Line source' })
const type = (text: string) => fireEvent.input(field()!, { target: { value: text } })

describe('click and drag stay Excalidraw’s', () => {
  it('a click inside an unselected math element selects it', async () => {
    const { selected } = await mount()

    clickOnCanvas(linePoint('m1', 1, 200))

    expect(selected()).toEqual(['m1'])
    expect(field()).toBeNull()
  })

  it('a drag from inside moves it', async () => {
    const { positionOf } = await mount()

    await dragOnCanvas({ clientX: 300, clientY: 80 }, { clientX: 340, clientY: 110 })

    expect(positionOf()).toEqual({ x: 140, y: 80 })
  })
})

describe('double-click (section 14: stopped at the stage)', () => {
  it('without the overlay, Excalidraw opens its text editor on the anchor', async () => {
    const { textElements, editingText } = await mount({ overlay: false })

    doubleClickOnCanvas({ clientX: 300, clientY: 74 })

    expect(editingText()).toBe(true)
    expect(textElements()).toBe(1)
    await closeTextEditor()
  })

  it('with it, edits the line under the pointer and adds no text element', async () => {
    const { textElements, editingText } = await mount()

    doubleClickLine('m1', 2)

    expect(field()!.value).toBe('I = 2 mA')
    expect(field()!.selectionStart).toBe(8)
    expect(document.activeElement).toBe(field())
    expect(editingText()).toBe(false)
    expect(textElements()).toBe(0)
  })

  it('a drawing on top keeps Excalidraw’s double-click', async () => {
    const [ellipse] = convertToExcalidrawElements([
      {
        type: 'ellipse',
        id: 'e1',
        x: 250,
        y: 55,
        width: 100,
        height: 60,
        backgroundColor: '#ffc9c9',
        fillStyle: 'solid',
      },
    ], { regenerateIds: false })
    const { api } = await mount({ elements: [...anchors, ellipse] })

    doubleClickOnCanvas({ clientX: 300, clientY: 85 })

    // Excalidraw labels the ellipse: its text editor opens with it as container.
    const editing = api.getAppState().editingTextElement
    expect(editing && 'containerId' in editing && editing.containerId).toBe('e1')
    expect(field()).toBeNull()
    await closeTextEditor()
  })

  it('a locked math element still edits, and gets no text element', async () => {
    const locked = createMathAnchorElements([
      { id: 'm1', x: 100, y: 50, width: 400, height: 72, source: 'a = 1', locked: true },
    ])
    const { selected, textElements, positionOf } = await mount({ elements: locked })

    clickOnCanvas(linePoint('m1', 1, 200))
    expect(selected()).toEqual([])
    doubleClickLine('m1', 1)

    expect(field()!.value).toBe('a = 1')
    expect(textElements()).toBe(0)
    await dragOnCanvas({ clientX: 300, clientY: 70 }, { clientX: 340, clientY: 110 })
    expect(positionOf()).toEqual({ x: 100, y: 50 })
  })

  it('a grouped math element edits straight away, without entering the group', async () => {
    const grouped = anchors.map((e) => ({ ...e, groupIds: ['g1'] }))
    const { api, selected } = await mount({ elements: grouped })

    clickOnCanvas(linePoint('m1', 1, 200))
    expect(selected().sort()).toEqual(['m1', 'm2'])
    doubleClickLine('m1', 2)

    expect(field()!.value).toBe('I = 2 mA')
    expect(api.getAppState().editingGroupId).toBeNull()
  })
})

describe('Enter (section 14: stopped on document)', () => {
  it('without the overlay, Excalidraw opens its text editor on the selected anchor', async () => {
    const { key, editingText } = await mount({ overlay: false })
    clickOnCanvas({ clientX: 300, clientY: 74 })

    key('Enter')

    expect(editingText()).toBe(true)
    await closeTextEditor()
  })

  it('with it, edits the last line, caret at the end, and opens no editor', async () => {
    const { key, editingText, textElements } = await mount()
    clickOnCanvas(linePoint('m1', 1, 200))

    key('Enter')

    expect(field()!.value).toBe('I = 2 mA')
    expect(field()!.selectionStart).toBe(8)
    expect(editingText()).toBe(false)
    expect(textElements()).toBe(0)
  })

  // `.excalidraw` takes focus when an edit leaves.
  it('works again straight after Esc leaves an edit', async () => {
    const { key, sourceOf } = await mount()
    doubleClickLine('m1', 1)
    type('R = 20 kohm')
    fireEvent.keyDown(field()!, { key: 'Escape' })
    expect(sourceOf()).toBe('R = 20 kohm\nI = 2 mA')

    const focused = document.activeElement!
    expect(focused).toHaveClass('excalidraw')
    key('Enter', focused)

    expect(field()!.value).toBe('I = 2 mA')
  })
})

describe('Esc', () => {
  it('without the overlay, Excalidraw keeps the selection', async () => {
    const { key, selected } = await mount({ overlay: false })
    clickOnCanvas({ clientX: 300, clientY: 74 })

    key('Escape')

    expect(selected()).toEqual(['m1'])
  })

  it('the first leaves the line with the element selected; the second deselects', async () => {
    const { key, selected, undo, sourceOf } = await mount()
    doubleClickLine('m1', 2)
    type('I = 4 mA')

    fireEvent.keyDown(field()!, { key: 'Escape' })
    expect(field()).toBeNull()
    expect(selected()).toEqual(['m1'])

    key('Escape', document.activeElement!)
    expect(selected()).toEqual([])

    // The deselect is no undo step: Ctrl+Z takes the line straight away.
    undo()
    await waitFor(() => expect(sourceOf()).toBe('R = 10 kohm\nI = 2 mA'))
  })

  it('deselects a mixed selection too', async () => {
    const [rect] = convertToExcalidrawElements([
      { type: 'rectangle', id: 'r1', x: 600, y: 50, width: 80, height: 80 },
    ], { regenerateIds: false })
    const { api, key, selected } = await mount({ elements: [...anchors, rect] })
    act(() => {
      api.updateScene({ appState: { selectedElementIds: { m1: true, r1: true } } })
    })

    key('Escape')

    expect(selected()).toEqual([])
  })
})

describe('leaving with a click or a drag (section 6)', () => {
  it('a click outside writes the line; the first Ctrl+Z re-selects, the second takes the line', async () => {
    const { undo, selected, sourceOf } = await mount()
    doubleClickLine('m1', 2)
    type('I = 4 mA')

    clickOnCanvas({ clientX: 800, clientY: 500 })

    expect(field()).toBeNull()
    expect(sourceOf()).toBe('R = 10 kohm\nI = 4 mA')
    expect(selected()).toEqual([])

    undo()
    await waitFor(() => expect(selected()).toEqual(['m1']))
    expect(sourceOf()).toBe('R = 10 kohm\nI = 4 mA')
    undo()
    await waitFor(() => expect(sourceOf()).toBe('R = 10 kohm\nI = 2 mA'))
  })

  it('a click on another line of the element moves the edit there', async () => {
    const { sourceOf } = await mount()
    doubleClickLine('m1', 1)
    type('R = 20 kohm')

    clickOnCanvas(linePoint('m1', 2, 200))

    expect(sourceOf()).toBe('R = 20 kohm\nI = 2 mA')
    expect(field()!.value).toBe('I = 2 mA')
  })

  it('a drag started while editing writes the line as one step, and the move is its own', async () => {
    const { undo, sourceOf, positionOf } = await mount()
    doubleClickLine('m1', 2)
    type('I = 4 mA')

    await dragOnCanvas({ clientX: 300, clientY: 80 }, { clientX: 340, clientY: 110 })

    expect(field()).toBeNull()
    expect(sourceOf()).toBe('R = 10 kohm\nI = 4 mA')
    expect(positionOf()).toEqual({ x: 140, y: 80 })

    undo()
    await waitFor(() => expect(positionOf()).toEqual({ x: 100, y: 50 }))
    expect(sourceOf()).toBe('R = 10 kohm\nI = 4 mA')
    undo()
    await waitFor(() => expect(sourceOf()).toBe('R = 10 kohm\nI = 2 mA'))
  })
})

// Kept as Excalidraw's (#43, answer 5). #44's size writes don't move a bound end.
it('an arrow drawn from inside a math element binds to it', async () => {
  const { api } = await mount()
  act(() => api.setActiveTool({ type: 'arrow' }))

  await dragOnCanvas({ clientX: 300, clientY: 80 }, { clientX: 700, clientY: 400 })

  const arrow = api.getSceneElements().find((e) => e.type === 'arrow')
  expect(arrow && 'startBinding' in arrow && arrow.startBinding?.elementId).toBe('m1')
})
