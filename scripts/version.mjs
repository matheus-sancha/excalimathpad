// npm's `version` lifecycle script (docs/spec-v1.md section 12a, Releases):
// one version for the web app and the plugin, from `package.json`.
//
// `npm version <patch|minor|major>` bumps `package.json`, then runs this,
// then commits and tags. This copies the new version into `manifest.json` and
// adds a line to `versions.json` when `minAppVersion` has changed since the
// last line, then stages both, so all three move in npm's one commit. The
// tag has no `v` (`.npmrc`, `tag-version-prefix`).
//
// Run by npm (`"version"` in package.json); `node scripts/version.mjs` by hand
// writes the files without staging them. `nextFiles` is the same step for tests.

import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The `minAppVersion` of `versions.json`'s newest line, or null when it has none. */
export function latestMinAppVersion(versions) {
  const newest = Object.keys(versions).sort(compareVersions).at(-1)
  return newest === undefined ? null : versions[newest]
}

/** Orders `x.y.z` versions by number, not as text (`0.10.0` after `0.9.0`). */
export function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/**
 * The manifest and `versions.json` for `version`. The manifest takes the
 * version; `versions.json` gains `version: minAppVersion` only when the
 * manifest's `minAppVersion` differs from its newest line's, so it stays one
 * line per floor Obsidian has to meet.
 */
export function nextFiles({ version, manifest, versions }) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`package.json's version ${version} isn't x.y.z`)
  const { minAppVersion } = manifest
  if (typeof minAppVersion !== 'string') throw new Error("manifest.json has no minAppVersion")
  const changed = latestMinAppVersion(versions) !== minAppVersion
  return {
    manifest: { ...manifest, version },
    versions: changed ? { ...versions, [version]: minAppVersion } : versions,
    versionsChanged: changed,
  }
}

const json = (value) => `${JSON.stringify(value, null, 2)}\n`

async function main() {
  const read = async (name) => JSON.parse(await readFile(join(root, name), 'utf8'))
  const version = process.env.npm_package_version ?? (await read('package.json')).version
  const next = nextFiles({ version, manifest: await read('manifest.json'), versions: await read('versions.json') })
  await writeFile(join(root, 'manifest.json'), json(next.manifest))
  await writeFile(join(root, 'versions.json'), json(next.versions))
  // npm commits what is staged once this script ends.
  if (process.env.npm_lifecycle_event === 'version') {
    execFileSync('git', ['add', 'manifest.json', 'versions.json'], { cwd: root, stdio: 'inherit' })
  }
  console.log(
    `manifest.json → ${version}; versions.json ${next.versionsChanged ? `+ "${version}": "${next.manifest.minAppVersion}"` : 'unchanged'}`,
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
