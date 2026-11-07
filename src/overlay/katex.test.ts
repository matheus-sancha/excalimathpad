import { describe, expect, it, vi } from 'vitest'

// A fresh copy of the module each time: the test setup has already loaded KaTeX
// into the shared one.
async function freshKatex() {
  vi.resetModules()
  return import('./katex.ts')
}

describe('katex (loaded lazily, docs/spec-v1.md section 14)', () => {
  it('gives no HTML until KaTeX has loaded, then typesets', async () => {
    const { isKatexReady, loadKatex, texToHtml } = await freshKatex()
    expect(isKatexReady()).toBe(false)
    expect(texToHtml('x^2')).toBeNull()

    await loadKatex()

    expect(isKatexReady()).toBe(true)
    expect(texToHtml('x^2')).toContain('class="katex"')
  })

  it('gives null for TeX KaTeX can’t render, so the line shows as text', async () => {
    const { loadKatex, texToHtml } = await freshKatex()
    await loadKatex()

    expect(texToHtml('\notacommand{')).toBeNull()
  })
})
