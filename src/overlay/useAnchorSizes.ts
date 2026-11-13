import { useEffect, useLayoutEffect, useRef } from 'react'
import {
  fitsContent,
  settleResizes,
  sizeWritesWait,
  writeAnchorSizes,
  type ContentSize,
} from '../canvas/anchorSize.ts'
import { anchorStylesChanged, restoreAnchorStyles } from '../canvas/anchorStyle.ts'
import type { MathAnchor } from '../canvas/mathAnchor.ts'
import type { SceneApi } from './MathOverlay.tsx'

export interface AnchorSizes {
  api: SceneApi
  /** The overlay's root, which holds every element's body. */
  overlay: () => HTMLElement | null
  /** Live anchors, as the overlay last read them. */
  anchors: () => readonly MathAnchor[]
  /** Runs a size or style write; the sheet keeps its clean mark through it (`SheetSession.keepClean`). */
  keepClean: (write: () => void) => void
}

/** An element holding only comments has a floor of about this (section 4, Chosen width). */
const COMMENTS_ONLY_FLOOR = 120

/**
 * An element's floor (section 4, Chosen width): the width its math lines need,
 * with comments asking for nothing. Measured by laying the body out at no
 * width for a moment, as a chosen width does; 0 when it isn't laid out (jsdom).
 */
export function floorOf(root: HTMLElement | null, id: string): number {
  const body = [...(root?.querySelectorAll<HTMLElement>('.math-element__body') ?? [])].find(
    (candidate) => candidate.closest<HTMLElement>('[data-anchor-id]')?.dataset.anchorId === id,
  )
  if (!body) return 0
  const { width, minWidth } = body.style
  const had = body.classList.contains('has-chosen-width')
  body.classList.add('has-chosen-width')
  body.style.width = '0px'
  body.style.minWidth = 'max-content'
  const floor = body.offsetWidth
  body.style.width = width
  body.style.minWidth = minWidth
  if (!had) body.classList.remove('has-chosen-width')
  if (floor === 0) return 0
  return body.querySelector('.math-element__row:not(.is-comment):not(.is-blank)') ? floor : Math.max(floor, COMMENTS_ONLY_FLOOR)
}

/**
 * Keeps every anchor the size of its content (docs/spec-v1.md section 4, Size),
 * and in the fixed style (`restoreAnchorStyles`):
 * after each render, whenever a body's size changes (fonts arriving, KaTeX
 * loading), and when a resize handle is let go. A body is measured with
 * `offsetWidth` and `offsetHeight`, which ignore transforms, so they are scene
 * units at any zoom and rotation.
 *
 * Writes wait while Excalidraw is mid-gesture or in one of its own editors
 * (`sizeWritesWait`): the content can't change then, and a write would fight
 * the gesture. They go in at its next change once it is idle.
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
      waiting = fits.size > 0 && sizeWritesWait(api.getAppState())
      if (fits.size > 0 && !waiting) keepClean(() => writeAnchorSizes(api, fits))
    }

    // The fixed style, written back at the change that broke it (section 4,
    // Selected math element). An opened file is restored the same way.
    const restoreStyles = () => {
      if (anchorStylesChanged(api)) latest.current.keepClean(() => restoreAnchorStyles(api))
    }
    restoreStyles()
    const offChange = api.onChange(() => {
      restoreStyles()
      if (waiting) measure.current()
    })
    const offPointerUp = settleResizes(api, (write) => latest.current.keepClean(write), (id) =>
      floorOf(latest.current.overlay(), id),
    )
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
