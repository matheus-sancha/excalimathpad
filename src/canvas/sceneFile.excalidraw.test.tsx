import { act, render, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CaptureUpdateAction, newElementWith } from '@excalidraw/excalidraw'
import { SheetCanvas, type SheetCanvasHandle } from './SheetCanvas.tsx'
import { createMathAnchorElements, writeAnchorSource } from './mathAnchor.ts'
import { loadScene, saveKey, serializeScene } from './sceneFile.ts'
import { sceneLoaded, undoControls } from '../test/excalidraw.ts'

/**
 * The scene half of the sheet file against the real Excalidraw (ADR 0004): what
 * a save keeps, what an open does to undo, and what makes the sheet dirty.
 */
async function mount() {
  let handle: SheetCanvasHandle | undefined
  const initialElements = createMathAnchorElements([
    { id: 'm1', x: 100, y: 100, width: 300, height: 80, source: 'a = 1\nb = a * 2' },
  ])
  const view = render(
    <SheetCanvas initialElements={initialElements} onReady={(h) => (handle = h)} />,
  )
  await waitFor(() => expect(handle).toBeDefined())
  const { api } = handle!
  await sceneLoaded(api)
  return { api, ...undoControls(view.container) }
}

const sourceIn = (json: string) =>
  (JSON.parse(json).elements as { id: string; customData?: { source?: string } }[]).find(
    ({ id }) => id === 'm1',
  )?.customData?.source

describe('serializeScene and loadScene on real Excalidraw', () => {
  it("keeps each anchor's source, the background and the grid", async () => {
    const first = await mount()
    act(() => {
      first.api.updateScene({
        appState: { viewBackgroundColor: '#ffec99', gridModeEnabled: true },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      })
    })
    const json = serializeScene(first.api)
    expect(sourceIn(json)).toBe('a = 1\nb = a * 2')

    const second = await mount()
    act(() => loadScene(second.api, JSON.parse(json)))

    const anchor = second.api.getSceneElements().find(({ id }) => id === 'm1')
    expect(anchor?.customData).toEqual({ kind: 'math', source: 'a = 1\nb = a * 2' })
    expect(second.api.getAppState()).toMatchObject({
      viewBackgroundColor: '#ffec99',
      gridModeEnabled: true,
    })
  })

  it('saves no results, selection or scroll', async () => {
    const { api } = await mount()
    act(() => {
      api.updateScene({ appState: { selectedElementIds: { m1: true }, scrollX: 500 } })
    })

    const data = JSON.parse(serializeScene(api))

    expect(Object.keys(data.appState).sort()).toEqual(
      ['gridModeEnabled', 'gridSize', 'gridStep', 'viewBackgroundColor'],
    )
    expect(JSON.stringify(data)).not.toContain('= 2')
  })

  it('leaves deleted elements out of the file', async () => {
    const { api } = await mount()
    act(() => {
      api.updateScene({
        elements: api.getSceneElements().map((e) => newElementWith(e, { isDeleted: true })),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      })
    })

    expect(JSON.parse(serializeScene(api)).elements).toEqual([])
  })

  it('is not an undo step, and clears the history of the previous sheet', async () => {
    const { api, canUndo, undo } = await mount()
    act(() => {
      writeAnchorSource(api, 'm1', 'c = 3')
    })
    expect(canUndo()).toBe(true)
    const other = JSON.parse(serializeScene(api))
    const sourceNow = () => api.getSceneElements()[0]?.customData?.source

    act(() => loadScene(api, other))
    expect(sourceNow()).toBe('c = 3')

    // `history.clear()` doesn't tell the Undo button, so it stays lit until the
    // next history event. Pressing it undoes nothing and puts the button right.
    undo()
    await waitFor(() => expect(canUndo()).toBe(false))
    expect(sourceNow()).toBe('c = 3')
  })

  it('clears the selection of the previous sheet', async () => {
    const { api } = await mount()
    act(() => {
      api.updateScene({ appState: { selectedElementIds: { m1: true } } })
    })

    act(() => loadScene(api, JSON.parse(serializeScene(api))))

    expect(api.getAppState().selectedElementIds).toEqual({})
  })
})

describe('saveKey on real Excalidraw', () => {
  it('changes on a line commit, a move, a delete and an undo', async () => {
    const { api, undo } = await mount()
    const keys = [saveKey(api)]
    const record = () => {
      const key = saveKey(api)
      expect(keys).not.toContain(key)
      keys.push(key)
    }

    act(() => {
      writeAnchorSource(api, 'm1', 'c = 3')
    })
    record()

    act(() => {
      api.updateScene({
        elements: api.getSceneElements().map((e) => newElementWith(e, { x: e.x + 10 })),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      })
    })
    record()

    undo()
    await waitFor(() => expect(saveKey(api)).not.toBe(keys.at(-1)))
    keys.push(saveKey(api))

    act(() => {
      api.updateScene({
        elements: api.getSceneElements().map((e) => newElementWith(e, { isDeleted: true })),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      })
    })
    record()
  })

  it('changes with the background and the grid', async () => {
    const { api } = await mount()
    const before = saveKey(api)

    act(() => {
      api.updateScene({ appState: { viewBackgroundColor: '#000000' } })
    })

    expect(saveKey(api)).not.toBe(before)
  })

  it('stays the same on selection, scroll, zoom and theme', async () => {
    const { api } = await mount()
    const before = saveKey(api)

    act(() => {
      api.updateScene({
        appState: {
          selectedElementIds: { m1: true },
          scrollX: 300,
          scrollY: -40,
          zoom: { value: 2 as never },
          theme: 'dark',
        },
      })
    })

    expect(saveKey(api)).toBe(before)
  })
})
