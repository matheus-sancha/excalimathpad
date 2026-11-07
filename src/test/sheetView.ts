/**
 * Reading math elements in tests. Typeset cells hold KaTeX's HTML, whose text
 * isn't the source, so rows are read by their accessible name (the line's
 * source) and results by `data-text` (the result as text).
 */

/** The source lines an element's grid shows (`aria-label` of each row). */
export function linesOf(element: ParentNode): string[] {
  return Array.from(element.querySelectorAll<HTMLElement>('[data-line]')).map(
    (row) => row.getAttribute('aria-label') ?? '',
  )
}

/** An element's non-empty results, as text, joined by a space. */
export function resultsOf(element: ParentNode | null | undefined): string {
  return Array.from(element?.querySelectorAll<HTMLElement>('.math-element__result') ?? [])
    .map((cell) => cell.dataset.text)
    .filter((text) => text !== undefined)
    .join(' ')
}
