import { act, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { notices, TFile, TFolder, type WorkspaceLeaf } from './obsidian.ts'
import { DEFAULT_SETTINGS, readSheet } from '../../src/file/sheetFormat.ts'
import { WELCOME_HINT } from '../../src/canvas/SheetCanvas.tsx'
import { NEW_SHEET, NEW_SHEET_ICON } from '../main.ts'
import { conflictBase, freeSheetPath } from '../names.ts'
import { SheetView } from '../SheetView.ts'
import { vaultWith, type Vault } from './harness.ts'

/** New sheet (docs/spec-v1.md section 7, A sheet in a vault): the command, the ribbon and a folder's menu. */

let vault: Vault

beforeEach(() => {
  notices.length = 0
})

afterEach(async () => {
  for (const leaf of [...vault.app.workspace.leaves]) await act(() => leaf.detach())
})

const command = () => vault.recorded.commands.find(({ name }) => name === NEW_SHEET)!
const created = () => vault.app.vault.creates.map(({ path }) => path)
const lastLeaf = (): WorkspaceLeaf => vault.app.workspace.leaves.at(-1)!

describe('the command, the ribbon and the folder menu', () => {
  it('registers the command New sheet, with no default hotkey, and a ribbon icon', async () => {
    vault = await vaultWith({})
    // The tab's own commands are tab.test.ts's.
    expect(vault.recorded.commands[0]).toEqual(expect.objectContaining({ id: 'new-sheet', name: 'New sheet' }))
    expect(command()).not.toHaveProperty('hotkeys')
    expect(vault.recorded.ribbon.map(({ icon, title }) => ({ icon, title }))).toEqual([
      { icon: NEW_SHEET_ICON, title: 'New sheet' },
    ])
  })

  it('makes an empty sheet in a new tab, on the welcome screen', async () => {
    vault = await vaultWith({})
    await act(async () => command().callback!())
    expect(created()).toEqual(['Untitled.excalimathpad'])
    const read = readSheet(vault.app.vault.creates[0].data)
    expect(read).toMatchObject({ kind: 'sheet', settings: DEFAULT_SETTINGS })
    expect(read.kind === 'sheet' && read.scene.elements).toEqual([])
    expect(JSON.parse(vault.app.vault.creates[0].data).excalimathpad.format).toBe(2)
    expect(vault.app.workspace.leafRequests.at(-1)).toBe('tab')
    expect(lastLeaf().view).toBeInstanceOf(SheetView)
    expect((lastLeaf().view as unknown as SheetView).file?.path).toBe('Untitled.excalimathpad')
    expect(await screen.findByText(WELCOME_HINT, {}, { timeout: 10_000 })).toBeInTheDocument()
  })

  it('names the next ones Untitled 1, Untitled 2…, never over a file', async () => {
    vault = await vaultWith({ 'Untitled.excalimathpad': '{}', 'Untitled 2.excalimathpad': '{}' })
    await act(async () => command().callback!())
    await act(async () => command().callback!())
    expect(created()).toEqual(['Untitled 1.excalimathpad', 'Untitled 3.excalimathpad'])
    expect(vault.app.vault.files.get('Untitled.excalimathpad')).toBe('{}')
  })

  it("follows Obsidian's Default location for new notes", async () => {
    vault = await vaultWith({})
    vault.app.vault.addFolder('Calcs/2026')
    vault.app.fileManager.newFileFolder = 'Calcs/2026'
    await act(async () => command().callback!())
    expect(created()).toEqual(['Calcs/2026/Untitled.excalimathpad'])
  })

  it('the ribbon icon is New sheet too', async () => {
    vault = await vaultWith({})
    await act(async () => vault.recorded.ribbon[0].click(new MouseEvent('click')))
    expect(created()).toEqual(['Untitled.excalimathpad'])
  })

  it("a folder's menu has New sheet, which puts it in that folder", async () => {
    vault = await vaultWith({ 'Projects/Pumps/notes.md': '# notes' })
    const menu = vault.app.workspace.fileMenu(new TFolder('Projects/Pumps'))
    const items = menu.items.filter(({ title }) => title === NEW_SHEET)
    expect(items).toHaveLength(1)
    expect(items[0].icon).toBe(NEW_SHEET_ICON)
    await act(async () => items[0].press())
    expect(created()).toEqual(['Projects/Pumps/Untitled.excalimathpad'])
  })

  it("a file's menu has no New sheet", async () => {
    vault = await vaultWith({ 'notes.md': '# notes' })
    const menu = vault.app.workspace.fileMenu(new TFile('notes.md'))
    expect(menu.items.map(({ title }) => title)).not.toContain(NEW_SHEET)
  })

  it('a new sheet, opened and closed untouched, is never written again', async () => {
    vault = await vaultWith({})
    await act(async () => command().callback!())
    await screen.findByText(WELCOME_HINT, {}, { timeout: 10_000 })
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    await act(() => lastLeaf().detach())
    expect(vault.app.vault.writes).toEqual([])
  })

  it('a create that fails says so, and opens nothing', async () => {
    vault = await vaultWith({})
    vault.app.vault.failNext = new Error('Disk full.')
    await act(async () => command().callback!())
    expect(notices).toEqual(["Couldn't create Untitled.excalimathpad: Disk full."])
    await waitFor(() => expect(vault.app.workspace.leaves).toEqual([]))
  })
})

describe('the names (plugin/names.ts)', () => {
  it('finds the first free name in a folder, the root included', () => {
    const taken = new Set(['A/Untitled.excalimathpad', 'Untitled.excalimathpad', 'Untitled 1.excalimathpad'])
    const has = (path: string) => taken.has(path)
    expect(freeSheetPath('/', 'Untitled', has)).toBe('Untitled 2.excalimathpad')
    expect(freeSheetPath('A', 'Untitled', has)).toBe('A/Untitled 1.excalimathpad')
    expect(freeSheetPath('B', 'Untitled', has)).toBe('B/Untitled.excalimathpad')
  })

  it('names a conflict copy by local date and time, to the minute', () => {
    expect(conflictBase('pump-sizing', new Date(2026, 10, 14, 15, 32, 59))).toBe(
      'pump-sizing (conflict 2026-11-14 1532)',
    )
    expect(conflictBase('a', new Date(2027, 0, 2, 3, 4))).toBe('a (conflict 2027-01-02 0304)')
  })
})
