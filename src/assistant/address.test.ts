import { describe, expect, it } from 'vitest'
import { checkAddress, hostOf } from './address.ts'
import { PROVIDERS } from './providers.ts'

/** The typed address's check (docs/spec-v1.md section 8, The setup card, Address; section 14, 0.7.0). */
describe('the typed address', () => {
  it.each([
    ['https://api.mistral.ai/v1', 'api.mistral.ai'],
    ['  https://api.x.ai/v1  ', 'api.x.ai'],
    ['https://gateway.example.com:8443/openai', 'gateway.example.com:8443'],
    ['http://localhost:11434/v1', 'localhost:11434'],
    ['http://127.0.0.1:1234/v1', '127.0.0.1:1234'],
    ['http://[::1]:8080/v1', '[::1]:8080'],
    ['https://192.168.1.20/v1', '192.168.1.20'],
  ])('%s is kept, trimmed, with its host', (typed, host) => {
    expect(checkAddress(typed)).toEqual({ ok: true, address: typed.trim(), host })
    expect(hostOf(typed)).toBe(host)
  })

  it.each(['', '   ', 'api.mistral.ai/v1', 'not an address', 'https://', '//api.example.com'])(
    '"%s" isn’t a URL',
    (typed) => {
      expect(checkAddress(typed)).toEqual({ ok: false, reason: 'notUrl' })
      expect(hostOf(typed)).toBeNull()
    },
  )

  it.each([
    // Plain http on the local network is refused in both homes.
    'http://192.168.1.20:11434/v1',
    'http://api.example.com/v1',
    'http://my-nas.local/v1',
    'http://localhost.example.com/v1',
    'http://127.0.0.2/v1',
    'ftp://api.example.com',
    'ws://localhost:8080',
    'localhost:11434',
    'file:///etc/passwd',
    'javascript:alert(1)',
  ])('%s isn’t https, or http on this computer', (typed) => {
    expect(checkAddress(typed)).toEqual({ ok: false, reason: 'notHttps' })
  })

  it.each(['https://user:pass@api.example.com/v1', 'https://user@api.example.com', 'http://sk-key@localhost:11434'])(
    '%s holds a user name or a password',
    (typed) => {
      expect(checkAddress(typed)).toEqual({ ok: false, reason: 'credentials' })
    },
  )

  it('passes every built-in provider’s own address', () => {
    for (const { address } of PROVIDERS) expect(checkAddress(address), address).toMatchObject({ ok: true })
  })
})
