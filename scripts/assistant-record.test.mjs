import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { scrub } from './assistant-record.mjs'

/** `npm run assistant:record` (docs/spec-v1.md section 14, 0.7.0, Fixtures). */
describe('assistant:record', () => {
  it('takes the key and account ids out of an answer', () => {
    const key = 'sk-ant-api03-recordingtestkey0123456789'
    const answer = `{"id":"msg_01AbCdEfGhIjKlMn","request_id":"req_011CSHoEeqs5C35K2UUqR7Fy","organization":"org-AbCdEf123456","system_fingerprint":"fp_44709d6fcb","error":{"message":"bad ${key}"}}`
    const out = scrub(answer, key)
    expect(out).not.toContain(key)
    expect(out).toBe(
      '{"id":"msg_recorded","request_id":"req_recorded","organization":"recorded","system_fingerprint":"fp_recorded","error":{"message":"bad [the key]"}}',
    )
  })

  it('is never run in CI, and no key is in a workflow', () => {
    expect(() =>
      execFileSync('node', ['scripts/assistant-record.mjs'], { env: { ...process.env, CI: 'true' }, stdio: 'pipe' }),
    ).toThrow(/never run in CI/)
    for (const file of readdirSync('.github/workflows'))
      expect(readFileSync(`.github/workflows/${file}`, 'utf8'), file).not.toMatch(/assistant:record|assistant-record|ASSISTANT_KEY/)
    const check = JSON.parse(readFileSync('package.json', 'utf8')).scripts.check
    expect(check).not.toContain('assistant:record')
  })
})
