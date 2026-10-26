import { useCallback, useRef } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'

/**
 * Re-dispatches a wheel event that landed on something outside Excalidraw
 * (an overlay control) onto Excalidraw's canvas, so scroll/pinch over math
 * still pans and zooms. Excalidraw listens for `wheel` on its own container
 * and only acts on canvas/textarea targets inside it.
 */
export type ForwardWheel = (event: WheelEvent) => void

/** What modules outside the canvas (the math overlay) get to work with. */
export interface SheetCanvasHandle {
  /** Excalidraw's public imperative API: scene, app state, subscriptions. */
  api: ExcalidrawImperativeAPI
  forwardWheel: ForwardWheel
}

export interface SheetCanvasProps {
  /** Called once Excalidraw has mounted. */
  onReady?: (handle: SheetCanvasHandle) => void
  /** Scene to start with. */
  initialElements?: readonly ExcalidrawElement[]
}

/**
 * The drawing surface: the official, unforked Excalidraw component.
 * This is the only module (with `mathAnchor.ts`) that imports
 * `@excalidraw/excalidraw` at runtime (ADR 0001).
 */
export function SheetCanvas({ onReady, initialElements }: SheetCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const forwardWheel = useCallback((event: WheelEvent) => {
    const canvas = containerRef.current?.querySelector('canvas')
    if (!canvas) return
    // Stop the browser acting on it too (ctrl+wheel would zoom the page).
    event.preventDefault()
    canvas.dispatchEvent(new WheelEvent(event.type, event))
  }, [])

  const handleApi = useCallback(
    (api: ExcalidrawImperativeAPI) => onReady?.({ api, forwardWheel }),
    [onReady, forwardWheel],
  )

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <Excalidraw
        excalidrawAPI={handleApi}
        initialData={initialElements ? { elements: initialElements } : null}
      />
    </div>
  )
}
