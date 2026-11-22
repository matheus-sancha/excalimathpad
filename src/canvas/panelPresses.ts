/**
 * A press in the Sheet panel never leaves the open line (docs/spec-v1.md
 * section 8, Sheet panel; section 14, Panel controls that act on the open
 * line; option B of `docs/research/panel-acts-on-open-line.md`).
 *
 * The panel is drawn in Excalidraw's sidebar, inside the box the gestures
 * listen on, so two things keep a press there from leaving the line:
 *
 * - `listenToCanvas` doesn't hand a press, click or double-click from the
 *   panel to the gestures (`isInSheetPanel`): to them it isn't a canvas press.
 * - `keepPanelPresses` prevents the `mousedown` of every press in the panel
 *   that doesn't land on a field, so focus stays in the line field. It listens
 *   in the bubble phase above React's root, after React has dispatched the
 *   event: Radix's tab trigger switches tabs from its own `onMouseDown`, which
 *   it skips when the event is already default-prevented, so a capture
 *   listener, or one on the sidebar itself, would stop the tabs switching
 *   (`panelPresses.excalidraw.test.tsx` holds that contract). On the web that
 *   is the page's document; in a vault, the view's container, which holds
 *   React's root, since the plugin adds no listener to the global document
 *   (section 12a).
 *
 * A field in the panel (a filter) takes focus as usual, so its press leaves
 * the line: that blur is the line commit. A rule's condition field is the one
 * exception (section 4, Rules list, M4e): it carries `LINE_FIELD`, as the open
 * line's own field does, and the keyboard passing between two such fields
 * leaves the line open.
 */

/**
 * The Sheet panel's class: the overlay keeps its hover tips clear of it, since
 * the panel (docked or floating) covers the canvas's right edge.
 */
export const SHEET_SIDEBAR_CLASS = 'sheet-sidebar'

/** The Sheet panel's frame on a phone, a bottom sheet (section 8, On a phone, M4d); it also carries `SHEET_SIDEBAR_CLASS`. */
export const BOTTOM_SHEET_CLASS = 'sheet-bottom'

/**
 * The panel's tabs, in their order (section 8, from M4d). Math assistant is the
 * seventh, last (0.7.0), and is there only where the panel is given its content.
 */
export const SHEET_PANEL_TABS = ['format', 'symbols', 'variables', 'problems', 'constants', 'settings', 'assistant'] as const
export type SheetPanelTab = (typeof SHEET_PANEL_TABS)[number]

/** Whether an event's target is inside the Sheet panel. */
export function isInSheetPanel(target: EventTarget | null): boolean {
  return isElement(target) && target.closest(`.${SHEET_SIDEBAR_CLASS}`) !== null
}

/**
 * The mark of a field the open line is edited through: the line's own field,
 * the title's, and a rule's condition field in the Rules list.
 */
export const LINE_FIELD = 'data-line-field'

/** Whether focus that went to `target` stayed with the open line. */
export function isLineField(target: EventTarget | null): boolean {
  return isElement(target) && target.hasAttribute(LINE_FIELD)
}

/** The targets in the panel that take focus on a press: its fields. */
const FIELDS = 'input, select, textarea, [contenteditable="true"]'

/**
 * Keeps focus where it is on every press in the Sheet panel but a field's;
 * returns the function that stops. `scope` holds React's root: `root`'s
 * document by default, the view's container in a vault.
 */
export function keepPanelPresses(root: HTMLElement, scope: EventTarget = root.ownerDocument): () => void {
  const onMouseDown = (event: MouseEvent) => {
    const target = event.target
    if (!isElement(target) || !root.contains(target) || !isInSheetPanel(target)) return
    if (target.closest(FIELDS)) return
    event.preventDefault()
  }
  scope.addEventListener('mousedown', onMouseDown as EventListener)
  return () => scope.removeEventListener('mousedown', onMouseDown as EventListener)
}

/** A DOM element from any window: a pop-out window has its own `Element` (section 12a). */
function isElement(target: EventTarget | null): target is Element {
  return (target as Node | null)?.nodeType === 1
}
