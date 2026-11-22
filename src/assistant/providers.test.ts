import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PROVIDERS } from './providers.ts'

/** The provider constants (docs/spec-v1.md section 8, The setup card; section 14, 0.7.0; section 12a). */
describe('the built-in providers', () => {
  it('are the four of the setup card, in its order, each with its address, adapter and default model', () => {
    expect(PROVIDERS.map(({ name, address, adapter, defaultModel }) => [name, address, adapter, defaultModel])).toEqual([
      ['Anthropic', 'https://api.anthropic.com', 'messages', 'claude-sonnet-5-5'],
      ['OpenAI', 'https://api.openai.com/v1', 'chat', 'gpt-6.2-sol'],
      ['Google Gemini', 'https://generativelanguage.googleapis.com/v1beta/openai', 'chat', 'gemini-4-hydrogen'],
      // OpenRouter's own name for Sonnet 5.5, read from its keyless model list (#309).
      ['OpenRouter', 'https://openrouter.ai/api/v1', 'chat', 'anthropic/claude-sonnet-5.5'],
    ])
  })

  it('each has its own id, and an https address with no user, password, query or closing slash', () => {
    expect(new Set(PROVIDERS.map(({ id }) => id)).size).toBe(PROVIDERS.length)
    for (const { address } of PROVIDERS) {
      const url = new URL(address)
      expect(url.protocol, address).toBe('https:')
      expect(url.username + url.password + url.search + url.hash, address).toBe('')
      expect(address.endsWith('/'), address).toBe(false)
    }
  })

  it('each default has a retirement date or none, and the day it was last checked, as real dates', () => {
    const day = /^\d{4}-\d\d-\d\d$/
    for (const { id, retires, checked, deprecations } of PROVIDERS) {
      expect(checked, id).toMatch(day)
      expect(new Date(`${checked}T00:00:00Z`).toISOString().slice(0, 10), id).toBe(checked)
      if (retires !== null) expect(retires, id).toMatch(day)
      // Plain text, so the bundle names each provider's https:// address once (section 12a).
      expect(deprecations, id).not.toMatch(/https?:/)
    }
  })

  it("are exactly the allowlist's reached hosts, in either direction", () => {
    const allowlist = JSON.parse(readFileSync('scripts/plugin-allowlist.json', 'utf8')) as {
      reached: Record<string, string>
    }
    const reached = Object.keys(allowlist.reached).filter((host) => !host.startsWith('$'))
    expect(reached.sort()).toEqual(PROVIDERS.map(({ address }) => new URL(address).host).sort())
    for (const host of reached) expect(allowlist.reached[host], host).toMatch(/^Math assistant, built-in provider: /)
  })
})
