/**
 * A hand-written fake of the `obsidian` module (docs/spec-v1.md section 12a,
 * Tests): only the part the plugin uses, behaving as Obsidian's typings
 * describe it. Vitest aliases `obsidian` here (`vite.config.ts`), and
 * `scripts/blocked-run.mjs` bundles it for the browser, where the built
 * `main.js` gets it from `require('obsidian')`. So the jsdom tests and the
 * network-blocked run drive the plugin through the same fake.
 *
 * It records what a test asks about: the views and extensions registered, every
 * vault write, every notice, every `registerDomEvent`.
 */

type Callback = () => unknown

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
  })
}
installDomHelpers()

// ---------------------------------------------------------------------------
// Components and events.

export class Events {
  private handlers = new Map<string, Set<(...args: unknown[]) => unknown>>()
  on(name: string, callback: (...args: unknown[]) => unknown) {
    const set = this.handlers.get(name) ?? new Set()
    set.add(callback)
    this.handlers.set(name, set)
    return { name, callback }
  }
  off(name: string, callback: (...args: unknown[]) => unknown) {
    this.handlers.get(name)?.delete(callback)
  }
  trigger(name: string, ...args: unknown[]) {
    this.handlers.get(name)?.forEach((callback) => callback(...args))
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
  registerEvent(_ref: unknown) {}
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

export class Notice {
  constructor(message: string) {
    notices.push(message)
  }
  hide() {}
}

// ---------------------------------------------------------------------------
// Files.

export class TAbstractFile {
  path: string
  name: string
  constructor(path: string) {
    this.path = path
    this.name = path.split('/').pop() ?? path
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

export class Vault extends Events {
  readonly files = new Map<string, string>()
  /** Every write, in order. */
  readonly writes: { path: string; data: string }[] = []
  add(path: string, text: string) {
    this.files.set(path, text)
    return new TFile(path)
  }
  getAbstractFileByPath(path: string) {
    return this.files.has(path) ? new TFile(path) : null
  }
  read(file: TFile) {
    const text = this.files.get(file.path)
    return text === undefined ? Promise.reject(new Error(`No file ${file.path}`)) : Promise.resolve(text)
  }
  cachedRead(file: TFile) {
    return this.read(file)
  }
  modify(file: TFile, data: string) {
    this.writes.push({ path: file.path, data })
    this.files.set(file.path, data)
    return Promise.resolve()
  }
  process(file: TFile, fn: (data: string) => string) {
    return this.read(file).then(async (text) => {
      const data = fn(text)
      await this.modify(file, data)
      return data
    })
  }
}

// ---------------------------------------------------------------------------
// Views.

type ViewCreator = (leaf: WorkspaceLeaf) => View

export class Workspace extends Events {
  readonly leaves: WorkspaceLeaf[] = []
  readonly containerEl: HTMLElement
  private readonly app: App
  constructor(app: App) {
    super()
    this.app = app
    this.containerEl = window.document.createElement('div')
    this.containerEl.className = 'workspace'
    window.document.body.appendChild(this.containerEl)
  }
  getLeaf() {
    const leaf = new WorkspaceLeaf(this.app)
    this.leaves.push(leaf)
    this.containerEl.appendChild(leaf.containerEl)
    return leaf
  }
}

export class App {
  readonly vault = new Vault()
  readonly workspace: Workspace
  readonly views = new Map<string, ViewCreator>()
  readonly extensions = new Map<string, string>()
  constructor() {
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
    this.containerEl.appendChild(view.containerEl)
    view.containerEl.dataset.type = view.getViewType()
    view.load()
    await view.onOpen()
    if (view instanceof FileView) await view.loadFile(file)
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
 * `getViewData()` to the file; `requestSave` saves after 2 s.
 */
export abstract class TextFileView extends EditableFileView {
  data = ''
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  requestSave = () => {
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

export class Plugin extends Component {
  readonly app: App
  readonly manifest: PluginManifest
  /** `data.json`, as `saveData` last wrote it. */
  dataJson: unknown = null
  readonly commands: { id: string; name: string }[] = []
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
  addCommand(command: { id: string; name: string }) {
    this.commands.push(command)
    return command
  }
  addRibbonIcon() {
    return window.document.createElement('div')
  }
}
