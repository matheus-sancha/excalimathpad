import { createElement, useLayoutEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import guide from '../../docs/math-guide.md?guide'
import { MATH_GUIDE_CLASS } from './guideBox.ts'
import { HEADING_ID_PREFIX, type GuideNode } from './markdown.ts'
import './MathGuide.css'

/** The guide's own title, the dialog's name. */
const TITLE_ID = `${HEADING_ID_PREFIX}math-guide`

/**
 * The Math guide's dialog (docs/spec-v1.md section 8, Math guide): the guide's
 * elements, made from `docs/math-guide.md` at build time, in a box that
 * scrolls and starts at the top, where the contents list is. It closes on Esc,
 * ✕ or a click outside, and is as wide as the view allows up to about 760 px.
 * It makes no request: everything it shows is in the bundle.
 *
 * `SheetCanvas` draws it inside Excalidraw's box, so it takes Excalidraw's
 * theme and stays inside the view's own container in a vault, a pop-out
 * window's too (section 12a, The view is confined to itself). Its keys stop
 * here, so none reaches Excalidraw or the sheet's gestures.
 */
export function MathGuide({ onClose, nodes = guide }: { onClose: () => void; nodes?: readonly GuideNode[] }) {
  const body = useRef<HTMLDivElement>(null)
  // A click outside closes it only when its press started outside too, so a
  // text selection dragged out of the dialog doesn't.
  const pressedOutside = useRef(false)

  useLayoutEffect(() => {
    body.current?.focus({ preventScroll: true })
  }, [])

  // The guide's links go to its own headings: scrolled to inside the dialog,
  // never through the page's address.
  const followLink = (event: MouseEvent) => {
    const link = (event.target as Element).closest?.('a[href^="#"]')
    const box = body.current
    if (!link || !box) return
    event.preventDefault()
    const heading = box.querySelector(`[id="${HEADING_ID_PREFIX}${link.getAttribute('href')!.slice(1)}"]`)
    if (heading) box.scrollTop += heading.getBoundingClientRect().top - box.getBoundingClientRect().top
  }

  return (
    <div
      className={MATH_GUIDE_CLASS}
      data-prevent-outside-click
      onPointerDown={(event) => {
        pressedOutside.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (pressedOutside.current && event.target === event.currentTarget) onClose()
        pressedOutside.current = false
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby={TITLE_ID} className="math-guide__dialog">
        <div className="math-guide__bar">
          <button type="button" className="math-guide__close" aria-label="Close" title="Close (Esc)" onClick={onClose}>
            ✕
          </button>
        </div>
        <div ref={body} className="math-guide__body" tabIndex={-1} onClick={followLink}>
          {nodes.map(draw)}
        </div>
      </div>
    </div>
  )
}

/** One node of the guide, as React elements. */
function draw(node: GuideNode, key: number): ReactNode {
  if (typeof node === 'string') return node
  return createElement(node.tag, { key, ...node.attrs }, ...node.children.map(draw))
}
