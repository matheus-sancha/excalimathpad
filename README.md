# Excalimathpad

A Mathcad-style live-calculation canvas built on [Excalidraw](https://github.com/excalidraw/excalidraw):
sketch freely, and (soon) drop unit-aware math onto the sheet that recalculates as
you edit. Runs entirely in the browser and builds to a static site.

Status: spike of one math element (#2). The sheet opens with one math element
(`R = 10 kohm`, `I = 2 mA`, `I * R` gives `20 V`). Edit it in place, and move it
by dragging its dashed border. Recalculation across elements (#3) and saving
are not built yet. Assignment is plain math.js `=`; Mathcad's `:=` is not
accepted yet.

## Requirements

- Node.js `^22.22.2 || ^24.15.0 || >=26` (the floor is set by jsdom, used in
  tests; Vite 8 alone would accept less), npm 10+. Also declared in
  `package.json` `engines`.

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
