/// <reference types="node" />
// (Node types for this test only: it reads Excalidraw's CSS from disk.)
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { ABOVE_DRAWING_BELOW_UI_Z_INDEX } from './layers.ts'

// Contract with Excalidraw's CSS internals: read the z-index variables from
// the installed package, so an upgrade that moves its layers fails here
// instead of silently hiding math or letting it cover the toolbar.
const require = createRequire(import.meta.url)
const cssPath = require
  .resolve('@excalidraw/excalidraw')
  .replace(/index\.js$/, 'index.css')
const css = readFileSync(cssPath, 'utf8')

function zIndex(name: string): number {
  const match = css.match(new RegExp(`--zIndex-${name}:\\s*(\\d+)`))
  if (!match) throw new Error(`--zIndex-${name} not found in ${cssPath}`)
  return Number(match[1])
}

describe('overlay z-index vs Excalidraw layers', () => {
  const z = ABOVE_DRAWING_BELOW_UI_Z_INDEX

  it('is above the drawing (ties the interactive canvas, wins by DOM order)', () => {
    expect(z).toBeGreaterThan(zIndex('canvas'))
    expect(z).toBe(zIndex('interactiveCanvas'))
  })

  it("is below Excalidraw's text editor, SVG layer and link buttons", () => {
    expect(z).toBeLessThan(zIndex('wysiwyg'))
    expect(z).toBeLessThan(zIndex('svgLayer'))
    expect(z).toBeLessThan(zIndex('canvasButtons'))
  })

  it("is below Excalidraw's UI (toolbar, panels, menus)", () => {
    expect(z).toBeLessThan(zIndex('layerUI'))
  })
})
