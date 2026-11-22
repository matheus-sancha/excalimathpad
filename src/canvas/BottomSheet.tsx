import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useWords } from '../text/words.ts'
import { BOTTOM_SHEET_CLASS, SHEET_SIDEBAR_CLASS, type SheetPanelTab } from './panelPresses.ts'

/** One tab of the bottom sheet: its trigger's face and name, and what fills it. */
export interface BottomSheetTab {
  tab: SheetPanelTab
  name: string
  /** The trigger's face: the tab's icon, its label and any badge. */
  face: ReactNode
  content: ReactNode
}

/**
 * The Sheet panel on a phone (docs/spec-v1.md section 8, On a phone, M4d): a
 * sheet across the bottom of the view in place of Excalidraw's right sidebar,
 * with the same tabs and the same contents. It sits just above the on-screen
 * keyboard (`useKeyboardInset`). While a line is open (`compact`) it is short:
 * the quick keys, the tab icons and a few rows of the tab, which scroll inside
 * it; otherwise it takes about half the view.
 *
 * It carries the panel's class, so a press in it is never the canvas's and
 * never takes focus (`panelPresses.ts`), and its keys never reach
 * Excalidraw's shortcuts. It is drawn inside Excalidraw's box (`.excalidraw`),
 * so it takes Excalidraw's theme, above the overlay.
 *
 * The active tab shows its name only if it fits (0.6.0, section 8): the room
 * the other icons and Close leave in the row, measured as it is laid out
 * (`nameFits`); otherwise it shows its icon alone, like the others, and every
 * tab stays a 40 px target. Its words are the text table's (`panel`).
 */
export function BottomSheet({
  tabs,
  active,
  compact,
  quickKeys,
  offer,
  onTab,
  onClose,
}: {
  tabs: readonly BottomSheetTab[]
  active: SheetPanelTab
  compact: boolean
  quickKeys?: ReactNode
  /** A rename's offer, the newest waiting, at the very top (0.5.0). */
  offer?: ReactNode
  onTab: (tab: SheetPanelTab) => void
  onClose: () => void
}) {
  const [box, setBox] = useState<HTMLElement | null>(null)
  const { bottom, visible } = useKeyboardInset(box)
  const shown = tabs.find(({ tab }) => tab === active) ?? tabs[0]
  const { panel } = useWords()
  const row = useRef<HTMLDivElement>(null)
  const [named, setNamed] = useState(true)
  useLayoutEffect(() => {
    const tabRow = row.current
    if (!tabRow) return
    const measure = () => setNamed(nameFits(tabRow))
    measure()
    const Observer = tabRow.ownerDocument.defaultView?.ResizeObserver
    if (!Observer) return
    const observer = new Observer(measure)
    observer.observe(tabRow)
    return () => observer.disconnect()
  }, [shown?.tab, shown?.name, tabs.length])
  return (
    <div
      ref={setBox}
      className={`${SHEET_SIDEBAR_CLASS} ${BOTTOM_SHEET_CLASS}${compact ? ' is-compact' : ''}`}
      role="region"
      aria-label={panel.region}
      style={{ bottom, '--sheet-visible': `${visible}px` } as CSSProperties}
    >
      <div className="sheet-sidebar__keys" onKeyDown={(event) => event.stopPropagation()}>
        {offer}
        {quickKeys}
        <div className="sheet-bottom__bar">
          <div
            ref={row}
            className={`sheet-bottom__tabs${named ? '' : ' is-icons'}`}
            role="tablist"
            aria-label={panel.tabList}
          >
            {tabs.map(({ tab, name, face }) => (
              <button
                key={tab}
                type="button"
                role="tab"
                className="sheet-tab sheet-bottom__tab"
                aria-selected={tab === shown?.tab}
                data-state={tab === shown?.tab ? 'active' : 'inactive'}
                title={name}
                tabIndex={-1}
                onClick={() => onTab(tab)}
              >
                {face}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="sheet-bottom__close"
            aria-label={panel.close}
            title={panel.close}
            tabIndex={-1}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="sheet-bottom__content" role="tabpanel" aria-label={shown?.name}>
          {shown?.content}
        </div>
      </div>
    </div>
  )
}

/** A tab's least width in the row, a finger's target (40 px), and the room kept each side of the active tab's face. */
const TAB_LEAST = 40
const PILL_PADDING = 4

/**
 * Whether the active tab's name fits its row (section 8, On a phone, 0.6.0):
 * its icon, the gap and the name, with a little room each side, beside the
 * other tabs at their least. A row that isn't laid out (jsdom) keeps the name.
 */
function nameFits(row: HTMLElement): boolean {
  const view = row.ownerDocument.defaultView
  if (!view || row.clientWidth === 0) return true
  const style = view.getComputedStyle(row)
  const room = row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  const tabs = [...row.querySelectorAll<HTMLElement>('.sheet-tab')]
  const activeTab = tabs.find((tab) => tab.dataset.state === 'active')
  const label = activeTab?.querySelector('.sheet-tab__label')
  if (!activeTab || !label) return true
  // The name's own width, laid out on one line, whether it shows or not.
  const range = row.ownerDocument.createRange()
  range.selectNodeContents(label)
  const name = range.getBoundingClientRect().width
  const icon = activeTab.querySelector('svg')?.getBoundingClientRect().width ?? 0
  const gap = parseFloat(view.getComputedStyle(activeTab).columnGap) || 0
  return (tabs.length - 1) * TAB_LEAST + icon + gap + name + 2 * PILL_PADDING <= room
}

/**
 * How far the on-screen keyboard reaches into the box that holds `sheet`
 * (`bottom`, px from that box's bottom edge) and how much of the box is left
 * visible above it (`visible`). Read from `visualViewport`, which shrinks when
 * a keyboard covers the page, on each of its resizes and scrolls; where the
 * keyboard resizes the page instead, the box itself shrinks and `bottom` is 0.
 */
function useKeyboardInset(sheet: HTMLElement | null): { bottom: number; visible: number } {
  const [inset, setInset] = useState({ bottom: 0, visible: 0 })
  useLayoutEffect(() => {
    const holder = sheet?.offsetParent ?? sheet?.parentElement
    const view = sheet?.ownerDocument.defaultView
    if (!holder || !view) return
    const viewport = view.visualViewport
    const measure = () => {
      const box = holder.getBoundingClientRect()
      const top = viewport ? viewport.offsetTop : 0
      const visibleBottom = viewport ? viewport.offsetTop + viewport.height : view.innerHeight
      const bottom = Math.max(0, Math.round(box.bottom - visibleBottom))
      const visible = Math.max(0, Math.round(Math.min(box.bottom, visibleBottom) - Math.max(box.top, top)))
      setInset((now) => (now.bottom === bottom && now.visible === visible ? now : { bottom, visible }))
    }
    measure()
    viewport?.addEventListener('resize', measure)
    viewport?.addEventListener('scroll', measure)
    view.addEventListener('resize', measure)
    return () => {
      viewport?.removeEventListener('resize', measure)
      viewport?.removeEventListener('scroll', measure)
      view.removeEventListener('resize', measure)
    }
  }, [sheet])
  return inset
}
