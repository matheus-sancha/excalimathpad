import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { describe, expect, it } from 'vitest'
import { contentToShow, type ContentView } from './sceneFile.ts'

/**
 * What an opened sheet is centred on (docs/spec-v1.md section 14, The
 * Excalidraw upgrade: an opened sheet lands where it did). The rule is
 * Excalidraw 0.18.1's own, which the canary's `setViewport` doesn't have.
 */
const box = (id: string, x: number, y: number, width = 160, height = 60) =>
  ({ id, type: 'rectangle', x, y, width, height, angle: 0, isDeleted: false }) as unknown as ExcalidrawElement

const view = (over: Partial<ContentView> = {}): ContentView => ({
  width: 1500,
  height: 900,
  zoom: { value: 1 } as ContentView['zoom'],
  scrollX: 0,
  scrollY: 0,
  offsetLeft: 0,
  offsetTop: 0,
  ...over,
})

const ids = (elements: readonly ExcalidrawElement[]) => elements.map((element) => element.id)

describe('contentToShow', () => {
  it('is the whole sheet where it fits the view', () => {
    const sheet = [box('a', 40, 120), box('b', 40, 320)]
    expect(ids(contentToShow(sheet, view()))).toEqual(['a', 'b'])
  })

  it('is the nearest element where the sheet is wider or taller than the view', () => {
    const wide = [box('a', 40, 120), box('far', 4000, 3000)]
    expect(ids(contentToShow(wide, view()))).toEqual(['a'])
    const tall = [box('top', 40, 120), box('low', 40, 2000)]
    expect(ids(contentToShow(tall, view()))).toEqual(['top'])
  })

  it('counts the zoom: a sheet that fits at 50% is shown whole', () => {
    const sheet = [box('a', 0, 0), box('b', 2000, 0)]
    expect(ids(contentToShow(sheet, view()))).toEqual(['a'])
    expect(ids(contentToShow(sheet, view({ zoom: { value: 0.5 } as ContentView['zoom'] })))).toEqual(['a', 'b'])
  })

  it('is one element that is itself larger than the view', () => {
    const sheet = [box('pump', 40, 320, 1029, 2262)]
    expect(ids(contentToShow(sheet, view()))).toEqual(['pump'])
  })

  it('measures from the scene point 0.18.1 measured from', () => {
    const sheet = [box('a', 40, 120), box('far', 4000, 3000)]
    // At 100% that point is the scene's origin, less the canvas's place in the window, wherever the view is.
    expect(ids(contentToShow(sheet, view({ scrollX: -2000, scrollY: -1500 })))).toEqual(['a'])
    // At another zoom it moves with the scroll: at 200%, scrolled by -8000 and -6000, it is (4000, 3000).
    const zoomed = view({ zoom: { value: 2 } as ContentView['zoom'], scrollX: -8000, scrollY: -6000 })
    expect(ids(contentToShow(sheet, zoomed))).toEqual(['far'])
  })
})
