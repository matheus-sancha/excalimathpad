# 0006. The Obsidian plugin bundles the whole app from the same source

- **Status**: accepted, M4d, not built
- **Date**: 2026-11-14

## Context

The hosted web app doesn't open on Matheus's work laptop, while Obsidian there takes community
plugins and runs the Excalidraw plugin (#115). The app should reach that machine, phones and
tablets, and strangers in Obsidian's community list, without forking the code or the file. An
install delivers only `main.js`, `manifest.json` and `styles.css`, so whatever the app needs must
be inside them (#116). Choices about where the plugin's code lives, how it is built and what it may
touch are hard to reverse once users install it.

Decided by Matheus on 2026-11-14, on the map in #114 (#124, #126, #128, #129, #130). The plugin's
behaviour is in [`docs/spec-v1.md`](../spec-v1.md) section 12a, with sections 7 and 8.

## Decision

- **Its own view for `.excalimathpad` files.** The plugin registers a `TextFileView` for the
  extension and mounts the same `<App>` in it. It is not an add-on to the Excalidraw plugin, and it
  doesn't replace the web app.
- **One source, two builds.** A top-level `plugin/` is the only code that imports `obsidian`; `src/`
  never imports `obsidian` or `plugin/`, enforced by a lint rule and a test. The web build stays on
  Vite. The plugin build is an esbuild script that makes one CommonJS `main.js` (no splitting, fonts
  as `data:` URLs, no worker) and one `styles.css`, trimmed of Mermaid, non-English locales and font
  subsetting, under 5,000,000 bytes per file.
- **No network and nothing outside the vault, enforced.** The plugin makes no request, stores only
  in vault files and `data.json`, and reads only the open sheet and a picked image. A bundle audit,
  a network-blocked run in headless Chromium and Obsidian's lint at zero warnings block every pull
  request and release.
- **Confined to its view.** Listeners, dialogs and portals bind to the view's container and
  document, never the global `window` or `document`, so several tabs and pop-out windows work.
- **One version for both homes,** from `package.json`, released by hand from an Actions button as a
  draft. `main.js` is not committed unless Obsidian's review proves it must be.

## Alternatives considered

- **Math as an add-on to the Obsidian Excalidraw plugin.** It reuses a canvas already there, but
  ties every release to another plugin's internals and file format. Matheus chose "Own view for
  .excalimathpad files".
- **Obsidian replacing the web app.** One home is simpler to build, but the web app is the
  try-before-install route and Matheus's home setup.
- **A workspace with a second `package.json`.** Cleaner dependency lines, but the plugin and the web
  app pin the same Excalidraw and math.js, so one `package.json` keeps them in step.
- **Vite for both builds.** Its library mode splits dynamic imports and emits worker files, which an
  install can't deliver. esbuild produced one file in the probe (#116).
- **A Playwright run of the built bundle only at release.** #128 chose fake-`obsidian` unit tests and
  an audit; #126 reopened it, so the network-blocked run is on every pull request.

## Consequences

- Every listener the web app put on `document` or `window` (`canvasEvents.ts`, `FileChrome`,
  `useFileRoutes`) needs a view-bound form, and a test proves the plugin adds none globally.
- The plugin's Excalidraw lacks Mermaid, its own image export with fonts, and other languages, so
  those items are hidden there (ADR 0001's contract tests grow).
- The bundle grows with each dependency; the size audit fails a change that crosses Obsidian Sync's
  limit.
- UI text is in sentence case in both homes, for the lint.
- Two homes save the same file differently (ADR 0004): explicit save on the web, autosave in a vault.
