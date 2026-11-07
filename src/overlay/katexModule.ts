/**
 * KaTeX and its stylesheet, as one lazily loaded chunk (docs/spec-v1.md
 * section 14: "KaTeX is a direct dependency, loaded lazily"). Only `katex.ts`
 * imports this, through `import()`.
 */
import katex from 'katex'
import 'katex/dist/katex.min.css'

export default katex
