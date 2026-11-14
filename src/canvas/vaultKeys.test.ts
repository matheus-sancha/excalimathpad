import { afterEach, describe, expect, it } from 'vitest'
import { confineKeys, PASS_THROUGH_KEYS, SWALLOWED_KEYS, vaultKeyRoute } from './vaultKeys.ts'

const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })

describe('the keys of a sheet in an Obsidian tab (docs/spec-v1.md section 8)', () => {
  it('passes Obsidian’s core keys through, as the spec lists them', () => {
    // The tested constant (section 14, Gestures): a change here is a spec change.
    expect(PASS_THROUGH_KEYS).toEqual([
      { mod: true, key: 'p' },
      { mod: true, key: 'o' },
      { mod: true, key: 'n' },
      { mod: true, key: 'w' },
      { mod: true, key: ',' },
      { mod: true, shift: true, key: 'f' },
      { mod: true, key: 's' },
      { ctrl: true, key: 'Tab' },
      { ctrl: true, shift: true, key: 'Tab' },
    ])
    expect(SWALLOWED_KEYS).toEqual([
      { mod: true, shift: true, key: 'e' },
      { mod: true, key: '/' },
      { mod: true, shift: true, key: 'p' },
    ])
  })

  it.each([
    ['Ctrl+P', { ctrlKey: true, key: 'p' }],
    ['Cmd+P', { metaKey: true, key: 'p' }],
    ['Ctrl+O', { ctrlKey: true, key: 'o' }],
    ['Ctrl+N', { ctrlKey: true, key: 'n' }],
    ['Ctrl+W', { ctrlKey: true, key: 'w' }],
    ['Ctrl+,', { ctrlKey: true, key: ',' }],
    ['Ctrl+Shift+F', { ctrlKey: true, shiftKey: true, key: 'F' }],
    ['Ctrl+S', { ctrlKey: true, key: 's' }],
    ['Ctrl+Tab', { ctrlKey: true, key: 'Tab' }],
    ['Ctrl+Shift+Tab', { ctrlKey: true, shiftKey: true, key: 'Tab' }],
    ['Ctrl+P with Caps Lock', { ctrlKey: true, key: 'P' }],
  ])('passes %s', (_name, init) => {
    expect(vaultKeyRoute(key(init))).toBe('pass')
  })

  it.each([
    ['Ctrl+Shift+E', { ctrlKey: true, shiftKey: true, key: 'E' }],
    ['Ctrl+/', { ctrlKey: true, key: '/' }],
    ['Cmd+/', { metaKey: true, key: '/' }],
    ['Ctrl+Shift+P', { ctrlKey: true, shiftKey: true, key: 'P' }],
  ])('swallows %s', (_name, init) => {
    expect(vaultKeyRoute(key(init))).toBe('swallow')
  })

  it.each([
    ['M', { key: 'm' }],
    ['P alone', { key: 'p' }],
    ['Enter', { key: 'Enter' }],
    ['Esc', { key: 'Escape' }],
    ['Tab in suggestions', { key: 'Tab' }],
    ['Ctrl+B', { ctrlKey: true, key: 'b' }],
    ['Ctrl+Z', { ctrlKey: true, key: 'z' }],
    ['Ctrl+Y', { ctrlKey: true, key: 'y' }],
    ['Ctrl+C', { ctrlKey: true, key: 'c' }],
    ['Ctrl+V', { ctrlKey: true, key: 'v' }],
    ['Ctrl+D', { ctrlKey: true, key: 'd' }],
    ['Ctrl+A', { ctrlKey: true, key: 'a' }],
    ['Ctrl+F', { ctrlKey: true, key: 'f' }],
    ['?', { shiftKey: true, key: '?' }],
    ['Alt+Shift+D', { altKey: true, shiftKey: true, key: 'D' }],
    ['Ctrl+Alt+P', { ctrlKey: true, altKey: true, key: 'p' }],
    ['Ctrl+Shift+S', { ctrlKey: true, shiftKey: true, key: 'S' }],
    ['Ctrl+Cmd+P', { ctrlKey: true, metaKey: true, key: 'p' }],
    ['Cmd+Tab', { metaKey: true, key: 'Tab' }],
  ])('keeps %s the sheet’s', (_name, init) => {
    expect(vaultKeyRoute(key(init))).toBeNull()
  })
})

describe('confineKeys: the view’s own container, in the capture phase', () => {
  const stops: (() => void)[] = []
  afterEach(() => {
    stops.splice(0).forEach((stop) => stop())
    document.body.replaceChildren()
  })

  /** A view whose canvas records what reaches it, and a window that does too. */
  function view(obsidianTakes: boolean) {
    const container = document.body.appendChild(document.createElement('div'))
    const canvas = container.appendChild(document.createElement('div'))
    const sheet: string[] = []
    const obsidian: string[] = []
    canvas.addEventListener('keydown', (event) => sheet.push(event.key))
    // Obsidian's keymap, before the view: it takes the pass-through keys.
    const keymap = (event: KeyboardEvent) => {
      if (obsidianTakes && vaultKeyRoute(event) === 'pass') event.preventDefault()
    }
    const after = (event: KeyboardEvent) => obsidian.push(event.key)
    window.addEventListener('keydown', keymap, true)
    window.addEventListener('keydown', after)
    stops.push(confineKeys(container), () => {
      window.removeEventListener('keydown', keymap, true)
      window.removeEventListener('keydown', after)
    })
    return { canvas, sheet, obsidian }
  }

  it('stops a core key Obsidian took, so the sheet doesn’t act on it too', () => {
    const { canvas, sheet } = view(true)
    const event = key({ ctrlKey: true, key: 'p' })
    canvas.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(sheet).toEqual([])
  })

  it('lets a core key Obsidian left alone go on, to the sheet and back up to the window', () => {
    const { canvas, sheet, obsidian } = view(false)
    const event = key({ ctrlKey: true, key: 'p' })
    canvas.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(sheet).toEqual(['p'])
    expect(obsidian).toEqual(['p'])
  })

  it('swallows Excalidraw’s export and palette keys, whatever Obsidian did', () => {
    const { canvas, sheet } = view(false)
    for (const init of [
      { ctrlKey: true, shiftKey: true, key: 'E' },
      { ctrlKey: true, key: '/' },
      { ctrlKey: true, shiftKey: true, key: 'P' },
    ]) {
      const event = key(init)
      canvas.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    }
    expect(sheet).toEqual([])
  })

  it('leaves the sheet’s own keys alone', () => {
    const { canvas, sheet } = view(true)
    for (const init of [{ key: 'm' }, { ctrlKey: true, key: 'z' }, { altKey: true, shiftKey: true, key: 'D' }]) {
      canvas.dispatchEvent(key(init))
    }
    expect(sheet).toEqual(['m', 'z', 'D'])
  })

  it('hears nothing once stopped', () => {
    const { canvas, sheet } = view(false)
    stops.shift()!()
    canvas.dispatchEvent(key({ ctrlKey: true, shiftKey: true, key: 'E' }))
    expect(sheet).toEqual(['E'])
  })
})
