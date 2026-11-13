import { describe, expect, it } from 'vitest'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import { drawingBoxes } from './drawingBoxes.ts'
import { createMathAnchorElements } from './mathAnchor.ts'

const shapes = (skeletons: Parameters<typeof convertToExcalidrawElements>[0]) =>
  convertToExcalidrawElements(skeletons, { regenerateIds: false })

const sorted = (boxes: ReturnType<typeof drawingBoxes>) => [...boxes].sort((a, b) => a.top - b.top)

describe('drawingBoxes (section 11, Page breaks)', () => {
  it('gives each drawing its bounds and leaves math anchors out', () => {
    const elements = [
      ...shapes([
        { type: 'rectangle', id: 'r', x: 10, y: 20, width: 100, height: 50 },
        { type: 'ellipse', id: 'e', x: 0, y: 200, width: 40, height: 40 },
      ]),
      ...createMathAnchorElements([{ id: 'm', x: 0, y: 100, width: 300, height: 80 }]),
    ]
    expect(sorted(drawingBoxes(elements))).toEqual([
      { left: 10, top: 20, right: 110, bottom: 70 },
      { left: 0, top: 200, right: 40, bottom: 240 },
    ])
  })

  it('skips deleted elements', () => {
    const [rect] = shapes([{ type: 'rectangle', x: 0, y: 0, width: 10, height: 10 }])
    expect(drawingBoxes([{ ...rect, isDeleted: true }])).toEqual([])
  })

  it('a group is one drawing, by its outermost group', () => {
    const elements = shapes([
      { type: 'rectangle', x: 0, y: 0, width: 50, height: 50, groupIds: ['inner', 'outer'] },
      { type: 'rectangle', x: 0, y: 300, width: 50, height: 50, groupIds: ['outer'] },
    ])
    expect(drawingBoxes(elements)).toEqual([{ left: 0, top: 0, right: 50, bottom: 350 }])
  })

  it('a rotated drawing is bounded where it is seen', () => {
    const elements = shapes([{ type: 'rectangle', x: 0, y: 0, width: 200, height: 20, angle: (Math.PI / 2) as never }])
    const [box] = drawingBoxes(elements)
    expect(box.bottom - box.top).toBeCloseTo(200)
    expect(box.right - box.left).toBeCloseTo(20)
  })

  it('a label belongs to its container', () => {
    const elements = shapes([
      { type: 'rectangle', id: 'box', x: 0, y: 0, width: 120, height: 60, label: { text: 'Pump' } },
    ])
    expect(elements.length).toBe(2)
    expect(drawingBoxes(elements)).toEqual([{ left: 0, top: 0, right: 120, bottom: 60 }])
  })
})
