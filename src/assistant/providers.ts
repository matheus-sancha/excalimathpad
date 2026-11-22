/**
 * The provider constants (docs/spec-v1.md section 14, 0.7.0): the four
 * built-in providers of the setup card, in its order (section 8, The setup
 * card), each with its name, its base URL and its default model. Every other
 * provider is an address the user types.
 */
export interface Provider {
  id: ProviderId
  /** As the pick list shows it; a provider's name is the same in both languages. */
  name: string
  /** The base URL, exactly as the provider's documentation gives it. */
  address: string
  /** The model the card fills in; null until the issue that reads the provider's own name for it. */
  defaultModel: string | null
}

export type ProviderId = 'anthropic' | 'openai' | 'google' | 'openrouter'

export const PROVIDERS: readonly Provider[] = [
  { id: 'anthropic', name: 'Anthropic', address: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-5-5' },
  { id: 'openai', name: 'OpenAI', address: 'https://api.openai.com/v1', defaultModel: 'gpt-6.2-sol' },
  {
    id: 'google',
    name: 'Google Gemini',
    address: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-4-hydrogen',
  },
  // Sonnet 5.5 by OpenRouter's own name for it, read from its keyless model list (#309).
  { id: 'openrouter', name: 'OpenRouter', address: 'https://openrouter.ai/api/v1', defaultModel: null },
]
