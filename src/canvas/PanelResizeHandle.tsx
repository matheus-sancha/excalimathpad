import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { PANEL_WIDTH, PANEL_WIDTH_MAX, PANEL_WIDTH_MIN, PANEL_WIDTH_STEP, clampPanelWidth } from './panelWidth.ts'

/** What the handle is called, by its tooltip and to a screen reader. */
export const RESIZE_HANDLE_NAME = 'Resize the panel'

/**
 * The Sheet panel's drag handle (docs/spec-v1.md section 8, Sheet panel, M4e,
 * #198): its left edge. A drag moves the width with the pointer, a
 * double-click puts the default back, and with the handle focused ← and →
 * move it a step and Home puts the default back. It is the app's own control,
 * drawn inside Excalidraw's sidebar, which has no resizing (ADR 0001).
 *
 * `onWidth` is called with each width on the way, and `onSettle` once with
 * the width a gesture ends at, which is the one remembered. A press on it is
 * a press in the panel, so it never takes focus from an open line
 * (`keepPanelPresses`); it is reached with Tab.
 */
export function PanelResizeHandle({
  width,
  onWidth,
  onSettle,
}: {
  width: number
  onWidth: (width: number) => void
  onSettle: (width: number) => void
}) {
  // The drag in progress: where the pointer and the width started, and the width now.
  const drag = useRef<{ pointer: number; x: number; from: number; now: number } | null>(null)
  const settle = (next: number) => {
    onWidth(next)
    onSettle(next)
  }
  const end = (event: PointerEvent<HTMLDivElement>) => {
    const dragged = drag.current
    if (!dragged || dragged.pointer !== event.pointerId) return
    drag.current = null
    onSettle(dragged.now)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // The handle is on the panel's left edge: moving it left widens the panel.
    const next =
      event.key === 'ArrowLeft'
        ? clampPanelWidth(width + PANEL_WIDTH_STEP)
        : event.key === 'ArrowRight'
          ? clampPanelWidth(width - PANEL_WIDTH_STEP)
          : event.key === 'Home'
            ? PANEL_WIDTH
            : null
    if (next === null) return
    event.preventDefault()
    settle(next)
  }
  return (
    <div
      className="sheet-sidebar__resize"
      role="separator"
      aria-orientation="vertical"
      aria-label={RESIZE_HANDLE_NAME}
      aria-valuemin={PANEL_WIDTH_MIN}
      aria-valuemax={PANEL_WIDTH_MAX}
      aria-valuenow={width}
      title={`${RESIZE_HANDLE_NAME}: drag, or double-click for ${PANEL_WIDTH} px`}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0 || drag.current) return
        drag.current = { pointer: event.pointerId, x: event.clientX, from: width, now: width }
        // Every move comes here until the release, wherever the pointer goes.
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }}
      onPointerMove={(event) => {
        const dragged = drag.current
        if (!dragged || dragged.pointer !== event.pointerId) return
        const next = clampPanelWidth(dragged.from + dragged.x - event.clientX)
        if (next === dragged.now) return
        dragged.now = next
        onWidth(next)
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => settle(PANEL_WIDTH)}
      onKeyDown={onKeyDown}
    />
  )
}
