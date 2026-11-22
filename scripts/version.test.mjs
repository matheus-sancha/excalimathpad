import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { compareVersions, isEntry, latestMinAppVersion, nextFiles } from './version.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = { id: 'excalimathpad', version: '0.0.0', minAppVersion: '1.7.2', isDesktopOnly: true }

describe('one version (docs/spec-v1.md section 12a, Releases)', () => {
  it('copies the version into the manifest and keeps its other fields', () => {
    const next = nextFiles({ version: '0.1.0', manifest, versions: {} })
    expect(next.manifest).toEqual({ ...manifest, version: '0.1.0' })
  })

  it('starts versions.json at the first release', () => {
    expect(nextFiles({ version: '0.1.0', manifest, versions: {} }).versions).toEqual({ '0.1.0': '1.7.2' })
  })

  it('adds no line while minAppVersion is unchanged', () => {
    const next = nextFiles({ version: '0.1.1', manifest, versions: { '0.1.0': '1.7.2' } })
    expect(next.versions).toEqual({ '0.1.0': '1.7.2' })
    expect(next.versionsChanged).toBe(false)
  })

  it('adds a line when minAppVersion changes', () => {
    const next = nextFiles({
      version: '0.2.0',
      manifest: { ...manifest, minAppVersion: '1.8.0' },
      versions: { '0.1.0': '1.7.2' },
    })
    expect(next.versions).toEqual({ '0.1.0': '1.7.2', '0.2.0': '1.8.0' })
  })

  it('compares against the newest line by number, not the last one written', () => {
    expect(latestMinAppVersion({ '0.10.0': '1.8.0', '0.9.0': '1.7.2' })).toBe('1.8.0')
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0)
    expect(latestMinAppVersion({})).toBeNull()
  })

  it('refuses a version that isn\'t x.y.z, such as a v-prefixed one', () => {
    expect(() => nextFiles({ version: 'v0.1.0', manifest, versions: {} })).toThrow("isn't x.y.z")
  })

  it('is wired to npm version, with tags that have no v', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(pkg.scripts.version).toBe('node scripts/version.mjs')
    expect(readFileSync(join(root, '.npmrc'), 'utf8')).toMatch(/^tag-version-prefix=""$/m)
  })

  it('keeps the repository consistent: the manifest carries package.json\'s version and minAppVersion 1.7.2', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    const rootManifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))
    const versions = JSON.parse(readFileSync(join(root, 'versions.json'), 'utf8'))
    expect(rootManifest.version).toBe(pkg.version)
    expect(rootManifest.minAppVersion).toBe('1.7.2')
    // Nothing is released yet, or the newest line names today's floor.
    expect([null, rootManifest.minAppVersion]).toContain(latestMinAppVersion(versions))
  })
})

describe('isEntry: whether Node was started on the script', () => {
  const self = join(root, 'scripts/version.mjs')
  const url = pathToFileURL(self).href

  it('is true for the script itself, and false for another file or none', () => {
    expect(isEntry(self, url)).toBe(true)
    expect(isEntry(join(root, 'scripts/docs.test.mjs'), url)).toBe(false)
    expect(isEntry(undefined, url)).toBe(false)
  })

  it('on Windows, ignores a difference of letter case only, as in a drive letter', () => {
    const upper = self.toUpperCase()
    expect(isEntry(upper, url, 'win32')).toBe(true)
    expect(isEntry(upper, url, 'linux')).toBe(false)
  })
})

describe('npm version, in a scratch repository', () => {
  let dir
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))

  /** A repository holding the three files, with the real script and .npmrc; runs `npm version <bump>`. */
  function release(bump, { version, versions }) {
    dir = mkdtempSync(join(tmpdir(), 'excalimathpad-version-'))
    const ident = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' }
    const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, ...ident } }).trim()
    const write = (name, value) => writeFileSync(join(dir, name), `${JSON.stringify(value, null, 2)}\n`)
    mkdirSync(join(dir, 'scripts'))
    cpSync(join(root, 'scripts/version.mjs'), join(dir, 'scripts/version.mjs'))
    cpSync(join(root, '.npmrc'), join(dir, '.npmrc'))
    write('package.json', { name: 'scratch', version, private: true, scripts: { version: 'node scripts/version.mjs' } })
    write('manifest.json', { ...manifest, version })
    write('versions.json', versions)
    git('init', '-q', '-b', 'main')
    git('add', '.')
    git('commit', '-q', '-m', 'start')
    // On Windows npm is npm.cmd, which Node starts only through a shell.
    execFileSync('npm', ['version', bump], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, ...ident },
      shell: process.platform === 'win32',
    })
    const read = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'))
    return {
      tags: git('tag'),
      commit: git('show', '--name-only', '--format=%s', 'HEAD').split('\n').filter(Boolean),
      clean: git('status', '--porcelain') === '',
      manifest: read('manifest.json'),
      versions: read('versions.json'),
    }
  }

  it('the first release: minor from 0.0.0 gives 0.1.0, and versions.json starts "0.1.0": "1.7.2"', () => {
    const result = release('minor', { version: '0.0.0', versions: {} })
    expect(result.tags).toBe('0.1.0')
    expect(result.commit).toEqual(['Release 0.1.0', 'manifest.json', 'package.json', 'versions.json'])
    expect(result.manifest.version).toBe('0.1.0')
    expect(result.versions).toEqual({ '0.1.0': '1.7.2' })
    expect(result.clean).toBe(true)
  }, 30_000)

  it('patch moves package.json and manifest.json in one commit, and versions.json only when minAppVersion changes', () => {
    const result = release('patch', { version: '0.1.0', versions: { '0.1.0': '1.7.2' } })
    expect(result.tags).toBe('0.1.1')
    expect(result.commit).toEqual(['Release 0.1.1', 'manifest.json', 'package.json'])
    expect(result.manifest.version).toBe('0.1.1')
    expect(result.versions).toEqual({ '0.1.0': '1.7.2' })
    expect(result.clean).toBe(true)
  }, 30_000)
})
