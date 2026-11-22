import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

/**
 * An Excalidraw text element as the Math assistant's listing reads it (spec section 8, Math
 * assistant, The listing): its text and where it is, for the reading order. Its id is kept
 * for the listing's map only, and is never written into a listing's text.
 */
export interface SceneText {
  id: string
  /** The text as typed, not as Excalidraw wrapped it to its box. */
  text: string
  x: number
  y: number
  width: number
  height: number
  /** Radians, clockwise, around the element's centre (Excalidraw's rule). */
  angle: number
}

/**
 * Every live text element of the scene, a label inside a shape or on an arrow included, in
 * the scene's order. The listing puts them in reading order.
 */
export function sceneTexts(elements: readonly ExcalidrawElement[]): SceneText[] {
  return elements.flatMap((element) => {
    if (element.isDeleted || element.type !== 'text') return []
    const { id, x, y, width, height, originalText, text } = element
    // Excalidraw types the angle as its `Radians` brand, from a module its published typings
    // don't ship, so it reads as `any`: it is a number in radians (as `toMathAnchor` says).
    return [{ id, text: originalText ?? text, x, y, width, height, angle: element.angle as number }]
  })
}
