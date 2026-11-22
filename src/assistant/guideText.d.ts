/**
 * `docs/math-guide.md?text`: the Math guide's own text, as the file is, made at build time
 * by `vite.config.ts` and `esbuild.plugin.mjs` from `src/guide/markdown.ts`.
 */
declare module '*.md?text' {
  const text: string
  export default text
}
