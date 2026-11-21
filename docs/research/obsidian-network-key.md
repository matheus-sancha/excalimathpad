Research for wayfinder ticket #240, 2026-11-20.

# What Obsidian requires of a plugin that uses the network, and where a plugin can keep a key on one device

**Question.** From 0.6.0 the plugin sends what the user asks, on Send only, to
one AI provider's API, with a key the user enters. 1.0.0 is the version
submitted to the community list. What must such a plugin disclose, what does
the review check, which request route does Obsidian offer, and where can the
key be kept so that it stays on one device? This extends
[`obsidian-plugin.md`](obsidian-plugin.md) (ticket #116) and doesn't repeat it.

**How to read the sources.** Everything was read on 2026-11-20. Every Obsidian
claim links to a file in an Obsidian-owned repository, pinned to that day's
commit, or to a page on an Obsidian-owned site:

- developer docs, `obsidianmd/obsidian-developer-docs` at `1c26772` (unchanged
  since the earlier note);
- the API typings, `obsidianmd/obsidian-api` at `737629a`. The package
  `obsidian` 1.14.4 that this repository pins is still the newest on npm. The
  repository head differs from it only by an `id` field on the settings
  definitions and by doc comments (diffed), so nothing newer than 1.14.4
  exists to raise to;
- the help vault, `obsidianmd/obsidian-help` at `ced3205`;
- the release repository, `obsidianmd/obsidian-releases` at `68c3912`;
- the official lint rules, `obsidianmd/eslint-plugin` at `a998a59` (tag 0.6.0).
  This repository pins **0.5.1**; facts about the installed rules name the
  file inside that package (`eslint-plugin-obsidianmd@0.5.1`, unpacked from
  npm);
- Obsidian's changelog (obsidian.md/changelog), its blog, and the live listing
  pages of the Community directory (community.obsidian.md). These can't be
  pinned; the date read stands in.

Four listed plugins are cited as **precedent**, not as authority: Copilot
(`logancyang/obsidian-copilot` at `208e0db`), ChatGPT MD (`bramses/chatgpt-md`
at `c4de557`), Smart Composer (`glowingjade/obsidian-smart-composer` at
`6b38ab3`) and Obsidian's own Importer (`obsidianmd/obsidian-importer` at
`fa9444a`). All four are in
[`community-plugins.json`](https://github.com/obsidianmd/obsidian-releases/blob/68c3912092116ff42e50d52e964d84e7ae997ea4/community-plugins.json).

Three marks are used throughout:

- unmarked: **verified** from the linked source;
- "**Observed**": run on 2026-11-20 in a scratch directory outside this
  repository (the pinned lint over a sample file; this repository's
  `auditBundle` fed sample text), or read off a live page;
- "**Inferred**": my reading, which no source states.

What no source settles is at the end, under [Could not verify](#could-not-verify).

## Answer

1. **Disclosure is a README duty, and the words are the plugin's own.** The
   developer policies allow network use only "if clearly indicated in your
   README", and ask to "clearly explain which remote services are used and why
   they're needed". Payment and an account "required for full access" are on
   the same list. No sentence is prescribed, and no rule asks for anything in
   the settings or in the description.
2. **The listing's payment label must change.** A plugin that "connects to a
   paid service or API … must be labeled as having Optional payments, even if
   the service has a free tier". The label is set in the directory's
   dashboard, not in the manifest.
3. **The description has format rules only** (250 characters, ends with a
   period, no emoji, no "Obsidian"). Nothing requires it to mention the
   network. Today's last sentence, "Works fully offline; makes no network
   requests.", would be untrue from 0.6.0.
4. **The review doesn't refuse network use.** It reports it. Every listing's
   scorecard carries the disclosures "Plugin might make requests to external
   domains", with the domains, and "Number of network request calls". Refused
   outright: client-side telemetry, obfuscated code, dynamic ads,
   self-updating code, and new closed-source plugins.
5. **Errors block, warnings don't.** The scanner runs the official lint. The
   bare global `fetch` is a warning there. Using an API newer than
   `minAppVersion` is an error for a plugin submitted today.
6. **Two request routes work on desktop and mobile, and they trade off.**
   - `requestUrl` has no cross-origin (CORS) limits, but returns the whole
     reply at once: no stream, and no way to cancel.
   - `fetch` streams and can be cancelled, but it is a browser request, so the
     provider's API has to allow cross-origin calls. That fact belongs to
     [`provider-apis.md`](provider-apis.md).
   - **Streaming on a phone therefore needs `fetch`** (inferred from the
     typings and the precedents; not run in Obsidian).
7. **One API keeps a value on one device as a secret: `App#secretStorage`**,
   from app version **1.11.4** (public on desktop and mobile on 2026-01-12).
   The value sits in the device's local storage, keyed to the vault, and never
   in the vault's files. On desktop it is encrypted on disk from 1.11.5. Any
   plugin in the vault can read it by its id.
   `App#saveLocalStorage` (typed from 1.8.7) is also per device and per vault,
   but plain.
8. **`minAppVersion` 1.7.2 is below both.** The pinned lint reports either API
   as an error at 1.7.2 (observed). The plugin has to raise `minAppVersion` or
   guard each call with `requireApiVersion()`.
9. **Today's rules collide with all of this** in six places, listed under
   [Where this meets today's rules](#where-this-meets-todays-rules): section
   12a's "No network, ever" and its storage rule, the README's Privacy
   section, the description, the audit's host allowlist, and the lint at
   `--max-warnings 0`. The audit's `localStorage` string does **not** catch
   `saveLocalStorage` or `secretStorage` (observed).

## Disclosure

### What the policies ask

- The developer policies list what is "only allowed if clearly indicated in
  your README". Three entries bear on this feature
  ([Developer policies](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Developer%20policies.md?plain=1#L30-L40)):
  - "Network use. Clearly explain which remote services are used and why
    they're needed."
  - "Payment is required for full access."
  - "An account is required for full access."
- The same page lists "Server-side telemetry", which needs a link to a privacy
  policy, and forbids client-side telemetry outright. A request that carries
  what the user typed to a provider is network use. Calling it telemetry would
  be a misreading (**inferred**: the page doesn't define the word).
- **Inferred:** a key from a provider means an account with that provider and,
  for most, payment. The policy's two lines speak of access to the plugin, not
  to a third party, so whether they apply to a bring-your-own-key feature is
  my reading. The payment label below is explicit, and settles the practical
  side.
- The self-critique checklist repeats the duty: "disclose relevant information
  … in your README file (payments, account requirements, network use, …)"
  ([checklist](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Obsidian%20October%20plugin%20self-critique%20checklist.md?plain=1#L46)).
- **No wording is given anywhere.** The policies, the submission requirements,
  the plugin guidelines and the directory FAQ were all searched for "network",
  "request" and "disclos"; the lines above are the only ones.
- **Where it is shown.** The README is the listing page: "An excerpt is shown
  on your entry's public listing page"
  ([Submit your plugin](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Releasing/Submit%20your%20plugin.md?plain=1#L23)).
  The listing's Overview tab shows "its long description, an excerpt of its
  README file"
  ([Community directory, help](https://github.com/obsidianmd/obsidian-help/blob/ced32050c0d9d1e1f8d3faa19a8ba8474d75a32d/en/Extending%20Obsidian/Community%20directory.md?plain=1#L24)).
- Nothing in these sources asks for a notice in the settings tab or before the
  first request.

### The payment label

- The directory has three labels: Free, Optional payment and Paid. "Optional
  payment: choose this if you rely on a third-party service that requires
  payment, or if you lock certain features behind payment"
  ([FAQ](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Frequently%20asked%20questions.md?plain=1#L49-L58)).
- Obsidian's launch post is stricter: "If a plugin connects to a paid service
  or API, it must be labeled as having Optional payments, even if the service
  has a free tier." Free means "not tied to any paid services whatsoever"
  ([The future of Obsidian plugins](https://obsidian.md/blog/future-of-plugins/),
  dated May 12, 2026).
- The label is set under **Edit listing**, with the icon, the "short and long
  description", the categories and the screenshots
  ([Manage your plugin](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Manage%20your%20plugin%20or%20theme.md?plain=1#L31-L37)).
  It is not a manifest field.
- A listing that isn't Free shows a Payments section that "explains how its
  pricing works"
  ([Community directory, help](https://github.com/obsidianmd/obsidian-help/blob/ced32050c0d9d1e1f8d3faa19a8ba8474d75a32d/en/Extending%20Obsidian/Community%20directory.md?plain=1#L46)).
  **Observed:** Copilot's and Smart Composer's listings both read "Payments:
  Optional".

### The description

- The rules are about form: follow the style guide, "250 characters maximum",
  "End with a period", no emoji or special characters, correct capitals, and
  start with an action rather than "This is a plugin"
  ([Submission requirements](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Submission%20requirements%20for%20plugins.md?plain=1#L22-L40)).
- The pinned lint checks the same on `manifest.json`, as warnings: at least 10
  and at most 250 characters, ending in `.`, `!` or `?`, no word "Obsidian",
  no "this plugin" or "a plugin that", and not starting with the plugin's name
  (`eslint-plugin-obsidianmd@0.5.1`, `dist/lib/rules/validateManifest.js`,
  lines 45-47 and 194-200).
- No rule says the description must mention network use, an account or a key.
- Today's description is 172 characters and ends "Works fully offline; makes
  no network requests." ([`manifest.json`](../../manifest.json),
  [section 12a, Listing](../spec-v1.md#listing)). From 0.6.0 that sentence is
  false for anyone who uses the assistant.
- The dashboard edits a short and a long description of its own (above).
  Whether the short one starts as the manifest's `description` is
  [not verified](#could-not-verify).

### What the directory publishes on its own

- The scorecard's review part has "disclosures (things the entry does that
  aren't necessarily issues but that you should be aware of, such as accessing
  your clipboard or making requests to external domains)"
  ([Community directory, help](https://github.com/obsidianmd/obsidian-help/blob/ced32050c0d9d1e1f8d3faa19a8ba8474d75a32d/en/Extending%20Obsidian/Community%20directory.md?plain=1#L32)).
- The help page tells users how to read them: "A handful of disclosures, worth
  checking for things like clipboard or network access" (same page, lines
  34-38).
- **Observed** on seven live listings (the four precedents, Gemini Scribe,
  Excalidraw and Just Simple Excalidraw), the two network entries read:
  - "Plugin might make requests to external domains", with the text "External
    network calls should be disclosed in the plugin README and only made with
    user knowledge." and a list of host names;
  - "Number of network request calls", with the text "All network requests
    should be necessary and disclosed to users." and a count.
- So a user sees the plugin's network use on the listing whatever the README
  says, and the README is where the scorecard sends them for the reason.
- Obsidian plans more: "Disclosures. Plugins will declare what they access:
  network, file system, clipboard, and other capabilities"
  ([The future of Obsidian plugins](https://obsidian.md/blog/future-of-plugins/)).
  No declaration format is published yet.

## Review

### How it runs

- "After each release, the directory scans your `manifest.json`, GitHub
  release assets, and source code, and verifies that the build matches what's
  committed." Each result is an error, a warning, a recommendation or a pass.
  "Warnings don't block your submission"
  ([Manage your plugin](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Manage%20your%20plugin%20or%20theme.md?plain=1#L19-L27)).
- Errors do block: the plugin "won't be installable from within Obsidian until
  any errors from the automated review are resolved"
  ([Submit your plugin](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Releasing/Submit%20your%20plugin.md?plain=1#L61-L65)).
  A later version that fails "is removed from search within 24 hours"
  ([The future of Obsidian plugins](https://obsidian.md/blog/future-of-plugins/)).
- The scanner "verifies that it adheres to our developer policies, that the
  source code follows best practices, and that it is free of known
  vulnerabilities", and includes "malware scanning" (same post).
- "Manual reviews continue for popular, featured, and flagged plugins"
  ([Plugin security](https://github.com/obsidianmd/obsidian-help/blob/ced32050c0d9d1e1f8d3faa19a8ba8474d75a32d/en/Extending%20Obsidian/Plugin%20security.md?plain=1#L37-L39)).
- **The release repository no longer holds the review.** Its only workflows
  mirror `community-plugins.json` from community.obsidian.md and collect
  download statistics; there is no validation script. Its pull-request
  template links to a `plugin.md` template that is not in the tree, and
  `plugin-review.md` says its content "has moved to Plugin guidelines"
  ([.github](https://github.com/obsidianmd/obsidian-releases/tree/68c3912092116ff42e50d52e964d84e7ae997ea4/.github),
  [plugin-review.md](https://github.com/obsidianmd/obsidian-releases/blob/68c3912092116ff42e50d52e964d84e7ae997ea4/plugin-review.md)).
  The checks that can be read are the lint's source and the live scorecards.

### What the scanner's lint does with network and storage calls

- "The Obsidian community plugin directory runs this plugin against every
  submitted plugin as part of its automated review"
  ([configuration.md](https://github.com/obsidianmd/eslint-plugin/blob/a998a5992b7bf9b6f3e0fe1e61a3ad180546f4a5/docs/configuration.md?plain=1#L1084-L1086)).
  The scanner uses its own configuration, built on the recommended one. It
  honours disable comments (same section).
- **Most rules are warnings there.** The ones kept as errors are `no-eval`,
  implied eval, the `Function` constructor, the two `no-unsanitized` rules,
  `regex-lookbehind` and `no-forbidden-elements`
  ([Rule severity adjustments](https://github.com/obsidianmd/eslint-plugin/blob/a998a5992b7bf9b6f3e0fe1e61a3ad180546f4a5/docs/configuration.md?plain=1#L1118-L1132)).
  The `fetch` rule isn't among them, so it warns.
- **Newer submissions get more errors.** For the newest, ten obsidianmd rules
  are errors, among them **`no-unsupported-api`** (same lines). A plugin
  submitted today that calls an API newer than its `minAppVersion` fails the
  review.
- **Disable comments are restricted.** Disabling `no-restricted-globals` (the
  `fetch` and `localStorage` rule) or any `obsidianmd/*` rule in a comment is
  itself an error for plugins checked with the two newest layers (same
  lines). **Observed** on Smart Composer's scorecard: "Disabling
  '@typescript-eslint/no-explicit-any' is not allowed."
- **Observed:** the same scorecard carries the lint's own sentence as a
  warning, "Unexpected use of 'fetch'. Use the built-in `requestUrl` function
  instead of `fetch` for network requests in Obsidian." Smart Composer stays
  listed and installable with it.
- The scanner lints the plugin's source and leaves out bundled JavaScript,
  `scripts`, `docs`, `*.mjs`, tests and tool configs
  ([Ignored files](https://github.com/obsidianmd/eslint-plugin/blob/a998a5992b7bf9b6f3e0fe1e61a3ad180546f4a5/docs/configuration.md?plain=1#L1088-L1112)).
  For this repository that leaves `plugin/` and `src/`.

### What the scorecards show about network use

**Observed** on the live listing pages
([Copilot](https://community.obsidian.md/plugins/copilot),
[ChatGPT MD](https://community.obsidian.md/plugins/chatgpt-md),
[Smart Composer](https://community.obsidian.md/plugins/smart-composer),
[Importer](https://community.obsidian.md/plugins/obsidian-importer),
[Just Simple Excalidraw](https://community.obsidian.md/plugins/just-simple-excalidraw)):

| Listing | Review | External domains | Network calls |
|---|---|---|---:|
| Copilot 4.0.20 | Satisfactory | `firecrawl.link`, `tiktoken.pages.dev` | 133 |
| ChatGPT MD 3.3.1 | Satisfactory | none listed | 3 |
| Smart Composer 1.2.9 | Risks | `github.com`, `obsidian.md`, `www.buymeacoffee.com`, `www.googleapis.com` | 124 |
| Importer 3.2.0 (by Obsidian) | Passed | `c2.com`, `takeout.google.com`, `www.youtube.com` | 112 |
| Just Simple Excalidraw | Satisfactory | none listed | 6 |

- Both entries sit under **Disclosures**, at the scorecard's lowest level
  (`info`). On none of the seven listings is a network entry a warning or an
  error.
- **Network use by itself doesn't fail a review.** Obsidian's own Importer
  makes requests and is "Passed".
- **The count is not the plugin's own calls only (inferred).** Just Simple
  Excalidraw states "all local with no network or telemetry" on its listing
  and shows 6 calls, and the earlier note counted `fetch(` call sites from
  Excalidraw in such a bundle. Expect this plugin's listing to show a count
  whether or not it has an assistant.
- **The domain list is not the list of hosts a plugin talks to (inferred).**
  Copilot's omits every provider host; Smart Composer's and the Importer's
  name hosts that look like links. How the scanner chooses them is
  [not verified](#could-not-verify). This repository's bundle names 19 hosts
  that it never fetches
  ([`plugin-allowlist.json`](../../scripts/plugin-allowlist.json)); some may
  appear on its scorecard.
- Other entries seen that bear on this plugin:
  - "**Local Storage**: Persists data in `localStorage` or `sessionStorage`
    instead of the Obsidian plugin data APIs", under **Other** (Just Simple
    Excalidraw). The help page calls these "other notes";
  - "Code uses runtime base64 encode or decode calls", a disclosure, with
    "sometimes used to hide API keys, URLs, or code payloads";
  - "`main.js` … is larger than 5 MB", a warning;
  - "Build reproduced the release main.js byte-for-byte", a pass.
- Each scorecard carries the notice "Scorecards are new and may contain
  errors."

### Refused outright

- Plugins "must not": obfuscate code, insert dynamic ads loaded over the
  internet, insert static ads outside their own interface, include client-side
  telemetry, or install or update themselves or their dependencies
  ([Developer policies](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Developer%20policies.md?plain=1#L19-L28)).
- "For now, we are not accepting new closed source plugins into the directory"
  ([The future of Obsidian plugins](https://obsidian.md/blog/future-of-plugins/)).
- A plugin that breaks a policy is removed; one that "appears to be malicious"
  can be removed at once
  ([Developer policies](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Developer%20policies.md?plain=1#L69-L81)).
- **What this means for the feature (inferred):** one request per Send, to one
  named provider, with the user's own key, breaks none of these. Loading
  anything else from the network at run time (a model list fetched from a
  third host, a remote script, usage pings) would move toward the forbidden
  list.

## The request route

### What Obsidian offers

- **`requestUrl(request)`**: "Similar to `fetch`, request a URL using
  HTTP/HTTPS, without any CORS restrictions"
  ([typings](https://github.com/obsidianmd/obsidian-api/blob/737629a51f6b4d30f8336fa3d38f3df006e322d4/obsidian.d.ts#L7833-L7847);
  `obsidian@1.14.4`, `obsidian.d.ts` line 7841).
  - It takes `url`, `method`, `contentType`, `body` (a string or an
    `ArrayBuffer`), `headers` and `throw`, which defaults to `true` and
    rejects on a status of 400 or more
    ([`RequestUrlParam`](https://github.com/obsidianmd/obsidian-api/blob/737629a51f6b4d30f8336fa3d38f3df006e322d4/obsidian.d.ts#L7849-L7898)).
  - It resolves to `status`, `headers`, `arrayBuffer`, `json` and `text`
    ([`RequestUrlResponse`](https://github.com/obsidianmd/obsidian-api/blob/737629a51f6b4d30f8336fa3d38f3df006e322d4/obsidian.d.ts#L7900-L7935)).
  - **There is no stream, no abort signal and no timeout in either type.**
    The body arrives as finished values.
- **`request(request)`** is the older form and returns the body as a string,
  since 0.12.11
  ([typings](https://github.com/obsidianmd/obsidian-api/blob/737629a51f6b4d30f8336fa3d38f3df006e322d4/obsidian.d.ts#L7819-L7831)).
  The changelog introduced it as "an API to perform HTTP requests without any
  CORS restrictions"
  ([0.12.11](https://obsidian.md/changelog/2021-07-19-desktop-v0.12.11/)), and
  `requestUrl` as "a more advanced version"
  ([0.13.25](https://obsidian.md/changelog/2022-02-18-desktop-v0.13.25/)).
- The typings hold two more globals, `ajax` and `ajaxPromise`, with no version
  and no CORS statement (`obsidian@1.14.4`, `obsidian.d.ts` lines 1050-1114).
  No doc page recommends them.
- Nothing else in the typings makes requests, and nothing in them streams
  (searched for `requestUrl`, `fetch`, `stream`, `ajax`).
- **Mobile:** the checklist's "Mobile support" section says "Don't use `fetch`
  or `axios.get`, use Obsidian's `requestUrl` instead"
  ([checklist](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Obsidian%20October%20plugin%20self-critique%20checklist.md?plain=1#L24-L32)).
  The typings carry no platform limit on `requestUrl`.

### How `fetch` differs

| | `requestUrl` | `fetch` |
|---|---|---|
| Cross-origin rules | none (typings) | the CORS protocol applies ([Fetch standard](https://fetch.spec.whatwg.org/#http-cors-protocol)) |
| Reply | whole body, after it ends | `body` is a stream ([Fetch standard](https://fetch.spec.whatwg.org/#dom-body-body)) |
| Cancel | no signal in the types | `signal` |
| Lint, pinned 0.5.1 | not reported | bare `fetch` warns |
| Checklist | recommended | "Don't use" |

- **`fetch` in Obsidian is a browser request (inferred).** No Obsidian page
  says how the app's web view treats it. The typings' "without any CORS
  restrictions" for `requestUrl` implies `fetch` has them, and all three
  precedents treat it so (below).
- **Where this meets [`provider-apis.md`](provider-apis.md):**
  - whether the provider's API answers cross-origin requests from a browser,
    and with which request header if it needs one, decides whether `fetch`
    works at all. Through `requestUrl` that question doesn't arise;
  - a reply sent as a stream of events can be read as it arrives only through
    `fetch`. Through `requestUrl` the same reply arrives complete, at the end.
- **So, for a reply that appears as it is written:**
  - desktop and mobile, one code path: `fetch`, if the provider allows
    cross-origin calls;
  - if it doesn't: `requestUrl`, and the answer appears all at once.
- **Obsidian's own plugin uses both.** The Importer calls `fetch` where "This
  request must be abortable; requestUrl has no AbortSignal support"
  ([onenote.ts](https://github.com/obsidianmd/obsidian-importer/blob/fa9444a188459f227b07ec121ad03d26bd6b301a/src/formats/onenote.ts#L1304-L1312)),
  and `requestUrl` elsewhere. It is listed as "Passed".
- **A third route exists on desktop only:** Node's `http` and `https`, which
  stream and have no CORS. ChatGPT MD uses it on desktop (below).
  - "Node.js and Electron APIs are only available in the desktop version", and
    a plugin that uses them "must" set `isDesktopOnly` to `true`
    ([Submission requirements](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Submission%20requirements%20for%20plugins.md?plain=1#L42-L46)).
  - The checklist allows them when gated: "gate the functionality behind
    `Platform.isDesktopApp` and `require()` them dynamically"
    ([checklist](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Obsidian%20October%20plugin%20self-critique%20checklist.md?plain=1#L28)).
    **The two pages disagree.** The lint follows the checklist
    (`no-nodejs-modules`: "unless guarded by Platform.isDesktop"), and ChatGPT
    MD is listed for desktop and mobile while doing it, so the checklist is
    the rule in force.
  - Section 12a's bundle has no Node use today.

### Which lint rules touch a network call

From `eslint-plugin-obsidianmd@0.5.1`, the version this repository installs.
The lists are the same in 0.6.0 (diffed).

- **`no-restricted-globals`, `warn`**, names three globals: `app`, `fetch`
  ("Use the built-in `requestUrl` function instead of `fetch` for network
  requests in Obsidian.") and `localStorage`
  (`dist/lib/ruleOptions.js` lines 4-17, `dist/lib/index.js` line 351;
  [source](https://github.com/obsidianmd/eslint-plugin/blob/a998a5992b7bf9b6f3e0fe1e61a3ad180546f4a5/lib/ruleOptions.ts#L7-L22)).
- **`@typescript-eslint/no-restricted-imports`, `warn`**, names `axios`,
  `superagent`, `got`, `ofetch`, `ky` and `node-fetch`, each with "Use the
  built-in `requestUrl` function instead"
  (`dist/lib/ruleOptions.js` lines 18-42). A provider's SDK is not on the
  list.
- **`eslint-comments/no-restricted-disable`, `error`**, forbids a disable
  comment for `no-restricted-globals`, for the import rule and for every
  `obsidianmd/*` rule but one (`dist/lib/index.js` lines 522-535;
  [source](https://github.com/obsidianmd/eslint-plugin/blob/a998a5992b7bf9b6f3e0fe1e61a3ad180546f4a5/lib/index.ts#L576-L594)).
- **`obsidianmd/no-nodejs-modules`, `warn`**, for the desktop-only route.
- **`obsidianmd/no-unsupported-api`, `error`**, for any Obsidian API newer
  than `minAppVersion`. `requestUrl` needs 0.13.26, or 0.16.0 when called
  with a bare URL string
  ([changelog 0.5.1](https://github.com/obsidianmd/eslint-plugin/blob/a998a5992b7bf9b6f3e0fe1e61a3ad180546f4a5/CHANGELOG.md?plain=1#L127)),
  so it is free at 1.7.2.

**Observed**, with ESLint 9.39.5, typescript-eslint 8.72.2, TypeScript 6.0.3,
`obsidian` 1.14.4 and a manifest at `minAppVersion` 1.7.2:

| Call in a plugin file | Result |
|---|---|
| `fetch(url)` | warning, `no-restricted-globals` |
| `window.fetch(url)`, `activeWindow.fetch(url)` | not reported |
| `requestUrl({ url, method, body })` | not reported |
| `new XMLHttpRequest()`, `new EventSource(url)`, `new WebSocket(url)` | not reported |
| `// eslint-disable-next-line no-restricted-globals -- …` above a `fetch` | error: "Disabling 'no-restricted-globals' is not allowed" |

- With `--max-warnings 0`, as this repository runs it, a bare `fetch` in
  `plugin/` or `src/` fails `npm run lint`.
- The rule can still be switched off for named files in `eslint.config.mjs`,
  as this repository already does for its web-only files
  ([`eslint.config.mjs`](../../eslint.config.mjs)). The scanner uses its own
  configuration, so it would still warn (**inferred** from the scanner
  section above).
- ChatGPT MD writes `window.fetch` and says why: "`window.fetch` instead of
  bare fetch (obsidianmd/no-restricted-globals): requestUrl cannot stream"
  ([requestStream.ts](https://github.com/bramses/chatgpt-md/blob/c4de557cf2f1cec9607e8b2a44660e8d2de5d0a7/src/Services/requestStream.ts#L217-L220)).
  Its scorecard has no `fetch` warning.

## Per-device storage

### The candidates

| Candidate | Where the value is kept | Mobile | Typed since | Lint at `minAppVersion` 1.7.2 (observed) |
|---|---|---|---|---|
| `Plugin#saveData` | `data.json` in the plugin's folder, inside the vault | yes | 0.9.7 | passes |
| `App#saveLocalStorage` / `loadLocalStorage` | the device's `localStorage`, per vault, plain | no limit stated | 1.8.7 | error |
| `App#secretStorage` (`SecretStorage`) | the device's local storage, keyed to the vault; encrypted on disk on desktop from 1.11.5 | Keychain settings exist on mobile | 1.11.4 | error |
| `localStorage`, IndexedDB directly | the web view's own storage | yes | n/a | `localStorage` warns |

### `Plugin#saveData`: the vault, so it syncs

- "Data is stored in `data.json` in the plugin folder"
  ([typings](https://github.com/obsidianmd/obsidian-api/blob/737629a51f6b4d30f8336fa3d38f3df006e322d4/obsidian.d.ts#L7336-L7353)).
- `onExternalSettingsChange` exists because "a Sync service or external
  program has modified the plugin settings"
  ([typings](https://github.com/obsidianmd/obsidian-api/blob/737629a51f6b4d30f8336fa3d38f3df006e322d4/obsidian.d.ts#L7364-L7373)).
- Obsidian Sync carries the configuration folder, and community plugins when
  the user turns on "Active community plugin list" and "Installed community
  plugin list"
  ([Sync settings](https://github.com/obsidianmd/obsidian-help/blob/ced32050c0d9d1e1f8d3faa19a8ba8474d75a32d/en/Obsidian%20Sync/Sync%20settings%20and%20selective%20syncing.md?plain=1#L64-L105)).
  Any other sync of the vault folder (git, a cloud drive) carries the file
  too (**inferred**: it is a file in the vault).
- Obsidian's guide names the problem: "When plugins store secrets directly in
  `data.json` … Secrets are stored in plaintext alongside other plugin data"
  ([Store secrets](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Guides/Store%20secrets.md?plain=1#L22-L30)).
- This matches the direction already set: the key is never in `data.json`.

### `App#saveLocalStorage` and `App#loadLocalStorage`

- "Save vault-specific value to `localStorage`. If data is `null`, the entry
  will be cleared." The value "must be serializable". Both are `@since 1.8.7`
  ([typings](https://github.com/obsidianmd/obsidian-api/blob/737629a51f6b4d30f8336fa3d38f3df006e322d4/obsidian.d.ts#L1391-L1406);
  `obsidian@1.14.4`, `obsidian.d.ts` lines 1391-1406).
- **Per device:** Obsidian's own changelog treats local storage as the place
  for what must not sync: "Base font size … is now stored in the device's
  local storage, so it no longer syncs with Obsidian Sync"
  ([1.14.2](https://obsidian.md/changelog/2026-09-15-desktop-v1.14.2/)).
- **Per vault:** "for this vault", in the typings. The lint's message calls it
  "localStorage data that's unique to a vault".
- **Plain (inferred):** the typings promise no encryption, and the guide below
  offers `SecretStorage` as the secure way.
- **Mobile:** the typings state no platform limit. Not run on a device.
- **Version:** 1.8.7 was public on desktop on 2025-02-18
  ([changelog](https://obsidian.md/changelog/2025-02-18-desktop-v1.8.7/)).
  **Observed:** at `minAppVersion` 1.7.2 the pinned lint reports
  "'App.saveLocalStorage' requires Obsidian v1.8.7, but minAppVersion is
  1.7.2", an error.
- Listed plugins use it for small per-device state, not for keys: Copilot for
  a device id and interface state
  ([deviceId.ts](https://github.com/logancyang/obsidian-copilot/blob/208e0db6f5d5faf37058861aecf10b9eef641ecd/src/utils/deviceId.ts#L15-L23)),
  the Importer for the chosen account type
  ([onenote.ts](https://github.com/obsidianmd/obsidian-importer/blob/fa9444a188459f227b07ec121ad03d26bd6b301a/src/formats/onenote.ts#L191-L195)).

### `App#secretStorage`: the Keychain

- **What it is.** "`SecretStorage` provides a secure way to store and manage
  sensitive data like API keys and tokens in Obsidian plugins. Instead of
  storing secrets directly in your plugin's `data.json` file, SecretStorage
  offers a centralized key-value store that allows users to share secrets
  across multiple plugins"
  ([Store secrets](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Guides/Store%20secrets.md?plain=1#L6)).
- **Where the value is.** "The actual secret is stored in local storage, keyed
  to the specific vault" (same page, line 96). The plugin's settings hold
  "the *name* of the secret, not the actual secret value" (line 81).
- **Encryption, desktop.** "Secret Storage is now encrypted while on disk.
  This relies on encryption provided by your operating system. For Linux
  users, this requires that kwallet, kwallet5, kwallet6 or gnome-libsecret are
  installed"
  ([1.11.5 desktop](https://obsidian.md/changelog/2026-01-20-desktop-v1.11.5/)).
  1.12 "Added handling for when encryption is unavailable on some Linux
  machines"
  ([1.12 desktop](https://obsidian.md/changelog/2026-02-27-desktop-v1.12.4/)).
  So at 1.11.4 exactly, the desktop value was not yet encrypted.
- **The API**
  ([typings](https://github.com/obsidianmd/obsidian-api/blob/737629a51f6b4d30f8336fa3d38f3df006e322d4/obsidian.d.ts#L8140-L8172);
  `obsidian@1.14.4`, `obsidian.d.ts` lines 8134-8166):
  - `app.secretStorage`, `@since 1.11.4`
    ([typings](https://github.com/obsidianmd/obsidian-api/blob/737629a51f6b4d30f8336fa3d38f3df006e322d4/obsidian.d.ts#L1379-L1383));
  - `setSecret(id, secret)`: the id is "Lowercase alphanumeric ID with
    optional dashes", and it throws on an invalid id;
  - `getSecret(id)`: the value "or null if not found";
  - `listSecrets()`: every id in the store;
  - no method to delete one. The Importer declares a `deleteSecret` of its own
    to call
    ([augment.d.ts](https://github.com/obsidianmd/obsidian-importer/blob/fa9444a188459f227b07ec121ad03d26bd6b301a/src/augment.d.ts#L76)),
    which is outside the public typings.
- **The store is shared.** Any plugin can call `getSecret` with any id, and
  `listSecrets` returns them all. The changelog presents this as the purpose:
  "a new opt-in way for plugins to save keys that might be shared across
  multiple plugins. For example, a Google API token, or an OpenAI key"
  ([1.11.4 desktop](https://obsidian.md/changelog/2026-01-07-desktop-v1.11.4/)).
  It protects a key from sync and from the disk, not from another plugin the
  user has installed. That is no weaker than `data.json`, which any plugin
  can read as a vault file (**inferred**).
- **The user's side.** 1.11.0 added a "'Keychain' settings section for storing
  plugin secrets"
  ([1.11.0 desktop](https://obsidian.md/changelog/2025-12-10-desktop-v1.11.0/)).
  The user sees, names and removes secrets there.
- **Two ways to use it:**
  - `SecretComponent` (`@since 1.11.1`, its methods 1.11.4), added to a
    setting with `Setting#addComponent` (`@since 1.11.0`): the user picks or
    creates a secret by name, and the plugin saves that name
    ([Store secrets](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Guides/Store%20secrets.md?plain=1#L47-L96),
    [typings](https://github.com/obsidianmd/obsidian-api/blob/737629a51f6b4d30f8336fa3d38f3df006e322d4/obsidian.d.ts#L8117-L8138)).
    From 1.13.2 a declarative settings tab can say `type: 'secret'` instead
    ([typings](https://github.com/obsidianmd/obsidian-api/blob/737629a51f6b4d30f8336fa3d38f3df006e322d4/obsidian.d.ts#L9186-L9199));
  - `setSecret` from the plugin's own field, under an id the plugin chooses.
    Copilot and the Importer do this (below).
- **The name is not the secret, but it syncs.** If the plugin stores the
  secret's name in `data.json`, that name reaches every device, where the
  secret may not exist. The Importer handles it: "SecretStorage is
  device-local even when plugin data syncs", then checks that `getSecret`
  returns a value on this device
  ([format-importer.ts](https://github.com/obsidianmd/obsidian-importer/blob/fa9444a188459f227b07ec121ad03d26bd6b301a/src/format-importer.ts#L756-L758)).
  A fixed id in the code needs nothing in `data.json` (**inferred**).
- **Mobile.** The mobile changelog has "Improved layout of Keychain settings"
  and "Keychain: Disabled auto-capitalization on the 'secret ID' input field"
  ([1.11.5 mobile](https://obsidian.md/changelog/2026-01-20-mobile-v1.11.5/)),
  so the Keychain is on mobile. The typings mark nothing as desktop-only, and
  the Importer (`isDesktopOnly: false`) calls `app.secretStorage` with no
  platform check. **Inferred:** the API works on mobile from 1.11.4. Where
  mobile keeps the value, and whether it is encrypted there, is
  [not verified](#could-not-verify).
- **Version.** 1.11.4 reached early access on 2026-01-07 and was public on
  desktop and mobile on 2026-01-12
  ([desktop](https://obsidian.md/changelog/2026-01-12-desktop-v1.11.4/),
  [mobile](https://obsidian.md/changelog/2026-01-12-mobile-v1.11.4/)). The
  current public release is 1.15.1 on both
  ([desktop-releases.json](https://github.com/obsidianmd/obsidian-releases/blob/68c3912092116ff42e50d52e964d84e7ae997ea4/desktop-releases.json),
  [mobile](https://obsidian.md/changelog/2026-11-12-mobile-v1.15.1/)).

### What the lint says at `minAppVersion` 1.7.2

**Observed**, same set-up as above:

| Code | Result at 1.7.2 | At 1.11.4 |
|---|---|---|
| `this.app.saveLocalStorage('k', 'v')` | error: needs 1.8.7 | passes |
| `this.app.secretStorage.getSecret('id')` | two errors: `App.secretStorage` and `SecretStorage.getSecret` need 1.11.4 | passes |
| the same inside `if (requireApiVersion('1.11.4')) { … }` | passes | passes |
| `this.app.secretStorage?.getSecret('id')` | errors in 0.5.1 | passes |
| `new SecretComponent(this.app, el)` in `addComponent` | errors: need 1.11.1 and 1.11.0 | passes |
| `window.localStorage.setItem(…)` | not reported | not reported |
| `localStorage.setItem(…)` | warning | warning |

- The rule's own advice: "either guard the call, or raise `minAppVersion` if
  the plugin needs the API anyway"
  ([no-unsupported-api](https://github.com/obsidianmd/eslint-plugin/blob/a998a5992b7bf9b6f3e0fe1e61a3ad180546f4a5/docs/rules/no-unsupported-api.md?plain=1#L62-L63)).
- Lint 0.6.0 also accepts the optional access `app.secretStorage?.getSecret(…)`
  as a guard
  ([changelog 0.6.0](https://github.com/obsidianmd/eslint-plugin/blob/a998a5992b7bf9b6f3e0fe1e61a3ad180546f4a5/CHANGELOG.md?plain=1#L47));
  the pinned 0.5.1 doesn't.
- **Raising `minAppVersion` leaves older apps on the last version they can
  run:** "If your `manifest.json` requires a version of Obsidian that's higher
  than the running app, your `versions.json` will be consulted to find the
  latest version of your plugin that is compatible"
  ([README](https://github.com/obsidianmd/obsidian-releases/blob/68c3912092116ff42e50d52e964d84e7ae997ea4/README.md?plain=1#L23)).
  This repository's version script already adds the `versions.json` line when
  `minAppVersion` changes ([section 12a, Releases](../spec-v1.md#releases)).
- A guard instead of a raise means an app older than 1.11.4 has nowhere
  per-device to put the key, so the assistant would have to be off there
  (**inferred**).

### Not candidates

- **`localStorage` or IndexedDB directly.** Per device, but the lint warns on
  the global, and the scorecard notes it under Other as "Local Storage:
  Persists data in `localStorage` or `sessionStorage` instead of the Obsidian
  plugin data APIs" (observed, above).
- **The operating system's keychain through Electron or Node.** Desktop only,
  so it can't serve a plugin with `isDesktopOnly: false`
  ([Mobile development](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Getting%20started/Mobile%20development.md?plain=1#L66-L68)).
- **A file outside the vault.** "Accessing files outside of Obsidian vaults"
  is its own disclosure, and needs Node on desktop
  ([Developer policies](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Developer%20policies.md?plain=1#L37)).

## How listed plugins do it

Precedent only. Each is in the community list today; none shows what the
platform requires.

### Copilot (3.7 million downloads; `minAppVersion` 1.11.4; desktop and mobile)

- **Key:** in the Keychain, under ids the plugin builds, through
  `app.secretStorage`
  ([keychainService.ts](https://github.com/logancyang/obsidian-copilot/blob/208e0db6f5d5faf37058861aecf10b9eef641ecd/src/services/keychainService.ts#L168-L185)).
  Its source notes "`data.json` syncs, the Keychain does not" (same file,
  line 53).
- **README:** "Keys are stored in this device's Obsidian Keychain, not in the
  vault's `data.json`"
  ([README](https://github.com/logancyang/obsidian-copilot/blob/208e0db6f5d5faf37058861aecf10b9eef641ecd/README.md?plain=1#L68)).
  Its docs add: "Keys are per device and do not follow a synced vault, so
  re-enter them … on each device"
  ([FAQ](https://github.com/logancyang/obsidian-copilot/blob/208e0db6f5d5faf37058861aecf10b9eef641ecd/docs/troubleshooting-and-faq.md?plain=1#L62)).
- **Network disclosure:** a section that says where content goes: "Messages
  and note context go to the LLM provider, local endpoint, or CLI agent you
  configure", that an account and payment are needed for paid access, and
  that hosted features "require network access", with a privacy policy link
  ([README](https://github.com/logancyang/obsidian-copilot/blob/208e0db6f5d5faf37058861aecf10b9eef641ecd/README.md?plain=1#L142-L157)).
- **Request route:** `fetch` by default. A per-provider "Enable CORS" switch
  sends requests through a `requestUrl` wrapper instead; "When enabled,
  responses arrive only after completion instead of streaming token by token"
  ([settings.md](https://github.com/logancyang/obsidian-copilot/blob/208e0db6f5d5faf37058861aecf10b9eef641ecd/docs/settings.md?plain=1#L180),
  [chatModelManager.ts](https://github.com/logancyang/obsidian-copilot/blob/208e0db6f5d5faf37058861aecf10b9eef641ecd/src/LLMProviders/chatModelManager.ts#L100-L124),
  [utils.ts](https://github.com/logancyang/obsidian-copilot/blob/208e0db6f5d5faf37058861aecf10b9eef641ecd/src/utils.ts#L445-L468)).
  This is the trade-off of [The request route](#the-request-route), left to
  the user.
- **Listing:** review "Satisfactory", payments "Optional".

### ChatGPT MD (`minAppVersion` 1.11.4; desktop and mobile)

- **Key:** in `SecretStorage` through `SecretComponent`, with only references
  in plugin data: "provider and web-search keys are stored as vault-local
  Obsidian credentials; plugin data contains only opaque references"
  ([README](https://github.com/bramses/chatgpt-md/blob/c4de557cf2f1cec9607e8b2a44660e8d2de5d0a7/README.md?plain=1#L226-L231)).
  Its requirement line: "Obsidian **1.11.4 or newer** (needed for secure key
  storage)" (same file, line 25).
- **Network disclosure:** a Privacy section: "Your messages are sent to their
  servers", "Chat messages and automatically expanded `[[linked notes]]` are
  sent to the selected provider", "No tracking from this plugin" (same file,
  lines 215-236).
- **Request route:** "Use Node HTTP on desktop to bypass CORS, with
  standards-based fetch on mobile", both streaming
  ([requestStream.ts](https://github.com/bramses/chatgpt-md/blob/c4de557cf2f1cec9607e8b2a44660e8d2de5d0a7/src/Services/requestStream.ts#L69-L74)).
- **Listing:** review "Satisfactory".

### Smart Composer (`minAppVersion` 0.15.0; desktop and mobile)

- **Key:** in `data.json`, as a field of each provider in the settings that
  `loadData` and `saveData` carry
  ([main.ts](https://github.com/glowingjade/obsidian-smart-composer/blob/6b38ab3c57e03c5c6cbeb79815277857df59cbd8/src/main.ts#L156-L172),
  [provider.types.ts](https://github.com/glowingjade/obsidian-smart-composer/blob/6b38ab3c57e03c5c6cbeb79815277857df59cbd8/src/types/provider.types.ts#L6)).
  So it syncs with the vault. The README says only "API Key (stored
  locally)".
- **Network disclosure:** a list of supported providers and one caution,
  "please review the provider's privacy policy before sending sensitive data"
  ([README](https://github.com/glowingjade/obsidian-smart-composer/blob/6b38ab3c57e03c5c6cbeb79815277857df59cbd8/README.md?plain=1#L98-L142)).
- **Request route:** the providers' own SDKs in the web view, with the SDK's
  browser switch on
  ([anthropic.ts](https://github.com/glowingjade/obsidian-smart-composer/blob/6b38ab3c57e03c5c6cbeb79815277857df59cbd8/src/core/llm/anthropic.ts#L46-L52)).
- **Listing:** review "Risks", with the `fetch` warning among many others. It
  is listed and installable. Older plugins "have been temporarily granted an
  exception" from the new review
  ([The future of Obsidian plugins](https://obsidian.md/blog/future-of-plugins/)),
  so this is the weakest of the three as a guide to what passes today.

### Importer, by Obsidian (`minAppVersion` 1.13.0; desktop and mobile)

- Not an AI plugin, but Obsidian's own use of the same parts: an API token
  through `SecretComponent`, a refresh token through `setSecret` under a fixed
  id, small state through `saveLocalStorage`, and both `requestUrl` and
  `fetch`
  ([onenote.ts](https://github.com/obsidianmd/obsidian-importer/blob/fa9444a188459f227b07ec121ad03d26bd6b301a/src/formats/onenote.ts#L411-L435),
  [format-importer.ts](https://github.com/obsidianmd/obsidian-importer/blob/fa9444a188459f227b07ec121ad03d26bd6b301a/src/format-importer.ts#L756-L800)).
- Its help page shows the user's side: "Under **API token**, click **Link...**
  to add a new secret. For the **ID**, give it a name like `notion`, and for
  the **Secret** paste your **Access token**"
  ([Import from Notion](https://github.com/obsidianmd/obsidian-help/blob/ced32050c0d9d1e1f8d3faa19a8ba8474d75a32d/en/Import%20notes/Import%20from%20Notion.md?plain=1#L58)).
- **Listing:** review "Passed".

### What the three have in common

- The two that were updated this year keep keys in `SecretStorage` and
  declare `minAppVersion` 1.11.4.
- All three say in the README that messages go to the provider the user
  chooses. None puts it in the manifest's `description`.
- The two that stream use `fetch` on mobile.

## Where this meets today's rules

Each line is a rule that is in force today and that the 0.6.0 feature makes
untrue or trips. What replaces it is for the decision tickets, not this note.

- **[Section 12a, Data protection](../spec-v1.md#data-protection): "No
  network, ever."** One request per Send contradicts it as written.
- **The same section: "Storage only in the vault … No IndexedDB,
  `localStorage` or `App#saveLocalStorage`."** Both per-device candidates are
  outside the vault. `secretStorage` isn't named there, but "only in the
  vault" excludes it.
- **The README's Privacy section**: "No network requests. The plugin loads
  nothing from the internet and sends nothing to it" and "Nothing outside
  your vault" ([README](../../README.md)). The developer policies make the
  README the place where network use has to be explained.
- **The description**, "Works fully offline; makes no network requests."
  ([`manifest.json`](../../manifest.json)).
- **The bundle audit** ([`audit-plugin.mjs`](../../scripts/audit-plugin.mjs)).
  **Observed** by feeding `auditBundle` one line of sample text at a time:

  | Text in `main.js` | Audit |
  |---|---|
  | `this.app.saveLocalStorage(…)`, `loadLocalStorage(…)` | passes: the forbidden string is `localStorage`, and the match is case-sensitive |
  | `this.app.secretStorage.setSecret(…)` | passes |
  | `window.localStorage.setItem(…)` | fails |
  | any `https://` provider host, through `requestUrl` or `fetch` | fails: "names https://…, which isn't in the allowlist" |

  - So the audit doesn't enforce section 12a's `App#saveLocalStorage` rule
    today; only the spec does.
  - The allowlist's own comment says "Every entry says why it can't reach the
    network"
    ([`plugin-allowlist.json`](../../scripts/plugin-allowlist.json)). A
    provider host is the first entry that could.
  - The audit's closing line prints "nothing reaching the network".
- **The network-blocked run** fails on "any attempted request"
  ([section 12a](../spec-v1.md#data-protection)). It stays true only while no
  test presses Send.
- **Obsidian's lint at `--max-warnings 0`** ([`package.json`](../../package.json)):
  - a bare `fetch` fails it, and can't be disabled in a comment;
  - `app.secretStorage` or `app.saveLocalStorage` fails it at `minAppVersion`
    1.7.2, unless guarded or the version is raised.
- **`src/` never imports `obsidian`**
  ([section 12a, One source, two builds](../spec-v1.md#one-source-two-builds)).
  `requestUrl` and `secretStorage` are reachable only from `plugin/`, so the
  shared app would take the request route and the key store as ports, as it
  takes the file adapter. `fetch` needs no import. (**Inferred** from the
  existing split.)
- **The fake `obsidian`** in [`plugin/test/`](../../plugin/test/obsidian.ts)
  has neither `requestUrl` nor `secretStorage` today (searched).

## Left for the map to decide

- The README's and the listing's words for the network use, and the
  description's last sentence.
- The payment label's explanation text.
- `fetch` or `requestUrl`: streaming against independence from the provider's
  cross-origin rules. It turns on [`provider-apis.md`](provider-apis.md).
- `secretStorage` or `saveLocalStorage` for the key, and with it whether
  `minAppVersion` rises to 1.11.4 (or 1.11.5, where the desktop value is
  encrypted) or the calls are guarded.
- The key's id in the Keychain, and whether the user types the key into the
  plugin's own field or picks a secret with `SecretComponent`.
- What replaces "No network, ever", the storage rule, the audit's allowlist
  meaning and the blocked run.
- Whether the lint moves to 0.6.0.

## Could not verify

- **How the scanner finds network use.** No published source says what counts
  as a "network request call", how the "external domains" are chosen (the
  lists seen omit provider hosts and include hosts that look like links),
  whether it reads the source or the built `main.js`, or what the entry
  "Network requests scan not available." means. Tried: the developer docs,
  the help vault, the lint's source and docs, the release repository, the
  blog post, and seven live scorecards.
- **Whether any network finding can be an error.** None was on the seven
  scorecards, and no doc lists the scanner's errors beyond the lint's.
- **Whether the scanner checks the README for a network disclosure.** The
  scorecard says calls "should be disclosed in the plugin README"; nothing
  says it looks.
- **The dashboard's forms.** Submitting and editing a listing need a signed-in
  owner. Not seen: whether a form asks about network use, how the payment
  explanation is entered, and whether the listing's short description starts
  as the manifest's `description`.
- **What a manual review would ask** of a plugin that takes a provider key.
  Manual reviews are for "popular, featured, and flagged plugins"; no
  checklist for them is published.
- **`SecretStorage` on mobile:** where the value is kept, and whether it is
  encrypted. The encryption note is in the desktop changelog only. That the
  API works on a phone at all is inferred, not run.
- **`SecretStorage` on desktop:** how "stored in local storage" (the guide)
  and "encrypted while on disk" (the changelog) fit together, and what
  happens on a Linux machine with no keyring beyond "Added handling".
- **Per vault or per device-wide.** The guide says "keyed to the specific
  vault". Copilot nonetheless puts a hash of the vault's path into each id.
  Not tested in the app.
- **Clearing a secret.** The typings have no delete. The Importer calls an
  undeclared `deleteSecret`; whether `setSecret(id, '')` clears is not
  documented.
- **`fetch` inside Obsidian.** No Obsidian page says that the desktop,
  Android and iOS web views apply cross-origin rules as a browser does, or
  which origin they send. The precedents behave as if they do. Not run: there
  is no Obsidian in this environment.
- **`requestUrl` on mobile.** That it buffers the whole reply and ignores
  cross-origin rules there too is read from the typings, which state no
  platform difference. Not run on a device.
- **Whether `App#loadLocalStorage` exists at run time before 1.8.7.** The
  typings' `@since` is the only source; the 1.8.7 changelog doesn't mention
  it.
- **The published docs pages.** docs.obsidian.md and help.obsidian.md answered
  but return a page that fills in with scripts, so their text was read from
  the GitHub sources. Whether the published pages are ahead of the
  repositories was not checked.
- **The GitHub links as web pages.** github.com's file views answered 403
  from this environment. The repositories were cloned at the commits named,
  and each link's path and line range was checked against the clone, not
  opened in a browser.
