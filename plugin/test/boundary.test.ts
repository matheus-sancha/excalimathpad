import { describe, expect, it } from 'vitest'

/**
 * One source, two builds (docs/spec-v1.md section 12a, ADR 0006): `src/` never
 * imports `obsidian` or `plugin/`. oxlint's `no-restricted-imports` says so
 * as code is written; this reads every file, so a lint config change can't
 * quietly drop the rule.
 */
const sources = import.meta.glob<string>('../../src/**/*.{ts,tsx,mts,cts,js,jsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Every module a file names: `import … from`, `export … from`, `import()` and `require()`. */
export function specifiers(text: string): string[] {
  const found: string[] = []
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\sfrom\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) found.push(match[1])
  return found
}

/** True when a specifier reaches `obsidian` or anything under `plugin/`. */
export function crossesBoundary(specifier: string): boolean {
  return /^obsidian(\/|$)/.test(specifier) || /(^|\/)plugin(\/|$)/.test(specifier)
}

describe('the boundary between src/ and plugin/', () => {
  it('reads the files it checks', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50)
    expect(Object.keys(sources)).toContain('../../src/App.tsx')
  })

  it('src/ imports neither obsidian nor plugin/', () => {
    const crossings = Object.entries(sources).flatMap(([file, text]) =>
      specifiers(text)
        .filter(crossesBoundary)
        .map((specifier) => `${file}: ${specifier}`),
    )
    expect(crossings).toEqual([])
  })

  it('catches each form of a crossing (the failing case)', () => {
    const bad = [
      "import { Plugin } from 'obsidian'",
      "import type { App } from 'obsidian'",
      "export { SheetView } from '../plugin/SheetView.ts'",
      "const m = await import('../../plugin/main.ts')",
      "const o = require('obsidian')",
    ].join('\n')
    expect(specifiers(bad).filter(crossesBoundary)).toHaveLength(5)
    expect(crossesBoundary('../canvas/plugins.ts')).toBe(false)
    expect(crossesBoundary('./file/sheetFormat.ts')).toBe(false)
  })
})
