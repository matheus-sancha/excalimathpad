import { useEffect, useState } from 'react'

/**
 * The app's items in Excalidraw's More tools dropdown (docs/spec-v1.md
 * section 8): Add math and Math Settings sit under Frame, Web Embed and Laser
 * pointer, with no buttons of their own on the canvas.
 *
 * Excalidraw has no slot for this, so the items are drawn into a box of the
 * app's own, appended to the dropdown each time it opens. That relies on the
 * dropdown's class names, which `moreTools.excalidraw.test.tsx` pins (ADR
 * 0001). The box is the app's: React owns the dropdown's other children and
 * never touches a node it didn't make.
 */

const DROPDOWN = '.App-toolbar__extra-tools-dropdown .dropdown-menu-container'
const TRIGGER = '.App-toolbar__extra-tools-trigger'
const HOST_CLASS = 'math-tools'

/** The box to draw the app's items into while More tools is open, else null. */
export function useMoreToolsSlot(root: HTMLElement | null): HTMLElement | null {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!root) return
    const find = () => {
      const menu = root.querySelector<HTMLElement>(DROPDOWN)
      if (!menu) return setSlot(null)
      let host = menu.querySelector<HTMLElement>(`:scope > .${HOST_CLASS}`)
      if (!host) {
        host = document.createElement('div')
        host.className = HOST_CLASS
        menu.append(host)
      }
      setSlot(host)
    }
    find()
    const observer = new MutationObserver(find)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [root])
  return slot
}

/** Closes More tools, as choosing one of Excalidraw's own items does. */
export function closeMoreTools(root: HTMLElement): void {
  if (root.querySelector(DROPDOWN)) root.querySelector<HTMLElement>(TRIGGER)?.click()
}

/**
 * Marks More tools' button from outside the dropdown, since the app's items
 * are out of sight while it is closed: `data-math-placing` while Add math is
 * placing, and `data-math-problems` with the count in `--math-problems` while
 * the sheet has problems. `SheetCanvas.css` draws both.
 */
export function markMoreTools(root: HTMLElement, marks: { placing: boolean; problems: number }): void {
  root.toggleAttribute('data-math-placing', marks.placing)
  root.toggleAttribute('data-math-problems', marks.problems > 0)
  root.style.setProperty('--math-problems', JSON.stringify(String(marks.problems)))
}
