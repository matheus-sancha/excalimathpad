import { useEffect, useLayoutEffect, useRef } from 'react'
import type { AppState } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { cancelPlacing, isPlacing, startPlacing, watchPlacing } from '../canvas/addMath.ts'
import { listenToCanvas } from '../canvas/canvasEvents.ts'
import { isMathAnchor, type MathAnchor } from '../canvas/mathAnchor.ts'
import { deselectAll } from '../canvas/selection.ts'
import { splitLines } from '../math/evaluate.ts'
import { clickTarget, keyAction, ownerAt, type CanvasState, type Press } from './gestures.ts'
import { anchorAt, containsPoint, lineAt, onHeader, type RowBox } from './lineHit.ts'
import { TITLE_LINE, type LineEdit } from './lineEdit.ts'
import type { TipTarget } from './HoverTip.tsx'
import type { SceneApi } from './MathOverlay.tsx'
import { stageToScene, type Point } from './viewport.ts'

export interface SheetGestures {
  api: SceneApi
  /**
   * The box Excalidraw fills, where the canvas's input is heard
   * (`listenToCanvas`).
   */
  canvasRoot: HTMLElement
  /** Live anchors in Excalidraw's z-order, bottom first. */
  anchors: () => readonly MathAnchor[]
  /** An element's rows as laid out, top first. */
  rowsOf: (anchorId: string) => RowBox[]
  /** An element's header as laid out, or null when it shows no title. */
  headerOf: (anchorId: string) => RowBox | null
  edit: () => LineEdit | null
  /** Leaves any open edit, then opens this line with the caret at the end. */
  openLine: (anchorId: string, lineIndex: number) => void
  /** Leaves the open edit, writing its line. */
  leaveLine: () => void
  focusCanvas: () => void
  /** The unit slot drawn at a point on screen, topmost first (section 5). */
  slotAt?: (clientX: number, clientY: number) => SlotTarget | null
  /** The row under the pointer, whose slot shows outlined; null off every row. */
  hoverRow?: (target: SlotTarget | null) => void
  /** Opens a result's unit field. */
  openUnit?: (target: SlotTarget) => void
  /** The problem message drawn at a point on screen: a gutter mark, a capped error (section 4). */
  tipAt?: (clientX: number, clientY: number) => TipTarget | null
  /** The message under the pointer, or null: shows it after a rest, hides it at once. */
  hoverTip?: (target: TipTarget | null) => void
}

/** A line's unit slot. */
export interface SlotTarget {
  anchorId: string
  line: number
  /** A table column's header slot (section 10); undefined for the result's own slot. */
  column?: number
}

/**
 * The stage's math gestures (docs/spec-v1.md section 4, section 14): double-click
 * on a line, Enter on a selected element, the second Esc, a press that leaves
 * or moves the edit, and Add math: M starts placing, Esc cancels it, and the
 * placing click opens the new element's first line (section 8). Excalidraw keeps click, drag, select and rotate, because the
 * overlay takes no pointer events and the anchor's fill takes clicks inside it.
 * The overlay's hovers come from the pointer's moves: a row's unit slot
 * (section 5) and a problem's message (section 4, Problems).
 *
 * `listenToCanvas` (`src/canvas/`) hands each event over before Excalidraw hears
 * it; the decisions are in `gestures.ts` and `lineHit.ts`. This wires them to
 * the app state and the line edit.
 */
export function useSheetGestures(gestures: SheetGestures) {
  const latest = useRef(gestures)
  useLayoutEffect(() => {
    latest.current = gestures
  })
  const { api, canvasRoot } = gestures

  useEffect(() => {
    const g = () => latest.current
    const anchorById = (id: string) => g().anchors().find((anchor) => anchor.id === id)

    const toScene = (event: MouseEvent): Point => {
      const { offsetLeft, offsetTop, scrollX, scrollY, zoom } = api.getAppState()
      return stageToScene(
        { x: event.clientX - offsetLeft, y: event.clientY - offsetTop },
        { scrollX, scrollY, zoom: zoom.value },
      )
    }

    // The line under the point, or the title when the point is on the header.
    const lineUnder = (anchor: MathAnchor, point: Point) =>
      onHeader(anchor, point, g().headerOf(anchor.id))
        ? TITLE_LINE
        : lineAt(anchor, point, g().rowsOf(anchor.id))

    const facts = (event: Event) => ({ targetOwnsEvent: isTypingTarget(event.target) })

    // A press on the edited element, kept until its click.
    let press: Press | null = null
    // A press on a unit slot, kept until its click (section 14: the slot lets
    // pointer-down through, so a drag from it still moves the element).
    let slotPress: Press | null = null
    let cursorFrame = 0

    const stopPlacing = watchPlacing(api, canvasRoot, (anchorId) => g().openLine(anchorId, 0))

    const stopListening = listenToCanvas(canvasRoot, {
      // Leaving comes before Excalidraw sees the press, so a drag starts on the
      // committed scene: the line is one undo step and the move is its own.
      pointerDown(event) {
        press = null
        // A press is never taken: Excalidraw still selects and drags from a
        // mark. Its message goes, as a native tooltip's does.
        g().hoverTip?.(null)
        const slot = g().slotAt?.(event.clientX, event.clientY) ?? null
        const slotAnchor = slot && anchorById(slot.anchorId)
        slotPress = slotAnchor
          ? { anchorId: slotAnchor.id, lineIndex: slot.line, x: slotAnchor.x, y: slotAnchor.y }
          : null
        const edit = g().edit()
        if (!edit) return
        const anchor = anchorById(edit.anchorId)
        const point = toScene(event)
        if (anchor && containsPoint(anchor, point)) {
          const lineIndex = lineUnder(anchor, point)
          press = { anchorId: anchor.id, lineIndex, x: anchor.x, y: anchor.y }
        }
        g().leaveLine()
        g().focusCanvas()
      },

      click(event) {
        const onSlot = slotPress
        slotPress = null
        if (onSlot) {
          // A click, not a drag: the element is where the press found it, and
          // the pointer is still on the same slot.
          const target = clickTarget(
            canvasState(api.getAppState(), api.getSceneElements()),
            g().anchors(),
            toScene(event),
            onSlot,
            facts(event),
          )
          const slot = g().slotAt?.(event.clientX, event.clientY)
          if (target && slot?.anchorId === onSlot.anchorId && slot.line === onSlot.lineIndex) {
            press = null
            g().openUnit?.(slot)
            return
          }
        }
        const pressed = press
        press = null
        if (!pressed) return
        const elements = api.getSceneElements()
        const target = clickTarget(
          canvasState(api.getAppState(), elements),
          g().anchors(),
          toScene(event),
          pressed,
          facts(event),
        )
        if (target) g().openLine(target.id, pressed.lineIndex)
      },

      pointerMove(event) {
        if (event.buttons !== 0) {
          g().hoverTip?.(null)
          return
        }
        const point = toScene(event)
        // Hover reads geometry alone: the topmost element under the pointer,
        // selected or not, while the selection tool is idle.
        const state = canvasState(api.getAppState(), api.getSceneElements())
        const owner = state.tool === 'selection' && !state.busy ? anchorAt(g().anchors(), point) : null
        const line = owner ? lineUnder(owner, point) : TITLE_LINE
        g().hoverRow?.(owner && line !== TITLE_LINE ? { anchorId: owner.id, line } : null)
        // A problem's message (section 4, Problems): from the mark's box, in any
        // tool, unless Excalidraw is busy or Add math is placing. Only over the
        // canvas itself, not Excalidraw's own menus and panels above it.
        const onCanvas = event.target instanceof HTMLCanvasElement
        g().hoverTip?.(
          onCanvas && !state.busy && !state.placing
            ? (g().tipAt?.(event.clientX, event.clientY) ?? null)
            : null,
        )
        // Excalidraw sets its own cursor on every move, after this capture
        // listener, and again from a frame callback it queues then. The pointer
        // goes back once the event is done (a microtask), and from a frame
        // callback queued after Excalidraw's, so it runs last before the paint
        // (#60, measured in Chromium: no frame shows Excalidraw's cursor).
        cancelAnimationFrame(cursorFrame)
        if (g().slotAt?.(event.clientX, event.clientY)) {
          const point = () => api.setCursor('pointer')
          queueMicrotask(() => {
            point()
            cancelAnimationFrame(cursorFrame)
            cursorFrame = requestAnimationFrame(point)
          })
        }
      },

      pointerLeave() {
        g().hoverTip?.(null)
      },

      doubleClick(event) {
        const point = toScene(event)
        const elements = api.getSceneElements()
        const owner = ownerAt(
          canvasState(api.getAppState(), elements),
          g().anchors(),
          point,
          facts(event),
        )
        if (!owner) return false
        g().openLine(owner.id, lineUnder(owner, point))
        return true
      },

      keyDown(event) {
        const app = api.getAppState()
        const elements = api.getSceneElements()
        const math = new Set(elements.filter(isMathAnchor).map(({ id }) => id))
        const selection = elements
          .filter(({ id }) => app.selectedElementIds[id])
          .map(({ id }) => id)
        const action = keyAction(canvasState(app, elements), selection, (id) => math.has(id), {
          key: event.key,
          modifier: event.ctrlKey || event.metaKey || event.altKey || event.shiftKey,
          composing: event.isComposing,
          ...facts(event),
        })
        if (!action) return false
        if (action.kind === 'deselect') {
          deselectAll(api)
          return true
        }
        if (action.kind === 'add-math') {
          startPlacing(api)
          return true
        }
        if (action.kind === 'cancel-placing') {
          cancelPlacing(api)
          return true
        }
        const anchor = anchorById(action.anchorId)
        if (anchor) g().openLine(anchor.id, splitLines(anchor.source).length - 1)
        return true
      },
    })

    return () => {
      cancelAnimationFrame(cursorFrame)
      stopPlacing()
      stopListening()
    }
  }, [api, canvasRoot])
}

function canvasState(app: AppState, elements: readonly ExcalidrawElement[]): CanvasState {
  return {
    tool: app.activeTool.type,
    placing: isPlacing(app),
    busy: Boolean(
      app.editingTextElement ||
        app.editingLinearElement ||
        app.newElement ||
        app.multiElement ||
        app.openMenu ||
        app.openDialog ||
        app.openPopup ||
        app.contextMenu,
    ),
    selected: app.selectedElementIds,
    zIndex: Object.fromEntries(elements.map(({ id }, index) => [id, index])),
  }
}

const TYPING_TARGETS = 'input, textarea, select, button, [contenteditable]:not([contenteditable="false"])'

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TYPING_TARGETS) !== null
}
