import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'

export interface SheetCanvasProps {
  /**
   * Called once Excalidraw has mounted, with its imperative API (scene,
   * app state, scroll/zoom subscriptions). This is how modules outside the
   * canvas, such as the math overlay, read the canvas without forking it.
   */
  onApiReady?: (api: ExcalidrawImperativeAPI) => void
}

/**
 * The drawing surface: the official, unforked Excalidraw component.
 * This is the only module that imports `@excalidraw/excalidraw` (ADR 0001).
 */
export function SheetCanvas({ onApiReady }: SheetCanvasProps) {
  return <Excalidraw excalidrawAPI={onApiReady} />
}
