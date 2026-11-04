import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CaptureUpdateAction, newElementWith } from '@excalidraw/excalidraw'
import { SheetCanvas, type SheetCanvasHandle } from './SheetCanvas.tsx'
import { createMathAnchorElements, writeAnchorSource } from './mathAnchor.ts'
import { sceneLoaded, undoControls } from '../test/excalidraw.ts'

/**
 * Contracts against the real, installed Excalidraw (ADR 0002): an upgrade that
 * changes how it records `customData` or carries it through a copy fails here.
 */
const SOURCE = 'R = 10 kohm\nI = 2 mA'

async function mount(moreAnchors: Parameters<typeof createMathAnchorElements>[0] = []) {
  let handle: SheetCanvasHandle | undefined
  const initialElements = createMathAnchorElements([
    { id: 'm1', x: 100, y: 100, width: 300, height: 80, source: SOURCE },
    ...moreAnchors,
  ])
  const view = render(
    <SheetCanvas initialElements={initialElements} onReady={(h) => (handle = h)} />,
  )
  await waitFor(() => expect(handle).toBeDefined())
  const { api, focusCanvas } = handle!
  await sceneLoaded(api)
  const container = view.container.querySelector<HTMLElement>('.excalidraw')!
  return {
    api,
    container,
    focusCanvas,
    ...undoControls(view.container),
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

// Excalidraw changes an element without capturing it in its arrow-key nudge and
// its Link editor. Until the app records that change, a write lands in the scene
// but adds no step, or its undo takes earlier lines with it.
describe('writeAnchorSource after a change Excalidraw did not capture', () => {
  async function mountSelected() {
    const mounted = await mount()
    mounted.select()
    mounted.focusCanvas()
    return mounted
  }

  function nudge(container: HTMLElement) {
    fireEvent.keyDown(container, { key: 'ArrowRight', code: 'ArrowRight' })
    fireEvent.keyUp(container, { key: 'ArrowRight', code: 'ArrowRight' })
  }

  it('takes one step for the write after a nudge, and one for the nudge', async () => {
    const { api, container, canUndo, undo, redo, sourceOf, write } = await mountSelected()
    nudge(container)
    expect(api.getSceneElements()[0].x).toBe(101)
    // The nudge alone is on no stack: this is what the write has to cope with.
    expect(canUndo()).toBe(false)

    write('a = 1')

    undo()
    await waitFor(() => expect(sourceOf()).toBe(SOURCE))
    expect(api.getSceneElements()[0].x).toBe(101)

    undo()
    await waitFor(() => expect(api.getSceneElements()[0].x).toBe(100))
    expect(canUndo()).toBe(false)

    redo()
    await waitFor(() => expect(api.getSceneElements()[0].x).toBe(101))
    expect(sourceOf()).toBe(SOURCE)
    redo()
    await waitFor(() => expect(sourceOf()).toBe('a = 1'))
  })

  it('keeps lines on either side of a nudge as separate steps', async () => {
    const { api, container, undo, sourceOf, write } = await mountSelected()
    write('one')
    nudge(container)
    write('two')

    undo()
    await waitFor(() => expect(sourceOf()).toBe('one'))
    expect(api.getSceneElements()[0].x).toBe(101)
  })

  // The Link editor's path: a change made with no capture. Its UI needs a real
  // browser; the check by hand is on PR #47.
  it('takes one step for the write after an uncaptured link', async () => {
    const { api, undo, sourceOf, write } = await mountSelected()
    act(() => {
      api.updateScene({
        elements: api
          .getSceneElementsIncludingDeleted()
          .map((e) => newElementWith(e, { link: 'https://example.com' })),
      })
    })

    write('a = 1')

    undo()
    await waitFor(() => expect(sourceOf()).toBe(SOURCE))
    expect(api.getSceneElements()[0].link).toBe('https://example.com')

    undo()
    await waitFor(() => expect(api.getSceneElements()[0].link).toBeNull())
  })

  // Spec section 6. Only the written anchor is recorded, and Excalidraw's undo
  // folds the other's nudge into its captured copy, so no undo reaches it.
  it('splits a nudge of two anchors: the other stays moved', async () => {
    const { api, container, canUndo, undo, sourceOf, write, focusCanvas } = await mount([
      { id: 'm2', x: 100, y: 300, width: 300, height: 80, source: 'b = 2' },
    ])
    const xOf = (id: string) => api.getSceneElements().find((e) => e.id === id)?.x
    act(() => {
      api.updateScene({ appState: { selectedElementIds: { m1: true, m2: true } } })
    })
    focusCanvas()
    nudge(container)
    expect([xOf('m1'), xOf('m2')]).toEqual([101, 101])

    write('a = 1')

    undo()
    await waitFor(() => expect(sourceOf()).toBe(SOURCE))
    expect([xOf('m1'), xOf('m2')]).toEqual([101, 101])

    undo()
    await waitFor(() => expect(xOf('m1')).toBe(100))
    expect(xOf('m2')).toBe(101)
    expect(canUndo()).toBe(false)
  })

  it('ends with the version ahead of where it started', async () => {
    const { api, container, write } = await mountSelected()
    nudge(container)
    const before = api.getSceneElements()[0].version

    write('a = 1')

    expect(api.getSceneElements()[0].version).toBeGreaterThan(before)
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
