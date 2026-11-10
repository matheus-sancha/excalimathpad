import type { AppState } from '@excalidraw/excalidraw/types'
import type { MathAnchor } from '../canvas/mathAnchor.ts'
import { anchorAt } from './lineHit.ts'
import type { Point } from './viewport.ts'

/**
 * When a double-click, a click, Enter or Esc on the stage belongs to math
 * rather than to Excalidraw (docs/spec-v1.md section 4, Gestures). Pure
 * decisions over plain snapshots; `useSheetGestures` feeds them from the DOM
 * and the app state.
 */

/** What these rules read from Excalidraw's app state and scene. */
export interface CanvasState {
  /** The active tool. Math gestures act only with the selection tool. */
  tool: AppState['activeTool']['type']
  /** Placing: Add math's tool is active, and the next click creates the anchor. */
  placing: boolean
  /**
   * Excalidraw is in the middle of something Esc or a double-click belongs to:
   * its text editor, a line editor, a shape being drawn, or a menu, dialog,
   * popup or context menu open.
   */
  busy: boolean
  /** Selected ids, as `selectedElementIds` holds them. */
  selected: Readonly<Record<string, true>>
  /** Each live element's place in the scene's z-order, bottom first. */
  zIndex: Readonly<Record<string, number>>
}

/** Where a key or pointer event came from, as far as these rules care. */
export interface EventFacts {
  /**
   * The target keeps the event: an input, textarea, contenteditable or button.
   * Keys from outside the canvas never reach these rules (`canvasEvents.ts`).
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
  | { kind: 'add-math' }
  | { kind: 'cancel-placing' }

/**
 * A press on the line edit's element, before Excalidraw handles it: where the
 * anchor was then, and the line under the press.
 */
export interface Press {
  anchorId: string
  lineIndex: number
  x: number
  y: number
}

/**
 * The math element that owns a pointer gesture at the point (a double-click,
 * or the click that moves an edit), or null when it stays Excalidraw's. Called
 * after Excalidraw has handled the press, so its selection says what its own
 * hit-testing (fill, stroke, groups) found.
 *
 * - The topmost anchor under the point owns it when it is selected, on its own
 *   or through its group.
 * - Otherwise a drawing on top took the press, and keeps the gesture.
 * - A locked anchor can't be selected: Excalidraw's hit-testing skips it and
 *   selects whatever lies under it, or nothing. So it owns the gesture unless
 *   something above it is selected. Its lines still edit, and Excalidraw would
 *   otherwise add a text element to what lies under it.
 */
export function ownerAt(
  state: CanvasState,
  anchors: readonly MathAnchor[],
  point: Point,
  event: EventFacts,
): MathAnchor | null {
  if (event.targetOwnsEvent || state.tool !== 'selection' || state.busy) return null
  const hit = anchorAt(anchors, point)
  if (!hit) return null
  if (state.selected[hit.id]) return hit
  if (hit.locked && !selectedAbove(state, hit.id)) return hit
  return null
}

function selectedAbove(state: CanvasState, anchorId: string): boolean {
  const own = state.zIndex[anchorId] ?? -1
  return Object.keys(state.selected).some((id) => (state.zIndex[id] ?? -1) > own)
}

/**
 * The anchor a click reopens, while a line edit was open on it: the press
 * that left the edit was a click, not a drag, so the edit moves to the line
 * under it. A click is a press and its `click` with the anchor's `x` and `y`
 * unchanged, on an anchor that still owns the point. A drawing on top took
 * the press, so the edit stays left. M2's unit slot and ⚙ reuse this rule.
 */
export function clickTarget(
  state: CanvasState,
  anchors: readonly MathAnchor[],
  point: Point,
  press: Press,
  event: EventFacts,
): MathAnchor | null {
  const owner = ownerAt(state, anchors, point, event)
  if (!owner || owner.id !== press.anchorId) return null
  return owner.x === press.x && owner.y === press.y ? owner : null
}

/**
 * What a key on the canvas does to math, or null to leave it to Excalidraw.
 * `selection` is the live selected elements' ids; `isMath` tells anchors apart.
 *
 * - Enter with one math element selected, and nothing else, edits its last line.
 * - Esc with a math element in the selection, alone or mixed, deselects
 *   everything: Excalidraw keeps a selection on Esc. A selection of drawings
 *   only stays Excalidraw's.
 * - M starts placing, from any tool, like Excalidraw's own letter shortcuts.
 *   Pressed again while placing, it keeps placing (and stays the app's).
 * - Esc while placing cancels it.
 */
export function keyAction(
  state: CanvasState,
  selection: readonly string[],
  isMath: (id: string) => boolean,
  key: KeyFacts,
): KeyAction | null {
  if (key.targetOwnsEvent || key.composing || key.modifier || state.busy) return null
  if (key.key.toLowerCase() === 'm') return { kind: 'add-math' }
  if (state.placing) return key.key === 'Escape' ? { kind: 'cancel-placing' } : null
  if (state.tool !== 'selection') return null
  if (key.key === 'Enter' && selection.length === 1 && isMath(selection[0])) {
    return { kind: 'open-last', anchorId: selection[0] }
  }
  if (key.key === 'Escape' && selection.some(isMath)) return { kind: 'deselect' }
  return null
}
