import { useWords } from '../text/words.ts'
import type { GateReason } from './hostGate.tsx'

/** A first request waiting on its confirm (`hostGate.tsx`). */
export interface Asking {
  reason: GateReason
  host: string
  /** A built-in's name, or null for a typed address. */
  provider: string | null
  go: () => void
}

/** The confirm, in section 13's words: what goes to `host`, and Cancel and Send or Continue. */
export function HostConfirm({ asking, onCancel, onGo }: { asking: Asking; onCancel: () => void; onGo: () => void }) {
  const w = useWords().assistant
  const { reason, host, provider } = asking
  const first = w.first[reason](host)
  return (
    <div className="assistant-card__confirm" role="alertdialog" aria-label={first} data-testid="assistant-first-request">
      <p>{first}</p>
      {/* A built-in's terms are named before a Send only; a typed address is always unknown. */}
      {!provider ? <p>{w.first.unknown}</p> : reason === 'send' && <p>{w.keeps(provider)}</p>}
      <div className="assistant-card__actions">
        <button type="button" className="assistant-card__button" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={onCancel}>
          {w.cancel}
        </button>
        <button
          type="button"
          className="assistant-card__button is-primary"
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onGo}
        >
          {reason === 'send' ? w.first.sendButton : w.first.continueButton}
        </button>
      </div>
    </div>
  )
}
