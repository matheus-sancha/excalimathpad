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
import { PROVIDERS } from '../src/assistant/providers.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The three files an install delivers, and nothing else. */
export const FILES = ['main.js', 'manifest.json', 'styles.css']

/** Obsidian Sync Standard's per-file cap. */
export const MAX_BYTES = 5_000_000

/**
 * Each file's budget, from 1.0.0 (#203): the size of the build that becomes
 * 1.0.0 plus 5%, rounded up to the next 1,000 bytes (main.js 3,403,718,
 * styles.css 555,370). Raise one only on purpose, in a commit that says what
 * was added. main.js was raised on 2026-11-22 by the Math assistant's Send
 * (#310): 3,580,181 bytes plus 5% of the first slice's growth so far (87,169),
 * rounded up; and again by the answer's form (#311): 3,589,407 bytes plus 5% of
 * the growth so far (96,395), rounded up. The issue that turns the assistant on
 * (#312) measured 3,589,415 bytes (the slice's whole growth, 96,403 of its
 * 120,000); the same rule gives 3,595,000, so it stands.
 */
export const BUDGET = {
  'main.js': 3_595_000,
  'styles.css': 584_000,
}

/**
 * Text that must not appear in any delivered file, and why. `localStorage` is
 * matched in any letter case (0.7.0), so Obsidian's `saveLocalStorage` and
 * `loadLocalStorage` are caught too: the Math assistant's setup is kept in the
 * secret storage and nowhere else.
 */
export const FORBIDDEN = [
  ['./fonts/', 'a font path Excalidraw would fetch: every font is a data: URL or local:'],
  ['esm.sh', "Excalidraw's CDN fallback"],
  ['AIza', "a Google API key (excalidraw.com's Firebase config)"],
  ['indexedDB', 'browser storage outside the vault'],
  [/localstorage/gi, 'browser storage outside the vault'],
  ['new Function', 'code built from text at run time'],
]

const CREATE_ELEMENT = /createElement\(\s*["'`](style|link)["'`]\s*\)/g
// A host starts with a letter or a digit: the setup card's own words, "must start with https://.", name none.
const URL = /\bhttps?:\/\/([a-z0-9][a-z0-9.-]*)/gi
/** How far either side of a createElement to look for its library's mark. */
const MARK_WINDOW = 400

/** The hosts of the built-in providers' addresses (`src/assistant/providers.ts`). */
export const PROVIDER_HOSTS = PROVIDERS.map(({ address }) => new globalThis.URL(address).host)

/** The allowlist's `reached` hosts (0.7.0), its comment left out. */
export const reachedHosts = (allowlist) => Object.keys(allowlist.reached ?? {}).filter((key) => !key.startsWith('$'))

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Returns the problems found (empty when the bundle passes) and each file's
 * size. `files` maps a name to its text; `allowlist` is plugin-allowlist.json;
 * `providerHosts` the hosts of the built-in providers' addresses.
 */
export function auditBundle({ files, sizes, packageVersion, allowlist, providerHosts = PROVIDER_HOSTS }) {
  const problems = []
  // 0.7.0: `reached` is exactly the built-in providers' hosts, in either direction.
  const reached = reachedHosts(allowlist)
  for (const host of reached.filter((host) => !providerHosts.includes(host)).sort()) {
    problems.push(`plugin-allowlist.json's reached list names ${host}, which no built-in provider's address in src/assistant/ has`)
  }
  for (const host of providerHosts.filter((host) => !reached.includes(host)).sort()) {
    problems.push(`a built-in provider's address in src/assistant/ has ${host}, which plugin-allowlist.json's reached list doesn't name`)
  }
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

  for (const [name, text] of Object.entries(files)) {
    if (name === 'manifest.json') continue
    for (const [needle, why] of FORBIDDEN) {
      if (typeof needle === 'string') {
        const count = text.split(needle).length - 1
        if (count > 0) problems.push(`${name}: ${count} × "${needle}" (${why})`)
        continue
      }
      // Each spelling found, as the file writes it.
      const found = new Map()
      for (const [spelling] of text.matchAll(needle)) found.set(spelling, (found.get(spelling) ?? 0) + 1)
      for (const [spelling, count] of found) problems.push(`${name}: ${count} × "${spelling}" (${why})`)
    }
    for (const match of text.matchAll(CREATE_ELEMENT)) {
      const near = text.slice(Math.max(0, match.index - MARK_WINDOW), match.index + MARK_WINDOW)
      const known = Object.keys(allowlist.elementCreation).filter((key) => !key.startsWith('$'))
      if (!known.some((mark) => near.includes(mark))) {
        problems.push(`${name}: creates a <${match[1]}> element outside the known library sites, at ${match.index}`)
      }
    }
    // 0.7.0: only the provider's constant names a reached host's address, so a second
    // `https://` to it is a request the constant doesn't make.
    for (const host of reached) {
      const count = [...text.matchAll(new RegExp(`https?://${escape(host)}(?![a-z0-9.-])`, 'gi'))].length
      if (count > 1) problems.push(`${name}: names https://${host} ${count} times; only its provider's constant may name it, once`)
    }
    const hosts = new Set([...text.matchAll(URL)].map((match) => match[1].toLowerCase()))
    for (const host of [...hosts].sort()) {
      // `reached` (0.7.0): the built-in providers' hosts, which the Math assistant reaches on a press.
      if (!Object.hasOwn(allowlist.hosts, host) && !Object.hasOwn(allowlist.reached ?? {}, host)) problems.push(`${name}: names https://${host}, which isn't in the allowlist`)
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
    'Bundle audit passed: three files, each under 5,000,000 bytes and within its budget. ' +
      `The only hosts reached are ${new Intl.ListFormat('en').format(PROVIDER_HOSTS)}, ` +
      "the Math assistant's built-in providers, on a press; every other host is named, never reached.",
  )
}
