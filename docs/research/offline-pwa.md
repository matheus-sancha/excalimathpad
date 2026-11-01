Research for wayfinder ticket #22, 2026-11-01.

# Shipping Excalimathpad as an installable offline PWA

**Question.** With Vite, what does it take to ship the build as an installable
offline PWA? That covers the service worker and manifest, self-hosting
Excalidraw's fonts and its font-subset worker, the update flow, HTTPS hosting
for a private repo, and PWA file handling for opening sheet files.

## Answer

It is a small, contained change: two dev dependencies, about 50 lines of
config, a 20-line `src/pwa.ts`, and one inline script in `index.html`. I
tried all of it in a throwaway clone (not committed; the diff is under
[Experiment](#experiment-what-was-run)). In headless Chrome the built app was
precached, reloaded **fully offline** with Excalidraw's canvas fonts served
from our own origin, and showed the update prompt on a redeploy.

Recommended setup:

- [ ] **`vite-plugin-pwa` 2.0.0** (`generateSW`). Its peer range includes
  `vite ^8.0.0` (seen with `npm view vite-plugin-pwa peerDependencies`, and it
  installed and built cleanly on Vite 8.3.5).
- [ ] **Copy Excalidraw's fonts into `dist/fonts/`** with
  `vite-plugin-static-copy` 4.1.1 (peer `vite ^6 || ^7 || ^8`). Use
  `src: 'node_modules/@excalidraw/excalidraw/dist/prod/fonts'`,
  `dest: '.'`, `rename: { stripBase: 5 }`.
- [ ] **Set `window.EXCALIDRAW_ASSET_PATH` to an absolute URL** in an inline
  `<script>` in `index.html`:
  `new URL(".", location.href).href`. Do **not** use `"./"`: Excalidraw
  resolves a relative path against `location.origin`, so it breaks under a
  sub-path such as GitHub Pages `/excalimathpad/` (see
  [Fonts](#excalidraw-fonts-and-the-subset-worker)).
- [ ] **Workbox settings:**
  - `globPatterns: ['**/*.{js,css,html,svg,woff2}']`.
  - `globIgnores: ['fonts/Xiaolai/**']` plus a `CacheFirst` runtime route for
    Xiaolai (13 MB of CJK font that a sheet will rarely need).
  - `maximumFileSizeToCacheInBytes: 4 * 1024 * 1024`. This is not needed
    today (see below), but the entry chunk is only ~136 kB under the 2 MiB
    default.
- [ ] **`registerType: 'prompt'`** (the default), with `injectRegister: false`
  and `registerSW` from `virtual:pwa-register` in `src/pwa.ts`. Sheets live in
  memory until saved, so do not auto-reload them away. Add
  `"vite-plugin-pwa/client"` to `types` in `tsconfig.app.json`.
- [ ] **Manifest:**
  - `start_url`, `scope` and `id` all `'./'`, and `display: 'standalone'`.
  - **192 px and 512 px PNG icons.** Chrome requires them; the SVG favicon
    alone is not enough (`@vite-pwa/assets-generator` can produce them).
  - `file_handlers` for a **custom extension** (for example `.calc` with
    `application/vnd.excalimathpad+json`), consumed by
    `window.launchQueue.setConsumer`.
- [ ] **Hosting: Cloudflare Pages** (free tier, HTTPS, deploy from a private
  repo). It can be gated with Cloudflare Access if wanted. GitHub Pages only
  works if Matheus's account is on **Pro or higher**, and the site is then
  **public** anyway. The app holds no data (files stay local), so a public
  URL is acceptable. A zero-hosting fallback is installing from
  `vite preview` on `localhost`, which is a secure context.

Precache result: **198 entries, 8,875 KiB.** That covers every JS chunk
(including `subset-worker.chunk-*.js` and the 1.82 MB `chunk-EIO257PC-*.js`
WASM chunk), the CSS, all non-Xiaolai Excalidraw fonts (25 files) and the
bundled UI fonts. Without `globIgnores`, Xiaolai is included and the precache
is **407 entries, 21,246 KiB**.

## Experiment (what was run)

Clone at `main` (`7127f1a`-era), `npm install`, then:

- `npm install -D vite-plugin-pwa@2.0.0 vite-plugin-static-copy@4.1.1`
- Set `"types": ["vite/client", "vite-plugin-pwa/client"]` in
  `tsconfig.app.json`.
- Add `import './pwa.ts'` to `src/main.tsx`.
- Add to `index.html`, after `<title>`:

  ```html
  <script>
    // Must be absolute: Excalidraw resolves "./" against location.origin.
    window.EXCALIDRAW_ASSET_PATH = new URL(".", location.href).href
  </script>
  ```

- In `vite.config.ts`, add these plugins after `react()`:

  ```ts
  viteStaticCopy({
    targets: [{
      src: 'node_modules/@excalidraw/excalidraw/dist/prod/fonts',
      dest: '.',
      rename: { stripBase: 5 }, // without it: dist/node_modules/@excalidraw/...
    }],
  }),
  VitePWA({
    registerType: 'prompt',
    injectRegister: false,
    includeAssets: ['favicon.svg'],
    manifest: {
      name: 'Excalimathpad', short_name: 'Excalimathpad',
      start_url: './', scope: './', id: './', display: 'standalone',
      theme_color: '#ffffff', background_color: '#ffffff',
      icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }], // replace with 192/512 PNGs
      file_handlers: [{ action: './', accept: { 'application/vnd.excalimathpad+json': ['.calc'] } }],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      globIgnores: ['fonts/Xiaolai/**'],
      maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      runtimeCaching: [{
        urlPattern: ({ url }) => url.pathname.includes('/fonts/Xiaolai/'),
        handler: 'CacheFirst',
        options: { cacheName: 'xiaolai-font', expiration: { maxEntries: 250 } },
      }],
    },
  }),
  ```

- New file `src/pwa.ts`:

  ```ts
  import { registerSW } from 'virtual:pwa-register'
  const updateSW = registerSW({
    onNeedRefresh() { if (confirm('A new version of Excalimathpad is ready. Reload now?')) void updateSW(true) },
    onOfflineReady() { console.info('[pwa] ready to work offline') },
  })
  if ('launchQueue' in window) {
    (window as any).launchQueue.setConsumer(async (params: { files: FileSystemFileHandle[] }) => {
      for (const handle of params.files ?? []) console.info('[pwa] launched with', (await handle.getFile()).name)
    })
  }
  ```

Results:

- **Checks:** `tsc -b`, `npm run lint` and `npm test` (76 tests) all pass with
  this config. `vite build` emits `sw.js`, `workbox-*.js` and
  `manifest.webmanifest`, and injects `<link rel="manifest">`.
- **Default size limit is enough today.** I rebuilt without
  `maximumFileSizeToCacheInBytes` and still got 198 entries: the entry chunk
  (1,961,239 B) and the WASM chunk (1,820,997 B) are both under the default of
  2,097,152 B ([workbox-build](https://developer.chrome.com/docs/workbox/modules/workbox-build)).
  The headroom is about 136 kB, so the explicit 4 MiB is a guard against
  silent drop-out as the bundle grows. Workbox's docs do not say whether
  over-limit files produce a warning (unverified).
- **Offline run** (headless Chrome 152 via `playwright-core` against
  `vite preview`):
  - On first load, `onOfflineReady` fired and the precache held 198 entries.
  - With the network set offline, a reload rendered Excalidraw's canvas.
  - All 13 Excalifont/Nunito/Virgil `FontFace`s reached `loaded`, with every
    request to `localhost:4173/fonts/...` and none to esm.sh.
  - `subset-worker.chunk-*.js` and `chunk-EIO257PC-*.js` both fetched with
    status 200 while offline.
- **Update run:**
  - I loaded the app, reloaded it so the service worker controlled the page,
    then rebuilt with a code change and called `registration.update()`.
  - The `confirm` appeared; accepting it reloaded the page onto the new
    `index-*.js`.
  - On a first visit the page is not yet controlled (prompt mode does not call
    `clients.claim`). There, accepting the prompt activates the new service
    worker but does not reload until the next visit. This is harmless.
- **Install not verified.** The Claude app's built-in browser refused service
  worker registration (an Electron host limit, not the app), so I did not test
  "Install app" or the OS file association. Headless Chrome cannot do either.
  To check by hand, open the app in desktop Chrome/Edge and confirm the
  install button appears once PNG icons are added.

## Service worker and manifest

- **Plugin vs hand-rolled.** `vite-plugin-pwa` generates the Workbox service
  worker with the hashed asset list (`generateSW`), writes the manifest, and
  gives a `virtual:pwa-register` helper
  ([prompt guide](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html)).
  A hand-rolled worker would have to rebuild that precache list from Vite's
  ~170 hashed chunks on every build, so the plugin is the clear choice.
- **Manifest typing.** The plugin's `ManifestOptions` type includes
  `file_handlers` (`{ action; accept: Record<string, string[]> }`), so no type
  casting is needed (read from `node_modules/vite-plugin-pwa/dist/index.d.ts`,
  2.0.0).
- **What gets precached.** Precaching all chunks includes everything
  Excalidraw lazy-loads that we never use: mermaid diagram chunks, about 50
  locale files and katex. Together these are at least 1.8 MB of the 8.9 MB (diagram, locale, katex, cytoscape and dagre chunks by name; shared chunks not attributed). They
  are only downloaded once per version, so accept it for v1. Trimming them
  with `globIgnores` risks a missing chunk offline. That risk is unverified;
  the lazy imports were not traced.
- **Duplicate Assistant fonts.** Assistant UI fonts appear twice:
  `assets/Assistant-*.woff2` comes from Excalidraw's CSS and
  `fonts/Assistant/*` from the copy. This adds 84 KB. Excluding
  `fonts/Assistant` from the copy should be safe, but I did not test it.
- **Chrome's install criteria** need `name` or `short_name`, a 192 px and a
  512 px icon, `start_url`, and `display` set to standalone (or similar)
  ([web.dev install criteria](https://web.dev/articles/install-criteria)).

## Excalidraw fonts and the subset worker

- **Where the fonts ship.** In `@excalidraw/excalidraw@0.18.1` they live under
  `dist/prod/fonts/`: 234 files, 14 MB, of which Xiaolai is 209 files and
  13 MB. The other families are Assistant, Cascadia, ComicShanns, Excalifont,
  Liberation, Lilita, Nunito and Virgil (listed from the installed package).
- **Upstream instructions.** Copy that folder to a served directory and set
  `window.EXCALIDRAW_ASSET_PATH` to the same path
  ([Excalidraw installation docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/installation)).
- **How URLs resolve.** In `ExcalidrawFontFace.createUrls`
  ([source, v0.18.0](https://github.com/excalidraw/excalidraw/blob/v0.18.0/packages/excalidraw/fonts/ExcalidrawFontFace.ts);
  the same code is in the shipped `dist/prod/chunk-K2UTITRG.js`):
  - Each font URI (e.g. `./fonts/Excalifont/...woff2`) is resolved against
    `EXCALIDRAW_ASSET_PATH`, which may be a string or an array.
  - The esm.sh URL (`https://esm.sh/@excalidraw/excalidraw@<ver>/dist/prod/`)
    is **always appended as a fallback**. Offline, the first (local) URL
    wins.
  - `normalizeBaseUrl` turns a path starting with `/` or `./` into
    `new URL(path, window.location.origin)`. That is why the value must be an
    absolute URL computed from `location.href` when the app is served from a
    sub-path.
- **The font-subset worker.** It is a separate module worker
  (`new Worker(url, { type: "module" })`), emitted by Vite as
  `assets/subset-worker.chunk-*.js` plus `subset-shared.chunk-*.js`. It
  imports `chunk-EIO257PC-*.js`, which holds base64-embedded WASM
  (harfbuzz/woff2). All are ordinary hashed assets, so `globPatterns` picks
  them up with no special config. The worker is used when exporting with
  embedded fonts, so precaching it keeps export working offline. It was
  fetched from cache while offline in the run; the export itself was not
  exercised.

## Update flow

- **`prompt` (default).** A new deploy installs in the background and waits.
  `onNeedRefresh` fires and the app shows its own prompt (Reload / Cancel).
  `updateSW()` activates it and reloads; Cancel keeps the old version until
  every tab closes. `cleanupOutdatedCaches` is on by default with
  `generateSW`, and the docs advise against disabling it
  ([prompt guide](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html)).
- **`autoUpdate`.** This sets `skipWaiting` and `clientsClaim`, then reloads
  open tabs when a new version is found. The docs warn it can lose unsaved
  input, recommend `prompt` for apps with forms, and say switching from
  `autoUpdate` to `prompt` later is difficult
  ([auto-update guide](https://vite-pwa-org.netlify.app/guide/auto-update.html)).
- **Choice: `prompt`.** An unsaved sheet would be wiped by an auto-reload.
  Replace the `confirm()` with a small toast in the shell once a UI exists.
- **When updates are noticed (unverified).** The browser checks for a new
  `sw.js` on navigation. A long-lived installed window only notices on
  relaunch, unless `registerSW({ onRegisteredSW })` polls
  `registration.update()`.

## File handling (opening sheet files)

- **Support.** Manifest `file_handlers` plus `window.launchQueue` work in
  Chrome and Edge 102+ on desktop only, not in Firefox or Safari
  ([Chrome docs](https://developer.chrome.com/docs/capabilities/web-apis/file-handling);
  [MDN how-to](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Associate_files_with_your_PWA)).
- **When it applies.** The association only takes effect once the app is
  installed. The browser reads `file_handlers` at install and registers it
  with the OS.
  - The **first** OS launch asks the user to confirm opening the file with
    the PWA.
  - Chrome repeats that prompt until Allow or Block, and auto-blocks after it
    is ignored three times.
  - Any change to `file_handlers` resets the permission.
  - Windows specifics (whether it appears under "Open with", or as default on
    double-click) are not documented on these pages, so they are
    **unverified** until tried on Matheus's machine.
- **Constraints.**
  - `action` must be inside the manifest scope
    ([MDN file_handlers](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/file_handlers)).
  - Keys of `accept` are MIME types; values are arrays of extensions (dotted
    in every example).
  - Chrome advises **not hijacking common extensions like `.json`** and
    defining your own.
  - Claiming `.excalidraw` is technically possible (Excalidraw's own MIME is
    `application/vnd.excalidraw+json`, from `constants.d.ts` in the package).
    But it would compete with excalidraw.com or Obsidian for plain
    drawings.
  - A **custom extension** keeps "math sheets" distinct. `.calc` is a
    placeholder name; pick it in the persistence decision.
- **Save-back.** `launchParams.files` is an array of `FileSystemHandle`
  objects ([MDN LaunchParams.files](https://developer.mozilla.org/en-US/docs/Web/API/LaunchParams/files)).
  For `kind === "file"`, call `getFile()` to read. Writing back uses the File
  System Access API on the same handle (`createWritable`), which may prompt
  for write permission. That this works on launched handles is inferred, not
  stated on those pages, so it is **unverified**.
- **Excalidraw integration.** Excalidraw already accepts the handle: the
  public export `loadFromBlob(blob, appState, elements, fileHandle)` stores it
  as `appState.fileHandle`. Excalidraw's own "save to current file" then
  writes to the same file (from `dist/types/excalidraw/index.d.ts` and
  `data/blob.d.ts`). The launch consumer can therefore call
  `loadFromBlob(await handle.getFile(), null, null, handle)` and
  `updateScene`, which fits the persistence ticket.

## Hosting

- **GitHub Pages.**
  - With GitHub Free, the repository must be public. Pages from a private repo
    needs Pro, Team or Enterprise, and **the site is publicly available on
    the internet even when the repo is private**
    ([creating a Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site);
    [GitHub plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)).
  - Access-controlled (private) Pages needs an organization on Enterprise
    Cloud
    ([visibility](https://docs.github.com/en/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site)).
  - Limits are a 1 GB site and a 100 GB/month soft bandwidth limit
    ([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)).
    Our `dist` is 22 MB.
  - **Matheus's plan is unknown.** `gh api user` returns `plan: null` with
    this token, and the repo is `private` with `has_pages: false`. No settings
    were changed.
- **Cloudflare Pages.**
  - The free plan allows 500 builds/month, 20,000 files per site and 25 MiB
    per file ([limits](https://developers.cloudflare.com/pages/platform/limits/)).
    Our build has 409 files with a largest of 1.96 MB.
  - The GitHub app can be scoped to selected repositories
    ([GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)).
    The page does not state private-repo support explicitly (unverified, but
    widely used). A `wrangler pages deploy dist` from CI avoids the question.
  - Access can gate previews, and with a manual tweak the `*.pages.dev`
    production domain too
    ([known issues](https://developers.cloudflare.com/pages/platform/known-issues/)).
  - Cloudflare Zero Trust's free plan covers up to 50 users. That comes from
    search results summarising Cloudflare's plan page, so it is **unverified**
    against the primary page.
- **Netlify.**
  - The free credit-based plan has 300 credits, with bandwidth at 20 credits
    per GB ([pricing](https://www.netlify.com/pricing/)).
  - "Private" project visibility exists on Free and Personal, but **only the
    team owner can view it**, behind a Netlify login
    ([visibility](https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/)).
    Password protection needs Pro
    ([password protection](https://docs.netlify.com/manage/security/secure-access-to-sites/password-protection/)).
  - The docs pages read do not state private-repo eligibility per plan
    (unverified).
  - Combining a login-gated site with a service worker is untested. The plugin
    has `useCredentials: true` for the manifest request (from the type
    definitions), but whether precache fetches pass the gate is
    **unverified**.
- **Local install.** `http://localhost` is a secure context
  ([MDN secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)),
  so the app can be installed from `npm run preview`.
  - Once precached, it launches with the server stopped. This matches the
    offline run, where the service worker served everything.
  - **The origin includes the port.** A different port (e.g. `vite dev` on
    5173) is a different app, with separate file-handler permissions and
    caches.
  - Updates arrive only when you rebuild and serve again on the same port.
  - Clearing site data uninstalls the cache.
  - It works for a single machine, but HTTPS hosting is needed for a second
    device.

## Open points

- Choose the sheet file extension and MIME type in the persistence decision.
  The file handler, `loadFromBlob` and save-back all depend on it.
- Make the PNG icons, then verify by hand on Windows Chrome/Edge: install,
  "Open with" or double-click on a `.calc` file, and save-back to the same
  file.
- Confirm the GitHub plan before choosing GitHub Pages. Cloudflare Pages
  avoids the dependency.
