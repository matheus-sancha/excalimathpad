import { describe, expect, it } from 'vitest'
import { neutralise } from './neutralise.mjs'

// The texts are Excalidraw 0.18.0-9fbeaed's own, as its packages ship them.
describe("the plugin build's rewrite of Excalidraw's files (docs/spec-v1.md section 12a, Data protection)", () => {
  it('makes a read of localStorage find nothing, with or without window', () => {
    const tally = {}
    expect(neutralise('try{let e=window.localStorage.getItem(Fe);if(e==="compact")return e}catch{}', tally)).toBe(
      'try{let e=null;if(e==="compact")return e}catch{}',
    )
    expect(neutralise('if(!O)try{let t=localStorage.getItem($e);t&&(O=JSON.parse(t)??J)}catch{}', tally)).toBe(
      'if(!O)try{let t=null;t&&(O=JSON.parse(t)??J)}catch{}',
    )
    expect(tally).toEqual({ 'localStorage reads': 2 })
  })

  it('makes a write do nothing, without throwing', () => {
    const tally = {}
    const written = neutralise(
      'var set=(t,n)=>{window.localStorage.setItem(t,JSON.stringify(n));return!0},del=t=>{localStorage.removeItem(t)}',
      tally,
    )
    expect(written).toBe('var set=(t,n)=>{(()=>{})(t,JSON.stringify(n));return!0},del=t=>{(()=>{})(t)}')
    expect(tally).toEqual({ 'localStorage writes': 2 })
  })

  it("renames the warnings' text, and leaves any other use for the audit to fail on", () => {
    expect(neutralise('console.warn(`localStorage.getItem error: ${n.message}`)')).toBe(
      'console.warn(`storage.getItem error: ${n.message}`)',
    )
    for (const other of ['localStorage.length', 'localStorage[k]', 'this.localStorage.getItem(k)', 'localStorage.clear()']) {
      expect(neutralise(other)).toBe(other)
    }
  })

  it("blanks the font fallback and excalidraw.com's environment values", () => {
    const tally = {}
    expect(neutralise('h(te,"ASSETS_FALLBACK_URL",`https://esm.sh/${D.PKG_NAME}/dist/prod/`)', tally)).toBe(
      'h(te,"ASSETS_FALLBACK_URL",`about:blank#${D.PKG_NAME}/dist/prod/`)',
    )
    expect(neutralise('{MODE:"production",VITE_APP_LIBRARY_URL:"https://libraries.excalidraw.com",VITE_APP_FIREBASE_CONFIG:\'{"apiKey":"AIzaXYZ"}\'}', tally)).toBe(
      '{MODE:"production",VITE_APP_LIBRARY_URL:"",VITE_APP_FIREBASE_CONFIG:""}',
    )
    expect(tally).toEqual({ 'the esm.sh font fallback': 1, "excalidraw.com's environment values": 2 })
  })
})
