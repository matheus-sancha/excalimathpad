import { act, fireEvent } from '@testing-library/react'

/**
 * jsdom has no layout, so every `offsetTop` and `offsetHeight` is 0. Rows
 * (`[data-line]`) get the layout `MathOverlay.css` gives them: 12 px of padding
 * above the first, then one 24 px line each. Installed once, in `setup.ts`.
 * Real geometry is checked by hand in Chromium (docs/spec-v1.md section 17).
 */
export const ROW_TOP = 12
export const ROW_HEIGHT = 24

export function installRowLayout() {
  const proto = HTMLElement.prototype
  const original = {
    top: Object.getOwnPropertyDescriptor(proto, 'offsetTop')!,
    height: Object.getOwnPropertyDescriptor(proto, 'offsetHeight')!,
  }
  const line = (element: HTMLElement) => {
    const value = element.dataset.line
    return value === undefined ? null : Number(value)
  }
  Object.defineProperty(proto, 'offsetTop', {
    configurable: true,
    get(this: HTMLElement) {
      const i = line(this)
      return i === null ? original.top.get!.call(this) : ROW_TOP + ROW_HEIGHT * i
    },
  })
  Object.defineProperty(proto, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return line(this) === null ? original.height.get!.call(this) : ROW_HEIGHT
    },
  })
}

export interface ClientPoint {
  clientX: number
  clientY: number
}

/**
 * The client point over line `n` (1-based) of an upright math element, `left`
 * scene units in from its edge. Read from where the overlay placed the element,
 * so it follows pan and zoom. jsdom puts the stage at the page's origin.
 */
export function linePoint(anchorId: string, n: number, left = 20): ClientPoint {
  const element = document.querySelector<HTMLElement>(`[data-anchor-id="${anchorId}"]`)
  const match = /translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([-\d.e]+)\)/.exec(
    element?.style.transform ?? '',
  )
  if (!match) throw new Error(`No math element ${anchorId} on the stage`)
  const [x, y, zoom] = match.slice(1).map(Number)
  return {
    clientX: x + left * zoom,
    clientY: y + (ROW_TOP + ROW_HEIGHT * (n - 1) + ROW_HEIGHT / 2) * zoom,
  }
}

/** Excalidraw's interactive canvas: where real pointer input lands. */
export const interactiveCanvas = () =>
  document.querySelector<HTMLCanvasElement>('canvas.interactive')!

const pointer = (point: ClientPoint) => ({
  ...point,
  button: 0,
  buttons: 1,
  pointerId: 1,
  pointerType: 'mouse',
  isPrimary: true,
})

/**
 * A press and release without moving, then the click the browser sends. Each
 * is its own task in a browser, so React commits between them: each gets its
 * own `act`.
 */
export function clickOnCanvas(point: ClientPoint) {
  const canvas = interactiveCanvas()
  act(() => {
    fireEvent.pointerDown(canvas, pointer(point))
  })
  act(() => {
    fireEvent.pointerUp(canvas, pointer(point))
  })
  act(() => {
    fireEvent.click(canvas, point)
  })
}

/** Two clicks and the double-click, as a person's double-click arrives. */
export function doubleClickOnCanvas(point: ClientPoint) {
  clickOnCanvas(point)
  clickOnCanvas(point)
  act(() => {
    fireEvent.doubleClick(interactiveCanvas(), point)
  })
}

/** Double-clicks line `n` (1-based) of a math element on the real Excalidraw. */
export function doubleClickLine(anchorId: string, n: number) {
  doubleClickOnCanvas(linePoint(anchorId, n))
}

/**
 * A drag on the real Excalidraw. Each move targets the canvas (Excalidraw drops
 * moves whose target isn't an element), with a short wait between them.
 */
export async function dragOnCanvas(from: ClientPoint, to: ClientPoint) {
  const canvas = interactiveCanvas()
  const steps = 3
  await act(async () => {
    fireEvent.pointerDown(canvas, pointer(from))
  })
  for (let i = 1; i <= steps; i++) {
    const at = {
      clientX: from.clientX + ((to.clientX - from.clientX) * i) / steps,
      clientY: from.clientY + ((to.clientY - from.clientY) * i) / steps,
    }
    await act(async () => {
      fireEvent.pointerMove(canvas, pointer(at))
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
  }
  await act(async () => {
    fireEvent.pointerUp(canvas, pointer(to))
    fireEvent.click(canvas, to)
  })
}
