/**
 * The provider constants (docs/spec-v1.md section 14, 0.7.0): the four
 * built-in providers of the setup card, in its order (section 8, The setup
 * card), each with its name, its base URL, its adapter and its default model,
 * that model's retirement date and the date it was last checked. Every other
 * provider is an address the user types, through Chat Completions.
 *
 * The Release button reads `retires` and `checked` (section 12a, A default
 * model's retirement; `scripts/release-models.mjs`), so this file is plain
 * TypeScript with no import: Node runs it as it is.
 */
export interface Provider {
  id: ProviderId
  /** As the pick list shows it; a provider's name is the same in both languages. */
  name: string
  /** The base URL, exactly as the provider's documentation gives it. */
  address: string
  /** Anthropic's own Messages API, or Chat Completions. */
  adapter: AdapterId
  /** The model the card fills in. */
  defaultModel: string
  /** That model's retirement date as `YYYY-MM-DD`, or null when the provider has announced none. */
  retires: string | null
  /** The day the provider's deprecations page was last read for it, as `YYYY-MM-DD`. */
  checked: string
  /** Where `retires` is read. */
  deprecations: string
}

export type ProviderId = 'anthropic' | 'openai' | 'google' | 'openrouter'
export type AdapterId = 'messages' | 'chat'

export const PROVIDERS: readonly Provider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    address: 'https://api.anthropic.com',
    adapter: 'messages',
    defaultModel: 'claude-sonnet-5-5',
    // "Active", retiring "Not sooner than September 28, 2027": no date announced.
    retires: null,
    checked: '2026-11-22',
    deprecations: 'platform.claude.com/docs/en/about-claude/model-deprecations',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    address: 'https://api.openai.com/v1',
    adapter: 'chat',
    defaultModel: 'gpt-6.2-sol',
    retires: null,
    checked: '2026-11-22',
    deprecations: 'platform.openai.com/docs/deprecations',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    address: 'https://generativelanguage.googleapis.com/v1beta/openai',
    adapter: 'chat',
    defaultModel: 'gemini-4-hydrogen',
    // "No shutdown date announced".
    retires: null,
    checked: '2026-11-22',
    deprecations: 'ai.google.dev/gemini-api/docs/deprecations',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    address: 'https://openrouter.ai/api/v1',
    adapter: 'chat',
    // Sonnet 5.5 by OpenRouter's own name, read from its keyless GET /models on 2026-11-22
    // (canonical_slug anthropic/claude-sonnet-5.5-20260928, no expiration_date).
    defaultModel: 'anthropic/claude-sonnet-5.5',
    retires: null,
    checked: '2026-11-22',
    deprecations: 'openrouter.ai/api/v1/models (expiration_date), and Anthropic’s page',
  },
]
