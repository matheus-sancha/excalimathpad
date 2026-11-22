# assistant

One module of Excalimathpad, as the code is today. [`CONTEXT.md`](../../CONTEXT.md) holds the
model, the terms and the load-bearing rules, and names every module; the behaviour is in
[the spec](../spec-v1.md), by the section numbers cited here. Read this file when an issue
touches this module, and keep it true in the pull request that changes the module.

**assistant** (`src/assistant/`, spec section 8, Math assistant; section 14, 0.7.0;
[ADR 0008](../adr/0008-math-assistant-calls-the-users-provider-directly.md)) — everything of
the Math assistant. It never calls the network or a store itself: both reach it through the
ports a home hands App. Depends on: nothing yet. Built so far: the first issue of the first
slice (#306), which is the module, its ports, the switch and its empty tab. It makes no
request and stores nothing.

**The ports** (`ports.ts`). `AssistantPorts` is `{ request, store }`, App's `assistant` prop:

- `request: AssistantRequest` is shaped like the browser's own request function:
  `(address, { method, headers, body?, signal })` gives a promise of
  `{ status, headers: { get }, body }`, the body a `ReadableStream<Uint8Array>` read in
  pieces (or `null`). It rejects when nothing readable came back. The browser's own function
  fits it as it is, so each home passes a one-line wrapper.
- `store: SetupStore` keeps the setup, one record per device, as text: `read()` gives the
  text or `null`, `write(text)` replaces it, `remove()` forgets it. All three answer at once
  (browser storage and Obsidian's secret storage both do). The record's fields are the
  assistant's own (the setup's issue, #307); a store only keeps the text.
- `sessionSetupStore()` lasts as long as the page. **Both homes pass it today,** so nothing
  is kept: #307 replaces it with the browser's entry in `src/main.tsx` and Obsidian's secret
  storage in `plugin/assistant.ts`.

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
when an edit opens ([app](app.md)). It takes the ports and draws an empty
`.assistant-tab` until the setup card (#307) and the conversation (#310) fill it.
`place.test.tsx` holds its place against the real Excalidraw.

**The provider constants** (`providers.ts`): `PROVIDERS`, the four built-ins in the setup
card's order, each `{ id, name, address, defaultModel }`. OpenRouter's `defaultModel` is
`null` until #309 reads OpenRouter's own name for Sonnet 5.5, and adds each model's
retirement date and the date it was last checked. **Nothing imports the constants yet, so
no build holds a provider's address.** The first issue to import them into the tab puts the
four hosts into `main.js` in every build, switch on or off, and the bundle audit then fails
on each until `scripts/plugin-allowlist.json` names it (its `reached` list is #312's,
section 12a, Data protection).

**Size** (section 14, Size). `main.js` before the slice: **3,493,012 bytes** at `a90b6a9`
(the same as at `c3b55a7`), against a budget of 3,574,000. The first slice may add at most
120,000 bytes; #312 measures after and raises `BUDGET` once.
