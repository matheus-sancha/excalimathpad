import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const bytes = (path) => readFileSync(join(root, path)).length
const count = (n) => n.toLocaleString('en-US')

/**
 * `CONTEXT.md`'s budget in bytes: its size after the split into
 * `docs/context/` (33,957 B, #192) plus about 10% (docs/spec-v1.md section
 * 14, M4e, Documents). Every build session reads the file whole, so it holds
 * the model, the terms and where things are, and nothing else. If the growth
 * is meant, raise the budget in a commit that says what was added.
 */
export const CONTEXT_BUDGET = 37_000

/** The files a build session is routed through, and the history beside the spec. */
const modules = readdirSync(join(root, 'docs/context')).map((name) => `docs/context/${name}`)
const routed = ['CLAUDE.md', 'CONTEXT.md', 'docs/spec-v1.md', 'docs/spec-history.md', ...modules]

/** GitHub's anchor for a heading: lower case, punctuation dropped, spaces to hyphens. */
const slug = (heading) =>
  heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s/g, '-')

const anchors = (text) => {
  const seen = new Map()
  const all = new Set()
  for (const [, heading] of text.replace(/^```[\s\S]*?^```/gm, '').matchAll(/^#{1,6} (.+)$/gm)) {
    const base = slug(heading)
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    all.add(n === 0 ? base : `${base}-${n}`)
  }
  return all
}

/** Every relative link of a file as `[target path, anchor]`; links to sites are left out. */
const links = (path) =>
  [...read(path).matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => match[1])
    .filter((href) => !/^[a-z]+:/i.test(href))
    .map((href) => {
      const [file, anchor = ''] = href.split('#')
      const target = file === '' ? path : relative(root, resolve(root, dirname(path), file))
      return [target, anchor]
    })

describe('the documents a build session reads (docs/spec-v1.md section 14, M4e, Documents)', () => {
  it('keeps CONTEXT.md inside its budget', () => {
    const size = bytes('CONTEXT.md')
    const message =
      `CONTEXT.md is ${count(size)} bytes, over its budget of ${count(CONTEXT_BUDGET)}. ` +
      'Behaviour goes in the spec and a module\'s description in docs/context/. ' +
      'If the growth is meant, raise CONTEXT_BUDGET and say why.'
    expect(size <= CONTEXT_BUDGET, message).toBe(true)
  })

  it('has a tracked CLAUDE.md with the reading route and the writing rule', () => {
    const claude = read('CLAUDE.md')
    expect(claude).toMatch(/^## Reading route$/m)
    expect(claude).toMatch(/^## Writing rule$/m)
  })

  it('links every module file from CONTEXT.md and from CLAUDE.md', () => {
    expect(modules.length).toBeGreaterThan(0)
    for (const path of ['CONTEXT.md', 'CLAUDE.md']) {
      const linked = new Set(links(path).map(([target]) => target))
      expect(modules.filter((file) => !linked.has(file)), path).toEqual([])
    }
  })

  it('keeps the spec at its path with every numbered section, so citations by number hold', () => {
    const numbers = [...read('docs/spec-v1.md').matchAll(/^## (\d+a?)\. /gm)].map((m) => m[1])
    const expected = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '12a']
    expect(numbers).toEqual([...expected, '13', '14', '15', '16', '17', '18'])
    expect(read('docs/spec-v1.md')).toMatch(/^### The finish line$/m)
  })

  it('lands every link between these documents on a file and a heading', () => {
    const known = new Map()
    const broken = []
    for (const path of routed) {
      for (const [target, anchor] of links(path)) {
        if (!existsSync(join(root, target))) broken.push(`${path}: ${target} is missing`)
        else if (anchor !== '' && target.endsWith('.md')) {
          if (!known.has(target)) known.set(target, anchors(read(target)))
          if (!known.get(target).has(anchor)) broken.push(`${path}: no heading for ${target}#${anchor}`)
        }
      }
    }
    expect(broken).toEqual([])
  })
})
