import { sceneCoordsToViewportCoords, viewportCoordsToSceneCoords } from '@excalidraw/excalidraw'
import type { NormalizedZoomValue } from '@excalidraw/excalidraw/types'
import { describe, expect, it } from 'vitest'
import { sceneToStage, stageToScene, type Viewport } from './viewport.ts'

const cases: Viewport[] = [
  { scrollX: 0, scrollY: 0, zoom: 1 },
  { scrollX: 150, scrollY: -40, zoom: 1 },
  { scrollX: -75.5, scrollY: 300, zoom: 2 },
  { scrollX: 12, scrollY: 34, zoom: 0.25 },
]
const point = { x: 120, y: -60 }

describe('sceneToStage', () => {
  it('applies scroll before zoom', () => {
    expect(sceneToStage(point, { scrollX: 30, scrollY: 10, zoom: 2 })).toEqual({
      x: 300,
      y: -100,
    })
  })

  it.each(cases)('round-trips through stageToScene at %o', (viewport) => {
    const back = stageToScene(sceneToStage(point, viewport), viewport)
    expect(back.x).toBeCloseTo(point.x)
    expect(back.y).toBeCloseTo(point.y)
  })

  // Contract: our math must agree with Excalidraw's own helper, so the
  // overlay lands where Excalidraw draws. Fails if Excalidraw changes it.
  it.each(cases)('agrees with Excalidraw at %o', (viewport) => {
    const theirs = sceneCoordsToViewportCoords(
      { sceneX: point.x, sceneY: point.y },
      {
        ...viewport,
        zoom: { value: viewport.zoom as NormalizedZoomValue },
        offsetLeft: 0,
        offsetTop: 0,
      },
    )
    const ours = sceneToStage(point, viewport)
    expect(ours.x).toBeCloseTo(theirs.x)
    expect(ours.y).toBeCloseTo(theirs.y)
  })
})

describe('stageToScene', () => {
  // The gestures turn a pointer's client point into scene units this way, after
  // taking off the stage's offset (#43). Excalidraw's own helper is the contract.
  it.each(cases)('agrees with viewportCoordsToSceneCoords at %o, with an offset', (viewport) => {
    const offsetLeft = 37
    const offsetTop = 64
    const client = { clientX: 410, clientY: 233 }
    const theirs = viewportCoordsToSceneCoords(client, {
      ...viewport,
      zoom: { value: viewport.zoom as NormalizedZoomValue },
      offsetLeft,
      offsetTop,
    })
    const ours = stageToScene(
      { x: client.clientX - offsetLeft, y: client.clientY - offsetTop },
      viewport,
    )
    expect(ours.x).toBeCloseTo(theirs.x)
    expect(ours.y).toBeCloseTo(theirs.y)
  })
})
