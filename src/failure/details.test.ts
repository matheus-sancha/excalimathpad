import { describe, expect, it } from 'vitest'
import { failureDetails, failureOf, FAILURE_MESSAGES, scrub, sheetWords, type FailureHome } from './details.ts'

const WEB: FailureHome = { version: '0.3.0', stamp: 'abc1234 · 2026-11-16', home: 'web', device: null }
const PLUGIN: FailureHome = { version: '0.3.0', stamp: '0.3.0', home: 'Obsidian plugin', device: 'tablet' }

describe('failureOf', () => {
  it('keeps an error as its name and message, and its stack', () => {
    const error = new TypeError('no such thing')
    expect(failureOf(error)).toEqual({ text: 'TypeError: no such thing', stack: error.stack })
  })

  it('keeps anything else thrown as its text', () => {
    expect(failureOf('just a string')).toEqual({ text: 'just a string', stack: '' })
  })
})

describe('failureDetails (docs/spec-v1.md section 4, Copy details)', () => {
  const failure = {
    text: 'TypeError: Unexpected type of argument',
    stack: 'TypeError: Unexpected type of argument\n    at systemUnit (display.ts:106:12)\n    at variablesOf (evaluate.ts:900:3)\n',
  }

  it('says the version and build stamp, the home, what failed and the error with its stack', () => {
    expect(failureDetails('view', failure, WEB, []).split('\n')).toEqual([
      'Excalimathpad 0.3.0 (abc1234 · 2026-11-16)',
      'web',
      'What failed: the view',
      'TypeError: Unexpected type of argument',
      '    at systemUnit (display.ts:106:12)',
      '    at variablesOf (evaluate.ts:900:3)',
      FAILURE_MESSAGES.noContent,
    ])
  })

  it('says the plugin’s device, and its version once: the plugin’s stamp is its version', () => {
    expect(failureDetails('chart', failure, PLUGIN, []).split('\n').slice(0, 3)).toEqual([
      'Excalimathpad 0.3.0',
      'Obsidian plugin, tablet',
      'What failed: a chart',
    ])
  })

  it.each([
    ['line', 'a line'],
    ['element', 'an element'],
    ['tab', 'a tab'],
  ] as const)('names a failed %s', (what, said) => {
    expect(failureDetails(what, failure, WEB, [])).toContain(`What failed: ${said}`)
  })

  it('cuts the sheet’s words out of the error, and leaves the stack’s frames whole', () => {
    const leaky = {
      text: 'Error: Undefined symbol zone_x in zone_x = r_t cos(theta) i',
      stack: 'Error: Undefined symbol zone_x in zone_x = r_t cos(theta) i\n    at theta (evaluate.ts:1:1)',
    }
    const words = sheetWords([{ source: 'r_t = 0.125 mm\nzone_x = r_t cos(theta) i', lines: [] }])
    const details = failureDetails('line', leaky, WEB, words)
    expect(details).toContain('Error: Undefined symbol … in …')
    expect(details).not.toContain('zone_x')
    expect(details).not.toContain('r_t')
    expect(details).toContain('    at theta (evaluate.ts:1:1)')
  })

  it('keeps a stack whose first line isn’t the message (Firefox, Safari)', () => {
    const details = failureDetails('view', { text: 'Error: x', stack: 'render@app.js:1:2\ncommit@app.js:3:4' }, WEB, [])
    expect(details).toContain('Error: x\nrender@app.js:1:2\ncommit@app.js:3:4\n')
  })
})

describe('sheetWords', () => {
  it('holds every line and title, their words and numbers, each name and each shown value', () => {
    const words = sheetWords(
      [
        {
          title: 'Pump duty',
          source: 'Q = 12.5 L/s\nhead = 3 m # at the inlet',
          lines: [
            { result: { kind: 'empty' }, variables: [{ name: 'Q', text: '0.0125 m^3 / s' }] },
            { result: { kind: 'value', text: '3 m' }, variables: [{ name: 'head', text: '3 m' }] },
          ],
        },
      ],
      'dp = rho g head',
    )
    for (const word of ['Pump duty', 'Pump', 'duty', 'Q = 12.5 L/s', '12.5', 'head', 'inlet', '0.0125 m^3 / s', '3 m', 'dp = rho g head', 'rho']) {
      expect(words).toContain(word)
    }
  })

  it('holds the stored formats too: a rule’s condition is the sheet’s text (M4e)', () => {
    const words = sheetWords([{ source: 'sigma = 120 MPa', formats: '@text-red if sigma > limit_stress', lines: [] }])
    expect(words).toEqual(expect.arrayContaining(['@text-red if sigma > limit_stress', 'limit_stress', 'sigma']))
  })

  it('leaves out a one-letter name and other text under three characters', () => {
    const words = sheetWords([{ source: 'a = 2\nab = 7', lines: [{ result: { kind: 'value', text: '2' }, variables: [{ name: 'a', text: '2' }, { name: 'ab' }] }] }])
    expect(words).not.toContain('a')
    expect(words).not.toContain('2')
    expect(words).toContain('ab')
    expect(words).toContain('a = 2')
  })
})

describe('scrub', () => {
  it('replaces whole words only, longest first', () => {
    expect(scrub('error in or, at flow_rate and flow', ['or', 'flow', 'flow_rate'])).toBe('error in …, at … and …')
  })

  it('replaces text that starts or ends with a sign wherever it is', () => {
    expect(scrub('cannot show (a+b)*2', ['(a+b)'])).toBe('cannot show …*2')
  })

  it('replaces every occurrence', () => {
    expect(scrub('abc, abc and abc', ['abc'])).toBe('…, … and …')
  })
})
