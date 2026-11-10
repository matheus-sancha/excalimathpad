import { useEffect, useState } from 'react'
import { NEW_ANCHOR_SIZE } from '../canvas/addMath.ts'

export interface PlacingGhostProps {
  /** The box Excalidraw fills: the pointer is followed there. */
  canvasRoot: HTMLElement
  zoom: number
}

/**
 * The ghost box shown while placing (docs/spec-v1.md section 8, Add math): the
 * new element's box, with its top-left at the pointer, where the click will
 * put it. It is UI only, never in the scene. Hidden until the pointer is over
 * the canvas, so it doesn't sit under the Add math button.
 */
export function PlacingGhost({ canvasRoot, zoom }: PlacingGhostProps) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!(event.target instanceof HTMLCanvasElement)) return setAt(null)
      const { left, top } = canvasRoot.getBoundingClientRect()
      setAt({ x: event.clientX - left, y: event.clientY - top })
    }
    const onPointerLeave = () => setAt(null)
    canvasRoot.addEventListener('pointermove', onPointerMove, true)
    canvasRoot.addEventListener('pointerleave', onPointerLeave)
    return () => {
      canvasRoot.removeEventListener('pointermove', onPointerMove, true)
      canvasRoot.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [canvasRoot])

  if (!at) return null
  return (
    <div
      className="math-ghost"
      data-testid="placing-ghost"
      style={{
        ...NEW_ANCHOR_SIZE,
        transform: `translate(${at.x}px, ${at.y}px) scale(${zoom})`,
      }}
    />
  )
}
