# Context

Excalimathpad is a single-user, browser-only "calc sheet": the Excalidraw
whiteboard with a layer of live, unit-aware math on top (Mathcad-style). It is
a Vite + React + TypeScript app that builds to static files; there is no
server. v1 target: one sheet, for Matheus's own use.

## Entry points

- `index.html` → `src/main.tsx` — the only runtime entry; mounts `App`.
- `npm run dev | build | preview | test | lint | check` — see `package.json`.
- `.github/workflows/ci.yml` — runs `npm run check` on pushes to `main`
  and on pull requests.

## Modules

- **App** (`src/App.tsx`) — composition root. Decides what fills each shell
  slot. No logic of its own. Depends on: shell, canvas.
- **shell** (`src/shell/`) — full-viewport layout with three slots: `canvas`,
  `overlay` (stacked exactly over the canvas, pointer-transparent by default)
  and `sidePanel` (docked right). Empty (falsy) slots render nothing. Interface: the
  `AppShell` props. Depends on: nothing.
- **canvas** (`src/canvas/`) — the drawing surface: the official, unforked
  `@excalidraw/excalidraw` component. Interface: `SheetCanvas`, whose
  `onApiReady` hands out Excalidraw's imperative API (scene, app state,
  scroll/zoom subscriptions). The only module allowed to import Excalidraw:
  an engineering rule that enforces ADR 0001, not part of that decision.
  Depends on: `@excalidraw/excalidraw`.
- **test setup** (`src/test/`) — jsdom stubs for browser APIs Excalidraw
  touches on mount (canvas, fonts, matchMedia, ResizeObserver). Not app code.

Planned (not built): the **math overlay** fills the `overlay` slot and reads
viewport state through `onApiReady` (#2); recalculation (#3) and a side panel
follow.

## Domain

Not modelled yet. The core loop is: define variables with units, see results
inline, edit an input and everything downstream recalculates. Engine: math.js,
client-side. Terms get pinned when #2 introduces them.

## Load-bearing

- **Excalidraw is wrapped, never forked or patched** ([ADR 0001](docs/adr/0001-wrap-excalidraw-unforked.md)).
  Math lives outside it, in the overlay and side panel. Reaching into
  Excalidraw internals or patching `node_modules` breaks upgrades.
- **Every ancestor of the canvas has a definite height** (`src/index.css`,
  `AppShell.css`). Excalidraw fills 100% of its container; a zero-height
  ancestor renders nothing, silently.
- **Overlay and canvas share one positioned box** (`.app-shell__stage`). The
  overlay maps canvas coordinates to screen coordinates relative to that box;
  moving either out of it breaks the mapping.
- **Static-only build** with relative `base` (`vite.config.ts`). Adding a
  server dependency breaks the deploy model.

## Incidental

- Excalidraw loads its canvas fonts (Excalifont etc.) from the esm.sh CDN by
  default; UI fonts are bundled. Fine online; self-host them if offline use
  matters (`window.EXCALIDRAW_ASSET_PATH`).
- The production bundle is large, almost all Excalidraw: the entry chunk
  (`index-*.js`) is ~1.31 MB (414 kB gzip), and a separate ~1.8 MB chunk is
  loaded only by Excalidraw's font-subset worker. Vite's chunk-size warning is
  expected.
- `npm audit` reports advisories in Excalidraw's transitive deps (mermaid,
  katex, nanoid, lodash-es); the only "fix" downgrades Excalidraw to 0.17.
- `test.server.deps.inline` for Excalidraw in `vite.config.ts` exists because
  its ESM build imports JSON without import attributes, which Node rejects.

## Decisions

- [ADR 0001](docs/adr/0001-wrap-excalidraw-unforked.md) — wrap the npm
  Excalidraw component unforked; math is an overlay + side panel around it.
