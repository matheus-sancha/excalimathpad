import { checkAddress } from './address.ts'
import type { SetupStore } from './ports.ts'
import { PROVIDERS, type ProviderId } from './providers.ts'

/**
 * The setup (docs/spec-v1.md section 8, The setup card): one record per
 * device, never synced and never in a sheet. A home's store keeps it as text
 * (`ports.ts`); this file is the only one that knows its fields.
 *
 * The key is never logged, thrown or shown (section 14, 0.7.0): it leaves this
 * file only inside the record's text, on its way to the store, and as the
 * setup a request is later made from.
 */
export interface Setup {
  /** A built-in's id, or `other` for a typed address. */
  provider: ProviderId | 'other'
  /** The base URL: a built-in's own, or the typed one, which passed `checkAddress`. */
  address: string
  model: string
  /** May be empty: a typed address can need none, and Remove forgets it alone. */
  key: string
  /** The hosts this device has confirmed a first request to (section 12a). */
  hosts: readonly string[]
}

/** The record's text, as a store keeps it. */
export function setupText(setup: Setup): string {
  const { provider, address, model, key, hosts } = setup
  return JSON.stringify({ provider, address, model, key, hosts })
}

/**
 * The setup a store's text holds, or null: nothing kept, an entry written
 * empty by Forget this setup, or text that isn't a record. A built-in's
 * address is always the constant's, so a changed entry can't send a key
 * elsewhere under a built-in's name.
 */
export function readSetup(text: string | null): Setup | null {
  if (!text) return null
  let record: unknown
  try {
    record = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof record !== 'object' || record === null) return null
  const { provider, address, model, key, hosts } = record as Record<string, unknown>
  if (typeof model !== 'string' || typeof key !== 'string') return null
  const confirmed = Array.isArray(hosts) ? hosts.filter((host): host is string => typeof host === 'string') : []
  const builtIn = PROVIDERS.find(({ id }) => id === provider)
  if (builtIn) return { provider: builtIn.id, address: builtIn.address, model, key, hosts: confirmed }
  if (provider !== 'other' || typeof address !== 'string' || !checkAddress(address).ok) return null
  return { provider, address, model, key, hosts: confirmed }
}

/** A key's last four characters, all of it that is ever shown again: "Saved key ending a1B2". */
export function keyEnding(key: string): string {
  return key.length > 4 ? key.slice(-4) : '…'
}

/** What the card reads: the setup, and how it is kept. */
export interface SetupState {
  setup: Setup | null
  /**
   * The store's error when it couldn't keep the setup, which is then held
   * until the page or Obsidian closes; null while the store keeps it.
   */
  session: string | null
  /** The key was removed and the rest stays: the card is headed "Key removed from this device." */
  removed: boolean
}

/**
 * The setup on this device, over one store: read once, then held here, so
 * every tab of the panel and every sheet tab of a vault reads the same, and a
 * store that throws leaves the setup usable for the session. There is never a
 * second store.
 */
export interface SetupKeeper {
  state: () => SetupState
  subscribe: (listener: () => void) => () => void
  /** Keeps `setup`, in the store when it can. Makes no request. */
  save: (setup: Setup) => void
  /** Forgets the key only: the entry is written again without it. */
  removeKey: () => void
  /** Keeps `host` as confirmed (section 12a): its first request asked, and the user went on. */
  confirmHost: (host: string) => void
  /** Forgets all of it. */
  forget: () => void
}

const keepers = new WeakMap<SetupStore, SetupKeeper>()

/** The one keeper of a store. */
export function setupKeeper(store: SetupStore): SetupKeeper {
  let keeper = keepers.get(store)
  if (!keeper) {
    keeper = makeKeeper(store)
    keepers.set(store, keeper)
  }
  return keeper
}

function makeKeeper(store: SetupStore): SetupKeeper {
  let first: Setup | null = null
  try {
    first = readSetup(store.read())
  } catch {
    // A store that can't be read holds nothing: the card starts empty.
  }
  // A built-in can't be saved without a key, so one read without it had its key removed.
  let state: SetupState = { setup: first, session: null, removed: first !== null && first.provider !== 'other' && first.key === '' }
  const listeners = new Set<() => void>()
  const set = (next: SetupState) => {
    state = next
    for (const listener of [...listeners]) listener()
  }
  const keep = (setup: Setup, removed: boolean) => {
    let session: string | null = null
    try {
      store.write(setupText(setup))
    } catch (error) {
      session = errorText(error, setup.key)
    }
    set({ setup, session, removed })
  }
  return {
    state: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    save: (setup) => keep(setup, false),
    removeKey: () => {
      if (state.setup) keep({ ...state.setup, key: '' }, true)
    },
    confirmHost: (host) => {
      const { setup, removed } = state
      if (setup && !setup.hosts.includes(host)) keep({ ...setup, hosts: [...setup.hosts, host] }, removed)
    },
    forget: () => {
      try {
        store.remove()
      } catch {
        // Nothing was kept there, or it can't be reached: it is forgotten here either way.
      }
      set({ setup: null, session: null, removed: false })
    },
  }
}

/** A store's error as the card shows it, with any copy of the key replaced by "…" and its last four characters. */
function errorText(error: unknown, key: string): string {
  const text = error instanceof Error ? error.message || error.name : String(error)
  return hideKey(text, key)
}

/** `text` with every verbatim copy of `key` replaced by "…" and its last four characters (section 14, 0.7.0). */
export function hideKey(text: string, key: string): string {
  return key ? text.split(key).join(`…${keyEnding(key).replace('…', '')}`) : text
}
