// PROTOTYPE, throwaway. Ticket #355: nerdamer 2.1.0's minified size on its own, whole and as the
// `nerdamer/core` sub-path, with and without a stub for the one module that holds `new Function`
// (which the bundle audit forbids). Run after `npm i --no-save nerdamer@2.1.0`:
// node docs/research/symbolic-nerdamer-bridge/size-probe.mjs
// The real plugin build was measured separately (see the note); this is the library alone.
import * as esbuild from 'esbuild'

const ENTRIES = {
  whole: "const n = require('nerdamer'); globalThis.y = n(globalThis.x).numerator().toString()",
  core: "const { Expression } = require('nerdamer/core'); const r = Expression.create(globalThis.x); globalThis.y = [r.numerator().toString(), r.denominator().toString()]",
  'core + algebra (lcm)': "const { Expression } = require('nerdamer/core'); const { lcm } = require('nerdamer/algebra'); globalThis.y = [Expression.create(globalThis.x).numerator().toString(), lcm]",
}
// nerdamer/output/core/functions/build/index.js is `buildFunction`, the compiler to a JavaScript function.
const stub = {
  name: 'stub-build-function',
  setup(b) {
    b.onLoad({ filter: /core[\\/]functions[\\/]build[\\/]index\.js$/ }, () => ({
      contents: 'exports.buildFunction = () => { throw new Error("buildFunction is not in this build") }',
      loader: 'js',
    }))
  },
}
for (const [label, contents] of Object.entries(ENTRIES)) {
  for (const stubbed of [false, true]) {
    const r = await esbuild.build({
      stdin: { contents, resolveDir: process.cwd() },
      bundle: true, minify: true, format: 'iife', platform: 'browser', write: false,
      plugins: stubbed ? [stub] : [],
    })
    const text = r.outputFiles[0].text
    console.log(`${label}${stubbed ? ', stubbed' : ''}: ${text.length} bytes, "new Function" x ${(text.match(/new Function/g) ?? []).length}`)
  }
}
