import type { MathAnchor } from '../canvas/mathAnchor.ts'
import { anchorAt } from './lineHit.ts'
import type { Point } from './viewport.ts'

/**
 * When a double-click, Enter or Esc on the stage belongs to math rather than to
 * Excalidraw (docs/spec-v1.md section 4, Gestures). Pure decisions over plain
 * snapshots; `useSheetGestures` feeds them from the DOM and the app state.
 */

/** What these rules read from Excalidraw's app state. */
export interface CanvasState {
  /** `activeTool.type`. Math gestures act only with the selection tool. */
  tool: string
  /**
   * Excalidraw is in the middle of something Esc or a double-click belongs to:
   * its text editor, a line editor, a shape being drawn, or a menu, dialog,
   * popup or context menu open.
   */
  busy: boolean
  /** Selected ids, as `selectedElementIds` holds them. */
  selected: Readonly<Record<string, true>>
}

/** Where a key or pointer event came from, as far as these rules care. */
export interface EventFacts {
  /**
   * The target keeps the event: an input, textarea, contenteditable or button,
   * or anything outside the canvas, such as the app's own dialogs.
   */
  targetOwnsEvent: boolean
}

export interface KeyFacts extends EventFacts {
  key: string
  modifier: boolean
  composing: boolean
}

export type KeyAction =
  | { kind: 'open-last'; anchorId: string }
  | { kind: 'deselect' }

/**
 * The anchor a double-click edits, or null when it stays Excalidraw's.
 *
 * Excalidraw's own first click has already hit-tested the point, with its
 * rules for fill, stroke, locks and groups, and selected what it hit. So the
 * double-click is math's when the topmost anchor under the point is selected,
 * on its own or through its group. A drawing on top took the selection
 * instead, and keeps its double-click. A locked anchor can't be selected, so it
 * is math's when the click selected nothing: its lines still edit, and
 * Excalidraw would otherwise add a text element on it.
 */
export function doubleClickTarget(
  state: CanvasState,
  anchors: readonly MathAnchor[],
  point: Point,
  event: EventFacts,
): MathAnchor | null {
  if (event.targetOwnsEvent || state.tool !== 'selection' || state.busy) return null
  const hit = anchorAt(anchors, point)
  if (!hit) return null
  if (state.selected[hit.id]) return hit
  if (hit.locked && Object.keys(state.selected).length === 0) return hit
  return null
}

/**
 * What a key on the canvas does to math, or null to leave it to Excalidraw.
 * `selection` is the live selected elements' ids; `isMath` tells anchors apart.
 *
 * - Enter with one math element selected, and nothing else, edits its last line.
 * - Esc with a math element in the selection, alone or mixed, deselects
 *   everything: Excalidraw keeps a selection on Esc. A selection of drawings
 *   only stays Excalidraw's.
 */
export function keyAction(
  state: CanvasState,
  selection: readonly string[],
  isMath: (id: string) => boolean,
  key: KeyFacts,
): KeyAction | null {
  if (key.targetOwnsEvent || key.composing || key.modifier) return null
  if (state.tool !== 'selection' || state.busy) return null
  if (key.key === 'Enter' && selection.length === 1 && isMath(selection[0])) {
    return { kind: 'open-last', anchorId: selection[0] }
  }
  if (key.key === 'Escape' && selection.some(isMath)) return { kind: 'deselect' }
  return null
}
