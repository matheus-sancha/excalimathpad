import '@testing-library/jest-dom/vitest'
import 'vitest-canvas-mock'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

// jsdom lacks a few browser APIs that Excalidraw touches on mount.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverStub })
}

// Fonts: Excalidraw registers its font faces on mount. Loading them is the
// browser's job; in tests a no-op FontFace and font set are enough.
if (!('FontFace' in globalThis)) {
  class FontFaceStub {
    family: string
    status = 'loaded'
    constructor(family: string) {
      this.family = family
    }
    load() {
      return Promise.resolve(this)
    }
  }
  Object.defineProperty(globalThis, 'FontFace', { value: FontFaceStub })
}

if (!document.fonts) {
  const fonts = new Set<unknown>()
  Object.defineProperty(document, 'fonts', {
    value: {
      add: (face: unknown) => fonts.add(face),
      delete: (face: unknown) => fonts.delete(face),
      has: (face: unknown) => fonts.has(face),
      check: () => true,
      load: () => Promise.resolve([]),
      ready: Promise.resolve(),
      forEach: (cb: (face: unknown) => void) => fonts.forEach(cb),
      [Symbol.iterator]: () => fonts.values(),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  })
}
