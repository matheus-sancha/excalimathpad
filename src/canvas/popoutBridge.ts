/**
 * The pop-out bridge (docs/spec-v1.md section 8, Inside an Obsidian tab;
 * section 14, Gestures). In an Obsidian pop-out window the plugin's code runs
 * in the main window, and only the view's DOM is in the pop-out, so the
 * `window` and `document` the unforked Excalidraw 0.18.1 listens on are the
 * main window's. Without the bridge a drag there never ends, a placing click
 * places nothing, `?` opens Help in the main window and paste does nothing
 * (`scripts/popout-run.mjs`, section 17).
 *
 * Every sheet view in a vault is registered, wherever it is; a pop-out gets
 * one bridge, however many sheet tabs it holds:
 *
 * - **Events.** The pointer, touch, `keyup` and clipboard events Excalidraw
 *   hears on the global document or window are copied from the pop-out onto
 *   the main document, after the pop-out's own handlers (its window, bubble
 *   phase), so the order is the one a single window has. A press and a key
 *   keep the original's `target` (Excalidraw tests it with `contains`); a move
 *   and a release go from the main body, since Excalidraw's drag reads on only
 *   for a target that is an `HTMLElement` of the code's own window. Only a
 *   sheet's events go across: a move, a release or
 *   a key over a sheet view, or while a press that began on one is held; a
 *   press anywhere, so a click outside closes a sheet's dropdown. `keydown` is
 *   never copied: the view hears its own keys, and a copy would reach
 *   Obsidian's main-window keymap too.
 * - **Clipboard.** Copy, cut and paste go across only with a sheet's canvas
 *   focused, never from a text field, where the browser's own does the job.
 *   While Excalidraw takes one, the main document's `activeElement` reads the
 *   pop-out's, and for paste its `elementFromPoint` answers from the pop-out (a
 *   canvas there reads as a canvas of the code's own window, which Excalidraw
 *   tests with `instanceof`), and `navigator.clipboard` is the pop-out's, which
 *   has the focus a copy's `writeText` needs.
 * - **Dialogs.** Excalidraw adds each dialog (Help, Reset the canvas's
 *   confirm, an error) to the global `document.body`. A dialog opens from a
 *   press or a key in a sheet, so each sheet view notes, on its own container,
 *   when its window had the last one; a dialog box added while that window is
 *   a pop-out moves into the pop-out's body, and Excalidraw's own removal of
 *   it finds it there.
 *
 * All of it leans on how Excalidraw 0.18.1 listens; the pop-out run in CI
 * (`npm run test:popout`) fails when an upgrade changes that.
 */

/** The events Excalidraw 0.18.1 hears on the global document or window, copied across. */
export const BRIDGED_EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'keyup'] as const

/** Clipboard events, copied across only from a sheet's canvas. */
export const BRIDGED_CLIPBOARD = ['copy', 'cut', 'paste'] as const

/** Excalidraw's class on the box each of its dialogs is drawn in. */
export const DIALOG_BOX_CLASS = 'excalidraw-modal-container'

/** The window the code runs in, with its own constructors. */
type Main = Window & typeof globalThis

/** What one main window keeps for the sheet views of all its windows. */
interface Shared {
  /** The window whose sheet had the last press or key. */
  last: Window | null
  /** Each pop-out's sheet views and the function that takes its bridge down. */
  popouts: Map<Window, { views: Set<HTMLElement>; stop: () => void }>
  /** Takes the dialog watch down; null while no pop-out holds a sheet. */
  stopDialogs: (() => void) | null
}

const shared = new WeakMap<Main, Shared>()

/**
 * Registers a sheet view, `container`, with the main window `main`, the one
 * the code runs in, and bridges it when it is in a pop-out window. Returns the
 * function that stops; a pop-out's bridge goes with its last sheet view.
 */
export function bridgeWindow(container: HTMLElement, main: Main = window): () => void {
  const view = container.ownerDocument.defaultView
  if (!view) return () => {}
  let state = shared.get(main)
  if (!state) {
    state = { last: null, popouts: new Map(), stopDialogs: null }
    shared.set(main, state)
  }
  const own = state
  // On the view's own container: the view adds no listener to a global.
  const touched = () => {
    own.last = view
  }
  container.addEventListener('pointerdown', touched, true)
  container.addEventListener('keydown', touched, true)
  const stopPopout = view === main ? () => {} : joinPopout(own, view, container, main)
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    container.removeEventListener('pointerdown', touched, true)
    container.removeEventListener('keydown', touched, true)
    stopPopout()
  }
}

function joinPopout(state: Shared, view: Window, container: HTMLElement, main: Main): () => void {
  let popout = state.popouts.get(view)
  if (!popout) {
    const views = new Set<HTMLElement>()
    popout = { views, stop: forwardEvents(view, main, views) }
    state.popouts.set(view, popout)
  }
  popout.views.add(container)
  state.stopDialogs ??= watchDialogs(state, main)
  const joined = popout
  return () => {
    joined.views.delete(container)
    if (joined.views.size > 0) return
    joined.stop()
    state.popouts.delete(view)
    if (state.popouts.size > 0) return
    state.stopDialogs?.()
    state.stopDialogs = null
  }
}

/** Copies a pop-out's events onto the main document. Returns the function that stops. */
function forwardEvents(view: Window, main: Main, views: Set<HTMLElement>): () => void {
  const target = main.document
  const inSheet = (node: EventTarget | null) =>
    node === view.document.body || [...views].some((box) => isNode(node) && box.contains(node))
  // Presses that began on a sheet and are still held, by pointer.
  const held = new Set<number>()
  const forward = (event: Event) => {
    if (madeHere.has(event)) return
    const pointer = (event as PointerEvent).pointerId
    const here = inSheet(event.target)
    if (event.type === 'pointerdown') {
      if (here) held.add(pointer)
    } else if (event.type === 'pointerup') {
      const wasHeld = held.delete(pointer)
      if (!here && !wasHeld) return
    } else if (event.type === 'pointermove') {
      if (!here && !held.has(pointer)) return
    } else if (event.type !== 'touchstart' && !here) return
    const copy = copyOf(event, main)
    if (!copy) return
    if (event.type === 'pointermove' || event.type === 'pointerup') {
      // Excalidraw's drag reads on only for a target that is an \`HTMLElement\`
      // of the code's own window, and the release reads none: the main body.
      main.document.body.dispatchEvent(copy)
    } else {
      keepTarget(copy, event)
      target.dispatchEvent(copy)
    }
  }
  const forwardClipboard = (event: Event) => {
    const active = view.document.activeElement
    if (madeHere.has(event) || !inSheet(active) || isTextField(active)) return
    const copy = new main.ClipboardEvent(event.type, {
      bubbles: true,
      cancelable: true,
      clipboardData: (event as ClipboardEvent).clipboardData,
    })
    madeHere.add(copy)
    keepTarget(copy, event)
    const restore = lend(main, view, event.type === 'paste')
    try {
      target.dispatchEvent(copy)
    } finally {
      restore()
    }
    if (copy.defaultPrevented) event.preventDefault()
  }
  const release = (event: Event) => held.delete((event as PointerEvent).pointerId)
  for (const type of BRIDGED_EVENTS) view.addEventListener(type, forward)
  for (const type of BRIDGED_CLIPBOARD) view.addEventListener(type, forwardClipboard)
  view.addEventListener('pointercancel', release)
  return () => {
    for (const type of BRIDGED_EVENTS) view.removeEventListener(type, forward)
    for (const type of BRIDGED_CLIPBOARD) view.removeEventListener(type, forwardClipboard)
    view.removeEventListener('pointercancel', release)
  }
}

/** Copies made here: never copied again. */
const madeHere = new WeakSet<Event>()

/** The same event, made by the main window, so Excalidraw's handlers read it as their own. */
function copyOf(event: Event, main: Main): Event | null {
  const options = { ...initOf(event), bubbles: event.bubbles, cancelable: event.cancelable, composed: event.composed }
  let copy: Event
  if (event.type.startsWith('pointer')) copy = new main.PointerEvent(event.type, options)
  else if (event.type.startsWith('touch')) {
    if (typeof main.TouchEvent !== 'function') return null
    copy = new main.TouchEvent(event.type, options)
  } else copy = new main.KeyboardEvent(event.type, options)
  madeHere.add(copy)
  return copy
}

/** The init members a pointer, touch or key event carries, read off the event. */
function initOf(event: Event) {
  const e = event as Event & PointerEventInit & KeyboardEventInit & Partial<TouchEvent>
  return {
    screenX: e.screenX,
    screenY: e.screenY,
    clientX: e.clientX,
    clientY: e.clientY,
    button: e.button,
    buttons: e.buttons,
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    metaKey: e.metaKey,
    pointerId: e.pointerId,
    width: e.width,
    height: e.height,
    pressure: e.pressure,
    tiltX: e.tiltX,
    tiltY: e.tiltY,
    twist: e.twist,
    pointerType: e.pointerType,
    isPrimary: e.isPrimary,
    key: e.key,
    code: e.code,
    location: e.location,
    repeat: e.repeat,
    // A touch list is the pop-out's: its touches go across as an array.
    ...(e.touches && {
      touches: [...e.touches],
      targetTouches: [...(e.targetTouches ?? [])],
      changedTouches: [...(e.changedTouches ?? [])],
    }),
  }
}

/** The copy reads the original's target: Excalidraw tests it (`contains`, a text field). */
function keepTarget(copy: Event, original: Event) {
  Object.defineProperty(copy, 'target', { configurable: true, value: original.target })
}

/**
 * While Excalidraw takes a clipboard event, the main document answers
 * `activeElement` (and for paste `elementFromPoint`) from the pop-out, and
 * `navigator.clipboard` is the pop-out's: Excalidraw writes a copy with
 * `writeText` while the event runs, which a document without the focus is
 * refused. Returns the function that puts them back.
 */
function lend(mainWindow: Main, viewWindow: Window, paste: boolean): () => void {
  const main = mainWindow.document
  const view = viewWindow.document
  const own = main as unknown as Record<string, unknown>
  Object.defineProperty(main, 'activeElement', { configurable: true, get: () => view.activeElement })
  Object.defineProperty(mainWindow.navigator, 'clipboard', { configurable: true, value: viewWindow.navigator.clipboard })
  if (paste) {
    const canvas = main.createElement('canvas')
    Object.defineProperty(main, 'elementFromPoint', {
      configurable: true,
      value: (x: number, y: number) => {
        const found = view.elementFromPoint(x, y)
        return found?.nodeName === 'CANVAS' ? canvas : found
      },
    })
  }
  return () => {
    delete own.activeElement
    delete (mainWindow.navigator as unknown as Record<string, unknown>).clipboard
    if (paste) delete own.elementFromPoint
  }
}

/** A field the browser pastes into itself, in any window. */
function isTextField(element: Element | null): boolean {
  if (!element) return false
  if ((element as HTMLElement).isContentEditable) return true
  return element.nodeName === 'TEXTAREA' || element.nodeName === 'INPUT' || element.nodeName === 'SELECT'
}

/** A DOM node from any window. */
function isNode(target: EventTarget | null): target is Node {
  return typeof (target as Node | null)?.nodeType === 'number'
}

/**
 * Moves Excalidraw's dialog boxes from the main document's body into the
 * pop-out whose sheet had the last press or key. Excalidraw removes a box with
 * `document.body.removeChild`, so the body's own `removeChild` takes a moved
 * box out wherever it is. Returns the function that stops.
 */
function watchDialogs(state: Shared, main: Main): () => void {
  const body = main.document.body
  const moved = new WeakSet<Node>()
  const take = (node: Node, late = false) => {
    if (node.parentNode !== body || node.nodeType !== 1) return
    if (!(node as Element).classList.contains(DIALOG_BOX_CLASS)) {
      // Excalidraw adds the box, then its classes in the same commit: look once more.
      if (!late && !(node as Element).className) main.setTimeout(() => take(node, true), 0)
      return
    }
    const into = state.last
    if (!into || into === main || !state.popouts.has(into)) return
    moved.add(node)
    into.document.body.appendChild(node)
  }
  const observer = new main.MutationObserver((records) => {
    for (const record of records) record.addedNodes.forEach((node) => take(node))
  })
  observer.observe(body, { childList: true })
  // An own property over the prototype's method, deleted again when the watch stops.
  Object.defineProperty(body, 'removeChild', {
    configurable: true,
    writable: true,
    value: function <T extends Node>(this: HTMLElement, child: T): T {
      if (moved.has(child) && child.parentNode !== this) {
        child.parentNode?.removeChild(child)
        return child
      }
      return main.Node.prototype.removeChild.call(this, child) as T
    },
  })
  return () => {
    observer.disconnect()
    delete (body as unknown as Record<string, unknown>).removeChild
  }
}
