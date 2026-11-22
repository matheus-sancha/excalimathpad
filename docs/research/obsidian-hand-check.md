Hand check for wayfinder ticket #258, 2026-11-22.

# Inside Obsidian: what a plugin's `fetch`, `requestUrl` and the device's storage do

**Question.** The two research notes ([`provider-apis.md`](provider-apis.md), #239, and
[`obsidian-network-key.md`](obsidian-network-key.md), #240) and
[`provider-shapes.md`](provider-shapes.md) (#303) could run nothing inside Obsidian. Does a
plugin's `fetch` reach each built-in provider, with which `Origin`, can a wrong key's answer be
read, does an answer arrive as it is written, and does `app.secretStorage` keep a value on one
device? This note records what Obsidian did. It decides nothing: the route ticket (#259) and the
first slice ticket (#252) do.

**How it was run.** Matheus ran a throwaway plugin,
[`obsidian-hand-check/`](obsidian-hand-check/) (`main.js.txt` and `manifest.json.txt`, renamed
without `.txt` in `<vault>/.obsidian/plugins/emp-hand-check/`), on his Windows 11 PC and pasted
back the note it writes. The check is a plugin and not console lines because `requestUrl` is an
export of the `obsidian` module, and `require('obsidian')` fails from the developer console
([forum](https://forum.obsidian.md/t/expose-obsidian-module-to-be-used-outside-plugins/49988);
read, not run). Before it went to Matheus it was run in Chromium against a mock Obsidian and the
real hosts ([`harness.cjs.txt`](obsidian-hand-check/harness.cjs.txt)).

Three labels:

- **Observed** (unmarked): the plugin's note says it, from Obsidian.
- **Reported:** Matheus looked and answered a question in the session.
- **Inferred:** my reading of the two. Always marked.

**Where it ran.** One device, one run, 2026-11-22 03:12 to 03:15 UTC:

- Obsidian `apiVersion` **1.15.1**; the user agent says `obsidian/1.12.7 Chrome/142.0.7444.265
  Electron/39.8.3` (**inferred:** 1.12.7 is the installer, 1.15.1 the app).
- Windows, desktop app. `requireApiVersion('1.11.4')` is true.

## Answer

1. **`fetch` reaches all four built-in providers from a plugin, as a browser page would.** The
   page's origin is `app://obsidian.md`, and that is the `Origin` a `fetch` carries, as the
   research assumed. Obsidian applies cross-origin rules: OpenAI's wrong-key answer on chat can't
   be read by `fetch` and can by `requestUrl`.
2. **`requestUrl` reaches them too, with no `Origin` at all,** and reads every answer, OpenAI's
   chat 401 included. It still throws when nothing answers, even with `throw: false`.
3. **An answer arrives as it is written by `fetch`,** and all at once by `requestUrl`. A real
   Anthropic key worked through `Authorization: Bearer` with the browser opt-in header.
4. **`app.secretStorage` keeps a value on the device and per vault.** It survived a restart, was
   absent from a second vault on the same PC, and is in no file under `.obsidian`. The id
   `excalimathpad-assistant` and a 550-character value are accepted.
5. **Overwriting with `""` doesn't remove an entry:** it stays in `listSecrets()` and in
   Settings › Keychain. A `deleteSecret` method exists at run time and does remove it, but it is
   not in the public typings.
6. **`app.saveLocalStorage` is also per device and per vault, and plain:** the value is readable
   in the web view's `localStorage` under `<vault id>-<key>`. `null` clears it.
7. **Not checked:** a phone or tablet, a second device, Linux with no keyring, a local Ollama,
   Stop in the middle of an answer, and any provider but Anthropic with a real key.

## The network, with an invalid key

Every request was sent twice, by `window.fetch` and by `requestUrl`, with the key
`sk-invalid-excalimathpad-hand-check`. The Anthropic rows carry `anthropic-version: 2023-06-01`
and `anthropic-dangerous-direct-browser-access: true`.

| Request | `fetch` | `requestUrl` |
| --- | --- | --- |
| Echo, `GET https://httpbin.org/headers` | 200. `Origin: app://obsidian.md`, `Sec-Fetch-Site: cross-site` | 200. **No `Origin`**, `Sec-Fetch-Site: none` |
| Echo, `POST https://httpbin.org/anything` (with a preflight) | 200. `Origin: app://obsidian.md` | 200. No `Origin` |
| Anthropic, `POST /v1/messages` | 401, readable: "invalid x-api-key" | 401, readable |
| Anthropic, `GET /v1/models` | 401, readable | 401, readable |
| OpenAI, `POST /v1/chat/completions` | **Threw `TypeError: Failed to fetch`** | **401, readable:** "Incorrect API key provided: sk-inval…" |
| OpenAI, `GET /v1/models` | 401, readable | 401, readable |
| Google, `POST …/v1beta/openai/chat/completions` | 400, readable: a JSON array, "Please pass a valid API key" | 400, readable |
| Google, `GET …/v1beta/openai/models` | 400, readable: a JSON object | 400, readable |
| OpenRouter, `POST /api/v1/chat/completions` | 401, readable: "Invalid API key: this is not an OpenRouter API key…" | 401, readable |
| OpenRouter, `GET /api/v1/models` | 200 with the model list (no key needed) | 200 |
| Ollama, `GET http://localhost:11434/v1/models` | Threw `TypeError: Failed to fetch` | Threw `Error: net::ERR_CONNECTION_REFUSED` |
| Ollama, `POST http://localhost:11434/v1/chat/completions` | Threw | Threw `net::ERR_CONNECTION_REFUSED` |

- **The `Origin` is `app://obsidian.md`,** read back from the echo host, on a simple `GET` and on
  a `POST` with a preflight. `location.origin` says the same. The by-hand reading from the
  Network tab was not done.
- **Obsidian's `fetch` obeys cross-origin rules.** OpenAI's chat 401 threw on `fetch` and was
  read by `requestUrl` in the same second, so the host answered and the page wasn't allowed to
  read it. This matches [`provider-shapes.md`](provider-shapes.md), which saw no
  `Access-Control-Allow-Origin` on that answer. The other seven provider rows match its table
  too.
- **`requestUrl` is not a browser request:** no `Origin`, `Sec-Fetch-Site: none`, the same user
  agent. **Inferred:** a host that refuses by origin (a typed address, Ollama) can't refuse it.
- **`requestUrl` throws when no host answers,** with `throw: false` set. That option covers a
  status of 400 or more, not a failed connection.
- **No Ollama was running** (connection refused), so a call from Obsidian to a loopback address,
  and Ollama's answer to `app://obsidian.md`, are still unchecked.
- A `fetch` took about twice as long as the `requestUrl` beside it on the rows with a preflight
  (one run; the preflight is a second round trip).

## A streamed answer, with a real key

Anthropic, `claude-sonnet-5-5`, `POST https://api.anthropic.com/v1/messages` with `stream: true`,
asked to count from 1 to 60. Run twice.

| | Run 1 | Run 2 |
| --- | --- | --- |
| `fetch`: status, type | 200, `text/event-stream; charset=utf-8` | the same |
| `fetch`: first bytes after | 1005 ms | 706 ms |
| `fetch`: pieces, at (ms) | 6, at 1005, 1335, 1350, 1382, 1413, 1843 | 5, at 706, 1053, 1084, 1116, 1554 |
| `fetch`: sizes (bytes) | 828, 1239, 132, 141, 142, 730 | 841, 1375, 137, 135, 708 |
| `requestUrl`: the same request | 200 after 1616 ms, all at once, 21 `data:` events | 200 after 1497 ms, 21 events |

- **The answer arrives as it is written:** pieces spread over about 840 ms in both runs, and the
  first piece starts `event: message_start`.
- **`Authorization: Bearer <key>` is accepted** by the Messages API with a real key. The plugin
  retries with `x-api-key` after a 401, and it didn't need to.
- **A successful answer can be read by the page** from `app://obsidian.md`, with the opt-in
  header. Matheus's organization isn't one Anthropic refuses for zero data retention.
- **Pieces aren't events.** 21 events came in 5 or 6 pieces, one of 1,375 bytes. **Inferred:**
  the reader has to keep the tail of a piece until the next one, since an event can be cut
  anywhere.
- **`requestUrl` takes a streamed answer and returns it whole** when it ends.
- **Stop was not observed.** The plugin cancels after 12 pieces, and both answers ended sooner.
  That `AbortController` ends a `fetch` in Obsidian is **inferred** from Chromium, where the
  harness saw the next read fail with `AbortError` and the stand-in server saw the connection
  close.

## `app.secretStorage`

- **Its methods at 1.15.1:** `load`, `isEncryptionAvailable`, `setupStorage`, `recordAccess`,
  `getLastAccess`, `validateId`, `setSecret`, `peekSecret`, `getSecret`, `listSecrets`,
  `deleteSecret`. The public typings (`obsidian@1.14.4`) declare only `setSecret`, `getSecret`
  and `listSecrets`. None of the others was called but `deleteSecret`.
- **`setSecret` returns `undefined`** and the value reads back at once: it is synchronous.
- **The id `excalimathpad-assistant` is accepted,** and a 550-character JSON string read back
  the same.
- **A restart keeps it.** After Obsidian was quit and opened again, `getSecret` returned the
  marker written before. The plugin tells the two sessions apart by a value it keeps on `window`.
- **A second vault doesn't see it** (**reported**): in another vault on the same PC,
  `getSecret` returned `null`. So the store is keyed to the vault, as Obsidian's guide says.
- **It is in no file a sync would carry:** none of the 8 files under `.obsidian` held the value.
  A second device was not run.
- **It isn't readable in the web view's `localStorage`:** no value there held it as plain text,
  and no key there names `excalimathpad` but `saveLocalStorage`'s. Where the store keeps it
  wasn't found.
- **`setSecret(id, "")` leaves an empty entry.** `getSecret` then returns `""`, not `null`,
  `listSecrets()` still lists the id, and Settings › Keychain still shows it (**reported**).
- **`deleteSecret(id)` removes it:** `getSecret` returns `null`, `listSecrets()` no longer lists
  it, and Keychain no longer shows it (**reported**). It is undeclared, so calling it from
  TypeScript needs a cast, and nothing promises it stays.
- `listSecrets()` returned 2 ids, both the check's, so this vault held no other secret.

## `app.saveLocalStorage`

- **Written, read back the same, and kept across the restart.** A string comes back as a string.
- **Per vault** (**reported**): the second vault read `null`.
- **Plain, in the web view's `localStorage`,** under the key
  `327f50d28ac65486-excalimathpad-check`. **Inferred:** the prefix is the vault's id.
- **In no file under `.obsidian`.**
- **`saveLocalStorage(key, null)` clears it:** `loadLocalStorage` then returns `null`.

## Not checked

1. **A phone or a tablet.** Nothing was run on one: which `Origin` a `fetch` carries there (a
   [forum post](https://forum.obsidian.md/t/is-it-possible-to-change-origin-header-sent-within-http-request-from-mobile-app/68970)
   says `http://localhost`; read, not run), whether the providers answer it, and whether
   `secretStorage` and `requestUrl` behave as on a computer.
2. **A second device that syncs the vault.** Standing in for it: neither value is in a file
   under `.obsidian`.
3. **Linux with no keyring:** what `setSecret` does there. `isEncryptionAvailable` exists but
   wasn't called.
4. **A local Ollama** or any loopback address from Obsidian.
5. **Stop** in the middle of an answer, inside Obsidian.
6. **OpenAI, Google and OpenRouter with a real key,** so whether OpenAI's successful answer can
   be read by `fetch` is still open ([`provider-shapes.md`](provider-shapes.md), Not verified,
   item 2).
7. **macOS, and an Obsidian below 1.15.1,** 1.11.4 included.
8. **The `Origin` as the Network tab shows it.** The echo host's reading stands in for it.
