// A small reader for the PDFs Chromium (Skia) writes, for the print run
// (scripts/print-run.mjs): the pages, each page's size and text, the fonts
// embedded and the images. Skia writes plain objects (no object streams),
// Flate-compressed content streams and Type0 fonts with a ToUnicode map, so
// this reads exactly that and no more. A PDF it can't read throws.

import { inflateSync } from 'node:zlib'

/** Every `N 0 obj … endobj`: its dictionary's text and its stream, inflated. */
function objectsOf(bytes) {
  const text = bytes.toString('latin1')
  const objects = new Map()
  const head = /(\d+) 0 obj\s*/g
  for (let match = head.exec(text); match; match = head.exec(text)) {
    const start = head.lastIndex
    const end = text.indexOf('endobj', start)
    const body = text.slice(start, end)
    const at = body.indexOf('stream')
    let dict = body
    let stream = null
    if (at >= 0 && /^stream\r?\n/.test(body.slice(at))) {
      dict = body.slice(0, at)
      const from = start + at + body.slice(at).match(/^stream\r?\n/)[0].length
      const length = Number(dict.match(/\/Length (\d+)/)?.[1])
      const raw = bytes.subarray(from, from + length)
      stream = /\/FlateDecode/.test(dict) ? inflateSync(raw) : raw
    }
    objects.set(Number(match[1]), { dict, stream })
    head.lastIndex = end
  }
  return objects
}

const ref = (text, key) => {
  const match = text.match(new RegExp(`/${key} (\\d+) 0 R`))
  return match ? Number(match[1]) : null
}

/** A ToUnicode CMap: source code (hex) to text, and its codes' width in hex digits (2 for a Type 3 font, 4 for Type 0). */
function cmapOf(stream) {
  const map = new Map()
  const text = stream.toString('latin1')
  map.width = text.match(/begincodespacerange\s*<([0-9a-fA-F]+)>/)?.[1].length ?? 4
  const unhex = (hex) => {
    let out = ''
    for (let i = 0; i + 4 <= hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16))
    return out
  }
  for (const [, block] of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const [, from, to] of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) map.set(from.toLowerCase(), unhex(to))
  }
  for (const [, block] of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const [, lo, hi, rest] of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]+>|\[[^\]]*\])/g)) {
      const a = parseInt(lo, 16)
      const b = parseInt(hi, 16)
      const width = lo.length
      const targets = rest.startsWith('[') ? [...rest.matchAll(/<([0-9a-fA-F]+)>/g)].map((m) => m[1]) : null
      for (let code = a; code <= b; code += 1) {
        const key = code.toString(16).padStart(width, '0')
        if (targets) map.set(key, unhex(targets[code - a] ?? ''))
        else {
          const base = rest.slice(1, -1)
          const last = parseInt(base.slice(-4), 16) + (code - a)
          map.set(key, unhex(base.slice(0, -4) + last.toString(16).padStart(4, '0')))
        }
      }
    }
  }
  return map
}

/**
 * Reads a PDF: `pages` (each with its `width` and `height` in pt and its
 * `text`, the shown strings in order, one per text-showing operator joined by
 * spaces), `fonts` (the embedded fonts' names, subset tag dropped) and
 * `images` (how many image objects).
 */
export function readPdf(bytes) {
  const objects = objectsOf(Buffer.from(bytes))
  const cmaps = new Map()
  const cmapFor = (fontRef) => {
    if (!cmaps.has(fontRef)) {
      const font = objects.get(fontRef)
      const to = font && ref(font.dict, 'ToUnicode')
      cmaps.set(fontRef, to !== null && to !== undefined && objects.get(to)?.stream ? cmapOf(objects.get(to).stream) : null)
    }
    return cmaps.get(fontRef)
  }
  const resourcesOf = (dict) => {
    const inline = dict.match(/\/Resources <<([\s\S]*)>>\s*\/(MediaBox|Contents|Parent|Tabs)/)
    if (inline) return inline[1]
    const r = ref(dict, 'Resources')
    return r === null ? '' : objects.get(r)?.dict ?? ''
  }
  const pages = []
  const pageTree = [...objects.values()].find((o) => /\/Type \/Pages\b/.test(o.dict) && !/\/Parent /.test(o.dict))
  const kids = (dict) => [...(dict.match(/\/Kids \[([^\]]*)\]/)?.[1] ?? '').matchAll(/(\d+) 0 R/g)].map((m) => Number(m[1]))
  const walk = (dict) => {
    for (const kid of kids(dict)) {
      const object = objects.get(kid)
      if (/\/Type \/Pages\b/.test(object.dict)) walk(object.dict)
      else pages.push(object.dict)
    }
  }
  if (pageTree) walk(pageTree.dict)
  const read = pages.map((dict) => {
    const box = dict.match(/\/MediaBox \[([^\]]*)\]/)[1].trim().split(/\s+/).map(Number)
    const resources = resourcesOf(dict)
    const fontsDict = resources.match(/\/Font <<([^>]*)>>/)?.[1] ?? ''
    const fonts = new Map([...fontsDict.matchAll(/\/(\w+) (\d+) 0 R/g)].map(([, name, n]) => [name, Number(n)]))
    const contents = dict.match(/\/Contents \[([^\]]*)\]/)
      ? [...dict.match(/\/Contents \[([^\]]*)\]/)[1].matchAll(/(\d+) 0 R/g)].map((m) => Number(m[1]))
      : [ref(dict, 'Contents')]
    const shown = []
    for (const n of contents) {
      const content = objects.get(n)?.stream?.toString('latin1') ?? ''
      let cmap = null
      // Tf picks the font; Tj and TJ show hex strings through its ToUnicode map.
      const tokens = /\/(\w+)\s+[\d.]+\s+Tf|(\[(?:[^\]]*)\])\s*TJ|<([0-9a-fA-F]*)>\s*Tj/g
      for (const [, font, array, single] of content.matchAll(tokens)) {
        if (font) {
          cmap = fonts.has(font) ? cmapFor(fonts.get(font)) : null
          continue
        }
        const hexes = array ? [...array.matchAll(/<([0-9a-fA-F]*)>/g)].map((m) => m[1]) : [single]
        let out = ''
        const width = cmap?.width ?? 4
        for (const hex of hexes) {
          for (let i = 0; i + width <= hex.length; i += width) {
            const code = hex.slice(i, i + width).toLowerCase()
            out += cmap?.get(code) ?? '�'
          }
        }
        if (out) shown.push(out)
      }
    }
    return { width: box[2] - box[0], height: box[3] - box[1], text: shown.join(' ') }
  })
  const fonts = new Set()
  let images = 0
  for (const { dict } of objects.values()) {
    for (const [, name] of dict.matchAll(/\/BaseFont \/(?:[A-Z]{6}\+)?([^\s/>]+)/g)) fonts.add(name)
    if (/\/Subtype \/Image\b/.test(dict)) images += 1
  }
  return { pages: read, fonts: [...fonts].sort(), images }
}
