import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * A problem's message under the pointer (docs/spec-v1.md section 4, Problems):
 * a gutter mark's warnings or error, or a capped error's whole text. Found by
 * geometry (`tipAt` in `MathOverlay.tsx`), since the overlay takes no pointer
 * events, and placed in the overlay's own coordinates.
 */
export interface TipTarget {
  /** Which mark: a new key is a new hover, with its own delay. */
  key: string
  message: string
  /** The mark's box, relative to the overlay. */
  left: number
  top: number
  bottom: number
}

/** How long the pointer rests on a mark before its message shows. */
export const TIP_DELAY_MS = 500

/**
 * The shown tip, and `hover`, which the gestures call on every move with the
 * mark under the pointer (or null). A message shows once the pointer has rested
 * on its mark for the delay, and hides as soon as it leaves. While one shows,
 * moving straight onto another mark shows that one at once, as native tooltips
 * do. Screen only: held here, never in the scene, the file or print.
 */
export function useHoverTip(delay = TIP_DELAY_MS) {
  const [tip, setTip] = useState<TipTarget | null>(null)
  const shown = useRef<TipTarget | null>(null)
  const waiting = useRef<{ target: TipTarget; timer: ReturnType<typeof setTimeout> } | null>(null)

  const show = useCallback((target: TipTarget | null) => {
    shown.current = target
    setTip(target)
  }, [])

  const stopWaiting = () => {
    if (waiting.current) clearTimeout(waiting.current.timer)
    waiting.current = null
  }

  const hover = useCallback(
    (target: TipTarget | null) => {
      if (!target) {
        stopWaiting()
        if (shown.current) show(null)
        return
      }
      if (shown.current?.key === target.key) return
      if (waiting.current?.target.key === target.key) {
        waiting.current.target = target
        return
      }
      stopWaiting()
      if (shown.current) {
        show(target)
        return
      }
      const timer = setTimeout(() => {
        const ready = waiting.current?.target
        waiting.current = null
        if (ready) show(ready)
      }, delay)
      waiting.current = { target, timer }
    },
    [delay, show],
  )

  useEffect(() => stopWaiting, [])

  return { tip, hover }
}

/** Space between the mark and its tip, in screen pixels. */
const GAP = 6

/**
 * The tip itself: below its mark, or above it when there's no room below, and
 * kept inside `room` (the overlay, short of the Sheet panel). It takes no
 * pointer events, like the rest of the overlay, and print hides it
 * (`MathOverlay.css`).
 */
export function HoverTip({
  tip,
  room,
}: {
  tip: TipTarget
  /** The space a tip can use, from the overlay's top-left. */
  room: () => { width: number; height: number }
}) {
  const roomRef = useRef(room)
  useLayoutEffect(() => {
    roomRef.current = room
  })
  const ref = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState({ left: tip.left, top: tip.bottom + GAP })

  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const { offsetWidth: width, offsetHeight: height } = box
    const room = roomRef.current()
    const left = Math.max(0, Math.min(tip.left, room.width - width - GAP))
    const below = tip.bottom + GAP
    const top = below + height > room.height && tip.top - GAP - height >= 0 ? tip.top - GAP - height : below
    setPlace({ left, top })
  }, [tip])

  return (
    <div ref={ref} className="math-hover-tip" role="tooltip" style={place}>
      {tip.message}
    </div>
  )
}
