import { describe, expect, it, vi } from 'vitest'
import { scrollClearAbove } from './selection.ts'

/** Just what `scrollClearAbove` reads and writes of Excalidraw's API. */
function fakeApi(scrollY = 0, zoom = 1) {
  return {
    getAppState: () => ({ scrollY, zoom: { value: zoom } }) as never,
    updateScene: vi.fn(),
  }
}

describe('scrollClearAbove (docs/spec-v1.md section 8, On a phone, M4d)', () => {
  it('leaves a line that is wholly above the bottom sheet where it is', () => {
    const api = fakeApi()

    expect(scrollClearAbove(api, { top: 100, bottom: 124 }, 500)).toBe(false)
    expect(api.updateScene).not.toHaveBeenCalled()
  })

  it('moves a line under the sheet to the middle of the strip above it, with no undo step', () => {
    const api = fakeApi(-40)

    expect(scrollClearAbove(api, { top: 600, bottom: 624 }, 500)).toBe(true)
    // Its middle (612) goes to the strip's middle (250): 362 px up, in scene units.
    expect(api.updateScene).toHaveBeenCalledWith(
      expect.objectContaining({ appState: { scrollY: -40 - 362 }, captureUpdate: 'NEVER' }),
    )
  })

  it('scrolls in scene units at a zoom, and brings back a line above the view', () => {
    const api = fakeApi(0, 2)

    expect(scrollClearAbove(api, { top: -30, bottom: -6 }, 400)).toBe(true)
    expect(api.updateScene).toHaveBeenCalledWith(expect.objectContaining({ appState: { scrollY: (200 + 18) / 2 } }))
  })

  it('does nothing while the sheet leaves no room', () => {
    const api = fakeApi()

    expect(scrollClearAbove(api, { top: 600, bottom: 624 }, 0)).toBe(false)
  })
})
