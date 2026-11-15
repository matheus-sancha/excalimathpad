/**
 * `docs/math-guide.md?guide`: the Math guide as elements, made at build time
 * by `vite.config.ts` and `esbuild.plugin.mjs` from `src/guide/markdown.ts`.
 */
declare module '*.md?guide' {
  const guide: readonly import('./markdown.ts').GuideNode[]
  export default guide
}
