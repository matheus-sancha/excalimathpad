import { describe, expect, it } from 'vitest'
import type { MathAnchor } from '../canvas/mathAnchor.ts'
import {
  clickTarget,
  keyAction,
  ownerAt,
  type CanvasState,
  type KeyFacts,
  type Press,
} from './gestures.ts'

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
  placing: false,
  busy: false,
  selected: {},
  zIndex: {},
  ...props,
})

const inside = { x: 50, y: 50 }
const onCanvas = { targetOwnsEvent: false }

describe('ownerAt (double-click, and the click that moves an edit)', () => {
  it('is the anchor under the point when Excalidraw selected it', () => {
    const m1 = anchor()
    expect(ownerAt(state({ selected: { m1: true } }), [m1], inside, onCanvas)).toBe(m1)
  })

  // Excalidraw's first click selected the whole group, the anchor with it.
  it('is a grouped anchor, selected through its group', () => {
    const m1 = anchor()
    const selected = { m1: true, e1: true } as const
    expect(ownerAt(state({ selected }), [m1], inside, onCanvas)).toBe(m1)
  })

  // A drawing on top took the click, so it keeps its double-click (#43, answer 3).
  it('is nothing when the click selected a drawing on top', () => {
    const zIndex = { m1: 0, drawing: 1 }
    expect(
      ownerAt(state({ selected: { drawing: true }, zIndex }), [anchor()], inside, onCanvas),
    ).toBeNull()
  })

  it('is an unlocked anchor only once selected', () => {
    expect(ownerAt(state(), [anchor()], inside, onCanvas)).toBeNull()
  })

  describe('a locked anchor, which Excalidraw never selects (#43, answer 2)', () => {
    const m1 = anchor({ locked: true })

    it('owns the point when the click selected nothing', () => {
      expect(ownerAt(state(), [m1], inside, onCanvas)).toBe(m1)
    })

    // Excalidraw's hit-testing skips it and selects what lies under it.
    it('owns the point when the click selected a drawing or an anchor below it', () => {
      const zIndex = { below: 0, m1: 1 }
      expect(ownerAt(state({ selected: { below: true }, zIndex }), [m1], inside, onCanvas)).toBe(m1)
      const under = anchor({ id: 'below' })
      expect(
        ownerAt(state({ selected: { below: true }, zIndex }), [under, m1], inside, onCanvas),
      ).toBe(m1)
    })

    it('doesn’t when the click selected something above it', () => {
      const zIndex = { m1: 0, drawing: 1 }
      expect(
        ownerAt(state({ selected: { drawing: true }, zIndex }), [m1], inside, onCanvas),
      ).toBeNull()
    })
  })

  it('is the topmost anchor where two overlap', () => {
    const below = anchor({ id: 'below' })
    const above = anchor({ id: 'above' })
    const selected = { below: true, above: true } as const
    expect(ownerAt(state({ selected }), [below, above], inside, onCanvas)).toBe(above)
  })

  it('is nothing outside every anchor', () => {
    const selected = { m1: true } as const
    expect(ownerAt(state({ selected }), [anchor()], { x: 300, y: 50 }, onCanvas)).toBeNull()
  })

  it('is nothing with another tool, while Excalidraw is busy, or on a control', () => {
    const selected = { m1: true } as const
    const m1 = anchor()
    expect(ownerAt(state({ selected, tool: 'rectangle' }), [m1], inside, onCanvas)).toBeNull()
    expect(ownerAt(state({ selected, busy: true }), [m1], inside, onCanvas)).toBeNull()
    expect(ownerAt(state({ selected }), [m1], inside, { targetOwnsEvent: true })).toBeNull()
  })
})

describe('clickTarget', () => {
  const press: Press = { anchorId: 'm1', lineIndex: 1, x: 0, y: 0 }
  const selected = { m1: true } as const

  it('is the edited anchor when it owns the point and didn’t move', () => {
    const m1 = anchor()
    expect(clickTarget(state({ selected }), [m1], inside, press, onCanvas)).toBe(m1)
  })

  it('is nothing after a drag: the anchor moved', () => {
    const moved = anchor({ x: 30 })
    expect(clickTarget(state({ selected }), [moved], inside, press, onCanvas)).toBeNull()
  })

  // The edit stays left: the drawing took the press (review of #51).
  it('is nothing when a drawing on top of the element took the press', () => {
    const zIndex = { m1: 0, drawing: 1 }
    expect(
      clickTarget(state({ selected: { drawing: true }, zIndex }), [anchor()], inside, press, onCanvas),
    ).toBeNull()
  })

  it('is nothing on another element', () => {
    const other = anchor({ id: 'm2' })
    expect(clickTarget(state({ selected: { m2: true } }), [other], inside, press, onCanvas)).toBeNull()
  })

  it('is the locked edited anchor when nothing above it was selected', () => {
    const m1 = anchor({ locked: true })
    expect(clickTarget(state(), [m1], inside, press, onCanvas)).toBe(m1)
  })

  it('is nothing with another tool', () => {
    expect(
      clickTarget(state({ selected, tool: 'hand' }), [anchor()], inside, press, onCanvas),
    ).toBeNull()
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

  describe('M (Add math, section 8)', () => {
    const m = (props: Partial<KeyFacts> = {}): KeyFacts => (key({ key: 'm', ...props }))

    it('starts placing, in either case, from any tool', () => {
      expect(keyAction(state(), [], isMath, m())).toEqual({ kind: 'add-math' })
      expect(keyAction(state(), [], isMath, m({ key: 'M' }))).toEqual({ kind: 'add-math' })
      expect(keyAction(state({ tool: 'rectangle' }), [], isMath, m())).toEqual({ kind: 'add-math' })
    })

    // Pressed again it keeps placing; the key stays the app's (#45, answer 3).
    it('keeps placing while placing', () => {
      const placing = state({ tool: 'custom', placing: true })
      expect(keyAction(placing, [], isMath, m())).toEqual({ kind: 'add-math' })
    })

    it('stays Excalidraw’s with a modifier, during composition, from a control or while it is busy', () => {
      expect(keyAction(state(), [], isMath, m({ modifier: true }))).toBeNull()
      expect(keyAction(state(), [], isMath, m({ composing: true }))).toBeNull()
      expect(keyAction(state(), [], isMath, m({ targetOwnsEvent: true }))).toBeNull()
      expect(keyAction(state({ busy: true }), [], isMath, m())).toBeNull()
    })
  })

  describe('while placing', () => {
    const placing = state({ tool: 'custom', placing: true })

    it('Esc cancels', () => {
      expect(keyAction(placing, [], isMath, key({ key: 'Escape' }))).toEqual({
        kind: 'cancel-placing',
      })
    })

    it('Esc with another custom tool stays Excalidraw’s', () => {
      expect(
        keyAction(state({ tool: 'custom' }), ['m1'], isMath, key({ key: 'Escape' })),
      ).toBeNull()
    })

    it('Enter does nothing to math', () => {
      expect(keyAction(placing, ['m1'], isMath, key({}))).toBeNull()
    })
  })

  it('ignores other keys', () => {
    expect(act(['m1'], { key: 'a' })).toBeNull()
    expect(act(['m1'], { key: 'Delete' })).toBeNull()
  })
})
