/**
 * The typed address's check (docs/spec-v1.md section 8, The setup card,
 * Address; section 14, 0.7.0): a base URL the user types for a provider that
 * isn't built in. Pure. Save refuses, with section 13's reason: a value that
 * isn't a URL; anything but `https:`, or `http:` on this computer; a user
 * name or a password in the address.
 */
export type AddressCheck =
  | { ok: true; /** The address, trimmed, as it is kept. */ address: string; /** Its host, with its port when it names one. */ host: string }
  | { ok: false; reason: AddressRefusal }

export type AddressRefusal = 'notUrl' | 'notHttps' | 'credentials'

/** The hosts that are this computer: plain `http` is allowed on these only. */
const THIS_COMPUTER = ['localhost', '127.0.0.1', '[::1]']

export function checkAddress(typed: string): AddressCheck {
  const address = typed.trim()
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return { ok: false, reason: 'notUrl' }
  }
  const local = url.protocol === 'http:' && THIS_COMPUTER.includes(url.hostname)
  if (url.protocol !== 'https:' && !local) return { ok: false, reason: 'notHttps' }
  if (!url.host) return { ok: false, reason: 'notUrl' }
  if (url.username || url.password) return { ok: false, reason: 'credentials' }
  return { ok: true, address, host: url.host }
}

/** The host of an address that passes the check, or null: what the card's lines name as `<host>`. */
export function hostOf(address: string): string | null {
  const check = checkAddress(address)
  return check.ok ? check.host : null
}
