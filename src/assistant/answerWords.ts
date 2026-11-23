import type { Words } from '../text/words.ts'
import type { Answer } from './conversation.ts'
import type { Setup } from './setup.ts'
import { builtInOf, hostOfSetup, providerOf } from './sheet.ts'

/** After this long with nothing arriving, the waiting line adds its hint (section 8). Nothing is cancelled. */
export const QUIET_MS = 30_000

/** A failed answer said in section 13's words, then the provider's own words where there are some. */
export function failureLines(answer: Answer, setup: Setup, w: Words['assistant'], online: boolean): string[] {
  const { failure, check } = answer
  const host = hostOfSetup(setup)
  const provider = providerOf(setup)
  if (!failure) return []
  switch (failure.kind) {
    case 'nothing':
      if (check?.kind === 'accepted') return [w.accepted(host)]
      if (check?.kind === 'refused') return [w.refusedKey(host), w.said(provider, check.said)]
      if (check?.kind === 'nothing') return [w.noAnswerAgain(host, window.location.origin)]
      if (check?.kind === 'other') return [w.said(provider, check.said)]
      return [online ? w.noAnswer(host) : w.offline]
    case 'refusedKey':
      return [w.refusedKey(host), w.said(provider, failure.said)]
    case 'unknownModel': {
      const retired = builtInOf(setup)?.defaultModel === setup.model
      return [retired ? w.retired(provider) : w.unknownModel(provider, setup.model), w.said(provider, failure.said)]
    }
    case 'noCredit':
      return [w.noCredit, ...(setup.provider === 'anthropic' ? [w.noCreditAnthropic] : []), w.said(provider, failure.said)]
    case 'other':
      return [w.said(provider, failure.said)]
  }
}
