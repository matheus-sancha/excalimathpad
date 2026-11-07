import { act } from '@testing-library/react'

/**
 * jsdom has no layout: every box measures 0 × 0, and a math element's body that
 * measures 0 × 0 is never sized (`useAnchorSizes`). These give bodies a size,
 * and fire the `ResizeObserver`s the way the browser does when fonts load.
 */

const observers = new Set<ResizeObserverStub>()

export class ResizeObserverStub {
  private readonly targets = new Set<Element>()
  private readonly callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  observe(target: Element) {
    this.targets.add(target)
    observers.add(this)
  }
  unobserve(target: Element) {
    this.targets.delete(target)
  }
  disconnect() {
    this.targets.clear()
    observers.delete(this)
  }
  fire() {
    const entries = [...this.targets].map((target) => ({ target }) as ResizeObserverEntry)
    if (entries.length > 0) this.callback(entries, this as unknown as ResizeObserver)
  }
}

/** Fires every live observer, as a font arriving would. */
export function fireResizeObservers() {
  act(() => observers.forEach((observer) => observer.fire()))
}

/**
 * Gives every math element's body (`.math-element__body`) the size `sizeOf`
 * returns for its element, until the returned function restores jsdom's 0 × 0.
 */
export function layOutBodies(sizeOf: (anchorId: string) => { width: number; height: number }) {
  const proto = HTMLElement.prototype
  const original = {
    width: Object.getOwnPropertyDescriptor(proto, 'offsetWidth')!,
    height: Object.getOwnPropertyDescriptor(proto, 'offsetHeight')!,
  }
  const sizeFor = (element: HTMLElement) => {
    if (!element.classList.contains('math-element__body')) return null
    const anchorId = element.closest<HTMLElement>('[data-anchor-id]')?.dataset.anchorId
    return anchorId === undefined ? null : sizeOf(anchorId)
  }
  Object.defineProperty(proto, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return sizeFor(this)?.width ?? original.width.get!.call(this)
    },
  })
  Object.defineProperty(proto, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return sizeFor(this)?.height ?? original.height.get!.call(this)
    },
  })
  return () => {
    Object.defineProperty(proto, 'offsetWidth', original.width)
    Object.defineProperty(proto, 'offsetHeight', original.height)
  }
}
