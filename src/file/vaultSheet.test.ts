import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, readSheet } from './sheetFormat.ts'
import { createVaultSheet } from './vaultSheet.ts'

/**
 * The vault sheet's rules (docs/spec-v1.md section 7, A sheet in a vault) over
 * fake ports: what counts as unwritten, `keepClean`, `busy`, and an outside
 * version that arrives before Excalidraw is ready.
 */
function setUp() {
  let version = 1
  let ready!: () => void
  const changes = new Set<() => void>()
  const scene = {
    loaded: [] as { scene: Record<string, unknown>; keepView?: boolean }[],
    serialize: () => JSON.stringify({ type: 'excalidraw', elements: [], version }),
    load: vi.fn((data: Record<string, unknown>, options?: { keepView?: boolean }) => {
      scene.loaded.push({ scene: data, keepView: options?.keepView })
      version++
    }),
    saveKey: () => `v${version}`,
    onChange: (listener: () => void) => {
      changes.add(listener)
      return () => changes.delete(listener)
    },
    ready: () => new Promise<void>((resolve) => (ready = resolve)),
  }
  const line = { open: false, commitLine: vi.fn(), leaveLine: vi.fn(), isOpen: () => line.open }
  const onUnwritten = vi.fn()
  const sheet = createVaultSheet({
    scene,
    line,
    sheet: { scene: { type: 'excalidraw', elements: [], first: true }, settings: DEFAULT_SETTINGS },
    onUnwritten,
  })
  sheet.attach()
  const edit = () => {
    version++
    changes.forEach((listener) => listener())
  }
  const start = async () => {
    const started = sheet.start()
    ready()
    await started
  }
  return { sheet, scene, line, onUnwritten, edit, start, ready: () => ready() }
}

describe('createVaultSheet', () => {
  it('holds nothing unwritten after the load, and a change makes it so', async () => {
    const { sheet, onUnwritten, edit, start, line } = setUp()
    await start()
    expect(sheet.unwritten()).toBeNull()
    expect(onUnwritten).not.toHaveBeenCalled()
    edit()
    expect(onUnwritten).toHaveBeenCalledTimes(1)
    const write = sheet.unwritten()
    expect(line.commitLine).toHaveBeenCalled()
    expect(readSheet(write!.text)).toMatchObject({ kind: 'sheet', settings: DEFAULT_SETTINGS })
    sheet.written(write!)
    expect(sheet.unwritten()).toBeNull()
  })

  it('ignores changes before the load, and auto-size writes through keepClean', async () => {
    const { sheet, onUnwritten, edit, start } = setUp()
    edit()
    expect(onUnwritten).not.toHaveBeenCalled()
    await start()
    sheet.keepClean(() => edit())
    expect(onUnwritten).not.toHaveBeenCalled()
    expect(sheet.unwritten()).toBeNull()
  })

  it('a settings change is unwritten', async () => {
    const { sheet, onUnwritten, start } = setUp()
    await start()
    sheet.setSettings({ ...DEFAULT_SETTINGS, digits: 6 })
    expect(onUnwritten).toHaveBeenCalledTimes(1)
    expect(readSheet(sheet.unwritten()!.text)).toMatchObject({ settings: { digits: 6 } })
  })

  it('is busy with unwritten work or a line open', async () => {
    const { sheet, line, edit, start } = setUp()
    await start()
    expect(sheet.busy()).toBe(false)
    line.open = true
    expect(sheet.busy()).toBe(true)
    line.open = false
    edit()
    expect(sheet.busy()).toBe(true)
  })

  it('reloads in place, keeping the view, closing the line, with nothing unwritten', async () => {
    const { sheet, scene, line, edit, start } = setUp()
    await start()
    edit()
    sheet.reload({ scene: { outside: true }, settings: { ...DEFAULT_SETTINGS, digits: 3 } })
    expect(line.leaveLine).toHaveBeenCalled()
    expect(scene.loaded.at(-1)).toEqual({ scene: { outside: true }, keepView: true })
    expect(sheet.getState().settings.digits).toBe(3)
    expect(sheet.unwritten()).toBeNull()
  })

  it('an outside version before Excalidraw is ready is the one the start loads', async () => {
    const { sheet, scene, start } = setUp()
    sheet.reload({ scene: { outside: true }, settings: DEFAULT_SETTINGS })
    expect(scene.load).not.toHaveBeenCalled()
    await start()
    expect(scene.loaded).toEqual([{ scene: { outside: true }, keepView: undefined }])
    expect(sheet.unwritten()).toBeNull()
  })

  describe('a failed view (docs/spec-v1.md section 4, Unexpected failures)', () => {
    it('fail keeps what the tab holds without committing the open line, and nothing is written after', async () => {
      const { sheet, edit, start, line, onUnwritten } = setUp()
      await start()
      edit()
      line.open = true

      const kept = sheet.fail()

      expect(line.commitLine).not.toHaveBeenCalled()
      expect(kept).toMatchObject({ dirty: true, name: null, handle: null })
      expect(readSheet(kept!.text)).toMatchObject({ kind: 'sheet', settings: DEFAULT_SETTINGS })
      expect(sheet.unwritten()).toBeNull()
      // The scene as Excalidraw leaves it when it unmounts asks for no save.
      onUnwritten.mockClear()
      edit()
      expect(onUnwritten).not.toHaveBeenCalled()
      expect(sheet.unwritten()).toBeNull()
      expect(sheet.fail()).toBeNull()
    })

    it('keeps a sheet the file already holds as not dirty, and nothing before the load', async () => {
      const early = setUp()
      expect(early.sheet.fail()).toBeNull()

      const { sheet, start } = setUp()
      await start()
      expect(sheet.fail()).toMatchObject({ dirty: false })
    })

    it('a sheet started from a kept copy the file doesn’t hold is unwritten at once', async () => {
      const first = setUp()
      await first.start()
      expect(first.onUnwritten).not.toHaveBeenCalled()

      const onUnwritten = vi.fn()
      const scene = {
        serialize: () => JSON.stringify({ type: 'excalidraw', elements: [] }),
        load: vi.fn(),
        saveKey: () => 'v1',
        onChange: () => () => {},
        ready: () => Promise.resolve(),
      }
      const sheet = createVaultSheet({
        scene,
        line: { commitLine: vi.fn(), leaveLine: vi.fn(), isOpen: () => false },
        sheet: { scene: { type: 'excalidraw', elements: [] }, settings: DEFAULT_SETTINGS },
        onUnwritten,
        unwrittenAtStart: true,
      })
      await sheet.start()

      expect(onUnwritten).toHaveBeenCalledTimes(1)
      expect(sheet.busy()).toBe(true)
      const write = sheet.unwritten()
      expect(write).not.toBeNull()
      sheet.written(write!)
      expect(sheet.unwritten()).toBeNull()
    })
  })
})
