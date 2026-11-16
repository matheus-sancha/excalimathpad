import { describe, expect, it } from 'vitest'
import { appStyles, paperNotice } from '../print.ts'

/**
 * Print… in a vault (docs/spec-v1.md section 11, Changed on 2026-11-16, and
 * section 13, In a vault): the paper's notice and the styles the frame gets.
 * The frame itself, its fonts and its dialog run in Chromium (the print run
 * and the pop-out run): jsdom lays nothing out and prints nothing.
 */

describe('the notice before the dialog (section 13, In a vault)', () => {
  it('names the paper of the sheet’s Page setting, in sentence case', () => {
    expect(paperNotice({ size: 'A4', orientation: 'portrait' })).toBe('Choose A4, portrait in the print dialog.')
    expect(paperNotice({ size: 'Letter', orientation: 'landscape' })).toBe('Choose Letter, landscape in the print dialog.')
  })
})

/** A rule as the browser gives it: a layer block is told by its constructor's name. */
class CSSLayerBlockRule {
  readonly name: string
  readonly cssText: string
  constructor(name: string, cssText: string) {
    this.name = name
    this.cssText = cssText
  }
}
class CSSStyleRule {
  readonly cssText: string
  constructor(cssText: string) {
    this.cssText = cssText
  }
}

const docWith = (sheets: (readonly object[] | 'unreadable')[]) =>
  ({
    styleSheets: sheets.map((rules) =>
      rules === 'unreadable'
        ? {
            get cssRules(): never {
              throw new DOMException('cross-origin', 'SecurityError')
            },
          }
        : { cssRules: rules },
    ),
  }) as unknown as Document

describe('the frame’s styles: the app’s own sheets only', () => {
  it('takes each sheet holding the app’s cascade layer, whole, and leaves Obsidian’s and a theme’s', () => {
    const doc = docWith([
      [new CSSStyleRule('body { background: red; }'), new CSSStyleRule('@media print { .app-container { display: none; } }')],
      'unreadable',
      [new CSSLayerBlockRule('excalimathpad', '@layer excalimathpad { .math-element { color: black; } }'), new CSSStyleRule('.excalimathpad-view { padding: 0; }')],
      [new CSSLayerBlockRule('theme', '@layer theme { a { color: blue; } }')],
    ])
    expect(appStyles(doc)).toEqual([
      '@layer excalimathpad { .math-element { color: black; } }\n.excalimathpad-view { padding: 0; }',
    ])
  })
})
