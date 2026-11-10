import { describe, expect, it, vi } from 'vitest'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import {
  anchorStylesChanged,
  hasAnchorStyle,
  restoreAnchorStyles,
  type StyleRestoreApi,
} from './anchorStyle.ts'
import { ANCHOR_STYLE, createMathAnchorElements } from './mathAnchor.ts'

const [anchor] = createMathAnchorElements([{ id: 'm1', x: 0, y: 0, width: 100, height: 50 }])
const drawing = { ...anchor, id: 'r1', customData: undefined, strokeColor: '#e03131' } as ExcalidrawElement
const restyled = (changes: Partial<ExcalidrawElement>) => ({ ...anchor, ...changes }) as ExcalidrawElement

function fakeApi(elements: ExcalidrawElement[]) {
  let scene = elements
  const updateScene = vi.fn((data: { elements?: readonly ExcalidrawElement[] }) => {
    if (data.elements) scene = [...data.elements]
  })
  const api = {
    getSceneElementsIncludingDeleted: () => scene,
    updateScene,
  } as unknown as StyleRestoreApi
  return { api, updateScene, element: (id: string) => scene.find((e) => e.id === id)! }
}

describe('the fixed anchor style (docs/spec-v1.md section 4)', () => {
  it('is thin, dashed and grey, with the fill that takes clicks and sharp corners', () => {
    expect(ANCHOR_STYLE).toEqual({
      strokeColor: '#868e96',
      strokeStyle: 'dashed',
      strokeWidth: 1,
      backgroundColor: '#ffffff01',
      fillStyle: 'solid',
      roughness: 0,
      roundness: null,
    })
  })

  it('is what a new anchor is created with', () => {
    expect(hasAnchorStyle(anchor)).toBe(true)
  })

  it.each([
    ['stroke colour', { strokeColor: '#e03131' }],
    ['stroke style', { strokeStyle: 'solid' }],
    ['stroke width', { strokeWidth: 2 }],
    ['background', { backgroundColor: 'transparent' }],
    ['fill', { fillStyle: 'hachure' }],
    ['sloppiness', { roughness: 1 }],
    ['edges', { roundness: { type: 3 } }],
  ] as const)('is lost with another %s', (_, changes) => {
    expect(hasAnchorStyle(restyled(changes as Partial<ExcalidrawElement>))).toBe(false)
  })

  it('doesn’t include opacity', () => {
    expect(hasAnchorStyle(restyled({ opacity: 40 }))).toBe(true)
  })
})

describe('restoreAnchorStyles', () => {
  it('writes the style back in one update with no undo step, and keeps the opacity', () => {
    const changed = restyled({ strokeColor: '#e03131', backgroundColor: 'transparent', opacity: 40 })
    const { api, updateScene, element } = fakeApi([changed, drawing])

    expect(anchorStylesChanged(api)).toBe(true)
    expect(restoreAnchorStyles(api)).toBe(true)

    expect(anchorStylesChanged(api)).toBe(false)
    expect(updateScene).toHaveBeenCalledTimes(1)
    expect(updateScene.mock.calls[0][0]).toMatchObject({ captureUpdate: 'NEVER' })
    expect(hasAnchorStyle(element('m1'))).toBe(true)
    expect(element('m1').opacity).toBe(40)
    // A new nonce, or Excalidraw wouldn't take the change.
    expect(element('m1').versionNonce).not.toBe(changed.versionNonce)
  })

  it('leaves drawings alone', () => {
    const { api, element } = fakeApi([restyled({ strokeWidth: 4 }), drawing])

    restoreAnchorStyles(api)

    expect(element('r1')).toBe(drawing)
  })

  // Called from onChange, so it must settle: the second call finds nothing.
  it('writes nothing when every anchor has the style', () => {
    const { api, updateScene } = fakeApi([anchor, drawing])

    expect(anchorStylesChanged(api)).toBe(false)
    expect(restoreAnchorStyles(api)).toBe(false)
    expect(updateScene).not.toHaveBeenCalled()
  })

  it('leaves a deleted anchor alone', () => {
    const { api, updateScene } = fakeApi([restyled({ strokeWidth: 4, isDeleted: true })])

    expect(restoreAnchorStyles(api)).toBe(false)
    expect(updateScene).not.toHaveBeenCalled()
  })
})
