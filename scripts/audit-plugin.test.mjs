import { describe, expect, it } from 'vitest'
import { auditBundle, BUDGET, MAX_BYTES, PROVIDER_HOSTS } from './audit-plugin.mjs'
import allowlist from './plugin-allowlist.json'

/** A bundle that passes; each test breaks one thing. */
function bundle(overrides = {}) {
  const files = {
    'main.js': 'var a="http://www.w3.org/2000/svg";module.exports=a',
    'manifest.json': JSON.stringify({ id: 'excalimathpad', version: '1.2.3' }),
    'styles.css': '.excalimathpad-view{padding:0}',
    ...overrides.files,
  }
  for (const [name, text] of Object.entries(files)) if (text === undefined) delete files[name]
  const sizes = Object.fromEntries(Object.entries(files).map(([name, text]) => [name, text.length]))
  return auditBundle({
    files,
    sizes: { ...sizes, ...overrides.sizes },
    packageVersion: '1.2.3',
    allowlist: overrides.allowlist ?? allowlist,
    providerHosts: overrides.providerHosts,
  })
}

describe('the bundle audit (docs/spec-v1.md section 12a, Data protection)', () => {
  it('passes a clean bundle', () => {
    expect(bundle()).toEqual([])
  })

  it('fails on a fourth file, or a missing one', () => {
    expect(bundle({ files: { 'main.js.map': '{}' } })).toEqual([expect.stringContaining('exactly main.js')])
    expect(bundle({ files: { 'styles.css': undefined } })).toEqual([expect.stringContaining('exactly main.js')])
  })

  it('fails on a file over 5,000,000 bytes', () => {
    expect(bundle({ sizes: { 'main.js': MAX_BYTES + 1 } })).toEqual(['main.js is 5,000,001 bytes, over 5,000,000'])
  })

  it('fails on main.js or styles.css over its budget, and passes one at it', () => {
    expect(bundle({ sizes: { 'main.js': BUDGET['main.js'] + 1 } })).toEqual([
      `main.js is ${(BUDGET['main.js'] + 1).toLocaleString('en')} bytes, over its budget of ` +
        `${BUDGET['main.js'].toLocaleString('en')}. If the growth is meant, raise BUDGET and say why.`,
    ])
    expect(bundle({ sizes: { 'styles.css': BUDGET['styles.css'] + 1 } })).toEqual([
      expect.stringMatching(/^styles\.css is [\d,]+ bytes, over its budget of [\d,]+\. If the growth is meant/),
    ])
    expect(bundle({ sizes: { 'main.js': BUDGET['main.js'], 'styles.css': BUDGET['styles.css'] } })).toEqual([])
  })

  it('keeps each budget under the 5,000,000 cap', () => {
    expect(Object.keys(BUDGET).sort()).toEqual(['main.js', 'styles.css'])
    for (const budget of Object.values(BUDGET)) expect(budget).toBeLessThan(MAX_BYTES)
  })

  it("fails when the manifest's version isn't package.json's", () => {
    expect(bundle({ files: { 'manifest.json': '{"version":"1.2.2"}' } })).toEqual([
      "manifest.json's version 1.2.2 isn't package.json's 1.2.3",
    ])
  })

  it.each([
    ['./fonts/Excalifont/a.woff2', './fonts/'],
    ['https://esm.sh/@excalidraw', 'esm.sh'],
    ['apiKey:"AIzaSyAbc"', 'AIza'],
    ['window.indexedDB.open("x")', 'indexedDB'],
    ['localStorage.setItem("a",1)', 'localStorage'],
    ['new Function("return 1")', 'new Function'],
  ])('fails on %s', (text, needle) => {
    const problems = bundle({ files: { 'main.js': `var a=${JSON.stringify(text)}` } })
    expect(problems.some((problem) => problem.includes(`"${needle}"`))).toBe(true)
  })

  it.each(['app.saveLocalStorage("key",value)', 'app.loadLocalStorage("key")', 'window["LOCALSTORAGE"]', 'localstorage'])(
    'fails on localstorage in any letter case: %s (0.7.0)',
    (text) => {
      const spelling = /localstorage/i.exec(text)[0]
      expect(bundle({ files: { 'main.js': `var a=${text}` } })).toEqual([
        `main.js: 1 × "${spelling}" (browser storage outside the vault)`,
      ])
    },
  )

  it('lets through the four built-in providers’ hosts, the only ones reached, and no other (0.7.0)', () => {
    expect(Object.keys(allowlist.reached).filter((host) => !host.startsWith('$'))).toEqual([
      'api.anthropic.com',
      'api.openai.com',
      'generativelanguage.googleapis.com',
      'openrouter.ai',
    ])
    expect(bundle({ files: { 'main.js': 'var a="https://api.anthropic.com",b="https://openrouter.ai/api/v1"' } })).toEqual([])
    expect(bundle({ files: { 'main.js': 'var a="https://api.mistral.ai/v1"' } })).toEqual([
      "main.js: names https://api.mistral.ai, which isn't in the allowlist",
    ])
    // The card's own words about an address name no host.
    expect(bundle({ files: { 'main.js': 'var a="The address must start with https://. http:// is allowed only for this computer"' } })).toEqual([])
    // A reached host is never also a host that is only named.
    for (const host of Object.keys(allowlist.reached)) expect(Object.hasOwn(allowlist.hosts, host), host).toBe(false)
  })

  it('reads the built-in providers’ hosts from src/assistant/ (0.7.0)', () => {
    expect([...PROVIDER_HOSTS].sort()).toEqual(['api.anthropic.com', 'api.openai.com', 'generativelanguage.googleapis.com', 'openrouter.ai'])
  })

  it('fails when the reached list and the built-in providers’ hosts differ, in either direction (0.7.0)', () => {
    // A provider added to src/assistant/ but not to the list.
    expect(bundle({ providerHosts: [...PROVIDER_HOSTS, 'api.mistral.ai'] })).toEqual([
      "a built-in provider's address in src/assistant/ has api.mistral.ai, which plugin-allowlist.json's reached list doesn't name",
    ])
    // A host left in the list after its provider went.
    const { 'openrouter.ai': _gone, ...fewer } = allowlist.reached
    expect(bundle({ allowlist: { ...allowlist, reached: { ...fewer, 'api.mistral.ai': 'x' } } })).toEqual([
      "plugin-allowlist.json's reached list names api.mistral.ai, which no built-in provider's address in src/assistant/ has",
      "a built-in provider's address in src/assistant/ has openrouter.ai, which plugin-allowlist.json's reached list doesn't name",
    ])
  })

  it('fails when main.js names https:// and a reached host more than once (0.7.0)', () => {
    expect(bundle({ files: { 'main.js': 'var a="https://api.anthropic.com";fetch("https://api.anthropic.com/v1/x")' } })).toEqual([
      'main.js: names https://api.anthropic.com 2 times; only its provider\'s constant may name it, once',
    ])
    // A key page in a cost line is plain text, with no https://, and another host that starts the same is another host.
    expect(
      bundle({ files: { 'main.js': 'var a="https://openrouter.ai/api/v1",b="openrouter.ai/settings/keys",c="https://openrouter.ai.example"' } }),
    ).toEqual(["main.js: names https://openrouter.ai.example, which isn't in the allowlist"])
  })

  it('fails on a <style> or <link> created outside the known library sites', () => {
    expect(bundle({ files: { 'main.js': 'document.head.append(document.createElement("style"))' } })).toEqual([
      expect.stringContaining('creates a <style> element'),
    ])
    expect(bundle({ files: { 'main.js': 'd.createElement(`link`)' } })).toEqual([
      expect.stringContaining('creates a <link> element'),
    ])
    // React DOM's own resource hoisting, as minified.
    expect(bundle({ files: { 'main.js': 'e={rel:"stylesheet","data-precedence":t};n.createElement("link")' } })).toEqual([])
  })

  it('fails on a host missing from the allowlist, in code or CSS', () => {
    expect(bundle({ files: { 'main.js': 'fetch("https://telemetry.example.com/hit")' } })).toEqual([
      'main.js: names https://telemetry.example.com, which isn\'t in the allowlist',
    ])
    expect(bundle({ files: { 'styles.css': '@import url(https://fonts.googleapis.com/css2)' } })).toEqual([
      "styles.css: names https://fonts.googleapis.com, which isn't in the allowlist",
    ])
  })
})
