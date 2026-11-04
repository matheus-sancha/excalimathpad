import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CaptureUpdateAction, newElementWith } from '@excalidraw/excalidraw'
import { SheetCanvas, type SheetCanvasHandle } from './SheetCanvas.tsx'
import { createMathAnchorElements, writeAnchorSource } from './mathAnchor.ts'

/**
 * Contracts against the real, installed Excalidraw (ADR 0002): an upgrade that
 * changes how it records `customData` or carries it through a copy fails here.
 */
const SOURCE = 'R = 10 kohm\nI = 2 mA'

async function mount() {
  let handle: SheetCanvasHandle | undefined
  const initialElements = createMathAnchorElements([
    { id: 'm1', x: 100, y: 100, width: 300, height: 80, source: SOURCE },
  ])
  const view = render(
    <SheetCanvas initialElements={initialElements} onReady={(h) => (handle = h)} />,
  )
  await waitFor(() => expect(handle).toBeDefined())
  const { api, focusCanvas } = handle!
  await waitFor(() => expect(api.getAppState().isLoading).toBe(false))
  // Excalidraw's Undo button subscribes to the history in an effect, and misses
  // any step recorded before that runs. A person can't get in first; a test can.
  await act(() => new Promise((resolve) => setTimeout(resolve)))
  const container = view.container.querySelector<HTMLElement>('.excalidraw')!
  const button = (name: 'undo' | 'redo') =>
    view.container.querySelector<HTMLButtonElement>(`[data-testid="button-${name}"]`)!
  return {
    api,
    container,
    focusCanvas,
    canUndo: () => !button('undo').disabled,
    undo: () => fireEvent.click(button('undo')),
    redo: () => fireEvent.click(button('redo')),
    sourceOf: (id = 'm1') =>
      api.getSceneElementsIncludingDeleted().find((e) => e.id === id)?.customData?.source,
    write: (source: string, id = 'm1') => {
      let wrote = false
      act(() => {
        wrote = writeAnchorSource(api, id, source)
      })
      return wrote
    },
    select: () =>
      act(() => {
        api.updateScene({ appState: { selectedElementIds: { m1: true } } })
      }),
  }
}

describe('writeAnchorSource on real Excalidraw', () => {
  it('makes one write one undo step, and undo and redo restore the source', async () => {
    const { canUndo, undo, redo, sourceOf, write } = await mount()
    expect(canUndo()).toBe(false)

    expect(write('a = 1')).toBe(true)
    expect(sourceOf()).toBe('a = 1')
    expect(canUndo()).toBe(true)

    undo()
    await waitFor(() => expect(sourceOf()).toBe(SOURCE))
    expect(canUndo()).toBe(false)

    redo()
    await waitFor(() => expect(sourceOf()).toBe('a = 1'))
  })

  it('never merges writes: three writes are three steps, newest first', async () => {
    const { canUndo, undo, sourceOf, write } = await mount()
    write('one')
    write('two')
    write('three')

    undo()
    await waitFor(() => expect(sourceOf()).toBe('two'))
    undo()
    await waitFor(() => expect(sourceOf()).toBe('one'))
    undo()
    await waitFor(() => expect(sourceOf()).toBe(SOURCE))
    expect(canUndo()).toBe(false)
  })

  it('writes nothing and adds no step when the source is unchanged', async () => {
    const { api, canUndo, write } = await mount()
    const before = api.getSceneElements()[0].version

    expect(write(SOURCE)).toBe(false)

    expect(api.getSceneElements()[0].version).toBe(before)
    expect(canUndo()).toBe(false)
  })

  it('writes nothing to an anchor that is gone', async () => {
    const { api, canUndo, write } = await mount()

    expect(write('a = 1', 'nope')).toBe(false)

    expect(api.getSceneElements()).toHaveLength(1)
    expect(canUndo()).toBe(false)
  })

  it('keeps the source through a delete and its undo', async () => {
    const { api, container, undo, sourceOf, write, select, focusCanvas } = await mount()
    write('a = 1')
    select()
    focusCanvas()

    fireEvent.keyDown(container, { key: 'Delete', code: 'Delete' })
    await waitFor(() => expect(api.getSceneElements()).toHaveLength(0))

    undo()
    await waitFor(() => expect(api.getSceneElements()).toHaveLength(1))
    expect(sourceOf()).toBe('a = 1')
  })

  it('keeps a write and a move as separate steps, undone newest first', async () => {
    const { api, undo, sourceOf, write } = await mount()
    write('a = 1')
    act(() => {
      api.updateScene({
        elements: api.getSceneElementsIncludingDeleted().map((e) => newElementWith(e, { x: 300 })),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      })
    })

    undo()
    await waitFor(() => expect(api.getSceneElements()[0].x).toBe(100))
    expect(sourceOf()).toBe('a = 1')

    undo()
    await waitFor(() => expect(sourceOf()).toBe(SOURCE))
  })
})

// docs/spec-v1.md section 17, Verify first.
describe('a copied anchor keeps its source', () => {
  const originalElementFromPoint = document.elementFromPoint

  afterEach(() => {
    document.elementFromPoint = originalElementFromPoint
  })

  it('through Ctrl+D, under a new id, and each then edits alone', async () => {
    const { api, container, sourceOf, select, write, focusCanvas } = await mount()
    select()
    focusCanvas()

    fireEvent.keyDown(container, { key: 'd', code: 'KeyD', ctrlKey: true })
    await waitFor(() => expect(api.getSceneElements()).toHaveLength(2))

    const copy = api.getSceneElements().find((e) => e.id !== 'm1')!
    expect(copy.customData).toEqual({ kind: 'math', source: SOURCE })

    write('changed', copy.id)
    expect(sourceOf(copy.id)).toBe('changed')
    expect(sourceOf('m1')).toBe(SOURCE)
  })

  it('through copy and paste, under a new id', async () => {
    const { api, container, select, focusCanvas } = await mount()
    // jsdom has no layout. Excalidraw pastes only with the canvas under the cursor.
    document.elementFromPoint = () => container.querySelector('canvas')
    select()
    focusCanvas()

    const clipboard = new Map<string, string>()
    const clipboardData = {
      setData: (type: string, value: string) => void clipboard.set(type, value),
      getData: (type: string) => clipboard.get(type) ?? '',
      get types() {
        return [...clipboard.keys()]
      },
      files: [],
      items: [],
    }
    const clipboardEvent = (type: string) =>
      Object.defineProperty(new Event(type, { bubbles: true, cancelable: true }), 'clipboardData', {
        value: clipboardData,
      })

    await act(async () => {
      document.dispatchEvent(clipboardEvent('copy'))
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    await act(async () => {
      document.dispatchEvent(clipboardEvent('paste'))
      await new Promise((resolve) => setTimeout(resolve, 200))
    })

    await waitFor(() => expect(api.getSceneElements()).toHaveLength(2))
    const copy = api.getSceneElements().find((e) => e.id !== 'm1')!
    expect(copy.customData).toEqual({ kind: 'math', source: SOURCE })
  })
})
