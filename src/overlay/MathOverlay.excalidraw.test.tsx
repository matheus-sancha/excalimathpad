import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CaptureUpdateAction, newElementWith } from '@excalidraw/excalidraw'
import type { NormalizedZoomValue } from '@excalidraw/excalidraw/types'
import { SheetCanvas, type SheetCanvasHandle } from '../canvas/SheetCanvas.tsx'
import { createMathAnchorElements } from '../canvas/mathAnchor.ts'
import { AppShell } from '../shell/AppShell.tsx'
import { MathOverlay } from './MathOverlay.tsx'

/**
 * The overlay against the real Excalidraw (not the fake in
 * MathOverlay.test.tsx): proves Excalidraw fires onChange / onScrollChange the
 * way the overlay relies on, and that its undo stack takes the steps in
 * docs/spec-v1.md section 6. Same composition as App, with the handle exposed
 * to the test.
 */
const initialElements = createMathAnchorElements([
  { id: 'm1', x: 100, y: 50, width: 400, height: 72, source: 'R = 10 kohm\nI = 2 mA' },
  { id: 'm2', x: 100, y: 200, width: 400, height: 48, source: 'U = I * R' },
])

function Harness({ onReady }: { onReady: (handle: SheetCanvasHandle) => void }) {
  const [canvas, setCanvas] = useState<SheetCanvasHandle | null>(null)
  return (
    <AppShell
      canvas={
        <SheetCanvas
          initialElements={initialElements}
          onReady={(handle) => {
            setCanvas(handle)
            onReady(handle)
          }}
        />
      }
      overlay={
        canvas && (
          <MathOverlay
            api={canvas.api}
            forwardWheel={canvas.forwardWheel}
            focusCanvas={canvas.focusCanvas}
          />
        )
      }
    />
  )
}

const elementOf = (id: string) =>
  document.querySelector<HTMLElement>(`[data-anchor-id="${id}"]`)
const transformOf = (id: string) => elementOf(id)?.style.transform
const resultsOf = (id: string) =>
  elementOf(id)?.querySelector('.math-element__results')?.textContent?.trim()

async function mount() {
  let handle: SheetCanvasHandle | undefined
  render(<Harness onReady={(h) => (handle = h)} />)
  await screen.findAllByRole('list', { name: 'Lines' })
  const { api } = handle!
  const button = (name: 'undo' | 'redo') =>
    document.querySelector<HTMLButtonElement>(`[data-testid="button-${name}"]`)!
  return {
    api,
    canUndo: () => !button('undo').disabled,
    undo: () => fireEvent.click(button('undo')),
    redo: () => fireEvent.click(button('redo')),
    sourceOf: (id = 'm1') =>
      api.getSceneElements().find((e) => e.id === id)?.customData?.source as string,
    sceneCount: () => api.getSceneElements().length,
  }
}

function openLine(n: number, id = 'm1') {
  fireEvent.click(within(elementOf(id)!).getByRole('button', { name: `Edit line ${n}` }))
  return field()
}

const field = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Line source' })
const type = (text: string) => fireEvent.input(field(), { target: { value: text } })
const press = (key: string, more = {}) => fireEvent.keyDown(field(), { key, ...more })
const atStart = () => field().setSelectionRange(0, 0)

describe('MathOverlay on real Excalidraw', () => {
  it('follows pan, zoom and a moved anchor via updateScene', async () => {
    const { api } = await mount()

    act(() => {
      api.updateScene({
        appState: {
          scrollX: -40,
          scrollY: 25,
          zoom: { value: 2 as NormalizedZoomValue },
        },
      })
    })
    // (100 - 40) * 2, (50 + 25) * 2
    await waitFor(() =>
      expect(transformOf('m1')).toBe('translate(120px, 150px) scale(2)'),
    )

    act(() => {
      api.updateScene({
        elements: api
          .getSceneElements()
          .map((e) => (e.id === 'm1' ? { ...e, x: 300, y: 220 } : e)),
      })
    })
    // (300 - 40) * 2, (220 + 25) * 2
    await waitFor(() =>
      expect(transformOf('m1')).toBe('translate(520px, 490px) scale(2)'),
    )
  })

  // Milestone M2 (#3) on the real editor: edit I, U updates; drag the U
  // element above the inputs, and it loses them.
  it('recalculates across elements on edit and when an anchor moves', async () => {
    const { api } = await mount()
    expect(resultsOf('m2')).toBe('= 20 V')

    openLine(2)
    type('I = 4 mA')
    expect(resultsOf('m2')).toBe('= 40 V')

    act(() => {
      api.updateScene({
        elements: api
          .getSceneElements()
          .map((e) => (e.id === 'm2' ? { ...e, y: 0 } : e)),
      })
    })
    await waitFor(() =>
      expect(resultsOf('m2')).toBe('I is defined below'),
    )
  })

  describe('undo steps', () => {
    it('keystrokes change the results but not the scene, and add no step', async () => {
      const { canUndo, sourceOf } = await mount()

      openLine(2)
      type('I = 3 mA')
      type('I = 4 mA')
      type('I = 5 mA')

      expect(resultsOf('m2')).toBe('= 50 V')
      expect(sourceOf()).toBe('R = 10 kohm\nI = 2 mA')
      expect(canUndo()).toBe(false)
    })

    it('takes one step per changed line, undoes newest first, and redo mirrors it', async () => {
      const { canUndo, undo, redo, sourceOf } = await mount()

      openLine(1)
      type('R = 20 kohm')
      press('ArrowDown') // Commits line 1.
      type('I = 4 mA')
      press('Escape') // Commits line 2.
      expect(sourceOf()).toBe('R = 20 kohm\nI = 4 mA')
      expect(resultsOf('m2')).toBe('= 80 V')

      undo()
      await waitFor(() => expect(sourceOf()).toBe('R = 20 kohm\nI = 2 mA'))
      await waitFor(() => expect(resultsOf('m2')).toBe('= 40 V'))

      undo()
      await waitFor(() => expect(sourceOf()).toBe('R = 10 kohm\nI = 2 mA'))
      await waitFor(() => expect(resultsOf('m2')).toBe('= 20 V'))
      expect(canUndo()).toBe(false)

      redo()
      await waitFor(() => expect(sourceOf()).toBe('R = 20 kohm\nI = 2 mA'))
      redo()
      await waitFor(() => expect(sourceOf()).toBe('R = 20 kohm\nI = 4 mA'))
      await waitFor(() => expect(resultsOf('m2')).toBe('= 80 V'))
    })

    it('a line left unchanged adds no step', async () => {
      const { canUndo } = await mount()

      openLine(1)
      press('ArrowDown')
      press('Escape')

      expect(canUndo()).toBe(false)
    })

    it('a split is one step, and the line edited next is its own', async () => {
      const { canUndo, undo, sourceOf } = await mount()

      openLine(2)
      press('Enter') // At the end: opens an empty line.
      expect(sourceOf()).toBe('R = 10 kohm\nI = 2 mA\n')
      type('V_x = 3 V')
      press('Escape')
      expect(sourceOf()).toBe('R = 10 kohm\nI = 2 mA\nV_x = 3 V')

      undo()
      await waitFor(() => expect(sourceOf()).toBe('R = 10 kohm\nI = 2 mA\n'))
      undo()
      await waitFor(() => expect(sourceOf()).toBe('R = 10 kohm\nI = 2 mA'))
      expect(canUndo()).toBe(false)
    })

    it('a join is one step', async () => {
      const { canUndo, undo, sourceOf } = await mount()

      openLine(2)
      atStart()
      press('Backspace')
      expect(sourceOf()).toBe('R = 10 kohmI = 2 mA')
      press('Escape')

      undo()
      await waitFor(() => expect(sourceOf()).toBe('R = 10 kohm\nI = 2 mA'))
      expect(canUndo()).toBe(false)
    })

    // Excalidraw only hears keys inside its own container, and the field is
    // outside it. The browser's text undo itself can't run in jsdom.
    it('Ctrl+Z in the field never reaches the sheet’s undo', async () => {
      const { sourceOf } = await mount()
      openLine(1)
      type('R = 20 kohm')
      press('ArrowDown') // A step that a sheet undo would take back.
      type('I = 4 mA')

      press('z', { ctrlKey: true, code: 'KeyZ' })

      expect(sourceOf()).toBe('R = 20 kohm\nI = 2 mA')
      expect(field().value).toBe('I = 4 mA')
    })

    it('after Esc, Ctrl+Z goes to the sheet’s undo', async () => {
      const { sourceOf } = await mount()
      openLine(2)
      type('I = 4 mA')
      press('Escape')

      const focused = document.activeElement!
      expect(focused).toHaveClass('excalidraw')
      fireEvent.keyDown(focused, { key: 'z', code: 'KeyZ', ctrlKey: true })

      await waitFor(() => expect(sourceOf()).toBe('R = 10 kohm\nI = 2 mA'))
    })

    it('a line and a move are separate steps', async () => {
      const { api, undo, sourceOf } = await mount()
      openLine(2)
      type('I = 4 mA')
      press('Escape')
      act(() => {
        api.updateScene({
          elements: api
            .getSceneElementsIncludingDeleted()
            .map((e) => (e.id === 'm1' ? newElementWith(e, { x: 300 }) : e)),
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        })
      })

      undo()
      await waitFor(() => expect(transformOf('m1')).toBe('translate(100px, 50px) scale(1)'))
      expect(sourceOf()).toBe('R = 10 kohm\nI = 4 mA')

      undo()
      await waitFor(() => expect(sourceOf()).toBe('R = 10 kohm\nI = 2 mA'))
    })
  })

  it('brings back a deleted element with its source after a later line edit', async () => {
    const { api, undo, sourceOf, sceneCount } = await mount()
    act(() => {
      api.updateScene({
        elements: api
          .getSceneElementsIncludingDeleted()
          .map((e) => (e.id === 'm1' ? newElementWith(e, { isDeleted: true }) : e)),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      })
    })
    await waitFor(() => expect(sceneCount()).toBe(1))

    openLine(1, 'm2')
    type('U = 5')
    press('Escape')

    undo()
    await waitFor(() => expect(sourceOf('m2')).toBe('U = I * R'))
    undo()
    await waitFor(() => expect(sceneCount()).toBe(2))
    expect(sourceOf('m1')).toBe('R = 10 kohm\nI = 2 mA')
  })

  it('shows a duplicated anchor’s source, and each then edits alone', async () => {
    const { api, sceneCount, sourceOf } = await mount()
    act(() => {
      api.updateScene({ appState: { selectedElementIds: { m2: true } } })
    })
    const container = document.querySelector<HTMLElement>('.excalidraw')!
    container.focus()

    fireEvent.keyDown(container, { key: 'd', code: 'KeyD', ctrlKey: true })
    await waitFor(() => expect(sceneCount()).toBe(3))

    const copyId = api.getSceneElements().find((e) => !['m1', 'm2'].includes(e.id))!.id
    await waitFor(() => expect(resultsOf(copyId)).toBe('= 20 V'))

    openLine(1, copyId)
    type('U = I * R * 2')
    press('Escape')

    expect(sourceOf(copyId)).toBe('U = I * R * 2')
    expect(sourceOf('m2')).toBe('U = I * R')
  })
})
