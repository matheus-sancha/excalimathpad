import { describe, expect, it } from 'vitest'
import { guideModule, guideTree, slug, type GuideNode } from './markdown.ts'

/** The text a tree holds, its marks set aside. */
const text = (nodes: readonly GuideNode[]): string =>
  nodes.map((node) => (typeof node === 'string' ? node : text(node.children))).join('')

describe('the Math guide’s Markdown, turned into elements at build time (section 8, Math guide)', () => {
  it('gives each heading the anchor GitHub gives it, behind the dialog’s prefix', () => {
    expect(slug('1. A first sheet')).toBe('1-a-first-sheet')
    expect(slug('13. The Symbols tab')).toBe('13-the-symbols-tab')
    const [h1, h2] = guideTree('# Math guide\n\n## 1. A first sheet\n')
    expect(h1).toEqual({ tag: 'h1', attrs: { id: 'math-guide-math-guide' }, children: ['Math guide'] })
    expect(h2).toMatchObject({ tag: 'h2', attrs: { id: 'math-guide-1-a-first-sheet' } })
  })

  it('reads paragraphs, lists, code, bold, italic and the guide’s own links', () => {
    const tree = guideTree(
      [
        '## Units',
        '',
        'Write `15 L/s`, then **press `Enter`** and see *the result*.',
        'A second line of the same paragraph.',
        '',
        '- one, see [Units](#units)',
        '  carried on',
        '- two',
        '',
        '1. first',
        '2. second',
      ].join('\n'),
    )
    expect(tree.map((node) => (typeof node === 'string' ? node : node.tag))).toEqual(['h2', 'p', 'ul', 'ol'])
    const paragraph = tree[1] as Exclude<GuideNode, string>
    expect(paragraph.children).toEqual([
      'Write ',
      { tag: 'code', children: ['15 L/s'] },
      ', then ',
      { tag: 'strong', children: ['press ', { tag: 'code', children: ['Enter'] }] },
      ' and see ',
      { tag: 'em', children: ['the result'] },
      '. A second line of the same paragraph.',
    ])
    const list = tree[2] as Exclude<GuideNode, string>
    expect(text(list.children.slice(0, 1))).toBe('one, see Units carried on')
    expect(JSON.stringify(list)).toContain('{"tag":"a","attrs":{"href":"#units"},"children":["Units"]}')
  })

  it('leaves code alone: no mark inside it, and a code block keeps its lines', () => {
    const [p, pre] = guideTree('`2 * pi * r` and `**x**`\n\n```sheet\nU = I * R   → 20 V\n  x = 1\n```\n')
    expect(text([p])).toBe('2 * pi * r and **x**')
    expect(pre).toEqual({
      tag: 'pre',
      attrs: { 'data-info': 'sheet' },
      children: [{ tag: 'code', children: ['U = I * R   → 20 V\n  x = 1'] }],
    })
  })

  it('reads a table, with `\\|` for a pipe inside a cell', () => {
    const [table] = guideTree('| Write | Shows |\n|---|---|\n| `abs(x)` | \\|x\\| |\n')
    expect(JSON.stringify(table)).toContain('"tag":"th","children":["Write"]')
    expect(text([table])).toBe('WriteShowsabs(x)|x|')
  })

  it('refuses a link outside the guide, and what the dialog can’t show', () => {
    expect(() => guideTree('See [the spec](spec-v1.md).')).toThrow(/line 1: the link to "spec-v1.md"/)
    expect(() => guideTree('See [nowhere](#nowhere).')).toThrow(/isn't to one of the guide's headings/)
    expect(() => guideTree('Open https://example.com')).toThrow(/links to no file or site/)
    expect(() => guideTree('<b>bold</b>')).toThrow(/no HTML/)
    expect(() => guideTree('#### Deep')).toThrow(/down to ###/)
    expect(() => guideTree('```\ncode\n```')).toThrow(/info string/)
    expect(() => guideTree('| a | b |\n|---|---|\n| 1 |\n')).toThrow(/line 3: a row has 1 cells/)
  })

  it('hands the app the tree as a module', () => {
    expect(guideModule('# Math guide\n')).toBe(
      'export default [{"tag":"h1","attrs":{"id":"math-guide-math-guide"},"children":["Math guide"]}]\n',
    )
  })
})
