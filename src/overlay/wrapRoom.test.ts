import { describe, expect, it, onTestFinished } from 'vitest'
import { fieldRoom, wrapWidthTo } from './wrapRoom.ts'

/**
 * An open line's cell in its element's body. jsdom lays nothing out, so the
 * widths stand in: `rest` is what the body needs with the cell asking for
 * nothing, and `beside` what the other lines' equations give the cell then;
 * both are read only while the body is being measured.
 */
function cellIn({ rest, beside }: { rest: number; beside: number }) {
  const body = document.createElement('div')
  body.className = 'math-element__body'
  const cell = document.createElement('span')
  body.append(cell)
  document.body.append(body)
  onTestFinished(() => body.remove())
  const measuring = () => body.classList.contains('is-measuring-wrap')
  Object.defineProperty(body, 'offsetWidth', { get: () => (measuring() ? rest : 999) })
  Object.defineProperty(cell, 'offsetWidth', { get: () => (measuring() ? beside : 999) })
  return { body, cell }
}

describe('fieldRoom (docs/spec-v1.md section 4, While editing a line, The field wraps, M4e)', () => {
  it('is what is left of the wrap width once the rest of the element has what it needs', () => {
    const { cell } = cellIn({ rest: 300, beside: 80 })

    // 600 wide in all: the rest keeps its 300, of which the equations' 80 are the field's too.
    expect(fieldRoom(cell, 600)).toBe(380)
  })

  it('is never less than the other lines’ equations take', () => {
    const { cell } = cellIn({ rest: 700, beside: 80 })

    expect(fieldRoom(cell, 600)).toBe(80)
  })

  it('measures for a moment only: the body is left as it was', () => {
    const { body, cell } = cellIn({ rest: 300, beside: 80 })

    fieldRoom(cell, 600)

    expect(body.className).toBe('math-element__body')
  })

  it('is null where nothing is laid out, or outside an element', () => {
    expect(fieldRoom(cellIn({ rest: 0, beside: 0 }).cell, 600)).toBeNull()
    expect(fieldRoom(document.createElement('span'), 600)).toBeNull()
  })
})

describe('wrapWidthTo', () => {
  it('is the space from the element’s left edge to the visible area’s right edge less the margin', () => {
    expect(wrapWidthTo(40, 904, 48, 1)).toBe(816)
  })

  it('is in scene units', () => {
    expect(wrapWidthTo(40, 904, 48, 2)).toBe(408)
  })

  it('is at least 240, also with the element’s left edge past the visible area', () => {
    expect(wrapWidthTo(700, 904, 48, 1)).toBe(240)
    expect(wrapWidthTo(1000, 904, 48, 1)).toBe(240)
  })

  it('counts the part of an element that starts left of the window', () => {
    expect(wrapWidthTo(-200, 904, 48, 1)).toBe(1056)
  })
})
