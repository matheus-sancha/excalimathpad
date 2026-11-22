/**
 * A hand-written fake of the `obsidian` module (docs/spec-v1.md section 12a,
 * Tests): only the part the plugin uses, behaving as Obsidian's typings
 * describe it. Vitest aliases `obsidian` here (`vite.config.ts`), and
 * `scripts/blocked-run.mjs` bundles it for the browser, where the built
 * `main.js` gets it from `require('obsidian')`. So the jsdom tests and the
 * network-blocked run drive the plugin through the same fake. It uses no Node
 * API, for that reason.
 *
 * It records what a test asks about: the views and extensions registered, every
 * vault write and create, every notice, every `registerDomEvent`, the commands,
 * the ribbon and the modals opened. And it lets a test act as the world
 * outside the view: a change from sync or git (`Vault.changeOutside`), a
 * rename, a write that fails, the folder menu, a pick in a modal.
 */

type Callback = () => unknown
type Handler = (...args: never[]) => unknown

// ---------------------------------------------------------------------------
// The DOM helpers Obsidian adds to every element.

interface DomElementInfo {
  cls?: string | string[]
  text?: string
  attr?: Record<string, string>
}

declare global {
  interface HTMLElement {
    empty(): void
    addClass(...classes: string[]): void
    removeClass(...classes: string[]): void
    createEl<K extends keyof HTMLElementTagNameMap>(tag: K, info?: DomElementInfo | string): HTMLElementTagNameMap[K]
    createDiv(info?: DomElementInfo | string): HTMLDivElement
    onWindowMigrated(listener: (win: Window) => unknown): () => void
  }
  interface Node {
    /** Obsidian's: the document the node is in now (a pop-out's, after a move). */
    doc: Document
    /** Obsidian's: that document's window. */
    win: Window
  }
}

/** Each element's window-migration listeners: \`migrateWindow\` calls them, as Obsidian does on a move. */
const migrations = new WeakMap<HTMLElement, Set<(win: Window) => unknown>>()

/**
 * Moves \`element\` into \`win\`'s body, as Obsidian does when a tab goes to a
 * pop-out window, and tells it and every element under it that listens.
 */
export function migrateWindow(element: HTMLElement, win: Window) {
  win.document.body.appendChild(element)
  for (const node of [element, ...element.querySelectorAll<HTMLElement>('*')]) {
    migrations.get(node)?.forEach((listener) => listener(win))
  }
}

function applyInfo(el: HTMLElement, info?: DomElementInfo | string) {
  if (!info) return
  if (typeof info === 'string') {
    el.className = info
    return
  }
  const classes = typeof info.cls === 'string' ? [info.cls] : (info.cls ?? [])
  if (classes.length) el.classList.add(...classes)
  if (info.text !== undefined) el.textContent = info.text
  for (const [name, value] of Object.entries(info.attr ?? {})) el.setAttribute(name, value)
}

/** Installs the helpers on a window's `HTMLElement`, as Obsidian does for each window. */
export function installDomHelpers(win: Window & typeof globalThis = window) {
  const proto = win.HTMLElement.prototype
  if ('createDiv' in proto) return
  Object.defineProperties(win.Node.prototype, {
    doc: {
      configurable: true,
      get(this: Node) {
        return this.ownerDocument ?? (this as Document)
      },
    },
    win: {
      configurable: true,
      get(this: Node) {
        return (this.ownerDocument ?? (this as Document)).defaultView
      },
    },
  })
  Object.assign(proto, {
    empty(this: HTMLElement) {
      while (this.firstChild) this.removeChild(this.firstChild)
    },
    addClass(this: HTMLElement, ...classes: string[]) {
      this.classList.add(...classes)
    },
    removeClass(this: HTMLElement, ...classes: string[]) {
      this.classList.remove(...classes)
    },
    createEl(this: HTMLElement, tag: string, info?: DomElementInfo | string) {
      const el = this.ownerDocument.createElement(tag)
      applyInfo(el, info)
      this.appendChild(el)
      return el
    },
    createDiv(this: HTMLElement, info?: DomElementInfo | string) {
      return this.createEl('div', info)
    },
    onWindowMigrated(this: HTMLElement, listener: (win: Window) => unknown) {
      const listeners = migrations.get(this) ?? new Set()
      migrations.set(this, listeners)
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  })
}
installDomHelpers()

/** Obsidian's own: slashes, no leading or trailing one, `/` for the root. */
export function normalizePath(path: string): string {
  const cleaned = path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
  return cleaned === '' ? '/' : cleaned
}

// ---------------------------------------------------------------------------
// Components and events.

export interface EventRef {
  events: Events
  name: string
  callback: Handler
}

export class Events {
  private handlers = new Map<string, Set<Handler>>()
  on(name: string, callback: Handler): EventRef {
    const set = this.handlers.get(name) ?? new Set()
    set.add(callback)
    this.handlers.set(name, set)
    return { events: this, name, callback }
  }
  off(name: string, callback: Handler) {
    this.handlers.get(name)?.delete(callback)
  }
  offref(ref: EventRef) {
    this.off(ref.name, ref.callback)
  }
  trigger(name: string, ...args: unknown[]) {
    this.handlers.get(name)?.forEach((callback) => (callback as (...a: unknown[]) => unknown)(...args))
  }
}

/** Every `registerDomEvent`, for "no global listener" (section 12a). */
export const domEvents: { target: EventTarget; type: string }[] = []

export class Component {
  private cleanups: Callback[] = []
  private loaded = false
  load() {
    if (this.loaded) return
    this.loaded = true
    void this.onload()
  }
  unload() {
    if (!this.loaded) return
    this.loaded = false
    this.cleanups.splice(0).forEach((cleanup) => cleanup())
    this.onunload()
  }
  onload(): unknown {
    return undefined
  }
  onunload() {}
  register(cleanup: Callback) {
    this.cleanups.push(cleanup)
  }
  registerDomEvent(
    target: EventTarget,
    type: string,
    callback: EventListener,
    options?: boolean | AddEventListenerOptions,
  ) {
    domEvents.push({ target, type })
    target.addEventListener(type, callback, options)
    this.register(() => target.removeEventListener(type, callback, options))
  }
  /** Removed when the component unloads, as Obsidian does. */
  registerEvent(ref: EventRef) {
    this.register(() => ref.events.offref(ref))
  }
}

export class Scope {
  register() {
    return {}
  }
  unregister() {}
}

export const Platform = {
  isDesktop: true,
  isMobile: false,
  isDesktopApp: true,
  isMobileApp: false,
  isIosApp: false,
  isAndroidApp: false,
  isPhone: false,
  isTablet: false,
  isMacOS: false,
  isWin: false,
  isLinux: true,
  isSafari: false,
}

export const notices: string[] = []
/** Every notice hidden by code, as `hide()` does (a duration of 0 stays until then). */
export const hiddenNotices: string[] = []

export class Notice {
  private readonly message: string
  constructor(message: string, _duration?: number) {
    this.message = message
    notices.push(message)
  }
  hide() {
    hiddenNotices.push(this.message)
  }
}

// ---------------------------------------------------------------------------
// Files.

export abstract class TAbstractFile {
  path: string
  constructor(path: string) {
    this.path = normalizePath(path)
  }
  get name() {
    return this.path === '/' ? '' : (this.path.split('/').pop() ?? this.path)
  }
  /** The folder holding it; the root's is null. */
  get parent(): TFolder | null {
    if (this.path === '/') return null
    const at = this.path.lastIndexOf('/')
    return new TFolder(at < 0 ? '/' : this.path.slice(0, at))
  }
}

export class TFile extends TAbstractFile {
  get basename() {
    return this.name.replace(/\.[^.]*$/, '')
  }
  get extension() {
    const dot = this.name.lastIndexOf('.')
    return dot < 0 ? '' : this.name.slice(dot + 1)
  }
}

export class TFolder extends TAbstractFile {
  isRoot() {
    return this.path === '/'
  }
}

export class Vault extends Events {
  readonly files = new Map<string, string>()
  readonly binaries = new Map<string, ArrayBuffer>()
  readonly folders = new Set<string>(['/'])
  /** Every write by the plugin (`modify`), in order. */
  readonly writes: { path: string; data: string }[] = []
  /** Every file the plugin created (`create`), in order. */
  readonly creates: { path: string; data: string }[] = []
  /** Every read of a binary file (`readBinary`). */
  readonly binaryReads: string[] = []
  /** Set by a test: the next `modify` or `create` fails with it. */
  failNext: Error | null = null
  private readonly app: App
  constructor(app: App) {
    super()
    this.app = app
  }

  /** A file already in the vault, as the test sets it up. */
  add(path: string, content: string | ArrayBuffer) {
    const at = normalizePath(path)
    if (typeof content === 'string') this.files.set(at, content)
    else this.binaries.set(at, content)
    this.addFolders(at)
    return new TFile(at)
  }
  addFolder(path: string) {
    this.addFolders(`${normalizePath(path)}/x`)
    return new TFolder(path)
  }
  private addFolders(filePath: string) {
    const parts = filePath.split('/').slice(0, -1)
    for (let i = 1; i <= parts.length; i++) this.folders.add(parts.slice(0, i).join('/'))
  }

  getAbstractFileByPath(path: string): TAbstractFile | null {
    const at = normalizePath(path)
    if (this.files.has(at) || this.binaries.has(at)) return new TFile(at)
    return this.folders.has(at) ? new TFolder(at) : null
  }
  getRoot() {
    return new TFolder('/')
  }
  getFiles(): TFile[] {
    return [...this.files.keys(), ...this.binaries.keys()].sort().map((path) => new TFile(path))
  }
  read(file: TFile) {
    const text = this.files.get(file.path)
    return text === undefined ? Promise.reject(new Error(`No file ${file.path}`)) : Promise.resolve(text)
  }
  cachedRead(file: TFile) {
    return this.read(file)
  }
  readBinary(file: TFile) {
    this.binaryReads.push(file.path)
    const bytes = this.binaries.get(file.path)
    return bytes === undefined ? Promise.reject(new Error(`No file ${file.path}`)) : Promise.resolve(bytes)
  }
  private failure() {
    const error = this.failNext
    this.failNext = null
    return error
  }
  /** Writes the file, then tells every listener, as Obsidian's `modify` event does. */
  async modify(file: TFile, data: string) {
    const error = this.failure()
    if (error) throw error
    if (!this.files.has(file.path)) throw new Error(`No file ${file.path}`)
    this.writes.push({ path: file.path, data })
    this.files.set(file.path, data)
    this.trigger('modify', new TFile(file.path))
  }
  /** Refuses a path that exists, as Obsidian does: "File already exists". */
  async create(path: string, data: string) {
    const at = normalizePath(path)
    const error = this.failure()
    if (error) throw error
    if (this.getAbstractFileByPath(at)) throw new Error('File already exists.')
    this.creates.push({ path: at, data })
    const file = this.add(at, data)
    this.trigger('create', file)
    return file
  }
  process(file: TFile, fn: (data: string) => string) {
    return this.read(file).then(async (text) => {
      const data = fn(text)
      await this.modify(file, data)
      return data
    })
  }

  /** A change from outside the plugin (sync, git, another app): not one of its writes. */
  changeOutside(path: string, data: string) {
    const at = normalizePath(path)
    this.files.set(at, data)
    this.trigger('modify', new TFile(at))
  }
  /** A rename or move from Obsidian's explorer: each tab on the file follows it. */
  async rename(file: TFile, newPath: string) {
    const from = file.path
    const to = normalizePath(newPath)
    const text = this.files.get(from)
    if (text === undefined) throw new Error(`No file ${from}`)
    this.files.delete(from)
    this.add(to, text)
    for (const leaf of this.app.workspace.leaves) {
      const view = leaf.view
      if (view instanceof FileView && view.file?.path === from) {
        view.file.path = to
        await view.onRename(view.file)
      }
    }
    this.trigger('rename', new TFile(to), from)
  }
}

/** Obsidian's file manager: where a new note goes ("Default location for new notes"). */
export class FileManager {
  /** The setting, as a folder path: the root (`/`) unless a test sets it. */
  newFileFolder = '/'
  getNewFileParent(_sourcePath: string, _newFilePath?: string) {
    return new TFolder(this.newFileFolder)
  }
}

// ---------------------------------------------------------------------------
// Menus and modals.

export class MenuItem {
  title = ''
  icon = ''
  private click: (() => unknown) | null = null
  setTitle(title: string) {
    this.title = title
    return this
  }
  setIcon(icon: string) {
    this.icon = icon
    return this
  }
  onClick(callback: () => unknown) {
    this.click = callback
    return this
  }
  /** A click on the item, as the user makes it. */
  press() {
    return this.click?.()
  }
}

export class Menu {
  readonly items: MenuItem[] = []
  addItem(build: (item: MenuItem) => unknown) {
    const item = new MenuItem()
    build(item)
    this.items.push(item)
    return this
  }
  addSeparator() {
    return this
  }
}

/** Every modal opened, last last. */
export const modals: Modal[] = []

export class Modal {
  readonly app: App
  readonly containerEl: HTMLElement
  readonly contentEl: HTMLElement
  isOpen = false
  constructor(app: App) {
    this.app = app
    this.containerEl = window.document.createElement('div')
    this.contentEl = this.containerEl.createDiv({ cls: 'modal-content' })
  }
  open() {
    this.isOpen = true
    modals.push(this)
    this.onOpen()
  }
  close() {
    if (!this.isOpen) return
    this.isOpen = false
    this.onClose()
  }
  onOpen() {}
  onClose() {}
}

export abstract class FuzzySuggestModal<T> extends Modal {
  placeholder = ''
  setPlaceholder(placeholder: string) {
    this.placeholder = placeholder
  }
  abstract getItems(): T[]
  abstract getItemText(item: T): string
  abstract onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): void
  /** What the list shows, as text. */
  shown() {
    return this.getItems().map((item) => this.getItemText(item))
  }
  /** Picks the item whose text is `text`. Obsidian closes the modal first, then calls `onChooseItem`. */
  choose(text: string) {
    const item = this.getItems().find((candidate) => this.getItemText(candidate) === text)
    if (item === undefined) throw new Error(`No item ${text}`)
    this.close()
    this.onChooseItem(item, new MouseEvent('click'))
  }
}

// ---------------------------------------------------------------------------
// Views.

type ViewCreator = (leaf: WorkspaceLeaf) => View

export class Workspace extends Events {
  readonly leaves: WorkspaceLeaf[] = []
  readonly containerEl: HTMLElement
  /** What each `getLeaf` was asked for: `'tab'`, `true`, or nothing. */
  readonly leafRequests: unknown[] = []
  activeLeaf: WorkspaceLeaf | null = null
  private readonly app: App
  constructor(app: App) {
    super()
    this.app = app
    this.containerEl = window.document.createElement('div')
    this.containerEl.className = 'workspace'
    window.document.body.appendChild(this.containerEl)
  }
  getLeaf(newLeaf?: unknown) {
    this.leafRequests.push(newLeaf)
    const leaf = new WorkspaceLeaf(this.app)
    this.leaves.push(leaf)
    this.containerEl.appendChild(leaf.containerEl)
    return leaf
  }
  getActiveFile() {
    const view = this.activeLeaf?.view
    return view instanceof FileView ? view.file : null
  }
  getActiveViewOfType<T extends View>(type: abstract new (...args: never[]) => T): T | null {
    const view = this.activeLeaf?.view
    return view instanceof type ? view : null
  }
  /** Makes `leaf` the active one, as a click into its tab does. */
  setActiveLeaf(leaf: WorkspaceLeaf) {
    this.activeLeaf = leaf
  }
  /** The explorer's menu for `file`, as a right-click opens it. */
  fileMenu(file: TAbstractFile) {
    const menu = new Menu()
    this.trigger('file-menu', menu, file, 'file-explorer-context-menu')
    return menu
  }
  /** Obsidian quitting: every task added runs before it closes. */
  async quit() {
    const tasks: (() => Promise<unknown>)[] = []
    this.trigger('quit', { add: (task: () => Promise<unknown>) => tasks.push(task) })
    for (const task of tasks) await task()
  }
}

/**
 * Obsidian's secret storage (from 1.11.4): values by id, on the device, with
 * no delete. It records every call, so a test can hold that an older Obsidian
 * never reaches it; `failNext` makes the next write throw, as a full one does.
 */
export class SecretStorage {
  readonly secrets = new Map<string, string>()
  readonly calls: string[] = []
  failNext: Error | null = null
  setSecret(id: string, secret: string) {
    this.calls.push(`setSecret ${id}`)
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Invalid secret ID: ${id}`)
    const fail = this.failNext
    this.failNext = null
    if (fail) throw fail
    this.secrets.set(id, secret)
  }
  getSecret(id: string): string | null {
    this.calls.push(`getSecret ${id}`)
    return this.secrets.get(id) ?? null
  }
  listSecrets(): string[] {
    this.calls.push('listSecrets')
    return [...this.secrets.keys()]
  }
}

/** The Obsidian the fake stands for: a test sets an older one, and puts it back. */
export const obsidian = { apiVersion: '1.15.1' }

/** Obsidian's own: whether the app is at least `version`. */
export function requireApiVersion(version: string): boolean {
  const have = obsidian.apiVersion.split('.').map(Number)
  const need = version.split('.').map(Number)
  for (let part = 0; part < Math.max(have.length, need.length); part++) {
    const difference = (have[part] ?? 0) - (need[part] ?? 0)
    if (difference !== 0) return difference > 0
  }
  return true
}

export class App {
  readonly secretStorage = new SecretStorage()
  readonly vault: Vault
  readonly workspace: Workspace
  readonly fileManager = new FileManager()
  readonly views = new Map<string, ViewCreator>()
  readonly extensions = new Map<string, string>()
  constructor() {
    this.vault = new Vault(this)
    this.workspace = new Workspace(this)
  }
}

export class WorkspaceLeaf extends Events {
  view: View | null = null
  readonly containerEl: HTMLElement
  readonly app: App
  constructor(app: App) {
    super()
    this.app = app
    this.containerEl = window.document.createElement('div')
    this.containerEl.className = 'workspace-leaf'
  }
  /** Opens a file in the view registered for its extension, as Obsidian does. */
  async openFile(file: TFile) {
    const type = this.app.extensions.get(file.extension)
    const create = type && this.app.views.get(type)
    if (!create) throw new Error(`No view for .${file.extension}`)
    await this.detachView()
    const view = create(this)
    this.view = view
    this.app.workspace.activeLeaf = this
    this.containerEl.appendChild(view.containerEl)
    view.containerEl.dataset.type = view.getViewType()
    view.load()
    await view.onOpen()
    if (view instanceof FileView) await view.loadFile(new TFile(file.path))
  }
  async detachView() {
    const view = this.view
    if (!view) return
    this.view = null
    if (view instanceof FileView && view.file) await view.onUnloadFile(view.file)
    await view.onClose()
    view.unload()
    view.containerEl.remove()
  }
  async detach() {
    await this.detachView()
    this.containerEl.remove()
    const leaves = this.app.workspace.leaves
    leaves.splice(leaves.indexOf(this), 1)
    if (this.app.workspace.activeLeaf === this) this.app.workspace.activeLeaf = null
  }
}

export abstract class View extends Component {
  readonly app: App
  readonly leaf: WorkspaceLeaf
  readonly containerEl: HTMLElement
  readonly scope = new Scope()
  icon = ''
  navigation = true
  constructor(leaf: WorkspaceLeaf) {
    super()
    this.leaf = leaf
    this.app = leaf.app
    this.containerEl = window.document.createElement('div')
    this.containerEl.className = 'workspace-leaf-content'
  }
  abstract getViewType(): string
  getDisplayText() {
    return ''
  }
  onOpen(): Promise<void> {
    return Promise.resolve()
  }
  onClose(): Promise<void> {
    return Promise.resolve()
  }
}

export abstract class ItemView extends View {
  readonly contentEl: HTMLElement
  constructor(leaf: WorkspaceLeaf) {
    super(leaf)
    this.contentEl = this.containerEl.createDiv({ cls: 'view-content' })
  }
}

export abstract class FileView extends ItemView {
  file: TFile | null = null
  allowNoFile = false
  getDisplayText() {
    return this.file?.basename ?? ''
  }
  async loadFile(file: TFile) {
    if (this.file) await this.onUnloadFile(this.file)
    this.file = file
    await this.onLoadFile(file)
  }
  onLoadFile(_file: TFile): Promise<void> {
    return Promise.resolve()
  }
  onUnloadFile(_file: TFile): Promise<void> {
    return Promise.resolve()
  }
  onRename(_file: TFile): Promise<void> {
    return Promise.resolve()
  }
  canAcceptExtension(_extension: string) {
    return false
  }
}

export abstract class EditableFileView extends FileView {}

/**
 * Obsidian's documented behaviour: load reads the file and hands its text to
 * `setViewData(data, true)`; unload saves, then clears; `save` writes
 * `getViewData()` to the file; `requestSave` saves after 2 s. How the real one
 * reacts to its file changing on disk isn't documented, so the fake does
 * nothing there: the plugin's view listens to `modify` itself.
 */
export abstract class TextFileView extends EditableFileView {
  data = ''
  /** How many times a save was requested: the fake's record, not Obsidian's. */
  saveRequests = 0
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  requestSave = () => {
    this.saveRequests++
    if (this.saveTimer !== null) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      void this.save()
    }, 2000)
  }
  abstract getViewData(): string
  abstract setViewData(data: string, clear: boolean): void
  abstract clear(): void
  async onLoadFile(file: TFile) {
    const data = await this.app.vault.read(file)
    this.data = data
    this.setViewData(data, true)
  }
  async onUnloadFile(_file: TFile) {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer)
    this.saveTimer = null
    await this.save()
    this.clear()
  }
  async save(_clear?: boolean) {
    if (!this.file) return
    const data = this.getViewData()
    if (data === this.data) return
    this.data = data
    await this.app.vault.modify(this.file, data)
  }
}

// ---------------------------------------------------------------------------
// The plugin.

export interface PluginManifest {
  id: string
  name: string
  version: string
  minAppVersion: string
  description: string
  author: string
  isDesktopOnly?: boolean
}

export interface Command {
  id: string
  name: string
  callback?: () => unknown
  checkCallback?: (checking: boolean) => boolean | void
  hotkeys?: unknown[]
}

/** Whether the command palette offers `command` now, as Obsidian asks before listing it. */
export function isOffered(command: Command): boolean {
  if (command.checkCallback) return command.checkCallback(true) === true
  return !!command.callback
}

/** Runs `command` as a pick in the command palette does; false if it isn't offered. */
export function runCommand(command: Command): boolean {
  if (!isOffered(command)) return false
  if (command.checkCallback) command.checkCallback(false)
  else command.callback?.()
  return true
}

export class Plugin extends Component {
  readonly app: App
  readonly manifest: PluginManifest
  /** `data.json`, as `saveData` last wrote it. */
  dataJson: unknown = null
  readonly commands: Command[] = []
  readonly ribbon: { icon: string; title: string; click: (evt: MouseEvent) => unknown }[] = []
  constructor(app: App, manifest: PluginManifest) {
    super()
    this.app = app
    this.manifest = manifest
  }
  loadData(): Promise<unknown> {
    return Promise.resolve(this.dataJson)
  }
  saveData(data: unknown): Promise<void> {
    this.dataJson = JSON.parse(JSON.stringify(data))
    return Promise.resolve()
  }
  registerView(type: string, create: ViewCreator) {
    this.app.views.set(type, create)
  }
  registerExtensions(extensions: string[], type: string) {
    extensions.forEach((extension) => this.app.extensions.set(extension, type))
  }
  addCommand(command: Command) {
    this.commands.push(command)
    return command
  }
  addRibbonIcon(icon: string, title: string, click: (evt: MouseEvent) => unknown) {
    this.ribbon.push({ icon, title, click })
    return window.document.createElement('div')
  }
}
