# 0008. The Math assistant calls the user's provider directly, with the user's key, only on a press

- **Status**: accepted, 0.7.0; built by #306 to #312, and on since #312. Amends [0006](0006-plugin-bundles-the-app-from-one-source.md)'s "No network and nothing outside the vault, enforced".
- **Date**: 2026-11-22

## Context

Until 0.7.0 the app made no request of its own in either home, and the plugin's promise was
"No network, ever" and "Storage only in the vault", proved on every pull request by a bundle
audit and a network-blocked run ([ADR 0006](0006-plugin-bundles-the-app-from-one-source.md)).
"ALL my data is protected" is Matheus's identity in public, and every user's vault. The first
test week's testers asked for AI features: a tutor that reviews a calculation, a drafted
sheet, and a calculation taken from an image or a PDF. Matheus chose one chat beside the
sheet, the **Math assistant**, in both homes, with "any api key for any model".

An AI provider can only be reached over the network, and its key is a secret that must not
travel with a vault. The app has no server and is free and best effort. No session had a
working key while this was decided: what the providers do was read from their documentation
and observed with invalid keys, from a browser page and once inside Obsidian 1.15.1.

Decided by Matheus on 2026-11-20 to 2026-11-22, on the map
[Spec for 0.7.0: the Math assistant](https://github.com/matheus-sancha/excalimathpad/issues/238)
(the tickets #239 to #246, #258, #259 and #303). The behaviour is in
[`docs/spec-v1.md`](../spec-v1.md) sections 8 (Math assistant), 12a (Data protection), 13 and
14.

## Decision

- **No server, account, proxy or key of ours.** The app calls the provider the user chose,
  from the browser or from Obsidian, with the user's own key.
- **Only on a press.** With no setup on the device the app makes no request, ever, as before.
  With one, a request goes only on Send, Show models or Check key, to that setup's host only,
  and the first request to any host asks once. Stop cancels the request in flight. Nothing in
  an answer makes a request, and nothing is retried or timed out by the app.
- **Two hand-written adapters, no SDK:** OpenAI's Chat Completions at a base URL (OpenAI,
  Google's compatible endpoint, OpenRouter and any address the user types) and Anthropic's
  own Messages API. They share one stream reader and one error reader.
- **`fetch` in both homes and nothing else.** Obsidian's `requestUrl` is not used.
- **One setup per device, never synced:** provider, address, model, key and confirmed hosts,
  in a `localStorage` entry on the web and in one `App#secretStorage` entry in the plugin
  (from Obsidian 1.11.4; `minAppVersion` stays 1.7.2). That entry is the one named exception
  to "Storage only in the vault".
- **The module never calls the network or a store.** `src/assistant/` takes a `request` port
  and a `store` port from each home (`src/main.tsx`, `plugin/assistant.ts`), and a source
  test keeps every request API in those two files.
- **The checks prove the rule line by line:** the audit's `reached` list is exactly the four
  built-in hosts and is tied to the provider constants; the network-blocked run stays the
  proof of "not set up, no request"; a seventh Playwright run, the assistant run, walks every
  line of the rule in both built homes against a stand-in provider, with a canary key. CI
  never calls a real provider and no key is kept in GitHub.
- **Excalidraw's own AI items are off in both homes,** so the assistant is the only AI in the
  app.

## Alternatives considered

- **A server or proxy of ours** between the app and the provider. It would hide the key from
  the page and lift every cross-origin limit, but it is an account, a bill, a place where
  sheets pass through us and something to keep running: it breaks "no server" and the
  promise.
- **One provider, called directly.** Chosen first (Anthropic), then replaced by Matheus: "I
  want the user to be able to use any api key for any model he wants. Don't want to lock
  Anthropic on this."
- **A provider's SDK.** Each is 390 to 450 kB, more than `main.js`'s free budget; the two
  adapters together are 3,825 bytes.
- **`requestUrl` in the plugin,** alone or behind a failed `fetch`. It has no cross-origin
  limit and can read a refusal `fetch` can't, but it returns an answer whole and can't be
  cancelled, so Stop would not stop the bill, and one press could make two requests.
- **The key in `data.json` or the vault.** It would sync and be committed with the vault.
- **Raising `minAppVersion` to 1.11.4.** It would refuse the whole plugin on an older
  Obsidian for a feature that is optional.

## Consequences

- The plugin is no longer "no network requests": the README's Privacy section, the listing's
  description and its "Optional payment" label say what is sent, when and to whom, and
  Obsidian's review reports the network use.
- A typed address that refuses calls from the app's origin can't be used in either home,
  although `requestUrl` could have reached it from Obsidian.
- Some refusals can't be read by a page (OpenAI's wrong-key answer on chat): Check key, a
  request the user presses, tells a wrong key from no network.
- Each built-in default model has a retirement date to watch; the Release button refuses a
  release near one, or when a default wasn't checked for 180 days.
- A key in `localStorage` on the web is readable by anything running on the app's origin, and
  one in Obsidian's keychain by other plugins. The card and the README say so.
- Proposals and attachments, the assistant's later slices, add to what a Send may carry and to
  what the plugin reads; each changes the rule's text and the assistant run in its own change.
