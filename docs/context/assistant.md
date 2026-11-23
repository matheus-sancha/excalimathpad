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
listing (#308), the two adapters, their readers, the fixtures and the default models
(#309), the Send: the conversation, the chat, the first request's confirm, Show models
and Check key (#310), and the answer's form: the small Markdown, the chips, suggested lines
and Sent with this (#311). **It is on since #312,** which added the assistant run and turned
the switch on. Only a press makes a request: Send, Show models, Check key, and Try again or
Check key under a failed answer.

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
the confirmed hosts (`confirmHost` adds one, after the first request's confirm).
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
between a paste and Save. **Show models and Check key** (#310) read the card's fields as
they are (Save's refusals first) and ask `listModels` through the gate: Show models fills a
pick list, or says it couldn't and leaves the field; Check key says accepted, refused, the
provider's words, or that nothing came back with the origin the address must allow. A host
confirmed here before Save is kept by Save; one for the saved setup, at once. A label wraps its field only, never a button, or the button's words become
part of the field's name. `SetupCard.test.tsx` holds the card against fake ports,
`canary.test.tsx` the canary key in the real app, and `plugin/test/assistant.test.ts` both
in a vault. The panel run holds the card at 280 and 320 px, in English and Português, with a
typed address's field shown (#312).

**Where the ports come from.** `src/main.tsx` (the web) and `plugin/assistant.ts`
(`assistantPorts(on, mobile)`, called by `SheetView`) are the only two files that name a
request API. `plugin/test/requestApis.test.ts` holds that, by whole words over every file's
text, comments included: so **a comment in `src/` can't spell the browser's request
function's name** either, outside `src/main.tsx`. `plugin/test/` is left out of the check.
The plugin passes no ports when `Platform.isMobile` is true.

**The switch** (section 14, Off until it is proved). `assistantSwitch.ts`, at the repository
root, is read by both builds (`vite.config.ts`, `esbuild.plugin.mjs`), which define the
constant `__ASSISTANT__` (typed in `src/buildStamp.d.ts`): **on since #312,** in every build
from `main`, in CI and in the tests, and `false` only when the build's environment has
`EXCALIMATHPAD_ASSISTANT=off` (a developer's build). Each home passes the ports only when it
is true, and the plugin only on a computer. **App never reads the constant:** it shows the
assistant where it is handed ports (a fake `assistant` prop in the tests; `SheetView`'s
`assistant` option, `false` for a build with the switch off, in
`plugin/test/assistant.test.ts`).

**The tab** (`AssistantTab.tsx`). App fills the Sheet panel's `assistant` slot with it,
inside a tab boundary, when it has ports; the canvas draws the tab's trigger (a speech
bubble), its heading and the More tools item ([canvas](canvas.md)), and App keeps the chat
when an edit opens ([app](app.md)). It takes the ports and `vault`, and draws the setup card
in `.assistant-tab`, or the line that it needs Obsidian 1.11.4 where the store is `null`.
App also hands it the open sheet's `conversation` and `sheet` (`AssistantSheet`, `sheet.ts`);
with both and a saved setup it draws the chat, whose field gives way to the card when the
key button opens it or when the setup can't send (a built-in with its key removed).
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
index from 0 and the line's text as sent, and an element's title as sent. `chipTarget(map,
label, now)` is what a chip does after the sheet changed: `jumps`, `changed`, `gone` or
`unknown`. The Send (#310) keeps each message's listing, counts and map (`SentWith`).
`sheetNow` (`sheet.ts`) is the listing with each math element's name and line count, for
"Goes with your message", and the scene as the chips read it: each element's lines and each
text (`scene`) and each element's name now (`names`, as `elementLabel` names it). App's
`AssistantSheet.now()` gives it, cached until the sheet may have changed; its `jump` is the
Problems row's (App's `jumpTo`: scroll, select, the flash only for a line, a floating panel
closed, the keyboard to the canvas).

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
constants' hosts differ, in either direction, and so does the bundle audit, which reads the
constants itself (`PROVIDER_HOSTS`, #312) and also fails when `main.js` names `https://` and
a reached host more than once (section 12a, Data protection). A key page in a cost line, and a
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
`ASSISTANT_PROVIDER` and `ASSISTANT_KEY`, takes the key and account ids out, writes nothing
unless the answer and the model list are both a 200, and refuses to run in CI. Anthropic's four
were recorded from the live API on 2026-11-22; `messages/answer-pieces.http` keeps the
documentation's answer in two pieces, which the live one wasn't, for the tests between pieces.
A new fixture may not show up in `npm test` until `node_modules/.vitest-cache` is deleted:
Vitest's module cache keeps the old list.

**The conversation** (`conversation.ts`, section 8, The conversation and What a Send
carries; section 14, The conversation is held outside the tab's content).
`createConversation()` is an external store, one per open sheet, held by App: `entries`
(each `Message` with its `SentWith`, each `Answer` with its `state`, `waiting`, `arriving`,
`answer`, `stopped`, `cut` or `failed`, its `failure` and a Check key's `check`), `busy` and
the field's `draft`. `send` runs `ask` with the instructions, the guide, that Send's listing,
`turnsOf` the entries before (each message and each answer's text, as the list shows it) and
the message; `retry` asks the last message again with the sheet as it is now, in place of
what failed; `checkKey` is `listModels` under a failed answer; `stop` aborts the request's
signal; `clear` (New chat) and `end` (the sheet closed) abort it and empty the list, and a
late piece of the old request changes nothing. It has no timer: `quietSince` is when
something last arrived, for the tab's 30-second hint (`QUIET_MS`, `answerWords.ts`).

**The chat** (`Chat.tsx`). The header (New chat, the key button), the list (the empty state
with the three suggested questions, each message as plain text with "Sent with this" under
it, each answer in the small Markdown, the status line, the failure's lines from `failureLines` with Check key and Try again), the
confirm, a too-long sheet's refusal, "Goes with your message" (pressed: each element and
its line count), the `<textarea>` and Send or Stop, and the hint. Enter sends, Shift+Enter
is a new line, Esc stops; a suggested question and Try again leave the open line first
(`leaveLine`). Every chat button has `tabIndex={-1}` and prevents its `mousedown`. A key in
the field never reaches Excalidraw: it is inside `.sheet-sidebar__keys`, and Excalidraw's own
document listener ignores a textarea; `conversation.app.test.tsx` holds it with a math
element selected (`m r 1 d`, Delete, Backspace), against the real Excalidraw, with the
control. **The first request's confirm** (`hostGate.tsx`, `HostConfirm.tsx`, section 12a, To
the one host): `useHostGate(confirmed).ask(reason, target, go)` runs `go` at once for a
confirmed host, else shows the confirm; Cancel sends nothing, Send or Continue calls
`confirmed` (the keeper's `confirmHost`) and then `go`.

**The answer's form** (section 8, An answer; section 14, 0.7.0). **The reader**
(`markdown.ts`, no dependency): `readAnswer(text, arriving)` gives blocks (`paragraph`, its
lines kept; `list`, ordered from its first number, a nested item a line of its item with its
mark; `code`, its lines unread) of parts (`text`, `bold`, `code`, `ref`). Everything else is
text: a heading, a table, a quote, raw HTML, a formula; a link is its text, an image its
words. It reads the whole text on every piece. While `arriving`, a last line that is only a
list's number or a fence's first backticks waits, and so does a tail that may yet be a label,
a link, a `*` run, a `\` or a `!`; an unclosed bold or inline code runs to the end.
`markdown.test.ts` cuts an answer at every character and holds that each block drawn is the
whole answer's, character by character as drawn. **`AnswerText.tsx`** draws the parts as text
in the chat's own elements, a code block with its mark and a Copy on each line with text
(the button's own window's clipboard; "Copied" for 1.5 s); `AnswerText.test.tsx` is the
hostile answers. **The chips** (`chips.ts`): `chipOf(map, label, now, words)` gives `{ state,
name, to }` or `null` for plain text (no map, or a label in none); a line in the panel's words
(`panel.line`), an element by its name now or, gone, as sent; a text by `firstWords` (four
words, 32 characters). `Chat.tsx`'s `ChipView` draws it: a button that calls `sheet.jump`, or
`<s>` when gone. An answer reads its labels against the `SentWith` of the message before it.
**Sent with this** (`SentWithView`) opens the sent listing in a `<pre>`, with its heading and
last line; an empty sheet's is a plain line. When the paste of several lines (#313) is in
`main`, a code block has one Copy.

**What goes with every Send.** `instructions.ts` holds the instructions, the spec's text word
for word, which `instructions.test.ts` reads from the spec. The Math guide goes as a **second
copy of the English file** (`docs/math-guide.md?text`, [guide](guide.md)), not rebuilt from
the elements, so the model reads the file #247 tested; the test holds it to the file.

**Size** (section 14, Size). `main.js` before the slice: **3,493,012 bytes** at `a90b6a9`
(the same as at `c3b55a7`), against a budget of 3,574,000. The first slice may add at most
120,000 bytes; #312 measures after and raises `BUDGET` once. After #307: 3,508,154. The
adapters and the two readers (#309), alone with the plugin's esbuild settings, are 4,698
bytes minified (2,087 gzipped), against the research's 3,825; the constants grew by 499.
After #310: **3,580,181** bytes (`main` before it: 3,509,028, so +71,153: about 42,900 for the
guide's copy, the rest the conversation, the chat and their words); the slice so far,
+87,169 of its 120,000. After #311: **3,589,407** (+9,226: the reader, the chips, Sent with
this, their words and styles), over 3,585,000, so `BUDGET` is 3,595,000 by #310's rule; the
slice so far, +96,395. After #312 (the switch on, `aiEnabled` off): **3,589,415**, the
slice's whole growth +96,403 of its 120,000; by the same rule the budget stays 3,595,000.

**The assistant run** (`scripts/assistant-run.mjs`, `npm run test:assistant`, section 12a,
Checked on every pull request; #312). Four passes, each home with the built-in (Anthropic)
and with a typed address (`http://127.0.0.1:<port>/v1`), the setup entered in the card. A
`context.route` over every request is the stand-in: it answers `api.anthropic.com` from
`fixtures/` (and step 6's hostile answer, and a 401 that echoes the key, built in the
script), passes the typed address on to the script's own server, and logs every request by
the step it belongs to; anything else is aborted and fails the pass. It reads the store's
record for the confirmed hosts (`secretStorage` in the fake `obsidian`, `localStorage` on the
web) and looks for the canary in `data.json`, the vault's text and writes, the recovery copy,
a saved file (the save dialog stood in by a file of the page's private file system), the
page, the console, and Copy details and Report this error. The page's init script makes
those reachable: a clipboard that keeps what is copied, a `navigator.onLine` that throws on
demand (the chat reads it as it draws, so its tab fails into its notice) and a `Map` lookup
of the `\rho` row's TeX that throws on demand (so an element fails, with Copy details and
Report this error). `--probe-background` and `--probe-host` fail it on purpose; each pass
prints its time.
