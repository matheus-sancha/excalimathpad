import { describe, expect, it } from 'vitest'
import { mathBoxes } from './printBoxes.ts'

/** Gives an element a screen box, as Chromium would lay it out. */
function at(element: Element, left: number, top: number, width: number, height: number) {
  element.getBoundingClientRect = () => new DOMRect(left, top, width, height)
  return element
}

/**
 * One element drawn at screen (500, 300) and zoom 2, with a title, a plain line
 * and a table line of two rows.
 */
function overlay() {
  const root = document.createElement('div')
  root.innerHTML = `
    <div class="math-element" data-anchor-id="m">
      <div class="math-element__body">
        <div data-title></div>
        <ol class="math-element__grid">
          <li class="math-element__row" data-line="0"></li>
          <li class="math-element__row" data-line="1">
            <div class="math-element__table-cell">
              <table class="math-element__table">
                <thead><tr></tr></thead>
                <tbody><tr></tr><tr></tr></tbody>
              </table>
            </div>
          </li>
        </ol>
      </div>
    </div>`
  const q = (selector: string) => root.querySelector(selector)!
  at(q('.math-element__body'), 500, 300, 400, 300)
  at(q('[data-title]'), 500, 300, 400, 40)
  at(q('[data-line="0"]'), 500, 340, 400, 40)
  at(q('[data-line="1"]'), 500, 380, 400, 220)
  at(q('.math-element__table-cell'), 500, 420, 300, 180)
  at(q('thead tr'), 500, 420, 300, 60)
  const [first, second] = root.querySelectorAll('tbody tr')
  at(first, 500, 480, 300, 60)
  at(second, 500, 540, 300, 60)
  return root
}

const anchor = { id: 'm', x: 100, y: 1000, width: 200, height: 150, angle: 0 }

describe('mathBoxes (section 11, Page breaks)', () => {
  it('measures the header, each line, and a table line by its parts, in scene units', () => {
    expect(mathBoxes(overlay(), [anchor], 2)).toEqual([
      { left: 100, top: 1000, right: 300, bottom: 1020 },
      { left: 100, top: 1020, right: 300, bottom: 1040 },
      // The table line's equation, above its table.
      { left: 100, top: 1040, right: 300, bottom: 1060 },
      { left: 100, top: 1060, right: 250, bottom: 1090, table: 'm:1', header: true },
      { left: 100, top: 1090, right: 250, bottom: 1120, table: 'm:1' },
      { left: 100, top: 1120, right: 250, bottom: 1150, table: 'm:1' },
    ])
  })

  it('a rotated element is one box, its anchor as rotated', () => {
    const [box] = mathBoxes(overlay(), [{ ...anchor, angle: Math.PI / 2 }], 2)
    expect(box.left).toBeCloseTo(125)
    expect(box.right).toBeCloseTo(275)
    expect(box.top).toBeCloseTo(975)
    expect(box.bottom).toBeCloseTo(1175)
  })

  it('an element not laid out, or not drawn, is its anchor', () => {
    expect(mathBoxes(document.createElement('div'), [anchor], 1)).toEqual([
      { left: 100, top: 1000, right: 300, bottom: 1150 },
    ])
  })
})
