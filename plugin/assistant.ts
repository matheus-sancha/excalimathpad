import { sessionSetupStore, type AssistantPorts } from '../src/assistant/ports.ts'

/**
 * The Math assistant's ports in a vault (docs/spec-v1.md section 12a, One
 * source, two builds; section 14, 0.7.0): the one file of `plugin/` that names
 * a request API or Obsidian's secret storage. The request is the window's own
 * `fetch`, which reads an answer in pieces as it arrives; Obsidian's own
 * request function gives an answer only once it is whole, so it is named
 * nowhere (ADR 0008).
 *
 * The view passes the ports only when the build-time switch is on and the
 * device is a computer: on a phone or a tablet there is no Math assistant tab
 * and no More tools item, as there is no Print… there. The setup's store lasts
 * as long as the view until the setup's own issue gives it its entry.
 */
export function assistantPorts(on: boolean, mobile: boolean): AssistantPorts | undefined {
  if (!on || mobile) return undefined
  return {
    request: (address, init) => window.fetch(address, init),
    store: sessionSetupStore(),
  }
}
