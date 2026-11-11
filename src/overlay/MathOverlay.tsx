import {
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { ABOVE_DRAWING_BELOW_UI_Z_INDEX, DARK_THEME_FILTER } from '../canvas/layers.ts'
import { isPlacing } from '../canvas/addMath.ts'
import {
  isMathAnchor,
  removeAnchor,
  sameAnchor,
  toMathAnchor,
  writeAnchorSource,
  writeAnchorTitle,
  type MathAnchor,
} from '../canvas/mathAnchor.ts'
import type { ForwardWheel } from '../canvas/SheetCanvas.tsx'
import { evaluateSheet, type SheetBlock } from '../math/evaluate.ts'
import {
  applyLineMove,
  startLineEdit,
  TITLE_LINE,
  withTypedLine,
  type LineEdit,
  type LineMove,
} from './lineEdit.ts'
import type { RowBox } from './lineHit.ts'
import { MathElementView } from './MathElementView.tsx'
import { PlacingGhost } from './PlacingGhost.tsx'
import { readingOrder } from './readingOrder.ts'
import { useAnchorSizes } from './useAnchorSizes.ts'
import { useSheetGestures } from './useSheetGestures.ts'
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
  | 'onPointerUp'
  | 'updateScene'
  | 'setActiveTool'
  | 'setCursor'
>

/** What the app outside the overlay may do to the line edit: the sheet file saves with it. */
export interface LineEditControl {
  /** Writes the typed line to the scene, as a line commit, and keeps it open. */
  commitLine(): void
  /** Writes the typed line and closes the edit. */
  leaveLine(): void
}

export interface MathOverlayProps {
  api: SceneApi
  /** The box Excalidraw fills, where the gestures listen (`SheetCanvasHandle.root`). */
  canvasRoot: HTMLElement
  forwardWheel: ForwardWheel
  /** Gives the keyboard back to Excalidraw, so its Ctrl+Z works after Esc. */
  focusCanvas: () => void
  control?: Ref<LineEditControl>
  /**
   * Runs a size write so it doesn't make a clean sheet dirty
   * (`SheetSession.keepClean`, docs/spec-v1.md section 4, Size).
   */
  keepClean?: (write: () => void) => void
}

interface SceneSnapshot {
  viewport: Viewport
  anchors: readonly MathAnchor[]
  /** Excalidraw's theme: in dark, math darkens with the canvas's own filter. */
  dark: boolean
  /** Add math is waiting for its click (docs/spec-v1.md section 8). */
  placing: boolean
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
 *
 * Lines open from the gestures (`useSheetGestures`): a double-click on a line,
 * Enter on a selected element, a click on another line while editing, and the
 * click that places a new element. An element left with no text is removed. The
 * overlay itself takes no pointer events except the open field.
 */
export function MathOverlay({
  api,
  canvasRoot,
  forwardWheel,
  focusCanvas,
  control,
  keepClean = runNow,
}: MathOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const store = useMemo(() => createSceneStore(api), [api])
  const { viewport, anchors, dark, placing } = useSyncExternalStore(store.subscribe, store.getSnapshot)

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
  const lines = useMemo(
    () => evaluateSheet(JSON.parse(sheetKey) as SheetBlock[]),
    [sheetKey],
  )

  const findAnchor = (anchorId: string) =>
    store.getSnapshot().anchors.find(({ id }) => id === anchorId)

  /**
   * Every line commit goes through here, so each one is written exactly once.
   * An element left with no text is removed instead, as its own one step.
   */
  const moveEdit = (move: LineMove) => {
    const current = editRef.current
    if (!current) return
    const anchor = findAnchor(current.anchorId)
    if (!anchor) {
      changeEdit(null)
      return
    }
    const next = applyLineMove(anchor.source, current, move, anchor.title)
    if (next.remove) removeAnchor(api, current.anchorId)
    else {
      // A move changes the line or the title, never both: one write, one step.
      writeAnchorSource(api, current.anchorId, next.source)
      writeAnchorTitle(api, current.anchorId, next.title)
    }
    changeEdit(next.edit)
  }

  const openLine = (anchorId: string, lineIndex: number) => {
    moveEdit({ kind: 'leave' })
    const anchor = findAnchor(anchorId)
    if (anchor) changeEdit(startLineEdit(anchor.source, anchorId, lineIndex, anchor.title))
  }

  useImperativeHandle(control, () => ({
    // Saving during an edit writes what's on screen, and the field stays open.
    commitLine() {
      const current = editRef.current
      const anchor = current && findAnchor(current.anchorId)
      if (!current || !anchor) return
      if (current.lineIndex === TITLE_LINE) writeAnchorTitle(api, current.anchorId, current.text)
      else writeAnchorSource(api, current.anchorId, withTypedLine(anchor.source, current))
    },
    leaveLine: () => moveEdit({ kind: 'leave' }),
  }))

  useSheetGestures({
    api,
    canvasRoot,
    anchors: () => store.getSnapshot().anchors,
    rowsOf: (anchorId) => rowsOf(overlayRef.current, anchorId),
    headerOf: (anchorId) => headerOf(overlayRef.current, anchorId),
    edit: () => editRef.current,
    openLine,
    leaveLine: () => moveEdit({ kind: 'leave' }),
    focusCanvas,
  })

  useAnchorSizes({
    api,
    overlay: () => overlayRef.current,
    anchors: () => store.getSnapshot().anchors,
    keepClean,
  })

  const leaveLine = (anchorId: string, lineIndex: number) => {
    const current = editRef.current
    if (current?.anchorId === anchorId && current.lineIndex === lineIndex) {
      moveEdit({ kind: 'leave' })
    }
  }

  return (
    // Above the drawing, below Excalidraw's toolbar and panels, so math never
    // covers (or steals clicks from) the editor's own UI.
    <div
      ref={overlayRef}
      className="math-overlay"
      // In Excalidraw's dark theme, math darkens with the canvas's own filter.
      style={{
        zIndex: ABOVE_DRAWING_BELOW_UI_Z_INDEX,
        filter: dark ? DARK_THEME_FILTER : undefined,
      }}
    >
      {anchors.map((anchor) => (
        <MathElementView
          key={anchor.id}
          anchor={anchor}
          viewport={viewport}
          source={typedSourceOf(anchor)}
          lines={lines.get(anchor.id) ?? []}
          edit={edit?.anchorId === anchor.id ? edit : null}
          onType={(text) => {
            const current = editRef.current
            if (current) changeEdit({ ...current, text })
          }}
          onRewrite={(text, caret) => {
            // A format from the bar: the line's new text goes to the scene as
            // one line commit, and the line stays open on it.
            const current = editRef.current
            const live = current && findAnchor(current.anchorId)
            if (!current || !live) return
            const next = { ...current, text, caret, revision: (current.revision ?? 0) + 1 }
            writeAnchorSource(api, current.anchorId, withTypedLine(live.source, next))
            changeEdit(next)
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
      {placing && <PlacingGhost canvasRoot={canvasRoot} zoom={viewport.zoom} />}
    </div>
  )
}

const runNow = (write: () => void) => write()

/**
 * An element's rows as laid out: `offsetTop` and `offsetHeight` ignore CSS
 * transforms, so they are in scene units, before zoom and rotation.
 */
function rowsOf(overlay: HTMLElement | null, anchorId: string): RowBox[] {
  const element = Array.from(overlay?.children ?? []).find(
    (child) => child instanceof HTMLElement && child.dataset.anchorId === anchorId,
  )
  if (!element) return []
  return Array.from(element.querySelectorAll<HTMLElement>('[data-line]')).map((row) => ({
    top: row.offsetTop,
    height: row.offsetHeight,
  }))
}

/** The header's box as laid out, or null when the element shows no title. */
function headerOf(overlay: HTMLElement | null, anchorId: string): RowBox | null {
  const header = elementOf(overlay, anchorId)?.querySelector<HTMLElement>('[data-title]')
  return header ? { top: header.offsetTop, height: header.offsetHeight } : null
}

function elementOf(overlay: HTMLElement | null, anchorId: string): HTMLElement | undefined {
  return Array.from(overlay?.children ?? []).find(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.dataset.anchorId === anchorId,
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
  const app = api.getAppState()
  const { scrollX, scrollY, zoom, theme } = app
  return {
    viewport: { scrollX, scrollY, zoom: zoom.value },
    anchors: api.getSceneElements().filter(isMathAnchor).map(toMathAnchor),
    dark: theme === 'dark',
    placing: isPlacing(app),
  }
}

function sameSnapshot(a: SceneSnapshot, b: SceneSnapshot): boolean {
  const va = a.viewport
  const vb = b.viewport
  if (va.scrollX !== vb.scrollX || va.scrollY !== vb.scrollY || va.zoom !== vb.zoom) {
    return false
  }
  if (a.dark !== b.dark || a.placing !== b.placing) return false
  if (a.anchors.length !== b.anchors.length) return false
  return a.anchors.every((anchor, i) => sameAnchor(anchor, b.anchors[i]))
}
