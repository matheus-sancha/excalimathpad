import { useEffect, useLayoutEffect, useRef } from 'react'
import type { AppState } from '@excalidraw/excalidraw/types'
import { isMathAnchor, type MathAnchor } from '../canvas/mathAnchor.ts'
import { deselectAll } from '../canvas/selection.ts'
import { splitLines } from '../math/evaluate.ts'
import { doubleClickTarget, keyAction, type CanvasState } from './gestures.ts'
import { containsPoint, lineAt, type RowBox } from './lineHit.ts'
import type { LineEdit } from './lineEdit.ts'
import type { SceneApi } from './MathOverlay.tsx'
import { stageToScene, type Point } from './viewport.ts'

export interface SheetGestures {
  api: SceneApi
  /**
   * The box Excalidraw fills. The overlay is its sibling, so the line field's
   * own clicks never reach these listeners.
   */
  canvasRoot: HTMLElement
  /** Live anchors in Excalidraw's z-order, bottom first. */
  anchors: () => readonly MathAnchor[]
  /** An element's rows as laid out, top first. */
  rowsOf: (anchorId: string) => RowBox[]
  edit: () => LineEdit | null
  /** Leaves any open edit, then opens this line with the caret at the end. */
  openLine: (anchorId: string, lineIndex: number) => void
  /** Leaves the open edit, writing its line. */
  leaveLine: () => void
  focusCanvas: () => void
}

/**
 * The stage's math gestures (docs/spec-v1.md section 4, section 14): double-click
 * on a line, Enter on a selected element, the second Esc, and a press that leaves
 * or moves the edit. Excalidraw keeps click, drag, select and rotate, because the
 * overlay takes no pointer events and the anchor's fill takes clicks inside it.
 *
 * Each listener runs in the capture phase, before Excalidraw's React handlers,
 * and stops the event only when math acts on it. The decisions are in
 * `gestures.ts` and `lineHit.ts`; this wires them to the DOM and the app state.
 */
export function useSheetGestures(gestures: SheetGestures) {
  const latest = useRef(gestures)
  useLayoutEffect(() => {
    latest.current = gestures
  })
  const { api, canvasRoot } = gestures

  useEffect(() => {
    const g = () => latest.current

    const toScene = (event: MouseEvent): Point => {
      const { offsetLeft, offsetTop, scrollX, scrollY, zoom } = api.getAppState()
      return stageToScene(
        { x: event.clientX - offsetLeft, y: event.clientY - offsetTop },
        { scrollX, scrollY, zoom: zoom.value },
      )
    }

    // A press on the edited element, kept until its click: if the anchor didn't
    // move, it was a click on a line, and the edit moves there.
    let press: { anchorId: string; lineIndex: number; x: number; y: number } | null = null

    // Leaving comes before Excalidraw sees the press, so a drag starts on the
    // committed scene: the line is one undo step and the move is its own.
    const onPointerDown = (event: PointerEvent) => {
      press = null
      const edit = g().edit()
      if (!edit) return
      const anchor = g().anchors().find(({ id }) => id === edit.anchorId)
      const point = toScene(event)
      if (anchor && containsPoint(anchor, point)) {
        const lineIndex = lineAt(anchor, point, g().rowsOf(anchor.id))
        press = { anchorId: anchor.id, lineIndex, x: anchor.x, y: anchor.y }
      }
      g().leaveLine()
      g().focusCanvas()
    }

    const onClick = () => {
      const pressed = press
      press = null
      if (!pressed || api.getAppState().activeTool.type !== 'selection') return
      const anchor = g().anchors().find(({ id }) => id === pressed.anchorId)
      if (anchor && anchor.x === pressed.x && anchor.y === pressed.y) {
        g().openLine(pressed.anchorId, pressed.lineIndex)
      }
    }

    const onDoubleClick = (event: MouseEvent) => {
      const point = toScene(event)
      const hit = doubleClickTarget(canvasState(api.getAppState()), g().anchors(), point, {
        targetOwnsEvent: isTypingTarget(event.target),
      })
      if (!hit) return
      event.stopPropagation()
      event.preventDefault()
      g().openLine(hit.id, lineAt(hit, point, g().rowsOf(hit.id)))
    }

    // Keys come to `document` from the whole page. Only those on the canvas, or
    // on nothing in particular (the body), are the canvas's.
    const ownsKeys = (target: EventTarget | null) =>
      isTypingTarget(target) ||
      !(target === document.body || (target instanceof Node && canvasRoot.contains(target)))

    const onKeyDown = (event: KeyboardEvent) => {
      const app = api.getAppState()
      const elements = api.getSceneElements()
      const math = new Set(elements.filter(isMathAnchor).map(({ id }) => id))
      const selection = elements.filter(({ id }) => app.selectedElementIds[id]).map(({ id }) => id)
      const action = keyAction(canvasState(app), selection, (id) => math.has(id), {
        key: event.key,
        modifier: event.ctrlKey || event.metaKey || event.altKey || event.shiftKey,
        composing: event.isComposing,
        targetOwnsEvent: ownsKeys(event.target),
      })
      if (!action) return
      event.stopPropagation()
      event.preventDefault()
      if (action.kind === 'deselect') {
        deselectAll(api)
        return
      }
      const anchor = g().anchors().find(({ id }) => id === action.anchorId)
      if (anchor) g().openLine(anchor.id, splitLines(anchor.source).length - 1)
    }

    canvasRoot.addEventListener('pointerdown', onPointerDown, true)
    canvasRoot.addEventListener('click', onClick, true)
    canvasRoot.addEventListener('dblclick', onDoubleClick, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      canvasRoot.removeEventListener('pointerdown', onPointerDown, true)
      canvasRoot.removeEventListener('click', onClick, true)
      canvasRoot.removeEventListener('dblclick', onDoubleClick, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [api, canvasRoot])
}

function canvasState(app: AppState): CanvasState {
  return {
    tool: app.activeTool.type,
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
  }
}

const TYPING_TARGETS = 'input, textarea, select, button, [contenteditable]:not([contenteditable="false"])'

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TYPING_TARGETS) !== null
}
