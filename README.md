# Excalimathpad

A Mathcad-style live-calculation canvas built on [Excalidraw](https://github.com/excalidraw/excalidraw):
sketch freely, and put unit-aware math on the sheet that recalculates as
you edit. Runs entirely in the browser and builds to a static site.

Status: live recalculation across math elements (#3). The sheet opens with two
math elements: `R = 10 kohm`, `I = 2 mA` above, and `U = I * R` (`20 V`) below.
Edit `I` and `U` updates. Elements read top to bottom, then left to right, like
Mathcad: each one sees only what is defined above it. Click an element to
select it and drag it from anywhere; duplicate one (Ctrl+D) for a copy with the
same source. Double-click a line, or press Enter on a selected element for its
last line, to edit it: arrows move between lines, Enter splits, Backspace at the
start joins, a click on another line moves there, and Esc, a click outside or a
drag leaves. A second Esc deselects. Ctrl+Z then undoes one line at a time,
among Excalidraw's own steps such as selecting.
Ctrl+S saves the sheet as a `.excalimathpad` file and Ctrl+O opens one (also in
the ☰ menu); unsaved work comes back from a recovery copy on the next launch,
in Chrome or Edge. Assignment is plain math.js `=`; Mathcad's `:=` is
not accepted. Avoid naming variables after units (`V`, `A`, `m`, `s`): the
name silently shadows the unit for everything below it (#7).

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
