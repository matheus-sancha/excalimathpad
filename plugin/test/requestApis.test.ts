import { describe, expect, it } from 'vitest'

/**
 * Where a request API may be named (docs/spec-v1.md section 14, 0.7.0, A
 * source test; ADR 0008). The Math assistant reaches a provider only through
 * the `request` port each home hands App, so the browser's request APIs are
 * named in one file of `src/`, its entry, and in one file of `plugin/`, which
 * is also the only one to name Obsidian's secret storage. Obsidian's own
 * request function, which gives an answer only once it is whole, is named
 * nowhere in `plugin/`.
 *
 * It reads every file, tests and comments included, as `boundary.test.ts`
 * beside it does. `plugin/test/` is left out: this file and the ports' own
 * test have to name what they check.
 */
const src = import.meta.glob<string>('../../src/**/*.{ts,tsx,mts,cts,js,jsx,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const plugin = import.meta.glob<string>(['../**/*.{ts,tsx,mts,cts,js,jsx,css}', '!../test/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** The request APIs of a browser. */
export const REQUEST_APIS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon']

/** Which of `names` a file's text holds, each as a whole word. */
export function named(text: string, names: readonly string[]): string[] {
  return names.filter((name) => new RegExp(`\\b${name}\\b`).test(text))
}

/** Every `file: name` where a file other than `allowed` holds one of `names`. */
function strays(files: Record<string, string>, names: readonly string[], allowed: string | null): string[] {
  return Object.entries(files)
    .filter(([file]) => file !== allowed)
    .flatMap(([file, text]) => named(text, names).map((name) => `${file}: ${name}`))
}

describe('where a request API is named (section 14, 0.7.0)', () => {
  it('reads the files it checks', () => {
    expect(Object.keys(src).length).toBeGreaterThan(50)
    expect(Object.keys(src)).toContain('../../src/main.tsx')
    expect(Object.keys(src)).toContain('../../src/assistant/ports.ts')
    expect(Object.keys(plugin)).toContain('../assistant.ts')
    expect(Object.keys(plugin)).toContain('../SheetView.ts')
    expect(Object.keys(plugin).filter((file) => file.includes('/test/'))).toEqual([])
  })

  it('src/ names one only in its entry, src/main.tsx', () => {
    expect(strays(src, REQUEST_APIS, '../../src/main.tsx')).toEqual([])
    expect(named(src['../../src/main.tsx'], REQUEST_APIS)).toEqual(['fetch'])
  })

  it('plugin/ names fetch and secretStorage only in plugin/assistant.ts', () => {
    expect(strays(plugin, [...REQUEST_APIS, 'secretStorage'], '../assistant.ts')).toEqual([])
    expect(named(plugin['../assistant.ts'], REQUEST_APIS)).toEqual(['fetch'])
  })

  it('plugin/ names requestUrl nowhere', () => {
    expect(strays(plugin, ['requestUrl'], null)).toEqual([])
  })

  it('catches each name, in code or in a comment, and no longer word (the failing case)', () => {
    const bad = [
      "const answer = await fetch('https://api.example.com')",
      'const answer = await window.fetch(address)',
      'new XMLHttpRequest().open("GET", address)',
      'const socket = new WebSocket(address)',
      'new EventSource(address)',
      'navigator.sendBeacon(address, body)',
      '// the key is read with app.secretStorage.getSecret(id)',
      "import { requestUrl } from 'obsidian'",
    ]
    const names = [...REQUEST_APIS, 'secretStorage', 'requestUrl']
    for (const line of bad) expect(named(line, names), line).toHaveLength(1)
    expect(strays({ '../SheetView.ts': bad[1], '../assistant.ts': bad[1] }, names, '../assistant.ts')).toEqual([
      '../SheetView.ts: fetch',
    ])
    // A longer word isn't the name: a font that is "fetched", a "prefetch" hint.
    expect(named('never fetched; dns-prefetch; fetchSize; refetch', names)).toEqual([])
  })
})
