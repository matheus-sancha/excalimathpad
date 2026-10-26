import { useMemo, useState, useSyncExternalStore } from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { ABOVE_DRAWING_BELOW_UI_Z_INDEX } from '../canvas/layers.ts'
import {
  isMathAnchor,
  sameAnchor,
  toMathAnchor,
  type MathAnchor,
} from '../canvas/mathAnchor.ts'
import type { ForwardWheel } from '../canvas/SheetCanvas.tsx'
import { MathElementView } from './MathElementView.tsx'
import type { Viewport } from './viewport.ts'
import './MathOverlay.css'

/** The slice of Excalidraw's API the overlay reads. */
export type SceneApi = Pick<
  ExcalidrawImperativeAPI,
  'getSceneElements' | 'getAppState' | 'onChange' | 'onScrollChange'
>

export interface MathOverlayProps {
  api: SceneApi
  forwardWheel: ForwardWheel
  /** Source text per anchor id, for anchors that exist at mount. */
  initialSources?: Readonly<Record<string, string>>
}

interface SceneSnapshot {
  viewport: Viewport
  anchors: readonly MathAnchor[]
}

/**
 * Renders every math element over the canvas, glued to its anchor's scene
 * position. Re-reads the scene whenever Excalidraw reports a change (element
 * moved, resized, deleted, undone) or a scroll/zoom.
 *
 * Source text lives here, in memory, keyed by anchor id; how it is persisted
 * with the sheet is still open (ADR 0001, ADR 0002).
 */
export function MathOverlay({ api, forwardWheel, initialSources }: MathOverlayProps) {
  const store = useMemo(() => createSceneStore(api), [api])
  const { viewport, anchors } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [sources, setSources] = useState<Record<string, string>>(() => ({
    ...initialSources,
  }))

  return (
    // Above the drawing, below Excalidraw's toolbar and panels, so math never
    // covers (or steals clicks from) the editor's own UI.
    <div className="math-overlay" style={{ zIndex: ABOVE_DRAWING_BELOW_UI_Z_INDEX }}>
      {anchors.map((anchor) => (
        <MathElementView
          key={anchor.id}
          anchor={anchor}
          viewport={viewport}
          source={sources[anchor.id] ?? ''}
          onSourceChange={(source) =>
            setSources((prev) => ({ ...prev, [anchor.id]: source }))
          }
          forwardWheel={forwardWheel}
        />
      ))}
    </div>
  )
}

function createSceneStore(api: SceneApi) {
  let current = readSnapshot(api)
  return {
    subscribe(onStoreChange: () => void) {
      const offChange = api.onChange(onStoreChange)
      const offScroll = api.onScrollChange(onStoreChange)
      return () => {
        offChange()
        offScroll()
      }
    },
    // Must return the same object while nothing relevant changed:
    // Excalidraw fires onChange for every pointer move and selection change.
    getSnapshot() {
      const next = readSnapshot(api)
      if (!sameSnapshot(current, next)) current = next
      return current
    },
  }
}

function readSnapshot(api: SceneApi): SceneSnapshot {
  const { scrollX, scrollY, zoom } = api.getAppState()
  return {
    viewport: { scrollX, scrollY, zoom: zoom.value },
    anchors: api.getSceneElements().filter(isMathAnchor).map(toMathAnchor),
  }
}

function sameSnapshot(a: SceneSnapshot, b: SceneSnapshot): boolean {
  const va = a.viewport
  const vb = b.viewport
  if (va.scrollX !== vb.scrollX || va.scrollY !== vb.scrollY || va.zoom !== vb.zoom) {
    return false
  }
  if (a.anchors.length !== b.anchors.length) return false
  return a.anchors.every((anchor, i) => sameAnchor(anchor, b.anchors[i]))
}
