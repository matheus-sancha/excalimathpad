/** The wrap width is never less than this (docs/spec-v1.md section 4, While editing a line, The field wraps). */
export const LEAST_WRAP_WIDTH = 240

/**
 * The room the open line's field has before it wraps (section 4, While
 * editing a line, The field wraps, M4e), in scene units: what is left of the
 * wrap width once the rest of the element has what it needs (the gutter, the
 * padding, the result and note columns as they are now), and never less than
 * the other lines' equations take. The cell's own least width
 * (MathOverlay.css) holds below that. `wrapWidth` is the element's chosen width
 * or, with none, the space from its left edge to the visible area's right
 * edge less the margin, in scene units.
 *
 * The rest is measured as the floor is (`floorOf`): the body is laid out at
 * no width for a moment, with the field's cell asking for nothing. Null when
 * nothing is laid out (jsdom): the field then doesn't wrap.
 */
export function fieldRoom(cell: HTMLElement, wrapWidth: number): number | null {
  const body = cell.closest<HTMLElement>('.math-element__body')
  if (!body) return null
  body.classList.add('is-measuring-wrap')
  const rest = body.offsetWidth
  const beside = cell.offsetWidth
  body.classList.remove('is-measuring-wrap')
  if (rest === 0) return null
  return beside + Math.max(0, wrapWidth - rest)
}

/**
 * An automatic element's wrap width, in scene units: from its left edge to
 * the visible area's right edge less the margin, and at least 240.
 */
export function wrapWidthTo(elementLeft: number, areaRight: number, margin: number, zoom: number): number {
  return Math.max(LEAST_WRAP_WIDTH, (areaRight - margin - elementLeft) / zoom)
}
