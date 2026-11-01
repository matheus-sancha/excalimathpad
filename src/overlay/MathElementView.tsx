import { useEffect, useRef } from 'react'
import type { MathAnchor } from '../canvas/mathAnchor.ts'
import type { ForwardWheel } from '../canvas/SheetCanvas.tsx'
import { splitLines, type LineResult } from '../math/evaluate.ts'
import { sceneToStage, type Viewport } from './viewport.ts'

export interface MathElementViewProps {
  anchor: MathAnchor
  viewport: Viewport
  source: string
  /** One per line of `source`, from the sheet's evaluation (MathOverlay). */
  results: readonly LineResult[]
  onSourceChange: (source: string) => void
  forwardWheel: ForwardWheel
}

/**
 * One math element: source on the left, one result per line on the right.
 * Laid out in scene units and scaled by the zoom, so it moves and scales
 * exactly like the anchor Excalidraw draws underneath.
 *
 * The textarea always has exactly one row per source line, so it never
 * needs to scroll vertically: if it did (e.g. to keep the caret visible when
 * the source is taller than the anchor), its lines would drift away from the
 * results beside them. Long source overflows the anchor's border instead.
 */
export function MathElementView({
  anchor,
  viewport,
  source,
  results,
  onSourceChange,
  forwardWheel,
}: MathElementViewProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const { x, y } = sceneToStage(anchor, viewport)

  // React's onWheel is passive, so it cannot stop ctrl+wheel zooming the page.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.addEventListener('wheel', forwardWheel, { passive: false })
    return () => root.removeEventListener('wheel', forwardWheel)
  }, [forwardWheel])

  return (
    <div
      ref={rootRef}
      className="math-element"
      data-anchor-id={anchor.id}
      style={{
        width: anchor.width,
        height: anchor.height,
        transform: `translate(${x}px, ${y}px) scale(${viewport.zoom})`,
      }}
    >
      <div
        className="math-element__body"
        style={anchor.angle ? { transform: `rotate(${anchor.angle}rad)` } : undefined}
      >
        <textarea
          className="math-element__source"
          aria-label="Math source"
          value={source}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          wrap="off"
          rows={splitLines(source).length}
          onChange={(event) => onSourceChange(event.target.value)}
        />
        <ol className="math-element__results" aria-label="Results">
          {results.map((result, i) => (
            <li
              key={i}
              className={`math-element__result is-${result.kind}`}
              // Long results are cut to fit (MathOverlay.css); this keeps the whole text.
              title={result.kind === 'empty' ? undefined : formatResult(result)}
            >
              {formatResult(result)}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function formatResult(result: LineResult): string {
  switch (result.kind) {
    case 'value':
      return `= ${result.text}`
    case 'error':
      return result.message
    case 'empty':
      return ' '
  }
}
