import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PROVIDERS } from '../src/assistant/providers.ts'
import { refusals } from './release-models.mjs'

/** A default model's retirement (docs/spec-v1.md section 12a, Releases; 0.7.0), with fixed dates. */
const one = (fields) => [
  { name: 'Anthropic', defaultModel: 'claude-sonnet-5-5', retires: null, checked: '2026-11-22', deprecations: 'its page', ...fields },
]

describe('the Release button refuses a release near a default model’s retirement', () => {
  it('lets a release go with no retirement announced, checked 180 days ago at most', () => {
    expect(refusals(one({}), '2026-11-22')).toEqual([])
    expect(refusals(one({}), '2027-05-21')).toEqual([]) // 180 days after 2026-11-22
    expect(refusals(one({ retires: '2027-03-01' }), '2026-11-30')).toEqual([]) // 91 days before
  })

  it('refuses within 90 days of a known retirement date, naming the model and what to do', () => {
    const [line, ...rest] = refusals(one({ retires: '2027-03-01' }), '2026-12-01') // 90 days before
    expect(rest).toEqual([])
    expect(line).toContain('claude-sonnet-5-5')
    expect(line).toContain('retires on 2027-03-01, 90 days from 2026-12-01')
    expect(line).toContain('Choose another default in src/assistant/providers.ts')
    expect(refusals(one({ retires: '2027-03-01' }), '2027-04-01')).toHaveLength(1) // already retired
  })

  it('refuses when a default was last checked more than 180 days ago', () => {
    const [line] = refusals(one({}), '2027-05-22')
    expect(line).toContain('claude-sonnet-5-5, was last checked on 2026-11-22, 181 days ago')
    expect(line).toContain('Read its page, and update its line in src/assistant/providers.ts, the date included.')
  })

  it("reads the real constants, which pass today's check on the day they were checked", () => {
    for (const { checked } of PROVIDERS) expect(refusals(PROVIDERS, checked)).toEqual([])
  })

  it('is a step of the Release button only, before the version is bumped; npm run check never runs it', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8')
    const at = (text) => workflow.indexOf(text)
    expect(at('node scripts/release-models.mjs')).toBeGreaterThan(-1)
    expect(at('node scripts/release-models.mjs')).toBeLessThan(at('npm version "$BUMP"'))
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(Object.values(pkg.scripts).join(' ')).not.toContain('release-models')
    expect(readFileSync('.github/workflows/ci.yml', 'utf8')).not.toContain('release-models')
  })
})
