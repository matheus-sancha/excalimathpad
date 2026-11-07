import { useSyncExternalStore } from 'react'

/**
 * TeX to HTML with KaTeX, loaded on first use (`katexModule.ts`), so the entry
 * chunk doesn't carry it. Until it has loaded, `texToHtml` gives null and the
 * grid shows each line's source as plain text; the rows then re-render, and the
 * elements re-measure, once.
 */
type Katex = (typeof import('./katexModule.ts'))['default']

let katex: Katex | null = null
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

/** Starts loading KaTeX, once; resolves when it is ready. */
export function loadKatex(): Promise<void> {
  loading ??= import('./katexModule.ts').then((module) => {
    katex = module.default
    listeners.forEach((listener) => listener())
  })
  return loading
}

export const isKatexReady = () => katex !== null

/** True once KaTeX has loaded; starts loading it. Re-renders when it arrives. */
export function useKatexReady(): boolean {
  return useSyncExternalStore(subscribe, isKatexReady)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  void loadKatex()
  return () => listeners.delete(listener)
}

// Every row re-renders on each keystroke; most of its TeX hasn't changed.
const cache = new Map<string, string | null>()
const CACHE_LIMIT = 2000

/**
 * The TeX as KaTeX's HTML. Null until KaTeX has loaded, or when it can't render
 * the TeX: the caller shows plain text, so a typesetting bug never hides a line.
 */
export function texToHtml(tex: string): string | null {
  if (!katex) return null
  const cached = cache.get(tex)
  if (cached !== undefined) return cached
  let html: string | null
  try {
    html = katex.renderToString(tex, { throwOnError: true, strict: 'ignore' })
  } catch {
    html = null
  }
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(tex, html)
  return html
}
