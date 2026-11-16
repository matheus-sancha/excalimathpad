import { describe, expect, it } from 'vitest'
import { printRows } from './printRows.ts'

/** Gives `element` a laid-out box on screen, at the canvas's `zoom`, `top` and `height` in scene units. */
function place(element: Element, top: number, height: number, zoom: number) {
  const y = 100 + top * zoom
  element.getBoundingClientRect = () => ({ top: y, bottom: y + height * zoom, height: height * zoom, left: 0, right: 0, width: 0, x: 0, y, toJSON: () => ({}) })
}

describe('printRows (docs/spec-v1.md section 11, Page breaks)', () => {
  it('reads the title, each line and comment, a plot whole and a table by its rows, in scene units', () => {
    document.body.innerHTML = `
      <div class="math-element__body">
        <div class="math-element__title" data-title></div>
        <ol class="math-element__grid">
          <li class="math-element__row is-comment" data-line="0"></li>
          <li class="math-element__row is-math" data-line="1"></li>
          <li class="math-element__row is-math" data-line="2">
            <div class="math-element__table-cell"><table class="math-element__table">
              <thead><tr></tr></thead><tbody><tr></tr><tr></tr></tbody>
            </table></div>
          </li>
          <li class="math-element__row is-math" data-line="3"><div class="math-element__plot-cell"></div></li>
        </ol>
      </div>`
    const zoom = 2
    const body = document.querySelector<HTMLElement>('.math-element__body')!
    Object.defineProperty(body, 'offsetHeight', { value: 600 })
    place(body, 0, 600, zoom)
    place(body.querySelector('[data-title]')!, 0, 30, zoom)
    const [comment, line, table, plot] = body.querySelectorAll('[data-line]')
    place(comment, 30, 48, zoom)
    place(line, 78, 24, zoom)
    place(table, 102, 98, zoom)
    place(table.querySelector('table')!, 126, 74, zoom)
    place(table.querySelector('thead tr')!, 126, 30, zoom)
    const [r1, r2] = table.querySelectorAll('tbody tr')
    place(r1, 156, 22, zoom)
    place(r2, 178, 22, zoom)
    place(plot, 200, 330, zoom)

    expect(printRows(body)).toEqual([
      { kind: 'title', line: -1, top: 0, height: 30 },
      { kind: 'comment', line: 0, top: 30, height: 48 },
      { kind: 'line', line: 1, top: 78, height: 24 },
      { kind: 'line', line: 2, top: 102, height: 24 },
      { kind: 'table-header', line: 2, top: 126, height: 30 },
      { kind: 'table-row', line: 2, top: 156, height: 22 },
      { kind: 'table-row', line: 2, top: 178, height: 22 },
      { kind: 'plot', line: 3, top: 200, height: 330 },
    ])
  })

  it('reads a failed element’s notice and its plain rows', () => {
    document.body.innerHTML = `
      <div class="math-element__body">
        <div class="math-element__failed"></div>
        <ol class="math-element__grid"><li class="math-element__row is-plain" data-line="0"></li></ol>
      </div>`
    const body = document.querySelector<HTMLElement>('.math-element__body')!
    Object.defineProperty(body, 'offsetHeight', { value: 60 })
    place(body, 0, 60, 1)
    place(body.querySelector('.math-element__failed')!, 0, 36, 1)
    place(body.querySelector('[data-line]')!, 36, 24, 1)
    expect(printRows(body)).toEqual([
      { kind: 'notice', line: -1, top: 0, height: 36 },
      { kind: 'line', line: 0, top: 36, height: 24 },
    ])
  })
})
