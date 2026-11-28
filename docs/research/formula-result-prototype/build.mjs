// PROTOTYPE (#357): inlines KaTeX's CSS, with its woff2 fonts as data URIs, into page.html.
// Run from the repo root: node docs/research/formula-result-prototype/build.mjs <out.html>
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, '../../../node_modules/katex/dist')
let css = readFileSync(join(dist, 'katex.min.css'), 'utf8')
css = css.replace(/src:([^;}]*)/g, (_, src) => {
  const m = src.match(/url\(fonts\/([^)]+\.woff2)\)/)
  const b64 = readFileSync(join(dist, 'fonts', m[1])).toString('base64')
  return `src:url(data:font/woff2;base64,${b64}) format("woff2")`
})
const page = readFileSync(join(here, 'page.html'), 'utf8').replace('/*KATEX_CSS*/', () => css)
writeFileSync(process.argv[2], page)
console.log('wrote', process.argv[2], page.length, 'bytes')
