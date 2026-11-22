import { requireApiVersion, type App } from 'obsidian'
import type { AssistantPorts, SetupStore } from '../src/assistant/ports.ts'

/**
 * The Math assistant's ports in a vault (docs/spec-v1.md section 12a, One
 * source, two builds, and Data protection; section 14, 0.7.0): the one file
 * of `plugin/` that names a request API or Obsidian's secret storage. The
 * request is the window's own `fetch`, which reads an answer in pieces as it
 * arrives; Obsidian's own request function gives an answer only once it is
 * whole, so it is named nowhere (ADR 0008).
 *
 * The view passes the ports only when the build-time switch is on and the
 * device is a computer: on a phone or a tablet there is no Math assistant tab
 * and no More tools item, as there is no Print… there.
 */
export function assistantPorts(on: boolean, mobile: boolean, app: App): AssistantPorts | undefined {
  if (!on || mobile) return undefined
  return {
    request: (address, init) => window.fetch(address, init),
    store: secretStore(app),
  }
}

/** The one entry the plugin keeps outside the vault (section 12a, Storage only in the vault, with one exception). */
export const SETUP_ENTRY = 'excalimathpad-assistant'

/** One store per Obsidian, so every sheet tab reads the same setup. */
const stores = new WeakMap<App, SetupStore | null>()

/**
 * The setup's store: the entry in Obsidian's secret storage, on this device
 * only, never in `data.json` or the vault. The storage is from Obsidian
 * 1.11.4 and `minAppVersion` stays 1.7.2, so it is named only behind
 * `requireApiVersion('1.11.4')`: on an older Obsidian there is no store, the
 * tab says it needs 1.11.4, and nothing is stored or read.
 *
 * The storage has no public delete: Remove writes the entry again without
 * the key (the assistant's own `write`), and Forget this setup writes it
 * empty, which reads back as no setup.
 */
function secretStore(app: App): SetupStore | null {
  let store = stores.get(app) ?? null
  if (!stores.has(app)) {
    if (requireApiVersion('1.11.4')) {
      store = {
        read: () => app.secretStorage.getSecret(SETUP_ENTRY) || null,
        write: (record) => app.secretStorage.setSecret(SETUP_ENTRY, record),
        remove: () => app.secretStorage.setSecret(SETUP_ENTRY, ''),
      }
    }
    stores.set(app, store)
  }
  return store
}
