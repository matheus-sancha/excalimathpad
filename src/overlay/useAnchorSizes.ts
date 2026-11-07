import { useEffect, useLayoutEffect, useRef } from 'react'
import type { AppState } from '@excalidraw/excalidraw/types'
import {
  fitsContent,
  snapBackResizes,
  writeAnchorSizes,
  type ContentSize,
} from '../canvas/anchorSize.ts'
import type { MathAnchor } from '../canvas/mathAnchor.ts'
import type { SceneApi } from './MathOverlay.tsx'

export interface AnchorSizes {
  api: SceneApi
  /** The overlay's root, which holds every element's body. */
  overlay: () => HTMLElement | null
  /** Live anchors, as the overlay last read them. */
  anchors: () => readonly MathAnchor[]
  /** Runs a size write; the sheet keeps its clean mark through it (`SheetSession.keepClean`). */
  keepClean: (write: () => void) => void
}

/**
 * Keeps every anchor the size of its content (docs/spec-v1.md section 4, Size):
 * after each render, whenever a body's size changes (fonts arriving, KaTeX
 * loading), and when a resize handle is let go. A body is measured with
 * `offsetWidth` and `offsetHeight`, which ignore transforms, so they are scene
 * units at any zoom and rotation.
 *
 * Writes wait while Excalidraw is busy with the pointer or its own editors (a
 * drag, a resize or rotation, a shape being drawn, its text or line editor):
 * the content can't change then, and a write would fight the gesture. They go
 * in at its next change once it is idle.
 */
export function useAnchorSizes(sizes: AnchorSizes) {
  const latest = useRef(sizes)
  useLayoutEffect(() => {
    latest.current = sizes
  })
  const measure = useRef<() => void>(() => {})
  const { api } = sizes

  useEffect(() => {
    let waiting = false
    const observer = new ResizeObserver(() => measure.current())
    const observed = new Set<Element>()

    measure.current = () => {
      const { overlay, anchors, keepClean } = latest.current
      const root = overlay()
      if (!root) return
      const fits = new Map<string, ContentSize>()
      for (const body of root.querySelectorAll<HTMLElement>('.math-element__body')) {
        if (!observed.has(body)) {
          observed.add(body)
          // The border box: the size the anchor takes.
          observer.observe(body, { box: 'border-box' })
        }
        const id = body.closest<HTMLElement>('[data-anchor-id]')?.dataset.anchorId
        const size = { width: body.offsetWidth, height: body.offsetHeight }
        // Not laid out (jsdom, or not in the page): nothing to fit.
        if (id === undefined || (size.width === 0 && size.height === 0)) continue
        const anchor = anchors().find((candidate) => candidate.id === id)
        if (anchor && !fitsContent(anchor, size)) fits.set(id, size)
      }
      for (const body of observed) {
        if (!body.isConnected) {
          observer.unobserve(body)
          observed.delete(body)
        }
      }
      waiting = fits.size > 0 && isBusy(api.getAppState())
      if (fits.size > 0 && !waiting) keepClean(() => writeAnchorSizes(api, fits))
    }

    const offChange = api.onChange(() => {
      if (waiting) measure.current()
    })
    const offPointerUp = snapBackResizes(api, (write) => latest.current.keepClean(write))
    return () => {
      offChange()
      offPointerUp()
      observer.disconnect()
      measure.current = () => {}
    }
  }, [api])

  // After every render: the content may have changed size.
  useEffect(() => measure.current())
}

/** Excalidraw is in the middle of a pointer gesture or one of its own editors. */
export function isBusy(app: AppState): boolean {
  return Boolean(
    app.selectedElementsAreBeingDragged ||
      app.isResizing ||
      app.isRotating ||
      app.newElement ||
      app.multiElement ||
      app.editingTextElement ||
      app.editingLinearElement,
  )
}
