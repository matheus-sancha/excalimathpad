/**
 * math.js's help texts, left out of both builds (docs/spec-v1.md section 14,
 * M4e, Lighter plugin). `esbuild.plugin.mjs` and an alias in `vite.config.ts`
 * resolve math.js's `expression/embeddedDocs/embeddedDocs.js` to this module.
 * Only `help()` reads those texts, and the engine disables it
 * (`src/math/evaluate.ts`); no part of the app imports math.js's `docs`.
 * Nothing in `src/` imports this file.
 */
export const embeddedDocs: Record<string, never> = {}
