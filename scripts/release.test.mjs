import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FILES } from './audit-plugin.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const workflow = read('.github/workflows/release.yml')

/** The checklist's items, as their text after `- [ ] `. */
const items = (text) => [...text.matchAll(/^- \[ \] (.+)$/gm)].map((match) => match[1])

describe('the Release button (docs/spec-v1.md section 12a, Releases)', () => {
  it('drafts a release with exactly the three files the audit checks', () => {
    const attached = [...workflow.matchAll(/dist-plugin\/([\w.]+)/g)].map((match) => match[1])
    expect(attached.sort()).toEqual([...FILES].sort())
    expect(workflow).toMatch(/gh release create "\$VERSION"[\s\S]*--draft/)
  })

  it('is a button with patch, minor or major, and may push to main', () => {
    expect(workflow).toMatch(/workflow_dispatch:/)
    expect(workflow).toMatch(/options: \[patch, minor, major\]/)
    expect(workflow).toMatch(/contents: write/)
    expect(workflow).toMatch(/HEAD:refs\/heads\/main/)
  })

  it('pushes only after npm run check, and drafts only after the push', () => {
    const at = (text) => workflow.indexOf(text)
    expect(at('npm version')).toBeGreaterThan(-1)
    expect(at('npm version')).toBeLessThan(at('npm run check'))
    expect(at('npm run check')).toBeLessThan(at('git push'))
    expect(at('git push')).toBeLessThan(at('gh release create'))
  })

  it("puts the checklist in the draft's body, the same list CONTRIBUTING.md keeps", () => {
    expect(workflow).toMatch(/--notes-file \.github\/release-checklist\.md/)
    const draft = items(read('.github/release-checklist.md'))
    expect(draft.length).toBeGreaterThanOrEqual(5)
    const contributing = read('CONTRIBUTING.md')
    // The Releasing section, up to the next heading of its level.
    const releasing = contributing.split('\n## Releasing\n')[1]?.split('\n## ')[0] ?? ''
    expect(items(releasing)).toEqual(draft)
  })

  it('never commits main.js', () => {
    expect(read('.gitignore')).toMatch(/^dist-plugin$/m)
    expect(workflow).not.toMatch(/git add/)
  })
})
