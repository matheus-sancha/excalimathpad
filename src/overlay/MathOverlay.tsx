import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { ABOVE_DRAWING_BELOW_UI_Z_INDEX } from '../canvas/layers.ts'
import {
  isMathAnchor,
  sameAnchor,
  toMathAnchor,
  writeAnchorSource,
  type MathAnchor,
} from '../canvas/mathAnchor.ts'
import type { ForwardWheel } from '../canvas/SheetCanvas.tsx'
import { evaluateSheet, type SheetBlock } from '../math/evaluate.ts'
import {
  applyLineMove,
  startLineEdit,
  withTypedLine,
  type LineEdit,
  type LineMove,
} from './lineEdit.ts'
import { MathElementView } from './MathElementView.tsx'
import { readingOrder } from './readingOrder.ts'
import type { Viewport } from './viewport.ts'
import './MathOverlay.css'

/** The slice of Excalidraw's API the overlay uses. */
export type SceneApi = Pick<
  ExcalidrawImperativeAPI,
  | 'getSceneElements'
  | 'getSceneElementsIncludingDeleted'
  | 'getAppState'
  | 'onChange'
  | 'onScrollChange'
  | 'updateScene'
>

export interface MathOverlayProps {
  api: SceneApi
  forwardWheel: ForwardWheel
  /** Gives the keyboard back to Excalidraw, so its Ctrl+Z works after Esc. */
  focusCanvas: () => void
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
 * Owns the sheet's evaluation (ADR 0003): every element's source runs in
 * reading order, in one scope, synchronously on every keystroke and whenever a
 * source or the order changes. A drag that does not change the order does not
 * re-evaluate.
 *
 * Source lives in the anchors (ADR 0002). The one thing held here is the line
 * edit: the typed text stays in memory, the sheet runs from it, and the scene
 * gets it once, at the line commit (docs/spec-v1.md section 6). Holding a single
 * edit is what keeps at most one line across the sheet in source form.
 */
export function MathOverlay({ api, forwardWheel, focusCanvas }: MathOverlayProps) {
  const store = useMemo(() => createSceneStore(api), [api])
  const { viewport, anchors } = useSyncExternalStore(store.subscribe, store.getSnapshot)

  const [edit, setEdit] = useState<LineEdit | null>(null)
  // Events read the latest edit from here: a field being removed can report its
  // blur while the render that removed it is still committing.
  const editRef = useRef(edit)
  const changeEdit = (next: LineEdit | null) => {
    editRef.current = next
    setEdit(next)
  }

  const typedSourceOf = (anchor: MathAnchor) =>
    edit?.anchorId === anchor.id ? withTypedLine(anchor.source, edit) : anchor.source

  // A string, so moves that keep the order and the sources keep the memo below.
  const sheetKey = JSON.stringify(
    readingOrder(anchors).map((id): SheetBlock => {
      const anchor = anchors.find((candidate) => candidate.id === id)
      return { id, source: anchor ? typedSourceOf(anchor) : '' }
    }),
  )
  const results = useMemo(
    () => evaluateSheet(JSON.parse(sheetKey) as SheetBlock[]),
    [sheetKey],
  )

  const findAnchor = (anchorId: string) =>
    store.getSnapshot().anchors.find(({ id }) => id === anchorId)

  /** Every line commit goes through here, so each one is written exactly once. */
  const moveEdit = (move: LineMove) => {
    const current = editRef.current
    if (!current) return
    const anchor = findAnchor(current.anchorId)
    if (!anchor) {
      changeEdit(null)
      return
    }
    const next = applyLineMove(anchor.source, current, move)
    writeAnchorSource(api, current.anchorId, next.source)
    changeEdit(next.edit)
  }

  const openLine = (anchorId: string, lineIndex: number) => {
    moveEdit({ kind: 'leave' })
    const anchor = findAnchor(anchorId)
    if (anchor) changeEdit(startLineEdit(anchor.source, anchorId, lineIndex))
  }

  const leaveLine = (anchorId: string, lineIndex: number) => {
    const current = editRef.current
    if (current?.anchorId === anchorId && current.lineIndex === lineIndex) {
      moveEdit({ kind: 'leave' })
    }
  }

  return (
    // Above the drawing, below Excalidraw's toolbar and panels, so math never
    // covers (or steals clicks from) the editor's own UI.
    <div className="math-overlay" style={{ zIndex: ABOVE_DRAWING_BELOW_UI_Z_INDEX }}>
      {anchors.map((anchor) => (
        <MathElementView
          key={anchor.id}
          anchor={anchor}
          viewport={viewport}
          source={typedSourceOf(anchor)}
          results={results.get(anchor.id) ?? []}
          edit={edit?.anchorId === anchor.id ? edit : null}
          onOpenLine={(lineIndex) => openLine(anchor.id, lineIndex)}
          onType={(text) => {
            const current = editRef.current
            if (current) changeEdit({ ...current, text })
          }}
          onMove={moveEdit}
          onEscape={() => {
            moveEdit({ kind: 'leave' })
            focusCanvas()
          }}
          onBlurLine={(lineIndex) => leaveLine(anchor.id, lineIndex)}
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
