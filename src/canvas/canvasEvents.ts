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
 *
 * **Touch** (M4d, section 4, Touch; verified in section 17):
 *
 * - Excalidraw doesn't turn two taps into a `dblclick`. A native `touchstart`
 *   listener on its interactive canvas runs its own double tap: a second
 *   one-finger touch within `TAP_TWICE_MS` of the first calls its double-click
 *   handler directly (on a selected math anchor, a text label). The browser's
 *   own `dblclick` comes after, if at all. So a capture `touchstart` here
 *   follows the same rule and offers the second tap as a double-click; one the
 *   app takes is stopped before Excalidraw's listener, and the browser's mouse
 *   events and `dblclick` for it are cancelled. Excalidraw never saw it, so its
 *   own count still stands, and this one's does too.
 * - On iOS Excalidraw cancels every `touchstart` on its canvas, so the browser
 *   sends no `click` after a tap. A touch's click is therefore its `pointerup`,
 *   handed over a task later, once Excalidraw has handled the release, as the
 *   browser's click would be; the browser's own click after a touch is ignored.
 */
import { isInSheetPanel } from './panelPresses.ts'

export interface CanvasEventHandlers {
  /**
   * A double-click, or a double tap's second touch (section 4, Touch). Returns
   * true when the app took it: it is then stopped before Excalidraw.
   */
  doubleClick: (event: PointAt) => boolean
  /** Every press, before Excalidraw's. Never stopped. */
  pointerDown: (event: PointerEvent) => void
  /**
   * Every click, after Excalidraw has handled its press and release: a tap's
   * is its `pointerup`, a task later (section 4, Touch). Never stopped.
   */
  click: (event: MouseEvent | PointerEvent) => void
  /** Every press under `root`, the Sheet panel's included: a tap tip closes on the next tap. Never stopped. */
  anyPress?: (event: PointerEvent) => void
  /** Every pointer move over the canvas, for the hovers: unit slots and problem tips. Never stopped. */
  pointerMove?: (event: PointerEvent) => void
  /** The pointer left the canvas (onto the overlay's field, or off the page). Never stopped. */
  pointerLeave?: (event: PointerEvent) => void
  /** Returns true when the app took it: it is then stopped before Excalidraw. */
  keyDown: (event: KeyboardEvent) => boolean
}

/** Where a double-click or a double tap landed, and on what. */
export interface PointAt {
  clientX: number
  clientY: number
  target: EventTarget | null
}

/** Excalidraw 0.18.1's `TAP_TWICE_TIMEOUT`: the second touch of a double tap comes within it. */
export const TAP_TWICE_MS = 300

/** A browser click this soon after a touch's `pointerup` is that tap's, already handed over. */
const TAP_CLICK_MS = 1000

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
    handlers.anyPress?.(event)
    if (!isInSheetPanel(event.target)) handlers.pointerDown(event)
  }
  const view = root.ownerDocument.defaultView ?? window
  // A touch's click is its release, a task later; the browser's own click after it is skipped.
  let tappedAt = -Infinity
  // The release of a second tap the app took as a double tap is no click.
  let tookTap = false
  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return
    tappedAt = event.timeStamp
    if (tookTap) {
      tookTap = false
      return
    }
    if (isInSheetPanel(event.target)) return
    view.setTimeout(() => handlers.click(event), 0)
  }
  const onClick = (event: MouseEvent) => {
    // A click that says what made it is trusted; one that doesn't (older WebKit) goes by the time.
    const kind = (event as PointerEvent).pointerType
    const touch = kind ? kind === 'touch' : event.timeStamp - tappedAt < TAP_CLICK_MS
    if (!touch && !isInSheetPanel(event.target)) handlers.click(event)
  }
  // Excalidraw's double tap, followed: armed by a touch on the canvas, for `TAP_TWICE_MS`.
  let armed = false
  let disarm = 0
  const onTouchStart = (event: TouchEvent) => {
    if (!isCanvasElement(event.target)) return
    if (!armed) {
      armed = true
      view.clearTimeout(disarm)
      disarm = view.setTimeout(() => (armed = false), TAP_TWICE_MS)
      return
    }
    if (event.touches.length !== 1) return
    const { clientX, clientY } = event.touches[0]
    if (handlers.doubleClick({ clientX, clientY, target: event.target })) {
      tookTap = true
      take(event)
      return
    }
    // Excalidraw's own double tap runs, and its count starts again.
    armed = false
    view.clearTimeout(disarm)
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
  root.addEventListener('pointerup', onPointerUp, true)
  root.addEventListener('click', onClick, true)
  // Not passive: a double tap the app takes cancels the browser's mouse events and `dblclick`.
  root.addEventListener('touchstart', onTouchStart, { capture: true, passive: false })
  root.addEventListener('pointermove', onPointerMove, true)
  root.addEventListener('pointerleave', onPointerLeave)
  keys.addEventListener('keydown', onKeyDown as EventListener, true)
  return () => {
    view.clearTimeout(disarm)
    root.removeEventListener('touchstart', onTouchStart, true)
    root.removeEventListener('pointerup', onPointerUp, true)
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
