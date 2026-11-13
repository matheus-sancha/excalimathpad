import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
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
import { SHEET_SIDEBAR_CLASS, type ForwardWheel } from '../canvas/SheetCanvas.tsx'
import {
  DEFAULT_DISPLAY,
  evaluateSheet,
  isDisplayUnit,
  listConstants,
  splitLines,
  type SheetBlock,
  type SheetLine,
} from '../math/evaluate.ts'
import { writeDisplayUnit, type TextColor } from '../math/lineForm.ts'
import { writeArgumentUnit } from '../math/tableLine.ts'
import { writePlotClauses, type PlotClause } from '../math/plotLine.ts'
import type { DisplaySettings } from '../math/display.ts'
import {
  applyLineMove,
  startLineEdit,
  TITLE_LINE,
  withTypedLine,
  type LineEdit,
  type LineMove,
} from './lineEdit.ts'
import type { RowBox } from './lineHit.ts'
import { HoverTip, useHoverTip, type TipTarget } from './HoverTip.tsx'
import { MathElementView } from './MathElementView.tsx'
import { PlacingGhost } from './PlacingGhost.tsx'
import { readingOrder } from './readingOrder.ts'
import { constantSuggestions, FUNCTION_SUGGESTIONS, sheetNames, suggest, unitSuggestions } from './suggest.ts'

/** The unit names offered while typing: fixed, so made once. */
const UNIT_NAMES = unitSuggestions()
import { useAnchorSizes } from './useAnchorSizes.ts'
import { GEAR, useSheetGestures, type SlotTarget } from './useSheetGestures.ts'
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
  /** Each evaluation of the sheet, in reading order, for the Sheet panel (section 8). */
  onEvaluated?: (sheet: readonly EvaluatedElement[]) => void
  /** The line a jump from the panel flashes. */
  flash?: FlashLine | null
  /** How results show: the sheet's unit system and Digits (section 5). */
  settings?: DisplaySettings
  /** The sheet's result colour (section 4, Colours and rules, M4c). */
  resultColor?: TextColor
}

/** The six text colours' values (section 4, Colours and rules). */
const TEXT_COLOR_VALUES: Record<TextColor, string> = {
  black: '#1e1e1e',
  blue: '#1971c2',
  red: '#e03131',
  green: '#2f9e44',
  orange: '#e8590c',
  gray: '#868e96',
}

/** One math element as evaluated: what the Sheet panel lists. */
export interface EvaluatedElement {
  anchorId: string
  title: string | null
  lines: readonly SheetLine[]
}

/** A line to flash; a new `key` flashes it again. */
export interface FlashLine {
  anchorId: string
  line: number
  key: number
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
 * overlay itself takes no pointer events except the open field, so its hovers
 * (the unit slots, a problem's message) are found from the pointer's moves.
 */
export function MathOverlay({
  api,
  canvasRoot,
  forwardWheel,
  focusCanvas,
  control,
  keepClean = runNow,
  onEvaluated,
  flash = null,
  settings = DEFAULT_DISPLAY,
  resultColor = 'blue',
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
    () => evaluateSheet(JSON.parse(sheetKey) as SheetBlock[], settings),
    [sheetKey, settings],
  )
  const constantNames = useMemo(() => constantSuggestions(listConstants(settings)), [settings])

  // The panel's view of the same run: titles name elements, so they count too.
  const titlesKey = JSON.stringify(anchors.map(({ id, title }) => [id, title]))
  const onEvaluatedRef = useRef(onEvaluated)
  useEffect(() => {
    onEvaluatedRef.current = onEvaluated
  })
  useEffect(() => {
    const titles = new Map(JSON.parse(titlesKey) as [string, string][])
    const order = (JSON.parse(sheetKey) as SheetBlock[]).map(({ id }) => id)
    onEvaluatedRef.current?.(
      order.map((anchorId) => ({
        anchorId,
        title: titles.get(anchorId) || null,
        lines: lines.get(anchorId) ?? [],
      })),
    )
  }, [lines, sheetKey, titlesKey])

  const findAnchor = (anchorId: string) =>
    store.getSnapshot().anchors.find(({ id }) => id === anchorId)

  // The unit slots (section 5): the hovered row, and the slot whose field is open.
  const [slotHover, setSlotHover] = useState<SlotTarget | null>(null)
  const [unitEdit, setUnitEdit] = useState<SlotTarget | null>(null)
  const hoverRow = (target: SlotTarget | null) =>
    setSlotHover((current) =>
      current?.anchorId === target?.anchorId && current?.line === target?.line ? current : target,
    )

  // A problem's message under the pointer (section 4, Problems). It is placed
  // where its mark was, so a scroll, zoom or scene change takes it away.
  const { tip, hover: hoverTip } = useHoverTip()
  useEffect(() => {
    hoverTip(null)
  }, [viewport, anchors, hoverTip])

  /** Writes the slot's choice into the line's source, as one line commit; the line stays typeset. */
  const applyUnit = (anchorId: string, lineIndex: number, unit: string | null, column?: number) => {
    setUnitEdit(null)
    focusCanvas()
    const anchor = findAnchor(anchorId)
    if (!anchor) return
    const sourceLines = splitLines(anchor.source)
    if (lineIndex >= sourceLines.length) return
    const written =
      column === undefined
        ? writeDisplayUnit(sourceLines[lineIndex], unit)
        : writeArgumentUnit(sourceLines[lineIndex], column, unit)
    if (written === sourceLines[lineIndex]) return
    sourceLines[lineIndex] = written
    writeAnchorSource(api, anchorId, sourceLines.join('\n'))
  }

  /** Writes a plot's clauses from its popover, as one line commit; the popover stays open. */
  const applyPlot = (anchorId: string, lineIndex: number, clauses: PlotClause[]) => {
    const anchor = findAnchor(anchorId)
    if (!anchor) return
    const sourceLines = splitLines(anchor.source)
    if (lineIndex >= sourceLines.length) return
    const written = writePlotClauses(sourceLines[lineIndex], clauses)
    if (written === sourceLines[lineIndex]) return
    sourceLines[lineIndex] = written
    writeAnchorSource(api, anchorId, sourceLines.join('\n'))
  }

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
    slotAt: (clientX, clientY) => slotAt(overlayRef.current, clientX, clientY),
    hoverRow,
    tipAt: (clientX, clientY) => tipAt(overlayRef.current, clientX, clientY),
    hoverTip,
    openUnit: (target) => {
      moveEdit({ kind: 'leave' })
      setUnitEdit(target)
    },
  })

  useAnchorSizes({
    api,
    overlay: () => overlayRef.current,
    anchors: () => store.getSnapshot().anchors,
    keepClean,
  })

  // Suggestions for the open line (section 4): the sheet's names above it,
  // then the constants, functions and units. None on a title.
  const suggestForEdit =
    edit && edit.lineIndex !== TITLE_LINE
      ? ((sheet) => (text: string, caret: number) =>
          suggest(text, caret, { sheet, constants: constantNames, functions: FUNCTION_SUGGESTIONS, units: UNIT_NAMES }))(
          sheetNames(
            readingOrder(anchors).map((id) => ({ id, lines: lines.get(id) ?? [] })),
            edit,
          ),
        )
      : null

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
      style={
        {
          zIndex: ABOVE_DRAWING_BELOW_UI_Z_INDEX,
          filter: dark ? DARK_THEME_FILTER : undefined,
          // Every result's number and unit, list summaries and table cells (a line's own text colour wins).
          '--math-result': TEXT_COLOR_VALUES[resultColor],
        } as CSSProperties
      }
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
          flash={flash?.anchorId === anchor.id ? flash : null}
          suggest={edit?.anchorId === anchor.id ? suggestForEdit : null}
          unitSlots={{
            hovered: slotHover?.anchorId === anchor.id ? slotHover.line : null,
            open: unitEdit?.anchorId === anchor.id ? unitEdit.line : null,
            openColumn: unitEdit?.anchorId === anchor.id ? (unitEdit.column ?? null) : null,
            apply: (lineIndex, unit, column) => applyUnit(anchor.id, lineIndex, unit, column),
            applyPlot: (lineIndex, clauses) => applyPlot(anchor.id, lineIndex, clauses),
            cancel: () => setUnitEdit(null),
            isUnit: isDisplayUnit,
          }}
        />
      ))}
      {tip && <HoverTip key={tip.key} tip={tip} room={() => tipRoom(overlayRef.current, canvasRoot)} />}
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

/**
 * The unit slot drawn under a point on screen, from the slots' boxes: the
 * topmost element first (later in the DOM paints above).
 */
function slotAt(overlay: HTMLElement | null, clientX: number, clientY: number): SlotTarget | null {
  const elements = Array.from(overlay?.children ?? []).reverse()
  for (const element of elements) {
    if (!(element instanceof HTMLElement) || !element.dataset.anchorId) continue
    for (const slot of element.querySelectorAll<HTMLElement>('[data-unit-slot]')) {
      const box = slot.getBoundingClientRect()
      if (box.width === 0 && box.height === 0) continue
      if (clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom) {
        const [line, column] = (slot.dataset.unitSlot ?? '').split(':')
        const target: SlotTarget = { anchorId: element.dataset.anchorId, line: Number(line) }
        // A plot's ⚙ (section 10) opens its popover the way a slot opens its field.
        if (column !== undefined) target.column = column === 'gear' ? GEAR : Number(column)
        return target
      }
    }
  }
  return null
}

/**
 * The message under a point on screen (section 4, Problems and Solve details):
 * a gutter mark, an error cell while its text is cut short, or a solved
 * value's details, found from their boxes
 * (`data-tip`), the topmost element first. The box comes back relative to the
 * overlay, where the tip is drawn.
 */
function tipAt(overlay: HTMLElement | null, clientX: number, clientY: number): TipTarget | null {
  if (!overlay) return null
  const elements = Array.from(overlay.children).reverse()
  for (const element of elements) {
    if (!(element instanceof HTMLElement) || !element.dataset.anchorId) continue
    for (const mark of element.querySelectorAll<HTMLElement>('[data-tip]')) {
      const box = mark.getBoundingClientRect()
      if (box.width === 0 && box.height === 0) continue
      if (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom) continue
      // An error that fits shows whole already: nothing to add on hover.
      if (mark.dataset.tipWhen === 'capped' && mark.scrollWidth <= mark.clientWidth) continue
      const origin = overlay.getBoundingClientRect()
      const row = mark.closest<HTMLElement>('[data-line]')?.dataset.line ?? ''
      const kind = mark.dataset.tipWhen ?? 'mark'
      return {
        key: `${element.dataset.anchorId}:${row}:${kind}:${mark.dataset.tip}`,
        message: mark.dataset.tip ?? '',
        left: box.left - origin.left,
        top: box.top - origin.top,
        bottom: box.bottom - origin.top,
      }
    }
  }
  return null
}

/**
 * Where a tip can show, in the overlay's coordinates: the overlay's box, short
 * of the Sheet panel where the panel covers its right edge.
 */
function tipRoom(overlay: HTMLElement | null, canvasRoot: HTMLElement) {
  if (!overlay) return { width: 0, height: 0 }
  const origin = overlay.getBoundingClientRect()
  const panel = canvasRoot.querySelector(`.${SHEET_SIDEBAR_CLASS}`)?.getBoundingClientRect()
  const covered = panel && panel.width > 0 ? Math.max(0, origin.right - panel.left) : 0
  return { width: overlay.clientWidth - covered, height: overlay.clientHeight }
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
