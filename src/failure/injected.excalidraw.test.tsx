import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'
import { createMathAnchorElements } from '../canvas/mathAnchor.ts'
import { readSheet } from '../file/sheetFormat.ts'
import { UNEXPECTED_LINE as UNEXPECTED_CODE } from '../math/evaluate.ts'
import { english } from '../test/english.ts'
import { fakeFileAccess, fakeRecovery } from '../test/files.ts'
import { doubleClickLine } from '../test/gestures.ts'
import { undoControls } from '../test/excalidraw.ts'
import { linesOf, resultsOf } from '../test/sheetView.ts'
import { FAILURE_MESSAGES, REPORT_URL } from './details.ts'

/** The unexpected line's words, in English. */
const UNEXPECTED_LINE = english(UNEXPECTED_CODE)

/**
 * Injected failures (docs/spec-v1.md section 14, M4e; section 4, Unexpected
 * failures): a line (its parse included), an element, a chart, a panel tab and
 * the view are made to throw on purpose, against the real Excalidraw. Each
 * test checks what shows, that the rest keeps working, and what Copy details
 * holds; the view's also that the failed view writes nothing. The vault's half
 * is `plugin/test/failure.test.ts`, and when a boundary tries again is
 * `Boundary.test.tsx`.
 */

/** Switched by a test: the view (the overlay's own render) or the Symbols tab throws while set. */
const bomb = vi.hoisted(() => ({ view: false, tab: false }))

// A line that mentions `lineboom` throws outside its own handling.
vi.mock('../math/warnings.ts', async (original) => {
  const real = await original<typeof import('../math/warnings.ts')>()
  return {
    ...real,
    lineWarnings: (...args: Parameters<typeof real.lineWarnings>) => {
      if (args[0].toString().includes('lineboom')) throw new Error('injected: a line')
      return real.lineWarnings(...args)
    },
  }
})
// Text that mentions `parseboom` throws as its form is read: the engine's parse
// of the line, and the element's view once the line is open.
vi.mock('../math/lineForm.ts', async (original) => {
  const real = await original<typeof import('../math/lineForm.ts')>()
  return {
    ...real,
    readLine: (text: string) => {
      if (text.includes('parseboom')) throw new TypeError('injected: reading parseboom')
      return real.readLine(text)
    },
  }
})
// A typeset cell that mentions `elementboom` throws as its row is drawn.
vi.mock('../overlay/katex.ts', async (original) => {
  const real = await original<typeof import('../overlay/katex.ts')>()
  return {
    ...real,
    texToHtml: (tex: string) => {
      if (tex.includes('elementboom')) throw new RangeError('injected: an element')
      return real.texToHtml(tex)
    },
  }
})
// A chart titled `chartboom` throws as it is drawn.
vi.mock('../overlay/plotDrawing.ts', async (original) => {
  const real = await original<typeof import('../overlay/plotDrawing.ts')>()
  return {
    ...real,
    drawChart: (...args: Parameters<typeof real.drawChart>) => {
      if (args[1].title === 'chartboom') throw new Error('injected: a chart')
      return real.drawChart(...args)
    },
  }
})
vi.mock('../panel/SymbolsTab.tsx', async (original) => {
  const real = await original<typeof import('../panel/SymbolsTab.tsx')>()
  return {
    ...real,
    SymbolsTab: (props: Parameters<typeof real.SymbolsTab>[0]) => {
      if (bomb.tab) throw new Error('injected: a tab')
      return real.SymbolsTab(props)
    },
  }
})
// Outside every boundary: the overlay reads the order on each render.
vi.mock('../overlay/readingOrder.ts', async (original) => {
  const real = await original<typeof import('../overlay/readingOrder.ts')>()
  return {
    ...real,
    readingOrder: (...args: Parameters<typeof real.readingOrder>) => {
      if (bomb.view) throw new Error('injected: the view, at secret_flow')
      return real.readingOrder(...args)
    },
  }
})

const sheet = (inputs: string, result: string) =>
  createMathAnchorElements([
    { id: 'inputs', x: 100, y: 100, width: 420, height: 72, source: inputs },
    { id: 'result', x: 100, y: 300, width: 420, height: 48, source: result },
  ])

let copied: string[]
let errors: ReturnType<typeof vi.spyOn>
const clientWidth = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!

beforeEach(() => {
  // A wide window (jsdom's is 0 px): the Sheet panel docks, so it opens at launch.
  Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => 1440 })
  bomb.view = false
  bomb.tab = false
  copied = []
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text: string) => void copied.push(text) },
  })
  // React prints each caught failure.
  errors = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  Object.defineProperty(Element.prototype, 'clientWidth', clientWidth)
  errors.mockRestore()
})

async function renderApp(elements: ReturnType<typeof sheet>) {
  const files = fakeFileAccess()
  const recovery = fakeRecovery()
  render(<App files={files} recovery={recovery} initialElements={elements} />)
  await screen.findByTestId('file-name')
  await waitFor(() => expect(document.title).toBe('Untitled'))
  await screen.findAllByRole('list', { name: 'Lines' })
  return { files, recovery }
}

const element = (id: string) => document.querySelector<HTMLElement>(`[data-anchor-id="${id}"]`)!
const lineField = () => screen.queryByRole<HTMLTextAreaElement>('textbox', { name: 'Line source' })
const row = (id: string, n: number) => element(id).querySelector<HTMLElement>(`[data-line="${n - 1}"]`)!

/** Opens line `n` (1-based) and types over it, leaving it open. */
function typeLine(id: string, n: number, text: string) {
  doubleClickLine(id, n)
  const field = lineField()!
  fireEvent.input(field, { target: { value: text } })
  return field
}

/** Presses Copy details inside `scope` and returns what reached the clipboard. */
async function copyDetails(scope: HTMLElement) {
  fireEvent.click(within(scope).getByRole('button', { name: FAILURE_MESSAGES.copyDetails }))
  await waitFor(() => expect(copied).toHaveLength(1))
  return copied[0]
}

/** The details name the app and what failed, and end by saying what they leave out. */
function expectDetails(details: string, what: string, error: string) {
  const lines = details.split('\n')
  expect(lines[0]).toBe(`Excalimathpad ${__APP_VERSION__} (${__BUILD_STAMP__})`)
  expect(lines[1]).toBe('web')
  expect(lines[2]).toBe(`What failed: ${what}`)
  expect(lines[3]).toBe(error)
  // Its stack.
  expect(lines.length).toBeGreaterThan(5)
  expect(lines.at(-1)).toBe(FAILURE_MESSAGES.noContent)
}

const reportLink = (scope: HTMLElement) => within(scope).getByRole('link', { name: FAILURE_MESSAGES.report })

describe('a line that fails unexpectedly', () => {
  it('is that line’s error, shown as its source, and the lines below and the other elements go on', async () => {
    await renderApp(sheet('flow_rate = 2 m\ny = lineboom + 1\nflow_rate * 3\ny', 'flow_rate + 1 m'))

    const failed = row('inputs', 2)
    expect(failed.querySelector('.math-element__raw')).toHaveTextContent('y = lineboom + 1')
    expect(failed.querySelector('.math-element__result')).toHaveTextContent(UNEXPECTED_LINE)
    // The raw text of the failure is on hover, under those words.
    expect(failed.querySelector('.math-element__gutter')).toHaveAttribute('data-tip', `${UNEXPECTED_LINE}\nError: injected: a line`)
    expect(failed.querySelector('.math-element__result')).toHaveAttribute('data-tip', `${UNEXPECTED_LINE}\nError: injected: a line`)
    expect(failed.querySelector('.math-element__result')).not.toHaveAttribute('data-tip-when')
    expect(row('inputs', 3).querySelector('.math-element__result')).toHaveAttribute('data-text', '6 m')
    expect(row('inputs', 4).querySelector('.math-element__result')).toHaveTextContent('y has an error above')
    expect(resultsOf(element('result'))).toBe('3 m')
  })

  it('is the line’s error when its parse throws', async () => {
    await renderApp(sheet('flow_rate = 2 m\ny = parseboom + 1\nflow_rate * 3', 'y'))

    expect(row('inputs', 2).querySelector('.math-element__raw')).toHaveTextContent('y = parseboom + 1')
    expect(row('inputs', 2).querySelector('.math-element__gutter')).toHaveAttribute(
      'data-tip',
      `${UNEXPECTED_LINE}\nTypeError: injected: reading parseboom`,
    )
    expect(row('inputs', 3).querySelector('.math-element__result')).toHaveAttribute('data-text', '6 m')
    expect(element('result').querySelector('.math-element__result')).toHaveTextContent('y has an error above')
  })

  it('has its raw text, Copy details and Report this error on its row in the Problems tab', async () => {
    await renderApp(sheet('flow_rate = 2 m\ny = lineboom + 1', 'flow_rate + 1 m'))

    // The panel opens on Problems for a sheet with an error.
    const message = await screen.findByText(UNEXPECTED_LINE, { selector: '.sheet-panel__message' })
    const item = message.closest('li')!
    expect(within(item).getByText('Error: injected: a line')).toHaveClass('sheet-panel__raw')
    expect(reportLink(item)).toHaveAttribute('href', REPORT_URL)

    const details = await copyDetails(item)
    expectDetails(details, 'a line', 'Error: injected: a line')
    for (const text of ['flow_rate', 'lineboom', '2 m', '3 m']) expect(details).not.toContain(text)
  })
})

describe('a math element that fails unexpectedly', () => {
  it('shows its lines as plain text under the notice, and the rest keeps working', async () => {
    await renderApp(sheet('pipe_len = 2 m\npipe_len * 3', 'q = 2\nq * elementboom'))

    const failed = element('result')
    expect(failed).toHaveClass('is-failed')
    const notice = within(failed).getByRole('alert')
    expect(notice).toHaveTextContent(`●${FAILURE_MESSAGES.element}`)
    expect(notice).toHaveAttribute('data-tip', 'RangeError: injected: an element')
    expect(linesOf(failed)).toEqual(['q = 2', 'q * elementboom'])
    expect(reportLink(failed)).toHaveAttribute('href', REPORT_URL)

    // The other element, the canvas and the panel are as they were.
    expect(resultsOf(element('inputs'))).toBe('6 m')
    expect(document.querySelector('canvas.interactive')).not.toBeNull()
    expect(document.querySelector('.sheet-sidebar')).not.toBeNull()

    const details = await copyDetails(failed)
    expectDetails(details, 'an element', 'RangeError: injected: an element')
    for (const text of ['pipe_len', 'q * elementboom', '6 m']) expect(details).not.toContain(text)
  })

  it('can still be opened and edited, and is tried again when its lines change', async () => {
    await renderApp(sheet('pipe_len = 2 m', 'q = 2\nq * elementboom'))
    expect(element('result')).toHaveClass('is-failed')

    // Its rows still take the double-click.
    const field = typeLine('result', 2, 'q * 4')
    expect(element('result')).not.toHaveClass('is-failed')
    fireEvent.keyDown(field, { key: 'Escape' })

    expect(element('result')).not.toHaveClass('is-failed')
    expect(row('result', 2).querySelector('.math-element__result')).toHaveAttribute('data-text', '8')
    await waitFor(() => expect(document.title).toBe('● Untitled'))
  })

  it('keeps the open line as a plain field while its view fails, and typing on brings the view back', async () => {
    await renderApp(sheet('pipe_len = 2 m', 'q = 2'))

    // The view of an element reads the open line's form: `parseboom` throws there.
    typeLine('result', 1, 'q = parseboom')
    const failed = element('result')
    expect(failed).toHaveClass('is-failed')
    const plain = lineField()!
    expect(plain).toHaveClass('math-element__plain-field')
    expect(plain).toHaveValue('q = parseboom')
    expect(plain).toHaveFocus()
    expect(resultsOf(element('inputs'))).toBe('')

    fireEvent.input(plain, { target: { value: 'q = 5 m' } })
    expect(element('result')).not.toHaveClass('is-failed')
    expect(lineField()).toHaveClass('math-element__field')
    expect(lineField()).toHaveValue('q = 5 m')
    fireEvent.keyDown(lineField()!, { key: 'Escape' })
    expect(linesOf(element('result'))).toEqual(['q = 5 m'])
  })

  it('commits a line from the plain field with Enter, as one undo step', async () => {
    await renderApp(sheet('pipe_len = 2 m', 'q = 2'))
    typeLine('result', 1, 'q = parseboom')
    const plain = lineField()!
    plain.setSelectionRange(plain.value.length, plain.value.length)

    fireEvent.keyDown(plain, { key: 'Enter' })
    // The edit is on the new line, which the real view draws: the failed line is at rest.
    expect(linesOf(element('result'))).toEqual(['q = parseboom', ''])
    expect(lineField()).toHaveValue('')
    fireEvent.keyDown(lineField()!, { key: 'Escape' })
    expect(row('result', 1).querySelector('.math-element__result')).toHaveTextContent(UNEXPECTED_LINE)
  })
})

describe('a chart that fails to draw', () => {
  it('says so in its box, and its line and the other lines stay', async () => {
    await renderApp(sheet('w = 0 .. 4\nplot(w, w^2), title "chartboom"\nw[2] + 1', 'plot(w, w)'))

    const box = await waitFor(() => {
      const failed = element('inputs').querySelector<HTMLElement>('.math-element__plot.is-failed')
      expect(failed).not.toBeNull()
      return failed!
    })
    expect(box).toHaveTextContent(FAILURE_MESSAGES.chart)
    expect(box).toHaveAttribute('data-tip', 'Error: injected: a chart')
    // Its box keeps the chart's size.
    expect(box.style.width).not.toBe('')
    expect(box.style.height).not.toBe('')
    // Its line stays, the element isn't failed, and the next line still runs.
    expect(element('inputs')).not.toHaveClass('is-failed')
    expect(linesOf(element('inputs'))).toContain('plot(w, w^2), title "chartboom"')
    expect(row('inputs', 3).querySelector('.math-element__result')).toHaveAttribute('data-text', '2')
    // The other chart is drawn.
    await waitFor(() => expect(element('result').querySelector('.math-element__plot-chart svg')).not.toBeNull())
  })

  it('is tried again when its plot changes', async () => {
    await renderApp(sheet('w = 0 .. 4\nplot(w, w^2), title "chartboom"', 'w'))
    await waitFor(() => expect(element('inputs').querySelector('.math-element__plot.is-failed')).not.toBeNull())

    fireEvent.keyDown(typeLine('inputs', 2, 'plot(w, w^2), title "fine"'), { key: 'Escape' })

    await waitFor(() => expect(element('inputs').querySelector('.math-element__plot-chart svg')).not.toBeNull())
    expect(element('inputs').querySelector('.math-element__plot.is-failed')).toBeNull()
  })
})

describe('a panel tab that fails unexpectedly', () => {
  /** The Sheet panel as it is now: Excalidraw mounts it anew when it reopens. */
  const panel = () => document.querySelector<HTMLElement>('.sheet-sidebar')!
  const showTab = async (name: string) => {
    await waitFor(() => expect(panel()).not.toBeNull())
    fireEvent.mouseDown(within(panel()).getByTitle(name))
    fireEvent.click(within(panel()).getByTitle(name))
  }

  it('says so in the tab, and the other tabs and the sheet keep working', async () => {
    bomb.tab = true
    await renderApp(sheet('pipe_len = 2 m\npipe_len * 3', 'q = 2'))

    await showTab('Symbols')
    const notice = await screen.findByText(FAILURE_MESSAGES.tab)
    expect(panel()).toContainElement(notice)
    expect(notice).toHaveAttribute('title', 'Error: injected: a tab')

    // The sheet goes on, and so does another tab.
    expect(resultsOf(element('inputs'))).toBe('6 m')
    await showTab('Variables')
    expect(await screen.findByRole('button', { name: 'pipe_len: 2 m' })).toBeInTheDocument()
    expect(screen.queryByText(FAILURE_MESSAGES.tab)).toBeNull()
  })
})

describe('the view failing as a whole', () => {
  /** A line committed, another being typed, then the view throws on the next key. */
  async function failWhileTyping() {
    const ports = await renderApp(sheet('R = 10 kohm\nI = 2 mA', 'U = I * R'))
    fireEvent.keyDown(typeLine('inputs', 2, 'I = 4 mA'), { key: 'Escape' })
    await waitFor(() => expect(document.title).toBe('● Untitled'))
    const field = typeLine('result', 1, 'U = I * R * secret_flo')
    bomb.view = true
    act(() => {
      fireEvent.input(field, { target: { value: 'U = I * R * secret_flow' } })
    })
    return ports
  }

  it('shows the failure screen with the line being typed, in place of the view', async () => {
    await failWhileTyping()

    const screenBox = screen.getByRole('alert')
    expect(screenBox).toHaveTextContent(FAILURE_MESSAGES.view)
    expect(screenBox).toHaveTextContent(`${FAILURE_MESSAGES.kept} ${FAILURE_MESSAGES.typing}`)
    // The key that failed is in it.
    expect(screenBox.querySelector('code')).toHaveTextContent('U = I * R * secret_flow')
    expect(within(screenBox).getByRole('button', { name: FAILURE_MESSAGES.reload })).toBeInTheDocument()
    expect(reportLink(screenBox)).toHaveAttribute('href', REPORT_URL)
    expect(document.querySelector('.excalidraw')).toBeNull()

    // Copy, beside the line, copies the line.
    fireEvent.click(within(screenBox).getByRole('button', { name: FAILURE_MESSAGES.copy }))
    await waitFor(() => expect(copied).toEqual(['U = I * R * secret_flow']))
  })

  it('leaves out the line when none was open', async () => {
    await renderApp(sheet('R = 10 kohm', 'R'))
    const field = typeLine('inputs', 1, 'R = 20 kohm')
    bomb.view = true
    fireEvent.keyDown(field, { key: 'Escape' })

    const screenBox = screen.getByRole('alert')
    expect(screenBox).toHaveTextContent(FAILURE_MESSAGES.kept)
    expect(screenBox).not.toHaveTextContent(FAILURE_MESSAGES.typing)
    expect(within(screenBox).queryByRole('button', { name: FAILURE_MESSAGES.copy })).toBeNull()
  })

  it('writes no file, and keeps the sheet up to the last finished line as the recovery copy', async () => {
    const { files, recovery } = await failWhileTyping()
    await waitFor(() => expect(recovery.current()).not.toBeNull())

    const kept = readSheet(recovery.current()!.text)
    if (kept.kind !== 'sheet') throw new Error('the copy is not a sheet')
    const sources = (kept.scene.elements as { customData?: { source?: string } }[]).map(({ customData }) => customData?.source)
    // The committed line is in it; the line being typed isn't.
    expect(sources).toEqual(['R = 10 kohm\nI = 4 mA', 'U = I * R'])

    const written = recovery.write.mock.calls.length
    // Nothing writes after the failure: not the copy's timer, not the page going away.
    await act(() => new Promise((resolve) => setTimeout(resolve, 700)))
    window.dispatchEvent(new Event('pagehide'))
    window.dispatchEvent(new Event('beforeunload'))
    fireEvent.keyDown(window, { key: 's', code: 'KeyS', ctrlKey: true })
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(recovery.write.mock.calls).toHaveLength(written)
    expect(recovery.clear).not.toHaveBeenCalled()
    expect(files.save).not.toHaveBeenCalled()
    expect(files.saveAs).not.toHaveBeenCalled()
    expect(files.disk.size).toBe(0)
  })

  it('copies details that hold no sheet text', async () => {
    await failWhileTyping()

    const details = await copyDetails(screen.getByRole('alert'))
    // The error named a word of the sheet: it is cut out.
    expectDetails(details, 'the view', 'Error: injected: the view, at …')
    for (const text of ['secret_flow', 'kohm', 'I = 4 mA', 'U = I * R', '4 mA']) expect(details).not.toContain(text)
  })

  it('Reload the sheet mounts the kept sheet again as an open does: nothing asked, no undo step, still dirty', async () => {
    const { files } = await failWhileTyping()
    bomb.view = false

    fireEvent.click(screen.getByRole('button', { name: FAILURE_MESSAGES.reload }))

    await waitFor(() => expect(screen.getAllByRole('list', { name: 'Lines' })).toHaveLength(2))
    expect(screen.queryByRole('alert')).toBeNull()
    await waitFor(() => expect(linesOf(element('inputs'))).toEqual(['R = 10 kohm', 'I = 4 mA']))
    // The line that was being typed isn't put back.
    expect(linesOf(element('result'))).toEqual(['U = I * R'])
    expect(lineField()).toBeNull()
    expect(resultsOf(element('result'))).toBe('40 V')
    // Its changes are still unsaved, and no question was asked.
    await waitFor(() => expect(document.title).toBe('● Untitled'))
    expect(screen.queryByText(/Restore unsaved changes/)).toBeNull()
    expect(undoControls(document).canUndo()).toBe(false)

    // The reloaded sheet saves as any other.
    fireEvent.keyDown(window, { key: 's', code: 'KeyS', ctrlKey: true })
    await waitFor(() => expect(files.saveAs).toHaveBeenCalled())
  })

  it('shows the screen again if the reloaded sheet fails too, and still holds the kept sheet', async () => {
    await failWhileTyping()

    // Still failing: the reload fails before the sheet has loaded.
    fireEvent.click(screen.getByRole('button', { name: FAILURE_MESSAGES.reload }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(FAILURE_MESSAGES.view))

    bomb.view = false
    fireEvent.click(screen.getByRole('button', { name: FAILURE_MESSAGES.reload }))
    await waitFor(() => expect(screen.getAllByRole('list', { name: 'Lines' })).toHaveLength(2))
    await waitFor(() => expect(linesOf(element('inputs'))).toEqual(['R = 10 kohm', 'I = 4 mA']))
  })
})
