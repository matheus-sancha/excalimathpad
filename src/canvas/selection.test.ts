import { CaptureUpdateAction } from '@excalidraw/excalidraw'
import { describe, expect, it, vi } from 'vitest'
import { scrollIntoArea, visibleArea } from './selection.ts'
import { SHEET_SIDEBAR_CLASS } from './panelPresses.ts'

/** Just what `scrollIntoArea` reads and writes of Excalidraw's API. */
function fakeApi(scrollX = 0, scrollY = 0, zoom = 1) {
  return {
    getAppState: () => ({ scrollX, scrollY, zoom: { value: zoom } }) as never,
    updateScene: vi.fn(),
  }
}

const AREA = { left: 0, top: 0, right: 1000, bottom: 700 }

describe('scrollIntoArea (docs/spec-v1.md section 4, While editing a line: the view follows the caret, 0.2.1)', () => {
  it('moves nothing when the row is wholly inside the area less the 48 px margin', () => {
    const api = fakeApi()

    expect(scrollIntoArea(api, { left: 48, top: 48, right: 952, bottom: 652 }, AREA)).toBe(false)
    expect(api.updateScene).not.toHaveBeenCalled()
  })

  it('scrolls a row below the area up by the least distance, with no undo step and no zoom', () => {
    const api = fakeApi(10, 20)

    expect(scrollIntoArea(api, { left: 100, top: 1185, right: 300, bottom: 1209 }, AREA)).toBe(true)
    // The row's bottom lands 48 px above the area's: 1209 → 652.
    expect(api.updateScene).toHaveBeenCalledWith({
      appState: { scrollX: 10, scrollY: 20 - 557 },
      captureUpdate: CaptureUpdateAction.NEVER,
    })
  })

  it('scrolls a row above or left of the area down and right, to the margin', () => {
    const api = fakeApi()

    scrollIntoArea(api, { left: -30, top: -60, right: 170, bottom: -36 }, AREA)

    expect(api.updateScene.mock.calls[0][0].appState).toEqual({ scrollX: 78, scrollY: 108 })
  })

  it('scrolls a row past the right edge sideways only', () => {
    const api = fakeApi()

    scrollIntoArea(api, { left: 1400, top: 300, right: 1400, bottom: 324 }, AREA)

    expect(api.updateScene.mock.calls[0][0].appState).toEqual({ scrollX: -448, scrollY: 0 })
  })

  it('scrolls by scene units: a distance on screen divided by the zoom', () => {
    const api = fakeApi(0, 0, 2)

    scrollIntoArea(api, { left: 100, top: 752, right: 300, bottom: 800 }, AREA)

    expect(api.updateScene.mock.calls[0][0].appState.scrollY).toBe(-74)
  })

  it('centres a row the area has no room for with both margins, and then leaves it', () => {
    const area = { left: 0, top: 0, right: 1000, bottom: 100 }
    const api = fakeApi()

    scrollIntoArea(api, { left: 100, top: 60, right: 300, bottom: 84 }, area)

    expect(api.updateScene.mock.calls[0][0].appState.scrollY).toBe(-22)
    expect(scrollIntoArea(fakeApi(), { left: 100, top: 38, right: 300, bottom: 62 }, area)).toBe(false)
  })

  it('moves nothing when there is no area', () => {
    const api = fakeApi()

    expect(scrollIntoArea(api, { left: 0, top: 900, right: 10, bottom: 924 }, { left: 0, top: 0, right: 0, bottom: 0 })).toBe(false)
  })
})

describe('visibleArea (section 4, While editing a line: the canvas less the panel, the bottom sheet and the keyboard)', () => {
  const rect = (left: number, top: number, right: number, bottom: number) =>
    ({ left, top, right, bottom, width: right - left, height: bottom - top }) as DOMRect

  /** A canvas root of the given box, with a Sheet panel of `panel` inside it. */
  function rootWith(box: DOMRect, panel: DOMRect | null) {
    const root = document.createElement('div')
    root.getBoundingClientRect = () => box
    Object.defineProperty(root, 'clientWidth', { value: box.width })
    if (panel) {
      const sidebar = document.createElement('div')
      sidebar.className = SHEET_SIDEBAR_CLASS
      sidebar.getBoundingClientRect = () => panel
      root.append(sidebar)
    }
    document.body.append(root)
    return root
  }

  it('is the canvas when no panel shows', () => {
    expect(visibleArea(rootWith(rect(10, 20, 1010, 720), null), false)).toEqual({ left: 10, top: 20, right: 1010, bottom: 720 })
  })

  it('ends at a floating panel’s left edge', () => {
    expect(visibleArea(rootWith(rect(0, 0, 1000, 700), rect(640, 60, 1000, 700)), false).right).toBe(640)
  })

  it('ends at a docked panel’s left edge too, since Excalidraw draws it over the canvas', () => {
    expect(visibleArea(rootWith(rect(0, 0, 1400, 700), rect(1040, 0, 1400, 700)), false).right).toBe(1040)
  })

  it('keeps the canvas’s width when the panel is beside it', () => {
    expect(visibleArea(rootWith(rect(0, 0, 1000, 700), rect(1000, 0, 1360, 700)), false).right).toBe(1000)
  })

  it('ends at the bottom sheet’s top on a phone', () => {
    expect(visibleArea(rootWith(rect(0, 0, 390, 844), rect(0, 500, 390, 844)), true)).toEqual({ left: 0, top: 0, right: 390, bottom: 500 })
  })

  it('ends where the visual viewport does, above the on-screen keyboard', () => {
    const root = rootWith(rect(0, 0, 820, 1180), null)
    vi.stubGlobal('visualViewport', { offsetTop: 0, height: 760 })

    expect(visibleArea(root, false).bottom).toBe(760)
    vi.unstubAllGlobals()
  })
})
