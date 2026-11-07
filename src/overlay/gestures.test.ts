import { describe, expect, it } from 'vitest'
import type { MathAnchor } from '../canvas/mathAnchor.ts'
import { doubleClickTarget, keyAction, type CanvasState, type KeyFacts } from './gestures.ts'

const anchor = (props: Partial<MathAnchor> = {}): MathAnchor => ({
  id: 'm1',
  x: 0,
  y: 0,
  width: 200,
  height: 100,
  angle: 0,
  source: 'a = 1',
  locked: false,
  ...props,
})

const state = (props: Partial<CanvasState> = {}): CanvasState => ({
  tool: 'selection',
  busy: false,
  selected: {},
  ...props,
})

const inside = { x: 50, y: 50 }
const onCanvas = { targetOwnsEvent: false }

describe('doubleClickTarget', () => {
  it('is the anchor under the point when Excalidraw selected it', () => {
    const m1 = anchor()
    expect(doubleClickTarget(state({ selected: { m1: true } }), [m1], inside, onCanvas)).toBe(m1)
  })

  // Excalidraw's first click selected the whole group, the anchor with it.
  it('is a grouped anchor, selected through its group', () => {
    const m1 = anchor()
    const selected = { m1: true, e1: true } as const
    expect(doubleClickTarget(state({ selected }), [m1], inside, onCanvas)).toBe(m1)
  })

  // A drawing on top took the click, so it keeps its double-click (#43, answer 3).
  it('is nothing when the click selected something else at the point', () => {
    expect(
      doubleClickTarget(state({ selected: { drawing: true } }), [anchor()], inside, onCanvas),
    ).toBeNull()
  })

  it('is a locked anchor when the click selected nothing', () => {
    const m1 = anchor({ locked: true })
    expect(doubleClickTarget(state(), [m1], inside, onCanvas)).toBe(m1)
    expect(
      doubleClickTarget(state({ selected: { drawing: true } }), [m1], inside, onCanvas),
    ).toBeNull()
  })

  it('is an unlocked anchor only once selected', () => {
    expect(doubleClickTarget(state(), [anchor()], inside, onCanvas)).toBeNull()
  })

  it('is the topmost anchor where two overlap', () => {
    const below = anchor({ id: 'below' })
    const above = anchor({ id: 'above' })
    const selected = { below: true, above: true } as const
    expect(doubleClickTarget(state({ selected }), [below, above], inside, onCanvas)).toBe(above)
  })

  it('is nothing outside every anchor', () => {
    const selected = { m1: true } as const
    expect(doubleClickTarget(state({ selected }), [anchor()], { x: 300, y: 50 }, onCanvas)).toBeNull()
  })

  it('is nothing with another tool, while Excalidraw is busy, or on a control', () => {
    const selected = { m1: true } as const
    const m1 = anchor()
    expect(doubleClickTarget(state({ selected, tool: 'rectangle' }), [m1], inside, onCanvas)).toBeNull()
    expect(doubleClickTarget(state({ selected, busy: true }), [m1], inside, onCanvas)).toBeNull()
    expect(doubleClickTarget(state({ selected }), [m1], inside, { targetOwnsEvent: true })).toBeNull()
  })
})

describe('keyAction', () => {
  const isMath = (id: string) => id.startsWith('m')
  const key = (props: Partial<KeyFacts>): KeyFacts => ({
    key: 'Enter',
    modifier: false,
    composing: false,
    targetOwnsEvent: false,
    ...props,
  })
  const act = (selection: string[], facts: Partial<KeyFacts>, canvas = state()) =>
    keyAction(canvas, selection, isMath, key(facts))

  describe('Enter', () => {
    it('edits the last line of the one selected math element', () => {
      expect(act(['m1'], {})).toEqual({ kind: 'open-last', anchorId: 'm1' })
    })

    it('stays Excalidraw’s for a drawing, several elements, or nothing selected', () => {
      expect(act(['r1'], {})).toBeNull()
      expect(act(['m1', 'm2'], {})).toBeNull()
      expect(act(['m1', 'r1'], {})).toBeNull()
      expect(act([], {})).toBeNull()
    })

    it('stays Excalidraw’s with a modifier, during composition, or from a control', () => {
      expect(act(['m1'], { modifier: true })).toBeNull()
      expect(act(['m1'], { composing: true })).toBeNull()
      expect(act(['m1'], { targetOwnsEvent: true })).toBeNull()
    })

    it('stays Excalidraw’s with another tool or while it is busy', () => {
      expect(act(['m1'], {}, state({ tool: 'rectangle' }))).toBeNull()
      expect(act(['m1'], {}, state({ busy: true }))).toBeNull()
    })
  })

  describe('Esc', () => {
    const esc = { key: 'Escape' }

    it('deselects when the selection includes a math element, mixed too', () => {
      expect(act(['m1'], esc)).toEqual({ kind: 'deselect' })
      expect(act(['m1', 'm2'], esc)).toEqual({ kind: 'deselect' })
      expect(act(['r1', 'm1'], esc)).toEqual({ kind: 'deselect' })
    })

    it('stays Excalidraw’s for drawings only, or nothing selected', () => {
      expect(act(['r1'], esc)).toBeNull()
      expect(act([], esc)).toBeNull()
    })

    // Its line editor, a shape being drawn, or a menu takes Esc first.
    it('stays Excalidraw’s while it is busy, with another tool, or from a control', () => {
      expect(act(['m1'], esc, state({ busy: true }))).toBeNull()
      expect(act(['m1'], esc, state({ tool: 'hand' }))).toBeNull()
      expect(act(['m1'], { ...esc, targetOwnsEvent: true })).toBeNull()
    })
  })

  it('ignores other keys', () => {
    expect(act(['m1'], { key: 'm' })).toBeNull()
    expect(act(['m1'], { key: 'Delete' })).toBeNull()
  })
})
