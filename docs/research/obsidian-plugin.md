Research for wayfinder ticket #116, 2026-11-14.

# What an Obsidian community plugin needs to open `.excalimathpad` files in its own view

**Question.** What does a plugin that bundles this React app (Excalidraw 0.18,
math.js, KaTeX, Observable Plot) and opens a custom file extension in its own
tab have to do, and what is it not allowed to do? Cover the view and the file
round trip, React and CSS, the bundle (chunks, workers, fonts, network), keys,
desktop and mobile, and the submission.

**How to read the sources.** Every Obsidian claim links to a file in an
Obsidian-owned repository, pinned to the commit read on 2026-11-14:

- developer docs, `obsidianmd/obsidian-developer-docs` at `1c26772`;
- the API typings, `obsidianmd/obsidian-api` at `879c936` (package `obsidian`
  1.14.4);
- the help vault, `obsidianmd/obsidian-help` at `0a01159`;
- the release repository, `obsidianmd/obsidian-releases` at `2cc6ee6`;
- the official lint rules, `obsidianmd/eslint-plugin` at `f56e3d4`.

Two community plugins are cited as **precedent**, not as authority. They show
how working plugins solved a problem, not what the platform requires:

- the Excalidraw plugin, `zsviczian/obsidian-excalidraw-plugin` at `78674a3`;
- Just Simple Excalidraw, `davidhurtadoai/just-simple-excalidraw` at `7dc7356`.

Just Simple Excalidraw is the closest prior art. It is a listed plugin that
opens `.excalidraw` files with **stock `@excalidraw/excalidraw` 0.18.1**, the
version this app uses, on desktop and mobile.

"**Observed**" means run in this repo on 2026-11-14 with a throwaway build
script that is not committed (see [Experiment](#experiment-the-app-as-one-file)).
"**Unverified**" marks claims no primary source settles.

## Answer

The platform settles most of the shape. The open questions are mostly about
what the map wants inside that shape.

1. **One view type, registered for the extension.** Use `registerView` and
   `registerExtensions(["excalimathpad"], VIEW_TYPE)`, and extend `FileView` or
   `TextFileView`. `TextFileView` hands the view the file's text
   (`setViewData`) and asks for it back (`getViewData`). By default it saves
   only when the view closes. `requestSave()` saves after a 2-second debounce.
2. **An install delivers three files and nothing else:** `main.js`,
   `manifest.json` and an optional `styles.css`. The plugin therefore has to be
   **one CommonJS `main.js` and one `styles.css`**. That means every `import()`
   inlined, every font as a `data:` URL, no separate worker files, and all CSS
   in `styles.css`. Creating `<style>` or `<link>` elements is an error in the
   official lint rules.
3. **Size is the real constraint. Observed:** the whole app as one file is
   **10.1 MB**. Stubbing three parts of Excalidraw the app never uses brings it
   to **3.5 MB**:
   - Mermaid;
   - the 50-odd non-English locales;
   - the WebAssembly font-subsetting chunk used by its image export.

   Obsidian Sync Standard caps a file at **5 MB**, and a plugin's `main.js` is
   a file Sync carries if the user syncs plugins. The trimmed bundle ran fully
   offline in Chromium: KaTeX typeset, every font loaded from `data:` URLs, and
   no request was made.
4. **No network is needed, and none should be made.** Stock Excalidraw falls
   back to `https://esm.sh/` for any font it can't resolve. The build must
   inline or neutralise every font path, including the 13 MB CJK fallback
   Xiaolai. The developer policies allow network use only when the README
   discloses it.
5. **Keys are shared with Obsidian.** Obsidian's defaults include Ctrl+P
   (command palette), Ctrl+O (quick switcher) and Ctrl+Z (editor undo).
   - The app today listens for keys on `window` and `document` in the capture
     phase. In Obsidian those listeners would fire in every tab.
   - Keys must be scoped to the view. `View.scope` (since 1.5.7) is the
     platform's mechanism, or the view can listen only when its leaf is active.
   - Commands must not ship default hotkeys.
6. **Phone and tablet are allowed** (`isDesktopOnly: false`) if the plugin uses
   no Node or Electron API. The app's browser-only file and storage paths
   (File System Access API, IndexedDB recovery, `localStorage`) give way to the
   Vault API and the plugin's own data, which also work on mobile.
7. **Submission is now through the Obsidian Community directory**
   (community.obsidian.md).
   - Every release is reviewed **automatically**. A scanner checks the
     manifest, the release assets and the source, and verifies that the build
     matches the repository.
   - Manual review is kept for popular, featured and flagged plugins.
   - Before listing, testers install with **BRAT**.
   - The id `excalimathpad` is valid and not taken.

What is left for the map is listed at the end, under
[Left for the map to decide](#left-for-the-map-to-decide), each item against
the ticket that owns it.

## The view and the file round trip

### Registering the extension

- `Plugin.registerExtensions(extensions, viewType)` "Register[s] a set of
  extensions for a view type", with extensions given without the dot
  ([API](https://github.com/obsidianmd/obsidian-api/blob/879c936660fcc45c90ee28ea6b4ef7068006477c/obsidian.d.ts#L7241-L7248)).
  Both precedents call it exactly this way: the Excalidraw plugin registers
  `["excalidraw"]`
  ([main.ts](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/78674a39ccf046b93b5de4155edcc871d82602cf/src/core/main.ts#L439-L450)),
  and so does Just Simple Excalidraw
  ([main.ts](https://github.com/davidhurtadoai/just-simple-excalidraw/blob/7dc7356cb698d8f0ff0d41f2639d5fa1e046dc23/main.ts#L145-L146)).
- A view is registered in `onload` with a factory. The docs warn: "Never
  manage references to views in your plugin. Obsidian may call the view
  factory function multiple times"
  ([Views](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/User%20interface/Views.md)).
  Since Obsidian 1.7.2, views open as a `DeferredView` until their tab is
  shown, so code must check `leaf.view instanceof MyView` before using it
  ([Defer views](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Guides/Defer%20views.md)).
- Other formats are added "using Community plugins"
  ([Accepted file formats](https://github.com/obsidianmd/obsidian-help/blob/0a01159d5b613a8afc55ce02b9c0ea8a0cd44ef1/en/Files%20and%20folders/Accepted%20file%20formats.md)).

### `FileView` or `TextFileView`

- **`FileView`** is "a view that works with a file". It has `file`,
  `onLoadFile`, `onUnloadFile`, `onRename` ("Called when the file is
  renamed") and `canAcceptExtension`
  ([API](https://github.com/obsidianmd/obsidian-api/blob/879c936660fcc45c90ee28ea6b4ef7068006477c/obsidian.d.ts#L4665-L4741)).
- **`TextFileView`** "implements a plaintext-based editable file view":
  - `onLoadFile` "Reads the file and passes its contents to `setViewData`".
  - `getViewData()` "will be called to save the editor contents to the file".
  - `setViewData(data, clear)` gets `clear` true when "a completely different
    file" is opened, and should then call `clear()`, which should "clear any
    editor states like undo-redo history".
  - `onUnloadFile` "Saves any unsaved changes first".
  - Saving is explicit: "by default, this view only saves when it's closing.
    To implement auto-save, your editor should call `this.requestSave()`",
    which is "debounced by 2 seconds"
    ([API](https://github.com/obsidianmd/obsidian-api/blob/879c936660fcc45c90ee28ea6b4ef7068006477c/obsidian.d.ts#L9846-L9925)).
- **Precedent:** the Excalidraw plugin extends `TextFileView`
  ([ExcalidrawView.ts](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/78674a39ccf046b93b5de4155edcc871d82602cf/src/view/ExcalidrawView.ts#L471)).
  Just Simple Excalidraw extends plain `FileView` and runs its own debounced
  autosave with `vault.modify`
  ([main.ts](https://github.com/davidhurtadoai/just-simple-excalidraw/blob/7dc7356cb698d8f0ff0d41f2639d5fa1e046dc23/main.ts#L216-L440)).
- For the app, the file's text is already the whole sheet: Excalidraw JSON plus
  the `excalimathpad` block (ADR 0004). Either base class fits. With
  `TextFileView`, `getViewData()` is the existing serialiser.

### Writing files

- The guidelines prefer `Vault.process` over `Vault.modify` for background
  edits, because it is atomic. They also prefer the Vault API over the Adapter
  API, for its cache and because it "performs file operations serially to
  avoid any race conditions"
  ([Plugin guidelines](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Releasing/Plugin%20guidelines.md),
  [Vault](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Vault.md)).
- The Vault API "only allows access to the files visible inside the app"
  ([Vault](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Vault.md)).
  A plugin that stays inside the vault needs no disclosure for file access;
  "Accessing files outside of Obsidian vaults" does need one
  ([Developer policies](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Developer%20policies.md)).
- Deleting goes through `FileManager.trashFile`, so the user's trash setting is
  respected
  ([self-critique checklist](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Obsidian%20October%20plugin%20self-critique%20checklist.md)).

### Rename, external change and sync

- **Rename:** `FileView.onRename(file)` is called
  ([API](https://github.com/obsidianmd/obsidian-api/blob/879c936660fcc45c90ee28ea6b4ef7068006477c/obsidian.d.ts#L4728-L4732)).
  `Vault.on('rename')` gives the old path
  ([API](https://github.com/obsidianmd/obsidian-api/blob/879c936660fcc45c90ee28ea6b4ef7068006477c/obsidian.d.ts#L10457)).
- **External change** (another device via sync, another app, git):
  `Vault.on('modify')` fires
  ([API](https://github.com/obsidianmd/obsidian-api/blob/879c936660fcc45c90ee28ea6b4ef7068006477c/obsidian.d.ts#L10445)).
  What `TextFileView` does with an open file that changes on disk is **not
  documented** (unverified):
  - The Excalidraw plugin's author observes that "text file view gets the
    modified file event after sync", and guards reloads by hand
    ([ExcalidrawView.ts](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/78674a39ccf046b93b5de4155edcc871d82602cf/src/view/ExcalidrawView.ts#L3096-L3099)).
  - Just Simple Excalidraw takes the conservative route. On an outside change
    it stops autosaving and tells the user to reopen the tab
    ([main.ts](https://github.com/davidhurtadoai/just-simple-excalidraw/blob/7dc7356cb698d8f0ff0d41f2639d5fa1e046dc23/main.ts#L243-L247),
    [L448-L458](https://github.com/davidhurtadoai/just-simple-excalidraw/blob/7dc7356cb698d8f0ff0d41f2639d5fa1e046dc23/main.ts#L448-L458)).
- **Obsidian Sync does not carry `.excalimathpad` files by default.**
  - Selective sync covers images, audio, video and PDFs by default. "To sync
    additional file types, toggle the `Sync all other types` option"
    ([Sync settings](https://github.com/obsidianmd/obsidian-help/blob/0a01159d5b613a8afc55ce02b9c0ea8a0cd44ef1/en/Obsidian%20Sync/Sync%20settings%20and%20selective%20syncing.md)).
  - Community plugins sync only if the user turns on "Active community plugin
    list" and "Installed community plugin list" (same page).
  - Other sync tools (iCloud, Syncthing, git) see a plain file. Not
    researched here.
- **Quit:** `Workspace.on('quit')` exists for last-moment work on desktop
  ([API](https://github.com/obsidianmd/obsidian-api/blob/879c936660fcc45c90ee28ea6b4ef7068006477c/obsidian.d.ts#L11130)).
  The app's `beforeunload` guard has no role in a vault.

## React, CSS and theme

- **React:** create a root on `contentEl` in `onOpen` and `unmount()` it in
  `onClose`
  ([Use React in your plugin](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Getting%20started/Use%20React%20in%20your%20plugin.md)).
  Obsidian does not provide React; the plugin bundles it. The Excalidraw plugin
  ships React 19.2.8
  ([package.json](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/78674a39ccf046b93b5de4155edcc871d82602cf/package.json)),
  and Just Simple Excalidraw ships 18.3.1.
- **CSS goes in `styles.css`, which Obsidian applies to the whole app.**
  - The official lint rule `no-forbidden-elements` errors on creating `<style>`
    or `<link>` elements
    ([rule](https://github.com/obsidianmd/eslint-plugin/blob/f56e3d4c63d6b43954e75e7eef65ec3ba2a38de6/lib/rules/noForbiddenElements.ts#L23)).
    That rules out injected styles, Vite's development style tags among them.
  - The guidelines ask for classes and Obsidian's CSS variables, not inline
    styles
    ([Plugin guidelines](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Releasing/Plugin%20guidelines.md)).
    The checklist adds "Don't override core styling"
    ([checklist](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Obsidian%20October%20plugin%20self-critique%20checklist.md)).
- **What would leak today (observed):**
  - `src/index.css` sets `height`, `margin` and `overflow: hidden` on `html`
    and `body`
    ([index.css](../../src/index.css)). It must not ship in the plugin.
  - Excalidraw 0.18.1's `index.css` has 1,026 selectors. 36 are not scoped
    under `.excalidraw`: a `:root` block of `--zIndex-*` and safe-area
    variables, and generic names such as `.visually-hidden`,
    `.LoadingMessage`, `.ProjectName` and `.footer-center`. These could meet
    Obsidian's or another plugin's styles.
  - KaTeX's CSS is scoped to `.katex`, apart from its `@font-face` rules.
- **Theme:** Obsidian marks the scheme with `.theme-dark` or `.theme-light`
  ([About styling](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Reference/CSS%20variables/About%20styling.md)).
  `Workspace.on('css-change')` fires when it changes
  ([API](https://github.com/obsidianmd/obsidian-api/blob/879c936660fcc45c90ee28ea6b4ef7068006477c/obsidian.d.ts#L11072)).
  Just Simple Excalidraw reads `body.theme-dark` and passes Excalidraw's
  `theme` prop
  ([main.ts](https://github.com/davidhurtadoai/just-simple-excalidraw/blob/7dc7356cb698d8f0ff0d41f2639d5fa1e046dc23/main.ts#L71-L86)).
- **Pop-out windows (desktop):** "pop-out windows come with a complete
  different set of globals". Plugins should use `activeDocument`,
  `element.doc` and `element.instanceOf(...)`
  ([Support pop-out windows](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Guides/Support%20pop-out%20windows.md)).
  The lint rules `prefer-active-doc`, `prefer-window-timers` and
  `no-global-this` warn on the rest
  ([README](https://github.com/obsidianmd/eslint-plugin/blob/f56e3d4c63d6b43954e75e7eef65ec3ba2a38de6/README.md)).
  The app's own code refers to `window.` or `document.` in 31 places.

## The bundle

### What an install delivers

- From the release repository: "Obsidian will download `manifest.json`,
  `main.js`, and `styles.css` (if available), and store them in the proper
  location inside the vault"
  ([README](https://github.com/obsidianmd/obsidian-releases/blob/2cc6ee617d7ea9ea498fb5b44cc7ee7ac73bc53b/README.md)).
  The submission guide repeats this: upload `main.js`, `manifest.json` and
  `styles.css` (optional) to the release
  ([Submit your plugin](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Releasing/Submit%20your%20plugin.md)).
- So lazy chunks, font files and worker files can't ship beside `main.js`.
- The developer policies forbid a plugin to "Install or update themselves or
  their dependencies"
  ([Developer policies](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Developer%20policies.md)).
  Downloading the missing parts later is out.
- The Excalidraw plugin's author says the same in their README: "Obsidian.md
  currently does not provide plugin developers with proper mechanisms for
  deploying local assets such as fonts"
  ([README](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/78674a39ccf046b93b5de4155edcc871d82602cf/README.md)).
- The sample plugin builds `src/main.ts` with esbuild to one `main.js`:
  `format: 'cjs'`, with `obsidian`, `electron`, the CodeMirror packages and the
  Node built-ins external
  ([esbuild.config.mjs](https://github.com/obsidianmd/obsidian-sample-plugin/blob/07ceb81d1fb3384af611ebf665a1ec42a7e5926d/esbuild.config.mjs)).

### Lazy chunks: KaTeX and Plot

- Today the app loads KaTeX and Observable Plot with `import()`
  ([katex.ts](../../src/overlay/katex.ts),
  [plotDrawing.ts](../../src/overlay/plotDrawing.ts)).
- Without code splitting, esbuild folds each `import()` into the same file.
- **Observed:** the single-file build typeset a math line with KaTeX.
  Observable Plot rides the same mechanism, but no plot line was drawn in the
  test.

### Fonts

- **Excalidraw 0.18.1 resolves canvas fonts at run time from strings** such as
  `"./fonts/Excalifont/…woff2"` (observed in
  `node_modules/@excalidraw/excalidraw/dist/prod/chunk-K2UTITRG.js`). Its
  `createUrls` works in this order:
  - a path starting with `data` is used as-is;
  - a path starting with `local:` gives no URL at all;
  - any other path is resolved against `window.EXCALIDRAW_ASSET_PATH`;
  - last comes the fallback, `https://esm.sh/@excalidraw/excalidraw@<version>/dist/prod/`.
- That fallback is why the hosted app fetches fonts from a CDN today: the app
  sets no asset path. In a plugin a relative path has no files behind it, so
  every font would end at `esm.sh`.
- **The fix is a build step that rewrites each path to a `data:` URL.**
  Observed: 21 font paths inlined (about 0.5 MB of woff2, about 0.7 MB as
  base64), and every face the app uses loaded (`Excalifont`, `Nunito`,
  `Assistant`).
- **Xiaolai is the exception.** It is the 13 MB CJK fallback, with 209 path
  strings. It was left as paths in the experiment.
  - Typing CJK text in the app's default text font made no request.
  - It would be reached for CJK text in Excalifont. That is not tested, and
    is an inference from Excalidraw's font table.
  - Rewriting those paths to `local:` would stop any fetch, with system fonts
    used instead (unverified in Obsidian).
- **Precedent:**
  - The Excalidraw plugin uses its author's fork, `@zsviczian/excalidraw`.
    Its `dist/obsidian` build is one 6.5 MB file with **23 woff2 fonts
    embedded as base64** (observed by unpacking 0.18.147 from npm). It
    downloads the CJK pack from GitHub on demand and discloses that in its
    README.
  - Just Simple Excalidraw rewrites every Excalidraw font path to **one**
    embedded Latin Excalifont. It removes Excalidraw's `@font-face` rules from
    the CSS, and fails its own release audit if `./fonts/` survives
    ([copy-assets.mjs](https://github.com/davidhurtadoai/just-simple-excalidraw/blob/7dc7356cb698d8f0ff0d41f2639d5fa1e046dc23/scripts/copy-assets.mjs),
    [audit-release.mjs](https://github.com/davidhurtadoai/just-simple-excalidraw/blob/7dc7356cb698d8f0ff0d41f2639d5fa1e046dc23/scripts/audit-release.mjs)).
- **KaTeX's fonts** come in through its CSS `url(...)`s, which a bundler can
  inline as `data:` URLs. KaTeX lists woff2, woff and ttf for each face.
  Keeping woff2 only cut `styles.css` from 1.73 MB to **0.64 MB** (observed).

### Workers

- Excalidraw 0.18.1 starts its font-subsetting worker with
  `new Worker(url, { type: "module" })`, from a URL built on
  `import.meta.url`. If that fails it logs "Failed to use workers for
  subsetting, falling back to the main thread" (observed in the package).
- A CommonJS `main.js` has no `import.meta.url`, so the worker can't start.
  Subsetting then runs on the main thread, or isn't in the bundle at all if it
  is trimmed (below).
- The fork in the Excalidraw plugin starts its workers from
  `data:text/javascript;base64,…` URLs (observed). That is the single-file
  pattern, but it was not tested here on iOS (unverified).

### Size, and the 5 MB line

- **Obsidian Sync Standard caps a file at 5 MB** (Sync Plus at 200 MB)
  ([Plans and storage limits](https://github.com/obsidianmd/obsidian-help/blob/0a01159d5b613a8afc55ce02b9c0ea8a0cd44ef1/en/Obsidian%20Sync/Plans%20and%20storage%20limits.md)).
  - A plugin's `main.js` is subject to it only when the user syncs community
    plugins (above).
  - Just Simple Excalidraw treats 5,000,000 bytes as a hard release limit "of
    Obsidian Sync Standard"
    ([audit-release.mjs](https://github.com/davidhurtadoai/just-simple-excalidraw/blob/7dc7356cb698d8f0ff0d41f2639d5fa1e046dc23/scripts/audit-release.mjs)).
- No Obsidian page sets a size limit for `main.js` itself. The load-time guide
  asks for a minified production build and a light `onload`
  ([Optimize plugin load time](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Guides/Optimize%20plugin%20load%20time.md)).
- **Observed sizes** (esbuild 0.25.12, minified, one CommonJS file, Excalidraw
  fonts inlined except Xiaolai, KaTeX woff2 only):

  | Build | `main.js` | `new Function` in bundle |
  |---|---:|---:|
  | Whole app, nothing trimmed | 10.09 MB | 2 |
  | Mermaid stubbed | 6.94 MB | 2 |
  | Mermaid and non-English locales stubbed | 5.29 MB | 2 |
  | Mermaid, locales and font subsetting stubbed | **3.46 MB** | **0** |

- **Where the weight sits** (untrimmed build, from esbuild's metafile):
  - Excalidraw: 4.46 MB, of which 1.82 MB is the WebAssembly subsetting chunk
    and about 1.6 MB is locales.
  - Mermaid and its parser, Cytoscape and the layout packages: about 2.8 MB.
  - math.js 0.59 MB, KaTeX 0.27 MB, React DOM 0.21 MB, Plot 0.20 MB.
  - The app's own code: 0.15 MB.
- **What each trim costs:**
  - The app never calls Mermaid, sets no `langCode`, and calls none of
    Excalidraw's export functions (searched in `src/`).
  - Mermaid-to-Excalidraw sits behind Excalidraw's own "Mermaid to Excalidraw"
    dialog. Stubbed, that dialog would fail. Just Simple Excalidraw stubs it
    the same way
    ([esbuild.config.mjs](https://github.com/davidhurtadoai/just-simple-excalidraw/blob/7dc7356cb698d8f0ff0d41f2639d5fa1e046dc23/esbuild.config.mjs)).
  - The subsetting chunk is reached only through `subset-worker` and
    `subset-shared`. Excalidraw uses those when it embeds fonts in an exported
    or copied SVG or PNG. Stubbing them means Excalidraw's own image
    export or copy can't embed fonts. That path was not exercised.
  - The "PNG or SVG" issue is on hold, so nothing in the app uses this today.

### Network

- **Observed:** with every non-local request blocked, the 3.46 MB build loaded,
  typeset `a ≔ 2 m + 3 m` with result `5 m`, drew Excalidraw text, and made
  **no request** and logged no error.
- The developer policies allow "Network use" only "if clearly indicated in your
  README", and forbid client-side telemetry
  ([Developer policies](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Developer%20policies.md)).
  The listing's scorecard shows "making requests to external domains" as a
  disclosure
  ([Community directory](https://github.com/obsidianmd/obsidian-help/blob/0a01159d5b613a8afc55ce02b9c0ea8a0cd44ef1/en/Extending%20Obsidian/Community%20directory.md)).
- **Left in the stock bundle after trimming** (observed counts in `main.js`):
  - 31 `fetch(` call sites from dependencies.
  - The `esm.sh` fallback string.
  - One Google API key pattern (`AIza…`). This is excalidraw.com's Firebase
    config for live collaboration, which the app never starts. Just Simple
    Excalidraw strips it before release and fails its audit if it survives
    ([audit-release.mjs](https://github.com/davidhurtadoai/just-simple-excalidraw/blob/7dc7356cb698d8f0ff0d41f2639d5fa1e046dc23/scripts/audit-release.mjs)).

    Whether the directory scanner flags it is **unverified**. The scanner's
    checks are not published beyond the four section names.
  - The lint config warns on the global `fetch` and points to `requestUrl`
    ([ruleOptions.ts](https://github.com/obsidianmd/eslint-plugin/blob/f56e3d4c63d6b43954e75e7eef65ec3ba2a38de6/lib/ruleOptions.ts)).
    It lints the plugin's source; whether the scanner also reads bundled
    dependencies is unverified.

## Keys

- **Obsidian's own keys include:**
  - Ctrl/Cmd+P, the command palette
    ([Command palette](https://github.com/obsidianmd/obsidian-help/blob/0a01159d5b613a8afc55ce02b9c0ea8a0cd44ef1/en/Plugins/Command%20palette.md));
  - Ctrl/Cmd+O, the quick switcher
    ([Quick switcher](https://github.com/obsidianmd/obsidian-help/blob/0a01159d5b613a8afc55ce02b9c0ea8a0cd44ef1/en/Plugins/Quick%20switcher.md));
  - Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y, undo and redo in the editor
    ([Editing shortcuts](https://github.com/obsidianmd/obsidian-help/blob/0a01159d5b613a8afc55ce02b9c0ea8a0cd44ef1/en/Editing%20and%20formatting/Editing%20shortcuts.md)).
- Whether Ctrl+S is bound by default is **unverified**: no help page in the
  vault names it.
- **Plugin commands:** "Avoid setting a default hotkey for commands"
  ([Plugin guidelines](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Releasing/Plugin%20guidelines.md)).
  The lint rule `commands/no-default-hotkeys` warns on it
  ([README](https://github.com/obsidianmd/eslint-plugin/blob/f56e3d4c63d6b43954e75e7eef65ec3ba2a38de6/README.md)).
  Users set hotkeys for commands themselves.
- **Keys inside the view:** `View.scope` (since 1.5.7) is a `Scope` active
  while the view is focused. Handlers come from
  `scope.register(modifiers, key, fn)`, `Mod` maps to Cmd on macOS and Ctrl
  elsewhere, and unhandled keys pass to the parent scope
  ([View.scope](https://github.com/obsidianmd/obsidian-api/blob/879c936660fcc45c90ee28ea6b4ef7068006477c/obsidian.d.ts#L10505-L10513),
  [Scope](https://github.com/obsidianmd/obsidian-api/blob/879c936660fcc45c90ee28ea6b4ef7068006477c/obsidian.d.ts#L8016-L8043)).
- **The app today listens globally:**
  - `useFileRoutes` takes Ctrl+S, Ctrl+Shift+S, Ctrl+O and Ctrl+Shift+E with a
    `window` keydown listener in the capture phase
    ([fileRoutes.ts](../../src/canvas/fileRoutes.ts)).
  - The canvas gestures (M, Enter, Esc) listen on `document`, also in capture
    ([canvasEvents.ts](../../src/canvas/canvasEvents.ts)).
  - In Obsidian these would run in every tab and before Obsidian's own
    handlers. They have to be confined to the view.
  - Precedent: the Excalidraw plugin registers its key listeners on the view's
    own window with `registerDomEvent`, so they are removed with the view
    ([ExcalidrawView.ts](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/78674a39ccf046b93b5de4155edcc871d82602cf/src/view/ExcalidrawView.ts#L2219-L2222)).
  - Both precedents pass Excalidraw `handleKeyboardGlobally: false`.

## Desktop, phone and tablet

- `isDesktopOnly` is a required manifest field. Node.js and Electron APIs "are
  only available in the desktop version", and a plugin that uses them "must"
  set it to `true`
  ([Manifest](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Reference/Manifest.md),
  [Submission requirements](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Submission%20requirements%20for%20plugins.md)).
  The app uses neither. Both precedents ship `isDesktopOnly: false`.
- `Platform` reports `isMobileApp`, `isPhone`, `isTablet`, `isIosApp` and
  `isAndroidApp`
  ([API](https://github.com/obsidianmd/obsidian-api/blob/879c936660fcc45c90ee28ea6b4ef7068006477c/obsidian.d.ts#L7047-L7087)).
  The lint rule `platform` forbids sniffing the OS through `navigator`.
- **On mobile, `Vault.adapter` is a `CapacitorAdapter`, not a
  `FileSystemAdapter`.** Plugins should use `requestUrl` rather than `fetch`
  ([checklist](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Obsidian%20October%20plugin%20self-critique%20checklist.md)).
- **Regex lookbehind** "is only supported on iOS 16.4 and above"
  ([Mobile development](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Getting%20started/Mobile%20development.md)).
  - Observed: the bundle holds 4 lookbehinds, all in Excalidraw's text-wrapping
    rules (`chunk-K2UTITRG.js`), built at run time with `RegExp`. None are in
    the app's code.
  - So on iOS below 16.4 Excalidraw's text wrapping would likely throw
    (unverified). Both precedents ship the same Excalidraw code.
- **The app's browser-only storage paths:**
  - File System Access pickers ([fileAccess.ts](../../src/file/fileAccess.ts)),
    the IndexedDB recovery copy ([recovery.ts](../../src/file/recovery.ts)) and
    the panel's `localStorage` memory
    ([panelMemory.ts](../../src/panel/panelMemory.ts)) are web-app paths.
  - In a vault, files come through the Vault API.
  - Plugin data goes through `Plugin.loadData()`/`saveData()`
    ([API](https://github.com/obsidianmd/obsidian-api/blob/879c936660fcc45c90ee28ea6b4ef7068006477c/obsidian.d.ts#L7344-L7353)).
  - Per-vault local values go through `App#saveLocalStorage` and
    `App#loadLocalStorage`. The lint config points there for `localStorage`
    ([ruleOptions.ts](https://github.com/obsidianmd/eslint-plugin/blob/f56e3d4c63d6b43954e75e7eef65ec3ba2a38de6/lib/ruleOptions.ts)).
  - The listing's scorecard notes "using browser storage instead of Obsidian's
    plugin data APIs"
    ([Community directory](https://github.com/obsidianmd/obsidian-help/blob/0a01159d5b613a8afc55ce02b9c0ea8a0cd44ef1/en/Extending%20Obsidian/Community%20directory.md)).
- **Inspecting on a device:** Android through `chrome://inspect`, iOS 16.4+
  through Safari's Web Inspector. `app.emulateMobile(true)` emulates on desktop
  ([Mobile development](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Getting%20started/Mobile%20development.md)).

## Minimum app version

- `minAppVersion` is required. "If you don't know what an appropriate version
  number is, use the latest stable build number"
  ([Submission requirements](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Submission%20requirements%20for%20plugins.md)).
  - The latest desktop release on 2026-11-14 is **1.15.1**
    ([desktop-releases.json](https://github.com/obsidianmd/obsidian-releases/blob/2cc6ee617d7ea9ea498fb5b44cc7ee7ac73bc53b/desktop-releases.json)).
  - The `obsidian` typings package is at 1.14.4.
- The lint rule `no-unsupported-api` errors on any API newer than the declared
  `minAppVersion`
  ([README](https://github.com/obsidianmd/eslint-plugin/blob/f56e3d4c63d6b43954e75e7eef65ec3ba2a38de6/README.md)).
  The APIs this plugin needs are old: `registerExtensions` (0.9.7),
  `TextFileView` (0.10.12) and `View.scope` (1.5.7). The floor is a choice,
  not a constraint.
- `versions.json` maps plugin versions to the `minAppVersion` each needs. Users
  on an older app get the newest compatible version. It changes only when
  `minAppVersion` does
  ([Versions](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Reference/Versions.md)).
- For comparison: the Excalidraw plugin declares 1.8.7 and Just Simple
  Excalidraw 1.13.7.

## Submission and review

### The manifest

- **Required:** `id`, `name`, `version` (`x.y.z`), `minAppVersion`,
  `description`, `author` and `isDesktopOnly`
  ([Manifest](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Reference/Manifest.md)).
- **`id`:** "only lowercase letters and hyphens, can't end with `plugin`, and
  can't contain `obsidian`" (same page). It must be unique, and it "can't be
  changed after it's been published"
  ([FAQ](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Frequently%20asked%20questions.md)).
  `excalimathpad` qualifies. It is **not** in `community-plugins.json`
  (10,379 entries) or `community-plugins-removed.json` (observed). The nearest
  names are "Mathpad" (`mathpad`) and "Excalidraw Math Plotter"
  ([community-plugins.json](https://github.com/obsidianmd/obsidian-releases/blob/2cc6ee617d7ea9ea498fb5b44cc7ee7ac73bc53b/community-plugins.json)).
- **`name`:** Basic Latin, no "Obsidian", no "Plugin", unique, not a core
  feature's name ([Manifest](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Reference/Manifest.md)).
- **`description`:**
  - at most 250 characters, ending with a period;
  - no emoji;
  - starts with an action ("Translate selected text into…"), never "This is a
    plugin"
  ([Submission requirements](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Submission%20requirements%20for%20plugins.md)).

### Releases

- A GitHub release whose tag equals the manifest `version` exactly, carrying
  `main.js`, `manifest.json` and an optional `styles.css`
  ([Submit your plugin](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Releasing/Submit%20your%20plugin.md)).
- The directory reads the `manifest.json` "at the HEAD of your repository's
  default branch" (same page).
- The checklist says not to commit `main.js`
  ([checklist](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Obsidian%20October%20plugin%20self-critique%20checklist.md)).
- **The repository root needs `README.md`, `LICENSE` and `manifest.json`**
  ([Submit your plugin](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Releasing/Submit%20your%20plugin.md)).
  This repository already has a README and an MIT licence. A licence GitHub
  reports as "Custom" draws a warning
  ([FAQ](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Frequently%20asked%20questions.md)).

### Submitting

- Sign in to community.obsidian.md with an Obsidian account, connect GitHub,
  and add the repository
  ([Set up and claim](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Set%20up%20and%20claim.md)).
- Only the first version is submitted; later releases reach users on their own
  ([FAQ](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Frequently%20asked%20questions.md)).
- The plugin "won't be installable from within Obsidian until any errors from
  the automated review are resolved"
  ([Submit your plugin](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Releasing/Submit%20your%20plugin.md)).

### The automated review

- "After each release, the directory scans your `manifest.json`, GitHub release
  assets, and source code, and verifies that the build matches what's
  committed". Results come as errors, warnings, recommendations or passes
  ([Manage your plugin](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Manage%20your%20plugin%20or%20theme.md)).
- A preview scan can run on any branch before a release (same page).
- The scanner runs the first of the `build`, `build:plugin` or `compile`
  scripts. It ignores a fixed list of paths, including `node_modules`, `docs`,
  `scripts`, `vite`, `test`, `*.test.*` and `*.mjs`
  ([FAQ](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Frequently%20asked%20questions.md)).
- **This bears on one repository building two targets.** Today `npm run build`
  is the web app's build
  ([package.json](../../package.json)). The scanner would run that unless a
  `build:plugin` comes first in its order, which it can't, since `build` wins.
- "Verifies that the build matches what's committed" is read two ways. Which
  one the scanner means is **unverified**:
  - The directory builds from the committed source and compares the result
    with the release asset. This is the natural reading.
  - Just Simple Excalidraw writes its built `main.js` to the repository root,
    "Keep the root build artifact identical to the published one. Obsidian's
    reproducibility check compares this file with the release asset"
    ([copy-assets.mjs](https://github.com/davidhurtadoai/just-simple-excalidraw/blob/7dc7356cb698d8f0ff0d41f2639d5fa1e046dc23/scripts/copy-assets.mjs)).
    That cuts against the checklist's "Don't include `main.js` in your repo".
- **Checks you can run locally:** the official ESLint plugin "covers how to
  install and set it up"
  ([FAQ](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Frequently%20asked%20questions.md)).
  Its recommended config includes these
  ([index.ts](https://github.com/obsidianmd/eslint-plugin/blob/f56e3d4c63d6b43954e75e7eef65ec3ba2a38de6/lib/index.ts),
  [README](https://github.com/obsidianmd/eslint-plugin/blob/f56e3d4c63d6b43954e75e7eef65ec3ba2a38de6/README.md)):
  - errors: `no-eval`, `no-implied-eval`, `new Function`, `no-unsanitized`,
    `no-forbidden-elements`, `no-unsupported-api`, `regex-lookbehind`,
    `no-static-styles-assignment`, `detach-leaves`;
  - warnings: `@microsoft/sdl/no-inner-html`, `no-explicit-any`, restricted
    globals (`app`, `fetch`, `localStorage`), `prefer-active-doc`,
    `no-default-hotkeys`, and sentence case for UI text.
- **Rules a plugin of this kind is most likely to break:**
  - global key listeners and styles;
  - `<style>` injection;
  - `localStorage`;
  - `document` instead of `activeDocument`;
  - default hotkeys;
  - Title Case UI strings;
  - network use not disclosed in the README.
- **Not allowed at all**
  ([Developer policies](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Community%20directory/Developer%20policies.md)):
  - obfuscated code;
  - dynamic ads;
  - client-side telemetry;
  - self-installing or self-updating code.

  Forks are not allowed without the original author's approval. This plugin
  is not a fork of an Obsidian plugin.

### Manual review and the listing

- Most listings now come from the automated review. "Manual reviews continue
  for popular, featured, and flagged plugins"
  ([Plugin security](https://github.com/obsidianmd/obsidian-help/blob/0a01159d5b613a8afc55ce02b9c0ea8a0cd44ef1/en/Extending%20Obsidian/Plugin%20security.md)).
  Observed: 7,796 of the 10,379 entries in `community-plugins.json` carry the
  suffix "This plugin has not been manually reviewed by Obsidian staff."
- Each listing shows a **scorecard** in four parts:
  - **health**: README, licence, contributing guide, recent activity;
  - **review**: the latest scan;
  - **disclosures**: for example clipboard or external requests;
  - **notes**: for example browser storage
  ([Community directory](https://github.com/obsidianmd/obsidian-help/blob/0a01159d5b613a8afc55ce02b9c0ea8a0cd44ef1/en/Extending%20Obsidian/Community%20directory.md)).
- Users must first turn off **Restricted mode** to run any community plugin.
  Obsidian "cannot reliably restrict plugins to specific permissions": a
  plugin can read files, use the network and install programs
  ([Plugin security](https://github.com/obsidianmd/obsidian-help/blob/0a01159d5b613a8afc55ce02b9c0ea8a0cd44ef1/en/Extending%20Obsidian/Plugin%20security.md)).
  "Protecting the user's data" is therefore the plugin's own discipline, plus
  what the scorecard shows. The platform does not enforce it.

### Installing before the plugin is listed

- "Obsidian doesn't officially support beta releases". The docs recommend the
  **BRAT** plugin to install from a GitHub repository before submission
  ([Beta-testing plugins](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Plugins/Releasing/Beta-testing%20plugins.md)).
- By hand: copy the three files into the vault's plugin folder (the config
  directory's `plugins/<id>/`). For local development, "the `id` should match
  the plugin's folder name"
  ([Manifest](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Reference/Manifest.md)).
- Whether the work laptop allows BRAT or a hand-copied folder was not recorded
  in [What does the work laptop block, and can it run an Obsidian community plugin?](https://github.com/matheus-sancha/excalimathpad/issues/115).

## Experiment: the app as one file

Run on 2026-11-14 in a scratch directory, outside the repository; nothing was
committed.

- **Build.** esbuild 0.25.12 bundled `src/main.tsx` (the web entry, unchanged)
  with these settings:
  - `format: "cjs"`, no splitting, `minify`;
  - `conditions: ["production"]`, needed for Excalidraw's `exports` map;
  - a `dataurl` loader for font files;
  - `obsidian` external.
- **After the build:**
  - every Excalidraw `"./fonts/…woff2"` string outside Xiaolai was replaced
    with a `data:font/woff2;base64,…` URL;
  - the woff and ttf sources were dropped from the bundled CSS.
- **Trims**, as an esbuild resolve plugin:
  - `@excalidraw/mermaid-to-excalidraw` resolved to a module whose function
    throws;
  - each `locales/xx-YY-*.js` resolved to `export default {}` (English kept);
  - `./subset-worker.chunk.js` and `./subset-shared.chunk.js` resolved to
    stubs that throw.
- **Run.** An IIFE copy of the fully trimmed build was served from
  `127.0.0.1`, with `main.css` beside it, and opened in Playwright's Chromium.
  Every request to any other host was aborted. The script then:
  - pressed M, clicked, typed `a = 2 m + 3 m` and pressed Esc;
  - drew a text element (Latin, then a second run with CJK).
- **Result:**
  - 5 `.katex` nodes rendered, and the line showed `5 m`.
  - `document.fonts` reported `Assistant`, `Nunito`, `Excalifont`,
    `KaTeX_Main` and `KaTeX_Math` loaded.
  - No request left the page in either run.
  - The server log shows only `index.html`, `main.css` and `main.js`.
  - No errors were logged.
- **Limits of the run:**
  - Chromium, not Obsidian's Electron or a phone's WebView.
  - No plot drawn; no export or copy tried.
  - The Excalidraw text box measured narrow on first draw (a known effect of
    measuring before a font settles; not investigated).

## Settled by the platform

- **The view.** One registered view type and `registerExtensions` for
  `excalimathpad`. A `FileView` or `TextFileView`, with a React root mounted
  in `onOpen` and unmounted in `onClose`. No stored references to views.
- **Files.** Through the Vault API. Saving is the view's job:
  - `TextFileView` saves on close, and after a 2-second debounce on
    `requestSave()`;
  - renames reach `onRename`;
  - outside changes reach `vault.on('modify')`.
- **Three files ship:** `main.js` (CommonJS, everything inlined),
  `manifest.json` and `styles.css`. Nothing may be downloaded or installed
  later. No `<style>` or `<link>` elements.
- **CSS is global.** The app's `html` and `body` rules can't ship.
  Excalidraw's unscoped selectors need containing.
- **Network must be disclosed if used.** No telemetry, no ads, no obfuscation.
- **Keys:**
  - Obsidian owns Ctrl+P, Ctrl+O and editor undo.
  - Plugin commands ship with no default hotkey.
  - Keys inside the view belong in `View.scope` or listeners bound to the
    view. Global window listeners are not acceptable.
- **Phone and tablet are open** to a plugin with no Node or Electron use. Use
  `requestUrl`, `Platform` and no lookbehinds in our own code. Storage goes
  through `loadData`/`saveData` or `App#saveLocalStorage`, not
  `localStorage`.
- **Pop-out windows** need `activeDocument` or `element.doc`, not `document`.
- **Submission:**
  - a manifest by the naming rules;
  - semver releases tagged to match;
  - README and licence;
  - listing through community.obsidian.md;
  - automated review on every release, run on the first of the `build`,
    `build:plugin` or `compile` scripts;
  - BRAT for testers before listing.
- **Obsidian Sync:**
  - Standard caps any synced file at 5 MB;
  - `.excalimathpad` files sync only with "Sync all other types" on;
  - plugins sync only if the user opts in.

## Left for the map to decide

Each item points at the ticket that already owns it on
[Spec for the second improvements batch and the Obsidian plugin, before M5](https://github.com/matheus-sancha/excalimathpad/issues/114).

- **[How do save, open, the clean mark and recovery work for a sheet in a vault?](https://github.com/matheus-sancha/excalimathpad/issues/124)**
  - `TextFileView` with `requestSave` (autosave), or explicit saving with a
    dirty mark as on the web.
  - What happens when the open file changes on disk (sync, git), given that
    `TextFileView`'s behaviour there is undocumented.
  - Whether a recovery copy still exists, and where, now that IndexedDB is
    discouraged.
  - What New and Open become: vault files, Obsidian's own new-file and
    file-explorer flows.
  - How a sheet is named and placed in the vault.
- **[What must the plugin do so that all of a user's data stays protected?](https://github.com/matheus-sancha/excalimathpad/issues/126)**
  - Zero network as a promise, enforced by a release check that the bundle
    has no `esm.sh` path, no unresolved font path and no live `fetch` to a
    remote host.
  - Whether to strip Excalidraw's unused Firebase config.
  - No browser storage.
  - Never write outside the vault.
  - Never write a file the view didn't load.
  - What happens to data when a write fails.
  - The README's disclosure section.
  - The "Sync all other types" caveat for Obsidian Sync users.
- **[How does a sheet work on a phone and a tablet in Obsidian?](https://github.com/matheus-sancha/excalimathpad/issues/127)**
  - Touch for the math layer (double-click and Enter have no phone
    equivalent).
  - The Sheet panel's place on a narrow screen.
  - iOS below 16.4 and Excalidraw's lookbehinds.
  - The worker fallback on a phone.
- **[How does one source build the web app and the plugin, and how is a version released?](https://github.com/matheus-sancha/excalimathpad/issues/128)**
  - Which script the scanner runs (`build` comes first, and is the web
    build today).
  - Where the plugin entry and the Obsidian-only code live.
  - What gets trimmed:
    - Mermaid, locales and font subsetting, with the cost of dropping
      subsetting;
    - Xiaolai inlined, sent to `local:`, or reduced like Just Simple
      Excalidraw's single font.
  - Whether 5 MB is a hard limit.
  - Whether `main.js` is committed.
  - How web versions and plugin versions relate.
  - `minAppVersion` and `versions.json`.
- **[Which of the app's chrome and keys remain inside an Obsidian tab?](https://github.com/matheus-sancha/excalimathpad/issues/129)**
  - Which of Ctrl+S, Ctrl+O, Ctrl+Shift+S, Ctrl+Z, Esc and M the view keeps in
    its scope, and which become commands with no default key.
  - What the ☰ menu's file items become.
  - The file name beside the menu, given that Obsidian has a tab title.
  - The theme: follow Obsidian's `theme-dark` or keep the sheet's own.
  - Excalidraw's own canvas actions.
- **[What does the community plugin listing need: id, name, description and review?](https://github.com/matheus-sancha/excalimathpad/issues/130)**
  - The id `excalimathpad` (free and valid).
  - The display name and a description under 250 characters.
  - Screenshots.
  - Whether to release through BRAT first, and whether the work laptop
    allows it.
  - The licence and contributing guide the health score looks for.
