/**
 * The canvas's input, handed to the app before Excalidraw hears it, for the
 * math gestures (docs/spec-v1.md section 4). This relies on behaviour that
 * isn't public API, so it lives here with its contract tests
 * (`canvasEvents.excalidraw.test.tsx`), per ADR 0001:
 *
 * - Excalidraw handles `dblclick` (its `onDoubleClick`) and `keydown` (its
 *   `onKeyDown`, without `handleKeyboardGlobally`) as React props, in the bubble
 *   phase at the React root. A capture listener runs first, and stopping the
 *   event there keeps it from Excalidraw: no text editor, no label.
 * - Its pointer handling still runs after a capture `pointerdown`, so a change
 *   written there is in the scene before Excalidraw starts a drag.
 *
 * Pointer events are heard on `root`, the box Excalidraw fills. The overlay is
 * its sibling, so the overlay's own controls (the line field) never reach them.
 * Keys are heard on `document`, but only those aimed at the canvas: their
 * target is inside `root`, or is the page's body. The app's own dialogs and
 * panels keep their keys.
 */
export interface CanvasEventHandlers {
  /** Returns true when the app took it: it is then stopped before Excalidraw. */
  doubleClick: (event: MouseEvent) => boolean
  /** Every press, before Excalidraw's. Never stopped. */
  pointerDown: (event: PointerEvent) => void
  /** Every click, after Excalidraw has handled its press and release. Never stopped. */
  click: (event: MouseEvent) => void
  /** Returns true when the app took it: it is then stopped before Excalidraw. */
  keyDown: (event: KeyboardEvent) => boolean
}

/** Starts listening; returns the function that stops. */
export function listenToCanvas(root: HTMLElement, handlers: CanvasEventHandlers): () => void {
  const take = (event: Event) => {
    event.stopPropagation()
    event.preventDefault()
  }
  const onDoubleClick = (event: MouseEvent) => {
    if (handlers.doubleClick(event)) take(event)
  }
  const onPointerDown = (event: PointerEvent) => handlers.pointerDown(event)
  const onClick = (event: MouseEvent) => handlers.click(event)
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target
    const onCanvas =
      target === document.body || (target instanceof Node && root.contains(target))
    if (onCanvas && handlers.keyDown(event)) take(event)
  }

  root.addEventListener('dblclick', onDoubleClick, true)
  root.addEventListener('pointerdown', onPointerDown, true)
  root.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown, true)
  return () => {
    root.removeEventListener('dblclick', onDoubleClick, true)
    root.removeEventListener('pointerdown', onPointerDown, true)
    root.removeEventListener('click', onClick, true)
    document.removeEventListener('keydown', onKeyDown, true)
  }
}
