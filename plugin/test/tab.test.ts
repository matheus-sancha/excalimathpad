import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, onTestFinished } from 'vitest'
import { isOffered, notices, Platform, runCommand, type Command, type WorkspaceLeaf } from './obsidian.ts'
import { DEFAULT_SETTINGS, writeSheet } from '../../src/file/sheetFormat.ts'
import { doubleClickLine } from '../../src/test/gestures.ts'
import { SHEET_COMMANDS } from '../main.ts'
import { VAULT_CLASS } from '../../src/canvas/vaultItems.ts'
import { vaultWith, type Vault } from './harness.ts'

/**
 * Inside an Obsidian tab (docs/spec-v1.md section 8): the theme and, from
 * 0.5.0, the language kept in `data.json`, the commands offered only with a sheet tab active, two tabs
 * that each keep their own keys and panel, and Obsidian's core keys passing
 * through from a focused line. Against the fake `obsidian` and the real
 * Excalidraw. The real Obsidian, side by side and in a pop-out window, is a
 * hand check (section 17).
 */

const A = 'Calcs/a.excalimathpad'
const B = 'Calcs/b.excalimathpad'

function sheetOf(lines: string[]) {
  return writeSheet(
    JSON.stringify({
      type: 'excalidraw',
      version: 2,
      elements: [
        { id: 'calc', type: 'rectangle', x: 0, y: 0, width: 320, height: 80, customData: { kind: 'math', source: lines.join('\n') } },
      ],
      appState: {},
      files: {},
    }),
    DEFAULT_SETTINGS,
  )
}

const open: WorkspaceLeaf[] = []
afterEach(async () => {
  for (const leaf of open.splice(0)) await act(() => leaf.detach())
})

async function setUp(data: unknown = null) {
  return vaultWith({ [A]: sheetOf(['a = 2 m']), [B]: sheetOf(['b = 3 s']) }, data)
}

/** Opens `path` in a new tab and waits for its sheet to show. */
async function openTab(vault: Vault, path: string) {
  const leaf = await act(() => vault.open(path))
  open.push(leaf)
  await waitFor(() => expect(leaf.containerEl.querySelector('[data-anchor-id="calc"]')).not.toBeNull(), {
    timeout: 10_000,
  })
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
  return leaf
}

const excalidrawIn = (leaf: WorkspaceLeaf) => leaf.containerEl.querySelector<HTMLElement>('.excalidraw')!
const isDark = (leaf: WorkspaceLeaf) => excalidrawIn(leaf).classList.contains('theme--dark')
const isPlacingIn = (leaf: WorkspaceLeaf) => !!leaf.containerEl.querySelector('[data-math-placing]')
const panelIn = (leaf: WorkspaceLeaf) => leaf.containerEl.querySelector('.sheet-sidebar')
const darkModeKey = (leaf: WorkspaceLeaf) =>
  act(() => {
    fireEvent.keyDown(excalidrawIn(leaf), { key: 'D', code: 'KeyD', altKey: true, shiftKey: true })
  })
const command = (vault: Vault, id: string) => vault.recorded.commands.find((c) => c.id === id) as Command

describe('the panel at launch (section 8: on Problems only for an error, M4d)', () => {
  /** The tab is 1440 px wide: the panel docks, so it opens as the sheet opens. */
  const wideTab = () => {
    const client = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!
    Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => 1440 })
    onTestFinished(() => {
      Object.defineProperty(Element.prototype, 'clientWidth', client)
    })
  }
  const tabOf = async (leaf: WorkspaceLeaf) => {
    await waitFor(() => expect(panelIn(leaf)).not.toBeNull())
    return leaf.containerEl.querySelector('[role="tab"][aria-selected="true"]')
  }

  it('opens on Problems for a vault sheet with an error, though the file loads after the view mounts', async () => {
    wideTab()
    const vault = await vaultWith({ [A]: sheetOf(['K = 5.4', 'x = 1 m + 1 s']) })
    const leaf = await openTab(vault, A)

    expect(await tabOf(leaf)).toHaveTextContent('Problems')
  })

  it('opens on Variables for a vault sheet with warnings alone', async () => {
    wideTab()
    const vault = await vaultWith({ [A]: sheetOf(['K = 5.4', 'x = 2']) })
    const leaf = await openTab(vault, A)

    expect(await tabOf(leaf)).toHaveTextContent('Variables')
  })
})

describe('the panel’s width (section 8, M4e, #198: per device, in data.json, never in the file)', () => {
  const widthIn = (leaf: WorkspaceLeaf) => excalidrawIn(leaf).parentElement!.style.getPropertyValue('--sheet-panel-width')
  const handleIn = (leaf: WorkspaceLeaf) => leaf.containerEl.querySelector<HTMLElement>('.sheet-sidebar__resize')!
  const openPanel = async (vault: Vault, leaf: WorkspaceLeaf) => {
    vault.app.workspace.setActiveLeaf(leaf)
    await act(() => runCommand(command(vault, 'toggle-math-settings')))
    await waitFor(() => expect(panelIn(leaf)).not.toBeNull())
  }

  it('remembers a dragged width in data.json, beside the rest, and never writes the file', async () => {
    const vault = await setUp({ theme: 'dark', sheetPanel: false })
    const leaf = await openTab(vault, A)
    expect(widthIn(leaf)).toBe('320px')
    await openPanel(vault, leaf)
    fireEvent.pointerDown(handleIn(leaf), { pointerId: 1, button: 0, clientX: 900 })
    fireEvent.pointerMove(handleIn(leaf), { pointerId: 1, clientX: 820 })
    expect(vault.recorded.dataJson).toEqual({ theme: 'dark', sheetPanel: false })
    fireEvent.pointerUp(handleIn(leaf), { pointerId: 1, clientX: 820 })

    expect(widthIn(leaf)).toBe('400px')
    expect(vault.recorded.dataJson).toEqual({ theme: 'dark', sheetPanel: false, sheetPanelWidth: 400 })
    await act(() => (leaf.view as unknown as { save: () => Promise<void> }).save())
    expect(vault.app.vault.writes).toEqual([])
    // A tab opened after it opens at that width.
    expect(widthIn(await openTab(vault, B))).toBe('400px')
  })

  it('opens at the remembered width after a restart, and drops one that isn’t a number', async () => {
    const vault = await setUp({ sheetPanelWidth: 296 })
    expect(widthIn(await openTab(vault, A))).toBe('296px')
    await act(() => open.splice(0)[0].detach())

    const odd = await setUp({ sheetPanelWidth: 'wide', sheetPanel: false })
    const leaf = await openTab(odd, A)
    expect(widthIn(leaf)).toBe('320px')
    await openPanel(odd, leaf)
    fireEvent.keyDown(handleIn(leaf), { key: 'ArrowLeft' })
    expect(odd.recorded.dataJson).toEqual({ sheetPanel: false, sheetPanelWidth: 336 })
  })
})

describe('the theme (section 8: Excalimathpad’s own light or dark, remembered)', () => {
  it('opens light until a mode is chosen, whatever Obsidian’s', async () => {
    document.body.classList.add('theme-dark')
    const vault = await setUp()
    const leaf = await openTab(vault, A)
    expect(isDark(leaf)).toBe(false)
    document.body.classList.remove('theme-dark')
  })

  it('remembers Dark mode in data.json, and every tab opened after opens dark', async () => {
    const vault = await setUp()
    const first = await openTab(vault, A)
    await darkModeKey(first)
    await waitFor(() => expect(isDark(first)).toBe(true))
    expect(vault.recorded.dataJson).toMatchObject({ theme: 'dark' })
    const second = await openTab(vault, B)
    expect(isDark(second)).toBe(true)
  })

  it('opens in the remembered mode after a restart, and keeps the panel’s memory beside it', async () => {
    const vault = await setUp({ theme: 'dark', sheetPanel: false })
    const leaf = await openTab(vault, A)
    expect(isDark(leaf)).toBe(true)
    await darkModeKey(leaf)
    await waitFor(() => expect(isDark(leaf)).toBe(false))
    expect(vault.recorded.dataJson).toEqual({ theme: 'light', sheetPanel: false })
  })

  it('drops a theme it doesn’t know, and opens light', async () => {
    const vault = await setUp({ theme: 'sepia' })
    const leaf = await openTab(vault, A)
    expect(isDark(leaf)).toBe(false)
  })

  it('a tab already open keeps its mode when another tab switches', async () => {
    const vault = await setUp()
    const first = await openTab(vault, A)
    const second = await openTab(vault, B)
    await darkModeKey(second)
    await waitFor(() => expect(isDark(second)).toBe(true))
    expect(isDark(first)).toBe(false)
  })

  it('never writes the file: light or dark isn’t the sheet’s', async () => {
    const vault = await setUp()
    const leaf = await openTab(vault, A)
    await darkModeKey(leaf)
    await act(() => (leaf.view as unknown as { save: () => Promise<void> }).save())
    expect(vault.app.vault.writes).toEqual([])
  })
})

describe('the language (section 8, Language, 0.5.0: per device, in data.json, never in the file)', () => {
  const rectangleTitle = (leaf: WorkspaceLeaf) =>
    leaf.containerEl.querySelector('[data-testid="toolbar-rectangle"]')!.closest('label')!.title
  const shownIn = (leaf: WorkspaceLeaf, rectangle: RegExp) => waitFor(() => expect(rectangleTitle(leaf)).toMatch(rectangle))
  const hintIn = (leaf: WorkspaceLeaf) =>
    leaf.containerEl.querySelector<HTMLElement>(`.${VAULT_CLASS}`)?.style.getPropertyValue('--math-hint')
  const choose = async (leaf: WorkspaceLeaf, language: string) => {
    fireEvent.click(leaf.containerEl.querySelector('[data-testid="main-menu-trigger"]')!)
    const select = await waitFor(() => leaf.containerEl.querySelector<HTMLSelectElement>('[data-testid="language-select"]')!)
    await act(async () => {
      fireEvent.change(select, { target: { value: language } })
    })
  }

  it('is English until chosen, whatever Obsidian’s language', async () => {
    const vault = await setUp()
    const leaf = await openTab(vault, A)
    await shownIn(leaf, /^Rectangle/)
    expect(vault.recorded.dataJson).toBeNull()
  })

  it('remembers Português in data.json beside the rest, a tab opened after opens in it, and the file is never written', async () => {
    const vault = await setUp({ theme: 'dark', sheetPanel: false })
    const leaf = await openTab(vault, A)
    await choose(leaf, 'pt-BR')
    await shownIn(leaf, /^Retângulo/)
    expect(vault.recorded.dataJson).toEqual({ theme: 'dark', sheetPanel: false, language: 'pt-BR' })
    await act(() => (leaf.view as unknown as { save: () => Promise<void> }).save())
    expect(vault.app.vault.writes).toEqual([])
    await shownIn(await openTab(vault, B), /^Retângulo/)
  })

  it('opens in the remembered language after a restart, and drops one it doesn’t offer', async () => {
    const vault = await setUp({ language: 'pt-BR' })
    await shownIn(await openTab(vault, A), /^Retângulo/)
    await act(() => open.splice(0)[0].detach())

    const odd = await setUp({ language: 'fr-FR', sheetPanel: false })
    const leaf = await openTab(odd, A)
    await shownIn(leaf, /^Rectangle/)
    await choose(leaf, 'pt-BR')
    expect(odd.recorded.dataJson).toEqual({ sheetPanel: false, language: 'pt-BR' })
  })

  it('a tab already open follows a choice made in another, since Excalidraw holds one language', async () => {
    const vault = await setUp()
    const first = await openTab(vault, A)
    const second = await openTab(vault, B)
    await choose(second, 'pt-BR')
    await shownIn(second, /^Retângulo/)
    await shownIn(first, /^Retângulo/)
    expect(first.containerEl.querySelector<HTMLSelectElement>('[data-testid="language-select"]')?.value ?? 'pt-BR').toBe('pt-BR')
    // The app's own text follows in both tabs (0.6.0): the canvas hint, and ☰ in the tab already open.
    for (const leaf of [first, second]) expect(hintIn(leaf)).toBe(JSON.stringify('Clique duas vezes em uma linha ou pressione Enter para editar'))
    fireEvent.click(first.containerEl.querySelector('[data-testid="main-menu-trigger"]')!)
    await waitFor(() => expect(first.containerEl.querySelector('[data-testid="math-guide-item"]')?.textContent).toMatch('Guia de cálculo'))
    expect(first.containerEl.querySelector('.language-row__label')?.textContent).toBe('Idioma')
    fireEvent.click(first.containerEl.querySelector('[data-testid="main-menu-trigger"]')!)
    await choose(first, 'en')
    await shownIn(second, /^Rectangle/)
    for (const leaf of [first, second]) expect(hintIn(leaf)).toBe(JSON.stringify('Double-click a line or press Enter to edit'))
    expect(vault.recorded.dataJson).toEqual({ language: 'en' })
  })
})

describe('the plugin’s own words in Obsidian (section 8, Language: In Obsidian, 0.6.0)', () => {
  /** ☰ → Language, opening ☰ only if it is closed (it stays open after a choice). */
  const choose = async (leaf: WorkspaceLeaf, language: string) => {
    const field = () => leaf.containerEl.querySelector<HTMLSelectElement>('[data-testid="language-select"]')
    if (!field()) fireEvent.click(leaf.containerEl.querySelector('[data-testid="main-menu-trigger"]')!)
    const select = await waitFor(() => {
      expect(field()).not.toBeNull()
      return field()!
    })
    await act(async () => {
      fireEvent.change(select, { target: { value: language } })
    })
  }
  const names = (vault: Vault) => vault.recorded.commands.map((c) => c.name)

  it('registers the commands in the language data.json holds at load', async () => {
    const vault = await setUp({ language: 'pt-BR' })
    expect(names(vault)).toEqual([
      'Nova folha',
      'Adicionar cálculo',
      'Mostrar ou ocultar Configurações de cálculo',
      'Abrir Guia de cálculo',
      'Imprimir…',
    ])
    expect(vault.recorded.ribbon.map((r) => r.title)).toEqual(['Nova folha'])
  })

  it('a choice names the next new sheet and words the next notice at once; the palette waits for a restart', async () => {
    const vault = await setUp()
    const leaf = await openTab(vault, A)
    await choose(leaf, 'pt-BR')
    expect(vault.recorded.dataJson).toEqual({ language: 'pt-BR' })
    // Registered at load: unchanged until Obsidian restarts or the plugin reloads.
    expect(names(vault)[0]).toBe('New sheet')
    await act(async () => command(vault, 'new-sheet').callback!())
    expect(vault.app.vault.creates.map(({ path }) => path)).toEqual(['Sem título.excalimathpad'])
    open.push(vault.app.workspace.leaves.at(-1)!)
    vault.app.vault.failNext = new Error('Disk full.')
    notices.length = 0
    await act(async () => command(vault, 'new-sheet').callback!())
    expect(notices).toEqual(['Não foi possível criar Sem título 1.excalimathpad: Disk full.'])
    // Back to English: the next notice is English again.
    await choose(leaf, 'en')
    vault.app.vault.failNext = new Error('Disk full.')
    notices.length = 0
    await act(async () => command(vault, 'new-sheet').callback!())
    expect(notices).toEqual(["Couldn't create Untitled.excalimathpad: Disk full."])
  })

  it('after a restart the commands read the language chosen', async () => {
    const first = await setUp()
    await choose(await openTab(first, A), 'pt-BR')
    const restarted = await setUp(first.recorded.dataJson)
    expect(names(restarted)[0]).toBe('Nova folha')
  })
})

describe('Obsidian’s commands (section 8: only while a sheet tab is active, no default hotkeys)', () => {
  it('registers New sheet, Add math, Toggle Math settings, Open Math guide and, on a computer, Print…, none with a hotkey', async () => {
    const vault = await setUp()
    expect(vault.recorded.commands.map((c) => [c.id, c.name])).toEqual([
      ['new-sheet', 'New sheet'],
      ['add-math', 'Add math'],
      ['toggle-math-settings', 'Toggle Math settings'],
      ['open-math-guide', 'Open Math guide'],
      ['print', 'Print…'],
    ])
    expect(SHEET_COMMANDS.map((c) => c.id)).toEqual(['add-math', 'toggle-math-settings', 'open-math-guide', 'print'])
    expect(vault.recorded.commands.every((c) => c.hotkeys === undefined)).toBe(true)
  })

  it('Print… is offered only with a sheet tab active, and is the first ☰ item (section 8, M5)', async () => {
    const vault = await setUp()
    expect(isOffered(command(vault, 'print'))).toBe(false)
    const leaf = await openTab(vault, A)
    expect(isOffered(command(vault, 'print'))).toBe(true)
    fireEvent.click(leaf.containerEl.querySelector<HTMLElement>('[data-testid="main-menu-trigger"]')!)
    const items = await waitFor(() => {
      const found = [...leaf.containerEl.querySelectorAll('.dropdown-menu-item')].map((item) => item.textContent?.trim())
      expect(found.length).toBeGreaterThan(1)
      return found
    })
    expect(items[0]).toBe('Print…')
  })

  it('on a phone or tablet there is no Print… command and no ☰ item (section 11, Changed on 2026-11-15)', async () => {
    Platform.isMobile = true
    onTestFinished(() => {
      Platform.isMobile = false
    })
    const vault = await setUp()
    expect(vault.recorded.commands.map((c) => c.id)).not.toContain('print')
    const leaf = await openTab(vault, A)
    fireEvent.click(leaf.containerEl.querySelector<HTMLElement>('[data-testid="main-menu-trigger"]')!)
    await waitFor(() => expect(leaf.containerEl.querySelector('[data-testid="math-guide-item"]')).not.toBeNull())
    expect(leaf.containerEl.querySelector('[data-testid="print-item"]')).toBeNull()
  })

  it('offers the sheet commands only with a sheet tab active; New sheet always', async () => {
    const vault = await setUp()
    expect(isOffered(command(vault, 'new-sheet'))).toBe(true)
    expect(isOffered(command(vault, 'add-math'))).toBe(false)
    expect(isOffered(command(vault, 'toggle-math-settings'))).toBe(false)
    expect(isOffered(command(vault, 'open-math-guide'))).toBe(false)
    const leaf = await openTab(vault, A)
    expect(isOffered(command(vault, 'add-math'))).toBe(true)
    expect(isOffered(command(vault, 'toggle-math-settings'))).toBe(true)
    expect(isOffered(command(vault, 'open-math-guide'))).toBe(true)
    await act(() => leaf.detach())
    open.splice(open.indexOf(leaf), 1)
    expect(isOffered(command(vault, 'add-math'))).toBe(false)
  })

  it('Add math starts placing in the active tab only', async () => {
    const vault = await setUp()
    const first = await openTab(vault, A)
    const second = await openTab(vault, B)
    vault.app.workspace.setActiveLeaf(first)
    act(() => {
      expect(runCommand(command(vault, 'add-math'))).toBe(true)
    })
    await waitFor(() => expect(isPlacingIn(first)).toBe(true))
    expect(isPlacingIn(second)).toBe(false)
    // The keyboard went to that tab's canvas: Esc there cancels.
    expect(first.containerEl.contains(document.activeElement)).toBe(true)
  })

  it('Toggle Math settings opens and closes the active tab’s panel only', async () => {
    const vault = await setUp({ sheetPanel: false })
    const first = await openTab(vault, A)
    const second = await openTab(vault, B)
    vault.app.workspace.setActiveLeaf(second)
    act(() => {
      runCommand(command(vault, 'toggle-math-settings'))
    })
    await waitFor(() => expect(panelIn(second)).not.toBeNull())
    expect(panelIn(first)).toBeNull()
    act(() => {
      runCommand(command(vault, 'toggle-math-settings'))
    })
    await waitFor(() => expect(panelIn(second)).toBeNull())
  })

  it('Open Math guide opens the guide in the active tab only, inside its view', async () => {
    const vault = await setUp()
    const first = await openTab(vault, A)
    const second = await openTab(vault, B)
    vault.app.workspace.setActiveLeaf(first)
    act(() => {
      runCommand(command(vault, 'open-math-guide'))
    })
    const guide = await waitFor(() => {
      const found = first.containerEl.querySelector('[role="dialog"][aria-labelledby="math-guide-math-guide"]')
      expect(found).not.toBeNull()
      return found!
    })
    expect(guide.textContent).toContain('A first sheet')
    expect(second.containerEl.querySelector('.math-guide')).toBeNull()
    // Esc closes it, and the key stops in the view.
    fireEvent.keyDown(guide, { key: 'Escape' })
    await waitFor(() => expect(first.containerEl.querySelector('.math-guide')).toBeNull())
  })
})

describe('two sheet tabs (section 8: each keeps its own keys and panel)', () => {
  it('M adds math only in the focused tab', async () => {
    const vault = await setUp()
    const first = await openTab(vault, A)
    const second = await openTab(vault, B)
    excalidrawIn(second).focus()
    act(() => {
      fireEvent.keyDown(excalidrawIn(second), { key: 'm', code: 'KeyM' })
    })
    await waitFor(() => expect(isPlacingIn(second)).toBe(true))
    expect(isPlacingIn(first)).toBe(false)
  })
})

describe('Obsidian’s core keys from a focused line (section 8)', () => {
  /** Obsidian's keymap, before the view: it takes Ctrl+P. */
  function obsidianKeymap(takes: boolean) {
    const heard: string[] = []
    const keymap = (event: KeyboardEvent) => {
      if (!(event.ctrlKey && event.key === 'p')) return
      heard.push('capture')
      if (takes) event.preventDefault()
    }
    const after = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'p') heard.push('bubble')
    }
    window.addEventListener('keydown', keymap, true)
    window.addEventListener('keydown', after)
    return {
      heard,
      stop: () => {
        window.removeEventListener('keydown', keymap, true)
        window.removeEventListener('keydown', after)
      },
    }
  }

  it('Ctrl+P that Obsidian takes never reaches the line, which stays open', async () => {
    const vault = await setUp()
    await openTab(vault, A)
    doubleClickLine('calc', 1)
    const field = screen.getByRole('textbox', { name: 'Line source' })
    const reached: string[] = []
    field.addEventListener('keydown', (event) => reached.push(event.key))
    const keymap = obsidianKeymap(true)
    try {
      fireEvent.keyDown(field, { key: 'p', ctrlKey: true })
    } finally {
      keymap.stop()
    }
    expect(keymap.heard).toEqual(['capture'])
    expect(reached).toEqual([])
    expect(screen.getByRole('textbox', { name: 'Line source' })).toHaveValue('a = 2 m')
  })

  it('Ctrl+P that Obsidian left alone still goes back up to the window', async () => {
    const vault = await setUp()
    await openTab(vault, A)
    doubleClickLine('calc', 1)
    const field = screen.getByRole('textbox', { name: 'Line source' })
    const keymap = obsidianKeymap(false)
    try {
      fireEvent.keyDown(field, { key: 'p', ctrlKey: true })
    } finally {
      keymap.stop()
    }
    expect(keymap.heard).toEqual(['capture', 'bubble'])
  })

  it('Ctrl+Shift+E opens no image export from the canvas', async () => {
    const vault = await setUp()
    const leaf = await openTab(vault, A)
    act(() => {
      fireEvent.keyDown(excalidrawIn(leaf), { key: 'E', ctrlKey: true, shiftKey: true })
    })
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(document.querySelector('.excalidraw-modal-container .Modal')).toBeNull()
  })
})
