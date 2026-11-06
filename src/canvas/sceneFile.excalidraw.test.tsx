import { act, render, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  newElementWith,
} from '@excalidraw/excalidraw'
import type { BinaryFileData, DataURL } from '@excalidraw/excalidraw/types'
import type { FileId } from '@excalidraw/excalidraw/element/types'
import { SheetCanvas, type SheetCanvasHandle } from './SheetCanvas.tsx'
import { createMathAnchorElements, writeAnchorSource } from './mathAnchor.ts'
import { loadScene, SAVED_APP_STATE, saveKey, serializeScene } from './sceneFile.ts'
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

  it('keeps an embedded image and its file, and opening it leaves the sheet clean', async () => {
    const first = await mount()
    const file: BinaryFileData = {
      id: 'img-1' as FileId,
      mimeType: 'image/png',
      // A 1×1 transparent PNG.
      dataURL:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' as DataURL,
      created: 1,
    }
    const [image] = convertToExcalidrawElements([
      { type: 'image', id: 'pic', x: 0, y: 300, width: 40, height: 40, fileId: file.id, status: 'saved' },
    ], { regenerateIds: false })
    act(() => {
      first.api.addFiles([file])
      first.api.updateScene({
        elements: [...first.api.getSceneElements(), image],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      })
    })
    const data = JSON.parse(serializeScene(first.api))
    expect(Object.keys(data.files)).toEqual(['img-1'])

    const second = await mount()
    act(() => loadScene(second.api, data))
    const opened = saveKey(second.api)

    expect(second.api.getSceneElements().map(({ id }) => id)).toEqual(['m1', 'pic'])
    expect(second.api.getFiles()['img-1']).toMatchObject({ mimeType: 'image/png', dataURL: file.dataURL })
    // Excalidraw settles the image after adding its file: that mustn't count as a change.
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(saveKey(second.api)).toBe(opened)
  })

  it('saves no results, selection or scroll', async () => {
    const { api } = await mount()
    act(() => {
      api.updateScene({ appState: { selectedElementIds: { m1: true }, scrollX: 500 } })
    })

    const data = JSON.parse(serializeScene(api))

    // Contract: what Excalidraw's "local" save keeps is exactly what the app
    // restores and counts in the save key (SAVED_APP_STATE).
    expect(Object.keys(data.appState).sort()).toEqual([...SAVED_APP_STATE].sort())
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
