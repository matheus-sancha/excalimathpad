// The bundle audit (docs/spec-v1.md section 12a, Data protection): what an
// install delivers is exactly `dist-plugin/`, nothing in it reaches the
// network or storage outside the vault, and no file outgrows its budget.
// Blocks every pull request through `npm run check`, and Release (#138).
//
// Run: `node scripts/audit-plugin.mjs [dir]` (`npm run audit:plugin`).
// `auditPlugin` is the same check for tests, which feed it bad bundles.

import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The three files an install delivers, and nothing else. */
export const FILES = ['main.js', 'manifest.json', 'styles.css']

/** Obsidian Sync Standard's per-file cap. */
export const MAX_BYTES = 5_000_000

/**
 * Each file's budget: the measured size plus 5%, rounded up to the next 1,000
 * bytes. Set at 1.0.0 (#203: main.js 3,403,718, styles.css 555,370), and set
 * again by the Excalidraw upgrade (#269), from its build on the canary
 * 0.18.0-9fbeaed with CodeMirror trimmed: main.js 3,904,270, styles.css
 * 605,789. Raise one only on purpose, in a commit that says what was added.
 */
export const BUDGET = {
  'main.js': 4_100_000,
  'styles.css': 637_000,
}

/**
 * Text that must not appear in any delivered file, and why. A name in the
 * allowlist's `text` is taken out before the count: it holds one of these
 * words and is no use of it.
 */
export const FORBIDDEN = [
  ['./fonts/', 'a font path Excalidraw would fetch: every font is a data: URL or local:'],
  ['esm.sh', "Excalidraw's CDN fallback"],
  ['AIza', "a Google API key (excalidraw.com's Firebase config)"],
  ['indexedDB', 'browser storage outside the vault'],
  ['localStorage', 'browser storage outside the vault'],
  ['new Function', 'code built from text at run time'],
]

const CREATE_ELEMENT = /createElement\(\s*["'`](style|link)["'`]\s*\)/g
const URL = /\bhttps?:\/\/([a-z0-9.-]+)/gi
/** How far either side of a createElement to look for its library's mark. */
const MARK_WINDOW = 400

/**
 * Returns the problems found (empty when the bundle passes) and each file's
 * size. `files` maps a name to its text; `allowlist` is plugin-allowlist.json.
 */
export function auditBundle({ files, sizes, packageVersion, allowlist }) {
  const problems = []
  const names = Object.keys(files).sort()
  if (names.join() !== [...FILES].sort().join()) {
    problems.push(`dist-plugin/ must hold exactly ${FILES.join(', ')}; it holds ${names.join(', ') || 'nothing'}`)
  }
  for (const [name, size] of Object.entries(sizes)) {
    const count = (bytes) => bytes.toLocaleString('en')
    if (size > MAX_BYTES) problems.push(`${name} is ${count(size)} bytes, over ${count(MAX_BYTES)}`)
    else if (Object.hasOwn(BUDGET, name) && size > BUDGET[name]) {
      problems.push(
        `${name} is ${count(size)} bytes, over its budget of ${count(BUDGET[name])}. ` +
          'If the growth is meant, raise BUDGET and say why.',
      )
    }
  }

  let version = null
  try {
    version = JSON.parse(files['manifest.json'] ?? 'null')?.version ?? null
  } catch {
    problems.push("manifest.json doesn't parse")
  }
  if (version !== packageVersion) {
    problems.push(`manifest.json's version ${version} isn't package.json's ${packageVersion}`)
  }

  const allowedText = Object.keys(allowlist.text ?? {}).filter((key) => !key.startsWith('$'))
  for (const [name, text] of Object.entries(files)) {
    if (name === 'manifest.json') continue
    const counted = allowedText.reduce((rest, allowed) => rest.replaceAll(allowed, ''), text)
    for (const [needle, why] of FORBIDDEN) {
      const count = counted.split(needle).length - 1
      if (count > 0) problems.push(`${name}: ${count} × "${needle}" (${why})`)
    }
    for (const match of text.matchAll(CREATE_ELEMENT)) {
      const near = text.slice(Math.max(0, match.index - MARK_WINDOW), match.index + MARK_WINDOW)
      const known = Object.keys(allowlist.elementCreation).filter((key) => !key.startsWith('$'))
      if (!known.some((mark) => near.includes(mark))) {
        problems.push(`${name}: creates a <${match[1]}> element outside the known library sites, at ${match.index}`)
      }
    }
    const hosts = new Set([...text.matchAll(URL)].map((match) => match[1].toLowerCase()))
    for (const host of [...hosts].sort()) {
      if (!Object.hasOwn(allowlist.hosts, host)) problems.push(`${name}: names https://${host}, which isn't in the allowlist`)
    }
  }
  return problems
}

/** Reads `dir` and audits it. */
export async function auditPlugin(dir = join(root, 'dist-plugin')) {
  const files = {}
  const sizes = {}
  for (const name of await readdir(dir).catch(() => [])) {
    const path = join(dir, name)
    if (!(await stat(path)).isFile()) {
      files[`${name}/`] = ''
      continue
    }
    files[name] = await readFile(path, 'utf8')
    sizes[name] = (await stat(path)).size
  }
  const packageVersion = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version
  const allowlist = JSON.parse(await readFile(join(root, 'scripts/plugin-allowlist.json'), 'utf8'))
  return { problems: auditBundle({ files, sizes, packageVersion, allowlist }), sizes }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { problems, sizes } = await auditPlugin(process.argv[2])
  for (const name of FILES) {
    if (!(name in sizes)) continue
    const budget = name in BUDGET ? ` (budget ${BUDGET[name].toLocaleString('en')})` : ''
    console.log(`${name.padEnd(14)} ${sizes[name].toLocaleString('en').padStart(11)} bytes${budget}`)
  }
  if (problems.length) {
    console.error(`\nBundle audit failed (docs/spec-v1.md section 12a, Data protection):`)
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exit(1)
  }
  console.log(
    'Bundle audit passed: three files, each under 5,000,000 bytes and within its budget, nothing reaching the network.',
  )
}
