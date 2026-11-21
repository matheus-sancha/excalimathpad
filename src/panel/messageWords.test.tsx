import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { evaluateSheet } from '../math/evaluate.ts'
import { showLanguage } from '../text/words.ts'
import { ProblemsTab } from './SheetPanel.tsx'
import type { PanelElement } from './sheetPanel.ts'

/**
 * The Sheet panel words the engine's codes in the language shown (ADR 0007;
 * docs/spec-v1.md section 13, section 14, 0.6.0): a choice re-words the
 * Problems tab at once, from the same results.
 */

afterEach(() => showLanguage('en'))

function sheetOf(source: string): PanelElement[] {
  return [{ anchorId: 'a', title: null, lines: evaluateSheet([{ id: 'a', source }]).get('a')! }]
}

const messages = () => Array.from(document.querySelectorAll('.sheet-panel__message'), (row) => row.textContent)

describe('the Problems tab’s messages (section 13)', () => {
  it('words each error and warning in the language shown, and again on a change', () => {
    render(<ProblemsTab sheet={sheetOf('K = 1 m + 1 s\ny = x\nx = 2')} onJump={() => {}} />)
    expect(screen.getAllByText(/./, { selector: '.sheet-panel__message' })).toHaveLength(3)
    expect(messages()).toEqual(['Units do not match', 'K shadows the unit K', 'x is defined below'])

    act(() => showLanguage('pt-BR'))
    expect(messages()).toEqual(['As unidades não correspondem', 'K encobre a unidade K', 'x é definido abaixo'])
  })
})
