import { useState } from 'react'
import { hostOf } from './address.ts'
import { HostConfirm, type Asking } from './HostConfirm.tsx'
import { PROVIDERS } from './providers.ts'

/**
 * The first request to a host this device hasn't confirmed asks once (docs/spec-v1.md
 * section 12a, Data protection: "To the one host"; section 13's words), whichever of Send,
 * Show models or Check key made it, the four built-ins included. Cancel sends nothing and the
 * host isn't confirmed; Send or Continue confirms it and makes the request.
 */
export type GateReason = 'send' | 'models' | 'check'

/** Where a request would go: the setup's, or the card's fields before Save. */
export interface GateTarget {
  provider: string
  address: string
  /** The hosts this device has confirmed. */
  hosts: readonly string[]
}

/**
 * The gate: `ask` runs `go` at once for a confirmed host, and otherwise shows the confirm,
 * which runs it on Send or Continue after `confirmed` keeps the host. `prompt` is the confirm
 * to draw, or null.
 */
export function useHostGate(confirmed: (host: string) => void) {
  const [asking, setAsking] = useState<Asking | null>(null)
  const ask = (reason: GateReason, target: GateTarget, go: () => void) => {
    const host = hostOf(target.address) ?? target.address
    if (target.hosts.includes(host)) return go()
    const builtIn = PROVIDERS.find(({ id }) => id === target.provider)
    setAsking({ reason, host, provider: builtIn?.name ?? null, go })
  }
  const prompt = asking && (
    <HostConfirm
      asking={asking}
      onCancel={() => setAsking(null)}
      onGo={() => {
        setAsking(null)
        confirmed(asking.host)
        asking.go()
      }}
    />
  )
  return { ask, prompt, asking: asking !== null }
}
