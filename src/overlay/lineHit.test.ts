import { describe, expect, it } from 'vitest'
import type { MathAnchor } from '../canvas/mathAnchor.ts'
import { anchorAt, containsPoint, lineAt, toAnchorFrame } from './lineHit.ts'
import { sceneToStage, stageToScene } from './viewport.ts'

const anchor = (props: Partial<MathAnchor> = {}): MathAnchor => ({
  id: 'm1',
  x: 100,
  y: 50,
  width: 400,
  height: 120,
  angle: 0,
  source: '',
  locked: false,
  opacity: 100,
  ...props,
})

// Three rows of different heights, as KaTeX rows will be (#44), with a gap.
const rows = [
  { top: 12, height: 24 },
  { top: 36, height: 40 },
  { top: 80, height: 24 },
]

describe('toAnchorFrame', () => {
  it('measures from the top-left corner of an upright anchor', () => {
    expect(toAnchorFrame(anchor(), { x: 130, y: 70 })).toEqual({ x: 30, y: 20 })
  })

  it('undoes the rotation about the centre', () => {
    // Quarter turn clockwise: the anchor's top-left corner is now top-right of
    // its centre (300, 110), at (360, -90) for this 400 x 120 box.
    const turned = anchor({ angle: Math.PI / 2 })
    const local = toAnchorFrame(turned, { x: 360, y: -90 })

    expect(local.x).toBeCloseTo(0)
    expect(local.y).toBeCloseTo(0)
  })
})

describe('anchorAt', () => {
  const below = anchor({ id: 'below' })
  const above = anchor({ id: 'above', x: 300 })

  it('takes the topmost anchor under the point (z-order, bottom first)', () => {
    expect(anchorAt([below, above], { x: 350, y: 100 })?.id).toBe('above')
    expect(anchorAt([below, above], { x: 150, y: 100 })?.id).toBe('below')
  })

  it('finds nothing outside every anchor', () => {
    expect(anchorAt([below, above], { x: 50, y: 100 })).toBeNull()
  })

  it('follows a rotated anchor, not its upright box', () => {
    const turned = anchor({ angle: Math.PI / 2 })
    // Inside the upright box, outside the turned one, and the other way round.
    expect(containsPoint(turned, { x: 110, y: 60 })).toBe(false)
    expect(containsPoint(turned, { x: 300, y: -60 })).toBe(true)
  })
})

describe('lineAt', () => {
  const at = (y: number) => lineAt(anchor(), { x: 200, y: 50 + y }, rows)

  it('finds the row the point is in, whatever the row heights', () => {
    expect(at(20)).toBe(0)
    expect(at(36)).toBe(1)
    expect(at(75)).toBe(1)
    expect(at(90)).toBe(2)
  })

  it('takes the first line above the rows and the last below them', () => {
    expect(at(2)).toBe(0)
    expect(at(118)).toBe(2)
  })

  it('takes the nearer row in a gap', () => {
    expect(at(77)).toBe(1)
    expect(at(79)).toBe(2)
  })

  it('is the first line when there are no rows', () => {
    expect(lineAt(anchor(), { x: 200, y: 100 }, [])).toBe(0)
  })

  // The research case (#28): 150% zoom, scrolled, rotated 30 degrees.
  it('finds the line on a rotated anchor at 150% zoom, scrolled', () => {
    const turned = anchor({ angle: Math.PI / 6 })
    const viewport = { scrollX: -35, scrollY: 18, zoom: 1.5 }
    // The middle of row 3, in the anchor's frame, turned into scene units.
    const local = { x: 200, y: 92 }
    const cx = turned.x + turned.width / 2
    const cy = turned.y + turned.height / 2
    const [dx, dy] = [local.x - turned.width / 2, local.y - turned.height / 2]
    const cos = Math.cos(turned.angle)
    const sin = Math.sin(turned.angle)
    const scene = { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
    // On screen and back, as the stage listener converts it.
    const stage = sceneToStage(scene, viewport)

    expect(lineAt(turned, stageToScene(stage, viewport), rows)).toBe(2)
  })
})
