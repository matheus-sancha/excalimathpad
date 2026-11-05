import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileAccess, PickedFile, SheetFileHandle } from './fileAccess.ts'
import type { RecoveryCopy, RecoveryStore } from './recovery.ts'
import {
  createSheetSession,
  displayName,
  MESSAGES,
  suggestedName,
  type SceneFile,
  type SessionDialogs,
} from './sheetSession.ts'
import { DEFAULT_SETTINGS, writeSheet, type SheetData } from './sheetFormat.ts'

/** A scene that is just a source string with a version, like Excalidraw's. */
function fakeScene(source = 'seed') {
  let current = source
  let version = 1
  const listeners = new Set<() => void>()
  const scene: SceneFile & {
    source: () => string
    edit: (s: string) => void
    editQuietly: (s: string) => void
    touch: () => void
  } = {
    serialize: () =>
      JSON.stringify({ type: 'excalidraw', version: 2, elements: [{ source: current }] }),
    load: vi.fn((data: SheetData) => {
      current = (data.elements as { source: string }[])[0]?.source ?? ''
      version++
      listeners.forEach((l) => l())
    }),
    saveKey: () => String(version),
    onChange: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    ready: () => Promise.resolve(),
    source: () => current,
    edit: (next) => {
      current = next
      version++
      listeners.forEach((l) => l())
    },
    /** A change not yet reported, as right after a write inside Excalidraw. */
    editQuietly: (next) => {
      current = next
      version++
    },
    /** A change Excalidraw reports that a save wouldn't see: selection, scroll. */
    touch: () => listeners.forEach((l) => l()),
  }
  return scene
}

const sheetFile = (source: string, settings = DEFAULT_SETTINGS) =>
  writeSheet(JSON.stringify({ type: 'excalidraw', elements: [{ source }] }), settings)

const handleFor = (name: string) => ({ kind: 'file', name }) as SheetFileHandle

function fakeFiles() {
  const disk = new Map<string, string>()
  const files = {
    disk,
    open: vi.fn<FileAccess['open']>(async () => null),
    save: vi.fn<FileAccess['save']>(async (handle, text) => {
      disk.set(handle.name, text)
    }),
    saveAs: vi.fn<FileAccess['saveAs']>(async (name, text) => {
      disk.set(name, text)
      return { name, handle: handleFor(name) }
    }),
  }
  return files
}

function fakeRecovery(initial: RecoveryCopy | null = null) {
  let copy = initial
  return {
    current: () => copy,
    read: vi.fn(async () => copy),
    write: vi.fn(async (next: RecoveryCopy) => {
      copy = next
    }),
    clear: vi.fn(async () => {
      copy = null
    }),
  } satisfies RecoveryStore & { current: () => RecoveryCopy | null }
}

function fakeDialogs() {
  return {
    askRestore: vi.fn<SessionDialogs['askRestore']>(async () => 'restore'),
    askSaveChanges: vi.fn<SessionDialogs['askSaveChanges']>(async () => 'cancel'),
    message: vi.fn<SessionDialogs['message']>(),
  }
}

async function setup(options: { recovery?: RecoveryCopy | null } = {}) {
  const scene = fakeScene()
  const files = fakeFiles()
  const recovery = fakeRecovery(options.recovery ?? null)
  const dialogs = fakeDialogs()
  const line = { commitLine: vi.fn(), leaveLine: vi.fn() }
  const session = createSheetSession({ scene, files, recovery, dialogs, line, recoveryDelayMs: 500 })
  const detach = session.attach()
  await session.start()
  return { scene, files, recovery, dialogs, line, session, detach }
}

const picked = (name: string, text: string): PickedFile => ({
  name,
  text,
  handle: handleFor(name),
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('starting', () => {
  it('starts untitled and clean, with no dialog when there is no copy', async () => {
    const { session, dialogs } = await setup()

    expect(session.getState()).toEqual({ name: null, dirty: false })
    expect(dialogs.askRestore).not.toHaveBeenCalled()
  })

  it('offers a recovery copy first, and Restore brings it back dirty, with its name', async () => {
    const copy = { text: sheetFile('restored'), name: 'pump.excalimathpad', handle: handleFor('pump.excalimathpad') }
    const { session, scene, dialogs, files } = await setup({ recovery: copy })

    expect(dialogs.askRestore).toHaveBeenCalledWith('pump.excalimathpad')
    expect(scene.source()).toBe('restored')
    expect(session.getState()).toEqual({ name: 'pump.excalimathpad', dirty: true })

    // Its handle came back too, so Ctrl+S writes back to the same file.
    await session.save()
    expect(files.save).toHaveBeenCalledWith(copy.handle, expect.any(String))
    expect(files.saveAs).not.toHaveBeenCalled()
  })

  it('Discard clears the copy and keeps the new untitled sheet', async () => {
    const dialogs = fakeDialogs()
    dialogs.askRestore.mockResolvedValue('discard')
    const recovery = fakeRecovery({ text: sheetFile('old'), name: null, handle: null })
    const scene = fakeScene()
    const session = createSheetSession({
      scene,
      files: fakeFiles(),
      recovery,
      dialogs,
      line: { commitLine: vi.fn(), leaveLine: vi.fn() },
    })

    await session.start()
    await vi.runAllTimersAsync()

    expect(recovery.current()).toBeNull()
    expect(scene.source()).toBe('seed')
    expect(session.getState()).toEqual({ name: null, dirty: false })
  })

  it('runs once, however often it is called', async () => {
    const { session, recovery } = await setup()

    await Promise.all([session.start(), session.start()])

    expect(recovery.read).toHaveBeenCalledOnce()
  })

  it('ignores Save and Open until the recovery offer is answered', async () => {
    const files = fakeFiles()
    let answer: (choice: 'restore' | 'discard') => void = () => {}
    const dialogs = fakeDialogs()
    dialogs.askRestore.mockImplementation(() => new Promise((resolve) => (answer = resolve)))
    const session = createSheetSession({
      scene: fakeScene(),
      files,
      recovery: fakeRecovery({ text: sheetFile('x'), name: null, handle: null }),
      dialogs,
      line: { commitLine: vi.fn(), leaveLine: vi.fn() },
    })

    const starting = session.start()
    await vi.waitFor(() => expect(dialogs.askRestore).toHaveBeenCalled())
    expect(await session.save()).toBe(false)
    answer('discard')
    await starting

    expect(files.saveAs).not.toHaveBeenCalled()
  })
})

describe('the clean mark', () => {
  it('turns dirty on a change a save would write, and only then', async () => {
    const { session, scene } = await setup()

    scene.touch()
    expect(session.getState().dirty).toBe(false)

    scene.edit('a = 1')
    expect(session.getState().dirty).toBe(true)
  })

  it('keepClean runs a write without dirtying a clean sheet', async () => {
    const { session, scene } = await setup()

    session.keepClean(() => scene.edit('resized'))

    expect(session.getState().dirty).toBe(false)
  })

  it('keepClean leaves a dirty sheet dirty', async () => {
    const { session, scene } = await setup()
    scene.edit('a = 1')

    session.keepClean(() => scene.edit('resized'))

    expect(session.getState().dirty).toBe(true)
  })
})

describe('saving', () => {
  it('Ctrl+S on an untitled sheet works as Save as, and the file becomes the sheet’s', async () => {
    const { session, scene, files } = await setup()
    scene.edit('a = 1')

    expect(await session.save()).toBe(true)

    expect(files.saveAs).toHaveBeenCalledWith('Untitled.excalimathpad', expect.any(String))
    expect(session.getState()).toEqual({ name: 'Untitled.excalimathpad', dirty: false })
    expect(JSON.parse(files.disk.get('Untitled.excalimathpad')!)).toMatchObject({
      elements: [{ source: 'a = 1' }],
      excalimathpad: { format: 1, settings: DEFAULT_SETTINGS },
    })
  })

  it('Ctrl+S on a titled sheet writes back to its file', async () => {
    const { session, scene, files } = await setup()
    await session.saveAs()
    scene.edit('b = 2')

    await session.save()

    expect(files.saveAs).toHaveBeenCalledOnce()
    expect(files.save).toHaveBeenCalledWith(handleFor('Untitled.excalimathpad'), expect.any(String))
    expect(files.disk.get('Untitled.excalimathpad')).toContain('b = 2')
  })

  it('commits the line being edited before writing', async () => {
    const { session, scene, line } = await setup()
    line.commitLine.mockImplementation(() => scene.edit('typed'))

    await session.save()

    expect(line.commitLine).toHaveBeenCalledOnce()
    expect(line.leaveLine).not.toHaveBeenCalled()
    expect(scene.source()).toBe('typed')
    expect(session.getState().dirty).toBe(false)
  })

  it('stays dirty when the picker is cancelled', async () => {
    const { session, scene, files } = await setup()
    files.saveAs.mockResolvedValue(null)
    scene.edit('a = 1')

    expect(await session.save()).toBe(false)

    expect(session.getState()).toEqual({ name: null, dirty: true })
  })

  it('says why a save failed, and stays dirty', async () => {
    const { session, scene, files, dialogs } = await setup()
    await session.saveAs()
    files.save.mockRejectedValue(new Error('permission to write the file was refused'))
    scene.edit('a = 1')

    expect(await session.save()).toBe(false)

    expect(dialogs.message).toHaveBeenCalledWith(
      "Couldn't save Untitled.excalimathpad: permission to write the file was refused",
    )
    expect(session.getState().dirty).toBe(true)
  })

  it('Save as on a plain drawing suggests the sheet extension, and Ctrl+S does too', async () => {
    const { session, files } = await setup()
    files.open.mockResolvedValue(picked('pump.excalidraw', JSON.stringify({ type: 'excalidraw', elements: [] })))
    await session.open()

    await session.save()

    expect(files.save).not.toHaveBeenCalled()
    expect(files.saveAs).toHaveBeenCalledWith('pump.excalimathpad', expect.any(String))
  })

  it('does one flow at a time', async () => {
    const { session, scene, files } = await setup()
    scene.edit('a = 1')

    await Promise.all([session.save(), session.save()])

    expect(files.saveAs).toHaveBeenCalledOnce()
  })
})

describe('the recovery copy', () => {
  it('is written after a change, once the changes stop', async () => {
    const { scene, recovery } = await setup()

    scene.edit('a = 1')
    scene.edit('a = 12')
    expect(recovery.write).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(500)

    expect(recovery.write).toHaveBeenCalledOnce()
    expect(recovery.current()).toMatchObject({ name: null, handle: null })
    expect(recovery.current()!.text).toContain('a = 12')
  })

  it('is not written for a change a save would not see', async () => {
    const { scene, recovery } = await setup()

    scene.touch()
    await vi.runAllTimersAsync()

    expect(recovery.write).not.toHaveBeenCalled()
  })

  it('is cleared by a save, and a write pending then is dropped', async () => {
    const { session, scene, recovery } = await setup()
    scene.edit('a = 1')
    await vi.advanceTimersByTimeAsync(500)
    scene.edit('a = 2')

    await session.save()
    await vi.runAllTimersAsync()

    expect(recovery.current()).toBeNull()
  })

  it('is written at once when the page goes away', async () => {
    const { session, scene, recovery } = await setup()
    scene.edit('a = 1')

    session.flushRecovery()
    await vi.waitFor(() => expect(recovery.write).toHaveBeenCalledOnce())
  })

  it('is written when the session stops listening with a change pending', async () => {
    const { scene, recovery, detach } = await setup()
    scene.edit('a = 1')

    detach()

    await vi.waitFor(() => expect(recovery.write).toHaveBeenCalledOnce())
  })
})

describe('opening', () => {
  it('opens a sheet clean, with its name, as the file to write back to', async () => {
    const { session, scene, files } = await setup()
    files.open.mockResolvedValue(picked('pump.excalimathpad', sheetFile('D = 4 in')))

    await session.open()

    expect(scene.source()).toBe('D = 4 in')
    expect(session.getState()).toEqual({ name: 'pump.excalimathpad', dirty: false })
    await session.save()
    expect(files.save).toHaveBeenCalledWith(handleFor('pump.excalimathpad'), expect.any(String))
  })

  it('reads the settings from the file and writes them back', async () => {
    const { session, files } = await setup()
    const settings = { ...DEFAULT_SETTINGS, digits: 6 }
    files.open.mockResolvedValue(picked('pump.excalimathpad', sheetFile('x', settings)))

    await session.open()
    await session.save()

    expect(session.settings).toEqual(settings)
    expect(JSON.parse(files.disk.get('pump.excalimathpad')!).excalimathpad.settings).toEqual(settings)
  })

  it('leaves the line being edited first', async () => {
    const { session, line } = await setup()

    await session.open()

    expect(line.leaveLine).toHaveBeenCalledOnce()
  })

  it.each([
    ['newer', JSON.stringify({ type: 'excalidraw', elements: [], excalimathpad: { format: 99 } }), MESSAGES.newer],
    ['not a sheet', 'not json', MESSAGES.notASheet],
  ])('refuses a %s file and leaves the sheet as it was', async (_, text, message) => {
    const { session, scene, files, dialogs } = await setup()
    scene.edit('mine')
    files.open.mockResolvedValue(picked('x.excalimathpad', text))
    dialogs.askSaveChanges.mockResolvedValue('dont-save')

    await session.open()

    expect(dialogs.message).toHaveBeenCalledWith(message)
    expect(scene.source()).toBe('mine')
    expect(session.getState()).toEqual({ name: null, dirty: true })
  })

  it('opens a dropped file the same way', async () => {
    const { session, scene, files } = await setup()

    await session.open(picked('dropped.excalimathpad', sheetFile('dropped')))

    expect(files.open).not.toHaveBeenCalled()
    expect(scene.source()).toBe('dropped')
  })

  describe('with unsaved changes', () => {
    it('asks first, and Cancel leaves everything as it was', async () => {
      const { session, scene, files, dialogs } = await setup()
      scene.edit('mine')

      await session.open()

      expect(dialogs.askSaveChanges).toHaveBeenCalledWith(null)
      expect(files.open).not.toHaveBeenCalled()
      expect(scene.source()).toBe('mine')
    })

    it('counts the line it just left, before the scene reports the change', async () => {
      const { session, scene, dialogs, line } = await setup()
      // Excalidraw's onChange comes after React commits, not inside the write.
      line.leaveLine.mockImplementation(() => scene.editQuietly('typed'))

      await session.open()

      expect(dialogs.askSaveChanges).toHaveBeenCalledOnce()
    })

    it("Don't save opens the file and drops the old sheet's recovery copy", async () => {
      const { session, scene, files, dialogs, recovery } = await setup()
      scene.edit('mine')
      await vi.advanceTimersByTimeAsync(500)
      expect(recovery.current()).not.toBeNull()
      dialogs.askSaveChanges.mockResolvedValue('dont-save')
      files.open.mockResolvedValue(picked('pump.excalimathpad', sheetFile('theirs')))

      await session.open()
      await vi.runAllTimersAsync()

      expect(scene.source()).toBe('theirs')
      expect(recovery.current()).toBeNull()
      expect(session.getState().dirty).toBe(false)
    })

    it('Save saves, then opens', async () => {
      const { session, scene, files, dialogs } = await setup()
      scene.edit('mine')
      dialogs.askSaveChanges.mockResolvedValue('save')
      files.open.mockResolvedValue(picked('pump.excalimathpad', sheetFile('theirs')))

      await session.open()

      expect(files.disk.get('Untitled.excalimathpad')).toContain('mine')
      expect(scene.source()).toBe('theirs')
    })

    it('Save, then a cancelled Save as, opens nothing', async () => {
      const { session, scene, files, dialogs } = await setup()
      scene.edit('mine')
      dialogs.askSaveChanges.mockResolvedValue('save')
      files.saveAs.mockResolvedValue(null)

      await session.open()

      expect(files.open).not.toHaveBeenCalled()
      expect(scene.source()).toBe('mine')
    })
  })
})

describe('names', () => {
  it.each([
    [null, 'Untitled.excalimathpad', 'Untitled'],
    ['pump-sizing.excalimathpad', 'pump-sizing.excalimathpad', 'pump-sizing'],
    ['pump.excalidraw', 'pump.excalimathpad', 'pump'],
    ['PUMP.EXCALIMATHPAD', 'PUMP.EXCALIMATHPAD', 'PUMP'],
  ])('%s suggests %s and shows as %s', (name, suggested, shown) => {
    expect(suggestedName(name)).toBe(suggested)
    expect(displayName(name)).toBe(shown)
  })
})
