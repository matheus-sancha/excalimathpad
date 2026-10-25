# Excalimathpad

A Mathcad-style live-calculation canvas built on [Excalidraw](https://github.com/excalidraw/excalidraw):
sketch freely, and (soon) drop unit-aware math onto the sheet that recalculates as
you edit. Runs entirely in the browser and builds to a static site.

Status: app shell only (issue #1). The math element (#2) and recalculation (#3)
are not built yet.

## Requirements

- Node.js 20.19+ or 22.12+ (required by Vite 8), npm 10+

## Run

```bash
npm install
npm run dev        # dev server at http://localhost:5173
```

## Build and deploy

```bash
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ locally to check the build
```

`dist/` is plain static files with relative asset URLs, so it can be served
from any static host or sub-path (GitHub Pages, Netlify, an S3 bucket, a local
folder server). There is no backend.

## Checks

```bash
npm run lint       # oxlint
npm test           # vitest (jsdom), single run; `npm run test:watch` to watch
npm run typecheck  # tsc project build, no emit
npm run check      # lint + test + build, what CI runs
```

## Where things are

See [CONTEXT.md](CONTEXT.md) for the module map and the decisions behind it
(`docs/adr/`).
