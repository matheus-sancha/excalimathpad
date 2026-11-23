import { describe, expect, it } from 'vitest'
import { readAnswer, type Block, type Inline } from './markdown.ts'

/**
 * The chat's small Markdown (docs/spec-v1.md section 8, Math assistant, An answer; section
 * 14, 0.7.0): paragraphs, lists, bold, inline code, code blocks and references, and nothing
 * else. What it never makes (an image, a link, a frame, a style) is held where it is drawn,
 * in `AnswerText.test.tsx`; here, what it reads and how it reads an answer as it arrives.
 */
const text = (value: string): Inline => ({ kind: 'text', text: value })
const para = (...lines: Inline[][]): Block => ({ kind: 'paragraph', lines })

/** The blocks' kinds and their plain text, for the tests that don't need every part. */
function plain(inlines: readonly Inline[]): string {
  return inlines
    .map((part) => (part.kind === 'bold' ? `**${plain(part.parts)}**` : part.kind === 'code' ? `\`${part.text}\`` : part.kind === 'ref' ? `<${part.label}>` : part.text))
    .join('')
}
function shape(blocks: readonly Block[], line: (inlines: readonly Inline[]) => string = plain): string[] {
  return blocks.map((block) => {
    if (block.kind === 'paragraph') return `p: ${block.lines.map(line).join(' / ')}`
    if (block.kind === 'code') return `code: ${block.lines.join(' / ')}`
    return `${block.ordered ? `ol ${block.start}` : 'ul'}: ${block.items.map((item) => item.map(line).join(' / ')).join(' | ')}`
  })
}

/**
 * Each character with what it is drawn as: a bold or a code character carries its own mark,
 * and a reference is one token. A part of an answer read this way is a start of the whole
 * one's only if nothing in it was drawn as something else.
 */
function tagged(inlines: readonly Inline[]): string {
  return inlines
    .map((part) =>
      part.kind === 'ref'
        ? `\u0003${part.label}\u0003`
        : part.kind === 'bold'
          ? [...tagged(part.parts)].map((c) => `\u0001${c}`).join('')
          : part.kind === 'code'
            ? [...part.text].map((c) => `\u0002${c}`).join('')
            : part.text,
    )
    .join('')
}

describe('readAnswer', () => {
  it('reads paragraphs, keeping a line break inside one', () => {
    expect(readAnswer('First line\nsecond line\n\nNext paragraph.', false)).toEqual([
      para([text('First line')], [text('second line')]),
      para([text('Next paragraph.')]),
    ])
  })

  it('reads bold, inline code and references inside a line', () => {
    expect(readAnswer('**Units** in `v = Q / A` at [E2:3], see [E2] and [T1].', false)).toEqual([
      para([
        { kind: 'bold', parts: [text('Units')] },
        text(' in '),
        { kind: 'code', text: 'v = Q / A' },
        text(' at '),
        { kind: 'ref', label: 'E2:3' },
        text(', see '),
        { kind: 'ref', label: 'E2' },
        text(' and '),
        { kind: 'ref', label: 'T1' },
        text('.'),
      ]),
    ])
  })

  it('reads a reference inside bold, and none inside code', () => {
    expect(shape(readAnswer('**Check [E1:4]** and `[E1:4]`', false))).toEqual(['p: **Check <E1:4>** and `[E1:4]`'])
  })

  it('reads lists, ordered from their first number, with an item running on over lines', () => {
    expect(shape(readAnswer('- one\n- two\n  still two\n\n3. three\n4. four', false))).toEqual([
      'ul: one | two / still two',
      'ol 3: three | four',
    ])
  })

  it('keeps one list across blank lines between its items', () => {
    expect(shape(readAnswer('1. first\n\n2. second\n\n3. third', false))).toEqual(['ol 1: first | second | third'])
  })

  it('keeps a nested item inside its item, as its own line with its mark', () => {
    expect(shape(readAnswer('1. **Units**\n   - Q is in L/s\n2. Next', false))).toEqual(['ol 1: **Units** / - Q is in L/s | Next'])
  })

  it('reads a code block as its lines, unread, whatever its info string', () => {
    expect(readAnswer('Try:\n```text\nQ = 25 L/s  # **not bold** [E1:1]\n\nv = Q / A\n```\nDone.', false)).toEqual([
      para([text('Try:')]),
      { kind: 'code', lines: ['Q = 25 L/s  # **not bold** [E1:1]', '', 'v = Q / A'] },
      para([text('Done.')]),
    ])
  })

  it('reads a block that never closes as code to the end', () => {
    expect(shape(readAnswer('```\nQ = 1 m', false))).toEqual(['code: Q = 1 m'])
  })

  it('shows a heading, a table, a quote and a rule as plain text', () => {
    expect(shape(readAnswer('## Findings\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n> quoted\n\n---', false))).toEqual([
      'p: ## Findings',
      'p: | a | b | / |---|---| / | 1 | 2 |',
      'p: > quoted',
      'p: ---',
    ])
  })

  it('shows a link as its text and an image as its words, and keeps every other mark as text', () => {
    expect(shape(readAnswer('See [the guide](https://example.com/x) or ![a plot](https://example.com/p.png).', false))).toEqual([
      'p: See the guide or a plot.',
    ])
    expect(shape(readAnswer('<img src=x onerror=alert(1)> <https://example.com> *italic* [E2:3](https://x.y)', false))).toEqual([
      'p: <img src=x onerror=alert(1)> <https://example.com> *italic* E2:3',
    ])
  })

  it('reads a label it does not know the form of as text', () => {
    expect(shape(readAnswer('[E2:3-5], [e2], [E], [T1:2], [X3]', false))).toEqual(['p: [E2:3-5], [e2], [E], [T1:2], [X3]'])
  })

  it('keeps an unclosed mark as text once the answer has ended', () => {
    expect(shape(readAnswer('a **b and `c', false))).toEqual(['p: a **b and `c'])
  })

  it('takes a backslash before a mark as that mark', () => {
    expect(shape(readAnswer('\\*\\*not bold\\*\\* \\[E1\\]', false))).toEqual(['p: **not bold** [E1]'])
  })

  it('reads Windows line ends as line ends', () => {
    expect(shape(readAnswer('- a\r\n- b\r\n', false))).toEqual(['ul: a | b'])
  })
})

describe('readAnswer, as an answer arrives', () => {
  const answer = [
    'You asked me to **check** the sheet.',
    '',
    '1. The velocity at [E1:2] uses `A`, which [E1] never defines.',
    '2. The text [T1] says rev B.',
    '',
    '10. A tenth point, to cut its number.',
    '',
    '- A list of **two**',
    '- items',
    '',
    'Suggested lines:',
    '```',
    'A = pi * D^2 / 4',
    '```',
    'That is all.',
  ].join('\n')

  /**
   * Each block of a part read is the same block in the whole answer, or the one still being
   * written: the same kind, and its text a start of the whole one's. So nothing turns into
   * something else, and a list never breaks, at any point the answer is cut.
   */
  it('never draws a block that the rest of the answer turns into something else', () => {
    const whole = shape(readAnswer(answer, false), tagged)
    for (let cut = 0; cut <= answer.length; cut++) {
      const part = shape(readAnswer(answer.slice(0, cut), true), tagged)
      expect(part.length, `cut at ${cut}`).toBeLessThanOrEqual(whole.length)
      part.forEach((block, index) => {
        const last = index === part.length - 1
        if (last) expect(whole[index].startsWith(block), `cut at ${cut}: "${block}" in "${whole[index]}"`).toBe(true)
        else expect(block, `cut at ${cut}`).toBe(whole[index])
      })
    }
  })

  it('draws an unclosed bold or code as it is written', () => {
    expect(shape(readAnswer('a **bol', true))).toEqual(['p: a **bol**'])
    expect(shape(readAnswer('a `v = Q', true))).toEqual(['p: a `v = Q`'])
  })

  it('holds back a label, a link or a line mark until it is whole', () => {
    expect(shape(readAnswer('see [E1:', true))).toEqual(['p: see '])
    expect(shape(readAnswer('see [the guide](https://exa', true))).toEqual(['p: see '])
    expect(shape(readAnswer('- a\n- b\n1', true))).toEqual(['ul: a | b'])
    expect(shape(readAnswer('text\n``', true))).toEqual(['p: text'])
    expect(shape(readAnswer('a **b*', true))).toEqual(['p: a **b**'])
    expect(shape(readAnswer('Done!', true))).toEqual(['p: Done'])
    expect(shape(readAnswer('Done!', false))).toEqual(['p: Done!'])
  })
})
