import { describe, expect, it } from 'vitest'
import { en } from '../text/en.ts'
import { ptBR } from '../text/ptBR.ts'
import { storeFormats } from '../math/lineForm.ts'
import { chipOf, firstWords } from './chips.ts'
import type { ListingMap } from './listing.ts'

/**
 * A reference as a chip (docs/spec-v1.md section 8, Math assistant, An answer; section 13's
 * words): its name in the panel's words, and what a press does after the sheet changed.
 */
const map: ListingMap = new Map([
  ['T1', { kind: 'text', textId: 'text-1', text: 'Pump sizing, rev B and more' }],
  ['E1', { kind: 'element', anchorId: 'a-1', title: 'Pipe flow' }],
  ['E1:3', { kind: 'line', anchorId: 'a-1', line: 2, text: 'Re = rho*v*D/mu' }],
  ['E2', { kind: 'element', anchorId: 'a-2', title: null }],
  ['E2:1', { kind: 'line', anchorId: 'a-2', line: 0, text: 'x = 1 @bold' }],
])
const now = {
  scene: {
    anchors: [
      { id: 'a-1', source: 'Q = 30 L/s\nv = Q / A\nRe = rho*v*D/mu' },
      { id: 'a-2', source: 'x = 1', formats: storeFormats(['@bold']) },
    ],
    texts: [{ id: 'text-1', text: 'Pump sizing, rev B and more' }],
  },
  names: new Map([
    ['a-1', 'Pipe flow'],
    ['a-2', 'Element 2'],
  ]),
}

describe('chipOf', () => {
  it('names a line, an element and a text as the panel does, and jumps', () => {
    expect(chipOf(map, 'E1:3', now, en)).toEqual({ state: 'jumps', name: 'Pipe flow, line 3', to: { id: 'a-1', line: 2 } })
    expect(chipOf(map, 'E2:1', now, en)).toEqual({ state: 'jumps', name: 'Element 2, line 1', to: { id: 'a-2', line: 0 } })
    expect(chipOf(map, 'E1', now, en)).toEqual({ state: 'jumps', name: 'Pipe flow', to: { id: 'a-1', line: null } })
    expect(chipOf(map, 'T1', now, en)).toEqual({ state: 'jumps', name: 'Pump sizing, rev B…', to: { id: 'text-1', line: null } })
  })

  it('names an element as it is now: a new title, or a new position', () => {
    const renamed = { ...now, names: new Map([['a-1', 'Flow in the pipe'], ['a-2', 'Element 1']]) }
    expect(chipOf(map, 'E1:3', renamed, en)?.name).toBe('Flow in the pipe, line 3')
    expect(chipOf(map, 'E2', renamed, en)?.name).toBe('Element 1')
  })

  it('says a changed line, and jumps to its element with no flash', () => {
    const edited = { ...now, scene: { ...now.scene, anchors: [{ id: 'a-1', source: 'Q = 30 L/s\nv = Q / A\nRe = rho*v*D/nu' }] } }
    expect(chipOf(map, 'E1:3', edited, en)).toEqual({ state: 'changed', name: 'Pipe flow, line 3 · changed', to: { id: 'a-1', line: null } })
    expect(chipOf(map, 'E1:3', edited, ptBR)?.name).toBe('Pipe flow, linha 3 · alterada')
    const retyped = { ...now, scene: { ...now.scene, texts: [{ id: 'text-1', text: 'Pump sizing, rev C' }] } }
    expect(chipOf(map, 'T1', retyped, ptBR)).toEqual({ state: 'changed', name: 'Pump sizing, rev C · alterado', to: { id: 'text-1', line: null } })
  })

  it('names what is gone as it was sent, and goes nowhere', () => {
    const gone = { scene: { anchors: [], texts: [] }, names: new Map<string, string>() }
    expect(chipOf(map, 'E1:3', gone, en)).toEqual({ state: 'gone', name: 'Pipe flow, line 3', to: null })
    expect(chipOf(map, 'E2', gone, ptBR)).toEqual({ state: 'gone', name: 'Bloco 2', to: null })
    expect(chipOf(map, 'T1', gone, en)).toEqual({ state: 'gone', name: 'Pump sizing, rev B…', to: null })
  })

  it('is plain text for a label in no map, or an answer to an empty sheet', () => {
    expect(chipOf(map, 'E9:1', now, en)).toBeNull()
    expect(chipOf(map, 'E1:4', now, en)).toBeNull()
    expect(chipOf(null, 'E1:3', now, en)).toBeNull()
  })
})

describe('firstWords', () => {
  it('names a text by its first four words, on one line', () => {
    expect(firstWords('Pump sizing')).toBe('Pump sizing')
    expect(firstWords('Pump\nsizing,  rev B, for the client')).toBe('Pump sizing, rev B,…')
    expect(firstWords('Supercalifragilisticexpialidocious-and-more-words')).toBe('Supercalifragilisticexpialidocio…')
  })
})
