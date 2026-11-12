/**
 * The build stamp the ☰ menu shows (docs/spec-v1.md section 12, Hosted
 * build): the short commit and the build's date, or `dev` when the build has
 * no commit to name, as on a local `npm run dev` or `npm run build`.
 *
 * Pure, and outside `src/`, because `vite.config.ts` runs it at build time
 * and hands the app the finished text as `__BUILD_STAMP__`.
 */
export function buildStamp(commit: string | undefined, now: Date): string {
  const hash = commit?.trim()
  if (!hash) return 'dev'
  return `${hash.slice(0, 7)} · ${now.toISOString().slice(0, 10)}`
}
