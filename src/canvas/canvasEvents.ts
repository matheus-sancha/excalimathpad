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
 * Keys are heard on `keys`, the page's document by default, but only those
 * aimed at the canvas: their target is inside `root`, or is the page's body.
 * The app's own dialogs and panels keep their keys. In a vault view (M4d,
 * section 12a) `keys` is the view's own container, so nothing listens on the
 * global document and each tab hears only its own keys.
 *
 * The Sheet panel is drawn inside `root`, in Excalidraw's sidebar, but a
 * press, click, double-click or key there isn't the canvas's (M4d, section
 * 14, Panel controls that act on the open line): the gestures never hear it,
 * so a press in the panel doesn't leave the open line (`panelPresses.ts`).
 */
import { isInSheetPanel } from './panelPresses.ts'

export interface CanvasEventHandlers {
  /** Returns true when the app took it: it is then stopped before Excalidraw. */
  doubleClick: (event: MouseEvent) => boolean
  /** Every press, before Excalidraw's. Never stopped. */
  pointerDown: (event: PointerEvent) => void
  /** Every click, after Excalidraw has handled its press and release. Never stopped. */
  click: (event: MouseEvent) => void
  /** Every pointer move over the canvas, for the hovers: unit slots and problem tips. Never stopped. */
  pointerMove?: (event: PointerEvent) => void
  /** The pointer left the canvas (onto the overlay's field, or off the page). Never stopped. */
  pointerLeave?: (event: PointerEvent) => void
  /** Returns true when the app took it: it is then stopped before Excalidraw. */
  keyDown: (event: KeyboardEvent) => boolean
}

/** Starts listening; returns the function that stops. */
export function listenToCanvas(
  root: HTMLElement,
  handlers: CanvasEventHandlers,
  keys: EventTarget = root.ownerDocument,
): () => void {
  const take = (event: Event) => {
    event.stopPropagation()
    event.preventDefault()
  }
  const onDoubleClick = (event: MouseEvent) => {
    if (!isInSheetPanel(event.target) && handlers.doubleClick(event)) take(event)
  }
  const onPointerDown = (event: PointerEvent) => {
    if (!isInSheetPanel(event.target)) handlers.pointerDown(event)
  }
  const onClick = (event: MouseEvent) => {
    if (!isInSheetPanel(event.target)) handlers.click(event)
  }
  const onPointerMove = (event: PointerEvent) => handlers.pointerMove?.(event)
  // Not in capture: each child's own leave would reach it there too.
  const onPointerLeave = (event: PointerEvent) => handlers.pointerLeave?.(event)
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target
    const onCanvas =
      target === root.ownerDocument.body || (isNode(target) && root.contains(target) && !isInSheetPanel(target))
    if (onCanvas && handlers.keyDown(event)) take(event)
  }

  root.addEventListener('dblclick', onDoubleClick, true)
  root.addEventListener('pointerdown', onPointerDown, true)
  root.addEventListener('click', onClick, true)
  root.addEventListener('pointermove', onPointerMove, true)
  root.addEventListener('pointerleave', onPointerLeave)
  keys.addEventListener('keydown', onKeyDown as EventListener, true)
  return () => {
    root.removeEventListener('pointermove', onPointerMove, true)
    root.removeEventListener('pointerleave', onPointerLeave)
    root.removeEventListener('dblclick', onDoubleClick, true)
    root.removeEventListener('pointerdown', onPointerDown, true)
    root.removeEventListener('click', onClick, true)
    keys.removeEventListener('keydown', onKeyDown as EventListener, true)
  }
}

/**
 * Whether an event's target is Excalidraw's canvas, in any window: a pop-out
 * window has its own `HTMLCanvasElement`, so `instanceof` would miss it there
 * (section 12a).
 */
export function isCanvasElement(target: EventTarget | null): target is HTMLCanvasElement {
  return isNode(target) && target.nodeName === 'CANVAS'
}

/** A DOM node from any window: a pop-out window has its own `Node` (section 12a). */
function isNode(target: EventTarget | null): target is Node {
  return typeof (target as Node | null)?.nodeType === 'number'
}
