import { getCommonBounds } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { PrintBox } from '../print/printPages.ts'
import { isMathAnchor } from './mathAnchor.ts'

/**
 * The sheet's drawings as print boxes (docs/spec-v1.md section 11, Page
 * breaks), in scene units: every live element that isn't a math anchor, as
 * Excalidraw bounds it (rotation, arrowheads and stroke included). A group is
 * one drawing, by its outermost group, and a label is part of its container, so
 * a break never splits a labelled box. Excalidraw text is a drawing like any
 * other.
 */
export function drawingBoxes(elements: readonly ExcalidrawElement[]): PrintBox[] {
  const live = elements.filter((element) => !element.isDeleted && !isMathAnchor(element))
  const drawings = new Map<string, ExcalidrawElement[]>()
  for (const element of live) {
    const key = drawingKey(element, live)
    drawings.set(key, [...(drawings.get(key) ?? []), element])
  }
  return [...drawings.values()].map((members) => {
    const [left, top, right, bottom] = getCommonBounds(members)
    return { left, top, right, bottom }
  })
}

/** The drawing an element belongs to: its outermost group, else its container's, else itself. */
function drawingKey(element: ExcalidrawElement, live: readonly ExcalidrawElement[]): string {
  const outer = element.groupIds.at(-1)
  if (outer !== undefined) return `group:${outer}`
  const containerId = 'containerId' in element ? element.containerId : null
  const container = containerId ? live.find((other) => other.id === containerId) : undefined
  if (container) return drawingKey(container, live)
  return `element:${element.id}`
}
