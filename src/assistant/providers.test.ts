import { describe, expect, it } from 'vitest'
import { PROVIDERS } from './providers.ts'

/** The provider constants (docs/spec-v1.md section 8, The setup card; section 14, 0.7.0). */
describe('the built-in providers', () => {
  it('are the four of the setup card, in its order, each with its address and default model', () => {
    expect(PROVIDERS.map(({ name, address, defaultModel }) => [name, address, defaultModel])).toEqual([
      ['Anthropic', 'https://api.anthropic.com', 'claude-sonnet-5-5'],
      ['OpenAI', 'https://api.openai.com/v1', 'gpt-6.2-sol'],
      ['Google Gemini', 'https://generativelanguage.googleapis.com/v1beta/openai', 'gemini-4-hydrogen'],
      // OpenRouter's own name for Sonnet 5.5 is read from its model list by #309.
      ['OpenRouter', 'https://openrouter.ai/api/v1', null],
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
})
