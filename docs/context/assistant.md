# assistant

One module of Excalimathpad, as the code is today. [`CONTEXT.md`](../../CONTEXT.md) holds the
model, the terms and the load-bearing rules, and names every module; the behaviour is in
[the spec](../spec-v1.md), by the section numbers cited here. Read this file when an issue
touches this module, and keep it true in the pull request that changes the module.

**assistant** (`src/assistant/`, spec section 8, Math assistant; section 14, 0.7.0;
[ADR 0008](../adr/0008-math-assistant-calls-the-users-provider-directly.md)) — everything of
the Math assistant. It never calls the network or a store itself: both reach it through the
ports a home hands App. Depends on: text, math (the evaluation's types and the line as the
engine reads it), overlay (the reading order) and canvas's `sceneTexts` (a type). Built so
far: the first four issues of the first slice, which are the module, its ports, the switch
and its tab (#306), the setup: its record, both stores and the card (#307), the
listing (#308), and the two adapters, their readers, the fixtures and the default models
(#309). It makes no request yet: nothing calls the adapters until the Send (#310).

**The ports** (`ports.ts`). `AssistantPorts` is `{ request, store }`, App's `assistant` prop:

- `request: AssistantRequest` is shaped like the browser's own request function:
  `(address, { method, headers, body?, signal })` gives a promise of
  `{ status, headers: { get }, body }`, the body a `ReadableStream<Uint8Array>` read in
  pieces (or `null`). It rejects when nothing readable came back. The browser's own function
  fits it as it is, so each home passes a one-line wrapper.
- `store: SetupStore | null` keeps the setup, one record per device, as text: `read()` gives
  the text or `null`, `write(text)` replaces it, `remove()` forgets it. All three answer at
  once, and **may throw**: the error is the store's own and reaches the card. A store only
  keeps the text. `null` is a home with nowhere to keep one (an Obsidian older than 1.11.4):
  the tab then says so and draws nothing else.
- **The web's store** is `storageSetupStore(storage)`, one entry `excalimathpad.assistant`
  (`SETUP_ENTRY`) beside the panel memory's. `src/main.tsx` hands it
  `() => window.localStorage`, asked on each call and not caught, so this module names no
  browser storage and a blocked or full one throws into the keeper. **The plugin's store**
  is in `plugin/assistant.ts` ([plugin](plugin.md)). `sessionSetupStore()` is for tests.

**The setup** (`setup.ts`, section 8, The setup card). `Setup` is the record:
`{ provider, address, model, key, hosts }`, `provider` a built-in's id or `other`, `hosts`
the confirmed hosts (nothing writes one yet: the first request is a later issue's).
`setupText` and `readSetup` are the only code that knows the record's text; `readSetup`
gives `null` for nothing, an empty entry or text that isn't a record, takes a built-in's
address from the constant whatever the entry says, and refuses a typed address that fails
the check. `setupKeeper(store)` is **the one keeper of a store** (a `WeakMap`), read once and
then held: `state()` is `{ setup, session, removed }`, with `subscribe` for
`useSyncExternalStore`; `save`, `removeKey` (writes the record again without the key) and
`forget` (the store's `remove`). When `write` throws, the keeper holds the setup itself and
`session` is the store's error, any copy of the key in it replaced by "…" and its last four
characters; the next Save tries the same store again. It is held above the tab because
Excalidraw removes a tab's content while another shows, and because every sheet tab of a
vault shares the plugin's one store. `keyEnding` is all of a key that is ever drawn.

**The address check** (`address.ts`, section 14, 0.7.0): `checkAddress(typed)`, pure, gives
the trimmed address and its host (with its port), or why Save refuses (`notUrl`,
`notHttps`, `credentials`); `hostOf` is the `<host>` the card's lines name.

**The card** (`SetupCard.tsx`, `AssistantTab.css`; its words are the text tables'
`assistant` group, [text](text.md)). It takes the keeper and whether the home is a vault
(where the key is kept reads differently). The key is in it only as the field's value
between a paste and Save. Show models and Check key are drawn dimmed: their request is a
later issue's. A label wraps its field only, never a button, or the button's words become
part of the field's name. `SetupCard.test.tsx` holds the card against fake ports,
`canary.test.tsx` the canary key in the real app, and `plugin/test/assistant.test.ts` both
in a vault. The card at a 280 px panel is a hand check in Chromium (a build with the switch
on), until the panel run has the tab (#312).

**Where the ports come from.** `src/main.tsx` (the web) and `plugin/assistant.ts`
(`assistantPorts(on, mobile)`, called by `SheetView`) are the only two files that name a
request API. `plugin/test/requestApis.test.ts` holds that, by whole words over every file's
text, comments included: so **a comment in `src/` can't spell the browser's request
function's name** either, outside `src/main.tsx`. `plugin/test/` is left out of the check.
The plugin passes no ports when `Platform.isMobile` is true.

**The switch** (section 14, Off until it is proved). `assistantSwitch.ts`, at the repository
root, is read by both builds (`vite.config.ts`, `esbuild.plugin.mjs`), which define the
constant `__ASSISTANT__` (typed in `src/buildStamp.d.ts`): `true` only when the build's
environment has `EXCALIMATHPAD_ASSISTANT=on`, so off in every build from `main`, in CI and
in the tests. Each home passes the ports only when it is true. A developer's build:
`EXCALIMATHPAD_ASSISTANT=on npm run dev` (or `npm run build`). #312 turns the default on.
**App never reads the constant:** it shows the assistant where it is handed ports, which is
how the tests show it with the switch off (a fake `assistant` prop; `SheetView`'s
`assistant` option in `plugin/test/assistant.test.ts`).

**The tab** (`AssistantTab.tsx`). App fills the Sheet panel's `assistant` slot with it,
inside a tab boundary, when it has ports; the canvas draws the tab's trigger (a speech
bubble), its heading and the More tools item ([canvas](canvas.md)), and App keeps the chat
when an edit opens ([app](app.md)). It takes the ports and `vault`, and draws the setup card
in `.assistant-tab`, or the line that it needs Obsidian 1.11.4 where the store is `null`.
The conversation (#310) takes the card's place where a setup is saved.
`place.test.tsx` holds its place against the real Excalidraw.

**The listing** (`listing.ts`, section 8, The listing and What a Send carries; section 14,
0.7.0). `listSheet(input)` is the one pure function: from the last evaluation (`elements`,
each `{ anchorId, title, source, formats, lines }`, which the overlay's `EvaluatedElement`
fits), the anchors' boxes, the scene's texts (`sceneTexts`, [canvas](canvas.md)), the
sheet's unit system and Digits, and the words of the language shown, to one of three:
`listing` (its `text`, its `counts` of math elements, lines and texts, and **the map**),
`empty` (no math element and no text) or `tooLong` (over `LISTING_LIMIT`, 200,000 by
`length`: both numbers and the refusal worded, the text never cut). Math elements and texts
go together in `readingOrder`. A line goes as `sentLines` gives it, `withFormat` with its
stored clause; a result, an error and a warning are worded through `wordMessage` in the
language given, and every mark is English. An empty result is `(function)` when the line
defines a function and `(input)` otherwise (a table and a plot have their own rows, a
comment line none): the engine marks neither, so a bare expression whose value is a function
reads as `(input)`. A table's headers are its arguments as typed (`readTable`) with the
column's unit, and its first `TABLE_ROWS` (20) rows; a plot, its points and its failed
points; a solve line, its `solveDetails` on one `solve:` row. A line break in a text or a
message is written `\n` in a text, and folded to a space in a row. Nothing else of the scene
reaches it: the input holds no file name, no image, no shape, no title format, no rule state,
no Result colour and no Page, and the map's ids are never written into the text.
`listing.test.ts` holds the form mark for mark, what it never holds, the cap, the map, and
every acceptance sheet and Math guide example in both languages. **The map**
(`ListingMap`): each label (`E2`, `E2:3`, `T1`) to its anchor or text element, the line's
index from 0 and the line's text as sent. `chipTarget(map, label, now)` is what a chip does
after the sheet changed: `jumps`, `changed`, `gone` or `unknown`. Nothing calls them yet: the
Send (#310) keeps a listing per Send, and the chips and "Sent with this" (#311) read it.

**The provider constants** (`providers.ts`, section 14, 0.7.0): `PROVIDERS`, the four
built-ins in the setup card's order, each `{ id, name, address, adapter, defaultModel,
retires, checked, deprecations }`: `adapter` is `messages` (Anthropic) or `chat`; `retires`
is the default's retirement date or `null`, `checked` the day its provider's deprecations
page was last read, `deprecations` where, as plain text. OpenRouter's default is its own
name for Sonnet 5.5, `anthropic/claude-sonnet-5.5`, from its keyless `GET /models`. The
file imports nothing, so Node runs it as it is, for the Release button. **The card imports
the constants, so every build's `main.js` holds the four addresses,** switch on or off, each
once: `scripts/plugin-allowlist.json` names their hosts in its `reached` list, which the
bundle audit lets through (#307), and `providers.test.ts` fails when that list and the
constants' hosts differ, in either direction. The audit's check of the built bundle for a
host named twice is #312's (section 12a, Data protection). A key page in a cost line, and a
`deprecations` page, are plain text with no `https://` for that reason.

**The Release button's check** (section 12a, A default model's retirement):
`scripts/release-models.mjs`, a step of `.github/workflows/release.yml` before the version
is bumped, never of `npm run check`. `refusals(providers, today)` is the rule, a line per
default within 90 days of its `retires` or checked more than 180 days ago, each naming the
model and what to do; `scripts/release-models.test.mjs` holds it with fixed dates.

**The adapters** (`adapters.ts`, section 14, 0.7.0; ADR 0008), hand-written, no SDK, both
through the `request` port only. A `Target` is `{ address, adapter, provider, key }`
(`provider` null for a typed address); `Carried` is what a Send carries, in its order:
`{ model, instructions, guide, listing, conversation, message }`, the listing `null` on an
empty sheet. `sendRequest` and `modelsRequest` build a request; the key goes only into
`authorization: Bearer`, and nowhere for a typed address with none.

- **Chat Completions:** `POST <base>/chat/completions`, `{ model, stream, messages }`: one
  system message, the instructions, the guide and the listing joined by blank lines, then
  the conversation and the message. The model list is `GET <base>/models`.
- **Messages:** `POST <base>/v1/messages` with `anthropic-version` (`ANTHROPIC_VERSION`,
  `2026-10-21`) and `anthropic-dangerous-direct-browser-access: true`; `{ model, max_tokens,
  stream, system, messages }`, `system` the instructions, the guide with its cache mark and
  the listing as three text blocks; `MAX_TOKENS` is 32,000. The model list is
  `GET <base>/v1/models`, with the same two headers.
- Either way the body's start, up to the end of the guide, is the same bytes on every Send.

`ask(request, target, carried, signal, onText)` sends, reads the answer as it arrives
(`onText` gets the whole text so far) and gives an `Outcome`, never throwing: `answer`, `cut`
(no end mark, a dropped connection, or `cap` at the token cap, with or without text),
`stopped` (the signal), or `failed` with a `Failure` and what had arrived. `listModels` is
Show models' and Check key's request: the names, or a `Failure`.

**The stream reader** (`stream.ts`): `readEvents(body, signal)` gives each whole
server-sent event, `{ event, data }`, carrying an event or a character cut between two
pieces, skipping `:` comments, and cancelling the body when it stops early or the signal
aborts. The end marks are Chat Completions' `data: [DONE]` and Messages' `message_stop`; an
error inside a 200's stream (Anthropic's `error` event, OpenRouter's top-level `error`) is
read by the error reader.

**The error reader** (`errors.ts`, section 13, Math assistant, the notes under its table):
`readFailure(status, text, provider, key)` gives `refusedKey`, `unknownModel`, `noCredit`
(each built-in's own recogniser, never a typed address's) or `other`, each with `said`, the
provider's message from any of the six body shapes (`errorOf`), with the key hidden by
`hideKey` (`setup.ts`, the keeper's too). `nothing`, no answer the page could read, is the
port's rejection.

**The fixtures** (`fixtures/`, its `README.md`): `messages/` and `chat/`, one `.http` file
per answer, a header saying where it is from, then the status, the content type and the body
byte for byte. `fixtures/load.ts` reads them and is the fake `request` port, answering a few
bytes at a time. `adapters.test.ts` runs each adapter on every fixture at several piece
sizes, an abort, a cut-short stream, a failure with nothing readable, and the canary key,
which shows nowhere but a request's header; it fails on a fixture shaped like a key.
`npm run assistant:record` (`scripts/assistant-record.mjs`) re-records them by hand with
`ASSISTANT_PROVIDER` and `ASSISTANT_KEY`, takes the key and account ids out, and refuses to
run in CI.

**Size** (section 14, Size). `main.js` before the slice: **3,493,012 bytes** at `a90b6a9`
(the same as at `c3b55a7`), against a budget of 3,574,000. The first slice may add at most
120,000 bytes; #312 measures after and raises `BUDGET` once. After #307: 3,508,154. The
adapters and the two readers (#309), alone with the plugin's esbuild settings, are 4,698
bytes minified (2,087 gzipped), against the research's 3,825; the constants grew by 499.
