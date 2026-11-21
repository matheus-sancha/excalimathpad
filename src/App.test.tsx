import { act, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, onTestFinished } from 'vitest'
import App from './App.tsx'
import { en } from './text/en.ts'
import { fakeFileAccess, fakeRecovery } from './test/files.ts'
import { clickOnCanvas, doubleClickLine, linePoint } from './test/gestures.ts'
import { createMathAnchorElements } from './canvas/mathAnchor.ts'
import { sampleSheet } from './test/sheets.ts'
import { linesOf, resultsOf } from './test/sheetView.ts'
import { undoControls } from './test/excalidraw.ts'

const renderApp = (props: Parameters<typeof App>[0] = {}) => {
  const files = fakeFileAccess()
  render(<App files={files} recovery={fakeRecovery()} {...props} />)
  return { files }
}

const mathElements = () => screen.queryAllByRole('list', { name: 'Lines' })
const lineField = () => screen.queryByRole<HTMLTextAreaElement>('textbox', { name: 'Line source' })

/** Opens Excalidraw's More tools, where Add math and Math settings are (section 8). */
async function openMoreTools() {
  if (!document.querySelector('.math-tools')) fireEvent.click(await screen.findByTitle('More tools'))
  await waitFor(() => expect(document.querySelector('.math-tools button')).not.toBeNull())
}
const addMath = async () => {
  await openMoreTools()
  return screen.getByRole('button', { name: /Add math/ })
}
/** More tools' button reads as selected while placing, the dropdown being closed. */
const placing = () => document.querySelector('[data-math-placing]') !== null

/** The app, loaded and holding its clean mark. */
async function ready() {
  await screen.findByTestId('file-name')
  await waitFor(() => expect(document.title).toBe('Untitled'))
}

/** The canvas's box is `width` px wide (jsdom's is 0): what the panel's docking is read from. */
function editorWidth(width: number) {
  const client = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!
  Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => width })
  onTestFinished(() => {
    Object.defineProperty(Element.prototype, 'clientWidth', client)
  })
}

/** A panel memory: last closed unless `open` says otherwise, at `width` if given; it lists what it is told. */
function fakePanelMemory({ open = false as boolean | null, width = null as number | null } = {}) {
  const remembered: boolean[] = []
  const widths: number[] = []
  return {
    remembered,
    widths,
    rememberedOpen: () => open,
    rememberOpen: (next: boolean) => void remembered.push(next),
    rememberedWidth: () => width,
    rememberWidth: (next: number) => void widths.push(next),
  }
}

describe('App', () => {
  it('mounts the Excalidraw editor as the sheet canvas', async () => {
    const { container } = render(<App files={fakeFileAccess()} recovery={fakeRecovery()} />)

    await waitFor(() => {
      expect(container.querySelector('.excalidraw')).toBeInTheDocument()
    })
    // The editor's own UI is up, not just an empty wrapper.
    expect(await screen.findAllByRole('radio')).not.toHaveLength(0)
  })

  it('evaluates a sheet across its elements', async () => {
    renderApp({ initialElements: sampleSheet() })

    const [inputs, result] = await screen.findAllByRole('list', { name: 'Lines' })
    expect(linesOf(inputs)).toEqual(['R = 10 kohm', 'I = 2 mA'])
    expect(linesOf(result)).toEqual(['U = I * R'])
    expect(resultsOf(result)).toBe('20 V')
  })

  describe('the untitled sheet (docs/spec-v1.md section 8)', () => {
    it('starts empty and clean', async () => {
      renderApp()

      expect(await screen.findByTestId('file-name')).toHaveTextContent(/^Untitled$/)
      await waitFor(() => expect(document.title).toBe('Untitled'))
      expect(mathElements()).toHaveLength(0)
    })

    it('shows the welcome screen, with the hint for Add math and Open…', async () => {
      const { files } = renderApp()
      await ready()

      expect(await screen.findByText(en.welcome.hint)).toBeInTheDocument()
      expect(screen.getByText('Excalimathpad')).toBeInTheDocument()
      // Excalidraw's own welcome items aren't there.
      expect(screen.queryByText(/Live collaboration/i)).toBeNull()

      fireEvent.click(screen.getByText('Open…'))
      await waitFor(() => expect(files.open).toHaveBeenCalled())
    })
  })

  describe('Add math (docs/spec-v1.md section 8)', () => {
    it('the item starts placing and closes More tools, and the click places an element ready to type in', async () => {
      renderApp()
      await ready()
      const item = await addMath()
      expect(item).toHaveAttribute('aria-pressed', 'false')
      expect(placing()).toBe(false)

      fireEvent.click(item)
      await waitFor(() => expect(document.querySelector('.math-tools')).toBeNull())
      expect(placing()).toBe(true)
      // The keyboard goes back to the canvas, so Esc and M reach it.
      expect(document.activeElement).toHaveClass('excalidraw')

      clickOnCanvas({ clientX: 300, clientY: 400 })

      expect(mathElements()).toHaveLength(1)
      expect(lineField()).toHaveFocus()
      expect(placing()).toBe(false)
      expect(screen.queryByText(en.welcome.hint)).toBeNull()
      await waitFor(() => expect(document.title).toBe('● Untitled'))
    })

    it('chosen again while placing, the item reads as pressed and keeps placing', async () => {
      renderApp()
      await ready()

      fireEvent.click(await addMath())
      await waitFor(() => expect(document.querySelector('.math-tools')).toBeNull())
      const again = await addMath()
      expect(again).toHaveAttribute('aria-pressed', 'true')
      fireEvent.click(again)

      expect(placing()).toBe(true)
    })

    it('M starts placing too, and Esc cancels with the sheet still clean', async () => {
      renderApp()
      await ready()
      await screen.findByTitle('More tools')
      const canvas = document.querySelector('.excalidraw')!

      act(() => {
        fireEvent.keyDown(canvas, { key: 'm' })
      })
      expect(placing()).toBe(true)

      act(() => {
        fireEvent.keyDown(canvas, { key: 'Escape' })
      })
      expect(placing()).toBe(false)
      expect(mathElements()).toHaveLength(0)
      expect(document.title).toBe('Untitled')
    })
  })

  describe('suggestions while typing (docs/spec-v1.md section 4)', () => {
    /** A new element with its first line open, the app loaded. */
    async function openLine() {
      renderApp()
      await ready()
      fireEvent.click(await addMath())
      clickOnCanvas({ clientX: 300, clientY: 400 })
      return lineField()!
    }
    const type = (text: string) => fireEvent.input(lineField()!, { target: { value: text } })
    const key = (name: string) => fireEvent.keyDown(lineField()!, { key: name })
    const options = () =>
      screen.queryAllByRole('option').map((option) => [
        option.querySelector('.math-suggest__name')!.textContent,
        option.querySelector('.math-suggest__detail')!.textContent,
      ])

    it('lists the names that start with the word, and Tab takes the first', async () => {
      await openLine()

      type('y = sq')
      expect(screen.getByRole('listbox', { name: 'Suggestions' })).toBeInTheDocument()
      expect(options()).toEqual([
        ['sqrt', 'square root'],
        ['SQRT2', 'Square root of 2 · 1.414'],
        ['SQRT1_2', 'Square root of ½ · 0.7071'],
      ])
      // Nothing is highlighted until ↓.
      expect(screen.queryByRole('option', { selected: true })).toBeNull()

      key('Tab')

      expect(lineField()).toHaveValue('y = sqrt(')
      expect(lineField()).toHaveFocus()
      expect(screen.queryByRole('listbox')).toBeNull()
    })

    it('↓ highlights and Enter takes the highlighted name, on the same line', async () => {
      await openLine()
      type('y = gra')

      key('ArrowDown')
      key('ArrowDown')
      expect(screen.getByRole('option', { selected: true })).toHaveTextContent('gravitationConstant')
      key('Enter')

      expect(lineField()).toHaveValue('y = gravitationConstant')
      expect(linesOf(screen.getByRole('list', { name: 'Lines' }))).toHaveLength(1)
    })

    it('Enter with nothing highlighted commits the line, as without a list', async () => {
      await openLine()
      type('y = gra')

      key('Enter')

      expect(screen.queryByRole('listbox')).toBeNull()
      expect(linesOf(screen.getByRole('list', { name: 'Lines' }))).toHaveLength(2)
      expect(lineField()).toHaveValue('')
    })

    it('the first Esc closes the list and keeps the line open', async () => {
      await openLine()
      type('y = gra')

      key('Escape')
      expect(screen.queryByRole('listbox')).toBeNull()
      expect(lineField()).toHaveValue('y = gra')

      key('Escape')
      expect(lineField()).toBeNull()
    })

    it('offers the sheet’s names from the lines above, with their values, and a click takes one', async () => {
      await openLine()
      type('speed = 3 m/s')
      expect(screen.queryByRole('listbox')).toBeNull()
      key('Enter')

      type('E = sp')
      expect(options()).toEqual([
        ['speed', '3 m / s'],
        ['speedOfLight', 'Speed of light in vacuum · 2.998·10⁵ km / s'],
      ])

      fireEvent.mouseDown(screen.getAllByRole('option')[0])

      expect(lineField()).toHaveValue('E = speed')
      expect(lineField()).toHaveFocus()
    })

    it('offers only units after in', async () => {
      await openLine()

      type('v = 2 m/s in k')

      expect(options().map(([name]) => name)).toEqual(['kg', 'kJ', 'km', 'kN', 'kV', 'kW', 'kgf', 'kHz'])
    })
  })

  describe('anchor style (docs/spec-v1.md section 4)', () => {
    // A hand-edited file, or one saved before the style was fixed.
    it('restores a changed style, and the sheet stays clean', async () => {
      const [changed, other] = sampleSheet()
      const { files } = renderApp({
        initialElements: [{ ...changed, strokeColor: '#e03131', backgroundColor: 'transparent' }, other],
      })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })
      expect(document.title).toBe('Untitled')

      act(() => {
        document
          .querySelector('.excalidraw')!
          .dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }))
      })
      await waitFor(() => expect(files.saveAs).toHaveBeenCalledOnce())

      const saved = files.disk.get('Untitled.excalimathpad')!
      expect(saved).not.toContain('#e03131')
      expect(saved).toContain('#ffffff01')
    })
  })

  // jsdom applies no stylesheet: the mark is pinned here, the text it shows in
  // the touch run (`scripts/touch-run.mjs`), in Chromium.
  describe('the hint for one math element (docs/spec-v1.md section 4, Touch)', () => {
    const onInputs = { clientX: 200, clientY: 130 }
    /** A press and release as a finger makes them; as on iOS, no click follows. */
    const tapOnCanvas = (point: { clientX: number; clientY: number }) => {
      const canvas = document.querySelector('canvas.interactive')!
      const event = { ...point, button: 0, pointerId: 2, pointerType: 'touch', isPrimary: true }
      act(() => {
        fireEvent.pointerDown(canvas, { ...event, buttons: 1 })
      })
      act(() => {
        fireEvent.pointerUp(canvas, event)
      })
    }
    const marked = () => document.querySelector<HTMLElement>('[data-math-selection="one"]')

    it('names the taps after a touch press, and the keys again after a mouse press', async () => {
      renderApp({ initialElements: sampleSheet() })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })

      clickOnCanvas(onInputs)
      await waitFor(() => expect(marked()).not.toBeNull())
      expect(marked()!.dataset.mathTouch).toBeUndefined()

      tapOnCanvas(onInputs)
      await waitFor(() => expect(marked()?.dataset.mathTouch).toBe(''))
      expect(marked()!.style.getPropertyValue('--math-hint-touch')).toBe(
        JSON.stringify('Double-tap a line, or tap Edit in Math settings'),
      )

      clickOnCanvas(onInputs)
      await waitFor(() => expect(marked()?.dataset.mathTouch).toBeUndefined())
      expect(marked()!.style.getPropertyValue('--math-hint')).toBe(
        JSON.stringify('Double-click a line or press Enter to edit'),
      )
    })
  })

  describe('Math settings (docs/spec-v1.md section 8)', () => {
    const sheetButton = async () => {
      await openMoreTools()
      return screen.getByRole('button', { name: /^Math settings/ })
    }
    const warningSheet = () =>
      createMathAnchorElements([{ id: 'm1', x: 100, y: 100, width: 300, height: 48, source: 'K = 5.4\ny = 2' }])
    const problemSheet = () =>
      createMathAnchorElements([
        { id: 'm1', x: 100, y: 100, width: 300, height: 72, source: 'K = 5.4\nx = 1 m + 1 s', title: 'Pipe flow' },
      ])

    it('has six icon tabs in order, each named, the active one labelled, the badge on Problems (M4d)', async () => {
      renderApp({ initialElements: problemSheet() })
      await ready()
      fireEvent.click(await sheetButton())

      const tabs = await screen.findAllByRole('tab')
      expect(tabs.map((tab) => tab.textContent?.replace(/\d+$/, ''))).toEqual([
        'Format',
        'Symbols',
        'Variables',
        'Problems',
        'Constants',
        'Settings',
      ])
      expect(tabs.map((tab) => tab.title)).toEqual(['Format', 'Symbols', 'Variables', 'Problems', 'Constants', 'Settings'])
      for (const tab of tabs) expect(tab.querySelector('svg')).not.toBeNull()
      // Each tab is named by its label, read on every tab, shown on the active one only.
      expect(screen.getByRole('tab', { name: 'Problems' })).toBe(tabs[3])
      expect(tabs.filter((tab) => tab.dataset.state === 'active')).toHaveLength(1)
      expect(tabs[3].querySelector('.sheet-tab__badge')).toHaveTextContent('1')
      expect(tabs[2].querySelector('.sheet-tab__badge')).toBeNull()
    })

    it('the item and the More tools button carry a red badge counting errors only (M4d)', async () => {
      // One warning (K) and one error.
      renderApp({ initialElements: problemSheet() })
      await ready()

      // With More tools closed, its button shows the count.
      await waitFor(() => expect(document.querySelector('[data-math-problems]')).not.toBeNull())
      const root = document.querySelector<HTMLElement>('[data-math-problems]')!
      expect(root.style.getPropertyValue('--math-problems')).toBe('"1"')

      expect(await sheetButton()).toHaveTextContent('Math settings1')
      expect(screen.getByLabelText('1 error')).toBeInTheDocument()
    })

    it('shows no badge for a sheet with warnings alone, and its Problems tab still lists them (M4d)', async () => {
      renderApp({ initialElements: warningSheet() })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })

      expect(await sheetButton()).toHaveTextContent(/^Math settings$/)
      expect(document.querySelector('[data-math-problems]')).toBeNull()

      fireEvent.click(await sheetButton())
      fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Problems' }))
      expect(await screen.findByText('K shadows the unit K')).toBeInTheDocument()
    })

    // Section 8, An edit opens the panel on Format (M4d). jsdom's canvas has no
    // width, so the panel floats there: a press on the canvas or Esc would close
    // it as Excalidraw closes a floating panel. These open the line by keyboard
    // (select all, then Enter on the one element) and leave it by its blur.
    describe('an edit opens the panel on Format, and its end restores it', () => {
      const panel = () => document.querySelector('.sheet-sidebar')
      const selected = () => screen.getByRole('tab', { selected: true }).textContent?.replace(/\d+$/, '')
      const editLine = async () => {
        const excalidraw = document.querySelector<HTMLElement>('.excalidraw')!
        fireEvent.keyDown(excalidraw, { key: 'a', code: 'KeyA', ctrlKey: true })
        await waitFor(() => expect(document.querySelector('[data-math-selection]')).not.toBeNull())
        fireEvent.keyDown(excalidraw, { key: 'Enter', code: 'Enter' })
        await waitFor(() => expect(lineField()).not.toBeNull())
      }
      const leave = () => act(() => lineField()!.blur())
      // From M4e an edit opens the panel only where it docks: the editor is 1440 px
      // wide, and the panel was last closed, so the launch leaves it closed.
      const start = async (width = 1440, panelMemory = fakePanelMemory()) => {
        editorWidth(width)
        renderApp({ initialElements: problemSheet(), panelMemory })
        await ready()
        await screen.findAllByRole('list', { name: 'Lines' })
      }

      it('opens a closed panel on Format, and closes it when the edit ends', async () => {
        await start()
        expect(panel()).toBeNull()

        await editLine()
        await waitFor(() => expect(panel()).not.toBeNull())
        expect(selected()).toBe('Format')
        leave()

        await waitFor(() => expect(panel()).toBeNull())
        expect(lineField()).toBeNull()
      })

      it('keeps a tab picked during the edit, the line open, then restores the tab it had', async () => {
        await start()
        fireEvent.click(await sheetButton())
        fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Constants' }))
        await waitFor(() => expect(selected()).toBe('Constants'))

        await editLine()
        await waitFor(() => expect(selected()).toBe('Format'))
        // A press in the panel isn't the canvas's: the line stays open (section 14).
        const problems = screen.getByRole('tab', { name: 'Problems' })
        fireEvent.pointerDown(problems)
        fireEvent.mouseDown(problems)
        fireEvent.click(problems)
        await waitFor(() => expect(selected()).toBe('Problems'))
        expect(lineField()).not.toBeNull()
        // Back in the line: a key there means the edit no longer ends from the panel.
        fireEvent.keyDown(lineField()!, { key: 'Shift' })
        leave()

        await waitFor(() => expect(selected()).toBe('Constants'))
      })

      it('stays as it is when the edit ends from a press in the panel, its filter or a row (found in Chromium, #143)', async () => {
        await start()
        await editLine()
        await waitFor(() => expect(selected()).toBe('Format'))
        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Variables' }))
        const filter = await screen.findByRole('searchbox', { name: 'Filter names' })

        fireEvent.pointerDown(filter)
        act(() => filter.focus())

        await waitFor(() => expect(lineField()).toBeNull())
        expect(selected()).toBe('Variables')
        expect(filter).toHaveFocus()
      })

      it('a Format tab press keeps the line open as one undo step; Done leaves it, and Edit opens it again (#144)', async () => {
        await start()
        await editLine()
        await waitFor(() => expect(selected()).toBe('Format'))
        const inPanel = (name: string) => within(panel() as HTMLElement).getByRole('button', { name })
        const press = (button: HTMLElement) => {
          fireEvent.pointerDown(button)
          const down = createEvent.mouseDown(button)
          fireEvent(button, down)
          fireEvent.click(button)
          return down
        }
        const row = () => document.querySelector('[data-anchor-id="m1"] [data-line="1"]')

        // From M4e the press writes the line's stored format: its text is left alone.
        const opened = lineField()
        expect(press(inPanel('Bold (Ctrl+B)')).defaultPrevented).toBe(true)
        await waitFor(() => expect(inPanel('Bold (Ctrl+B)')).toHaveAttribute('aria-pressed', 'true'))
        expect(lineField()).toBe(opened)
        expect(lineField()).toHaveValue('x = 1 m + 1 s')
        expect(lineField()).toHaveFocus()

        press(inPanel('Done (Esc)'))
        await waitFor(() => expect(lineField()).toBeNull())
        expect(row()).toHaveClass('is-bold')
        // The edit ended from the panel, so it stays on Format, with Edit for the selected element.
        expect(selected()).toBe('Format')
        press(inPanel('Edit (Enter)'))
        await waitFor(() => expect(lineField()).toHaveValue('x = 1 m + 1 s'))
        expect(inPanel('Bold (Ctrl+B)')).toHaveAttribute('aria-pressed', 'true')
        press(inPanel('Done (Esc)'))
        await waitFor(() => expect(lineField()).toBeNull())

        undoControls(document.body).undo()
        await waitFor(() => expect(row()).not.toHaveClass('is-bold'))
      })

      // Section 4, Rules list (M4e, #197): the condition's field is the one typed
      // field in the panel that doesn't leave the line.
      it('a rule’s condition is typed in the Rules list with the line still open, and each save is one undo step (#197)', async () => {
        await start()
        await editLine()
        await waitFor(() => expect(selected()).toBe('Format'))
        const inPanel = (name: string) => within(panel() as HTMLElement).getByRole('button', { name })
        const press = (button: HTMLElement) => {
          fireEvent.pointerDown(button)
          const down = createEvent.mouseDown(button)
          fireEvent(button, down)
          fireEvent.click(button)
          return down
        }
        const row = () => document.querySelector('[data-anchor-id="m1"] [data-line="1"]')
        const condition = () => within(panel() as HTMLElement).findByRole<HTMLInputElement>('textbox', { name: 'Condition of rule 1' })
        const opened = lineField()!
        fireEvent.input(opened, { target: { value: 'x = 4 m' } })
        opened.setSelectionRange(3, 3)

        // + Add rule: the row's field takes the keyboard, and the line is still open, untouched.
        expect(press(inPanel('+ Add rule')).defaultPrevented).toBe(true)
        const field = await condition()
        await waitFor(() => expect(field).toHaveFocus())
        expect(field).toHaveValue('x ')
        expect(lineField()).toBe(opened)
        expect(opened).toHaveValue('x = 4 m')
        expect(opened.selectionStart).toBe(3)

        // Its keys never reach Excalidraw: S would open the stroke colour picker.
        fireEvent.pointerDown(field)
        fireEvent.keyDown(field, { key: 's', code: 'KeyS' })
        expect(document.querySelector('.color-picker-content')).toBeNull()

        // The live state follows the field; Enter saves, and the line stays open.
        fireEvent.change(field, { target: { value: 'x > 3 m' } })
        await waitFor(() => expect(within(panel() as HTMLElement).getByText('true')).toBeInTheDocument())
        fireEvent.keyDown(field, { key: 'Enter', code: 'Enter' })
        expect(field).toHaveFocus()
        expect(lineField()).toBe(opened)
        expect(selected()).toBe('Format')

        // Back in the line, the edit continues in the same field.
        act(() => opened.focus())
        expect(lineField()).toBe(opened)
        expect(opened).toHaveValue('x = 4 m')
        press(inPanel('Done (Esc)'))
        await waitFor(() => expect(lineField()).toBeNull())
        expect(row()).toHaveClass('is-text-red')

        // One undo takes the condition back, to what + Add rule wrote; the next takes the rule.
        undoControls(document.body).undo()
        await waitFor(() => expect(row()).not.toHaveClass('is-text-red'))
        press(inPanel('Edit (Enter)'))
        await waitFor(() => expect(lineField()).toHaveValue('x = 4 m'))
        expect(await condition()).toHaveValue('x')
        press(inPanel('Done (Esc)'))
        await waitFor(() => expect(lineField()).toBeNull())
        undoControls(document.body).undo()
        press(inPanel('Edit (Enter)'))
        await waitFor(() => expect(lineField()).toHaveValue('x = 1 m + 1 s'))
        expect(within(panel() as HTMLElement).queryByRole('textbox', { name: 'Condition of rule 1' })).toBeNull()
      })

      it('the Symbols and Constants tabs insert at the caret; with nothing open, the selected element’s last line opens (#146)', async () => {
        await start()
        fireEvent.click(await sheetButton())
        fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Symbols' }))
        const inPanel = (name: string) => within(panel() as HTMLElement).getAllByRole('button', { name })[0]
        const press = (button: HTMLElement) => {
          fireEvent.pointerDown(button)
          const down = createEvent.mouseDown(button)
          fireEvent(button, down)
          fireEvent.click(button)
          return down
        }

        // Nothing open or selected: dimmed under the hint, the hover still the spelling.
        expect(await screen.findByText('Open a line to insert')).toBeInTheDocument()
        const rho = inPanel('rho')
        expect(rho).toHaveAttribute('aria-disabled', 'true')
        expect(rho).toHaveAttribute('title', 'rho — type _ for a subscript: rho_w')
        press(rho)
        expect(lineField()).toBeNull()
        expect(within(panel() as HTMLElement).getByRole('region', { name: 'Sheet forms' })).toBeInTheDocument()

        // A line open: a press keeps it, and types at its caret.
        await editLine()
        await waitFor(() => expect(selected()).toBe('Format'))
        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Symbols' }))
        await waitFor(() => expect(selected()).toBe('Symbols'))
        expect(screen.queryByText('Open a line to insert')).toBeNull()
        expect(press(inPanel('rho')).defaultPrevented).toBe(true)
        await waitFor(() => expect(lineField()).toHaveValue('x = 1 m + 1 s rho'))
        expect(lineField()).toHaveFocus()
        leave()
        await waitFor(() => expect(lineField()).toBeNull())

        // The one element still selected: √ opens its last line and inserts at its end.
        await waitFor(() => expect(selected()).toBe('Symbols'))
        press(inPanel('sqrt'))
        await waitFor(() => expect(lineField()).toHaveValue('x = 1 m + 1 s rho sqrt()'))
        expect(lineField()!.selectionStart).toBe(23)

        // A Constants row inserts its short name by the same rules, its hover "Insert c".
        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Constants' }))
        const light = await screen.findByLabelText(/^Speed of light in vacuum/)
        expect(light).toHaveAttribute('title', 'Insert c')
        press(light)
        await waitFor(() => expect(lineField()).toHaveValue('x = 1 m + 1 s rho sqrt(c)'))

        // The filter matches the spelling, the letter's name and the hint.
        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Symbols' }))
        fireEvent.change(await screen.findByRole('searchbox', { name: 'Filter symbols' }), { target: { value: 'root' } })
        expect(within(panel() as HTMLElement).getAllByRole('button', { name: /^(sqrt|cbrt|nthRoot)$/ })).toHaveLength(3)
        expect(within(panel() as HTMLElement).queryByRole('region', { name: 'Greek' })).toBeNull()
      })

      it('stays closed when closed during the edit, until the next edit', async () => {
        await start()
        await editLine()
        await waitFor(() => expect(panel()).not.toBeNull())
        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
        await waitFor(() => expect(panel()).toBeNull())
        leave()
        await waitFor(() => expect(lineField()).toBeNull())
        expect(panel()).toBeNull()

        await editLine()
        await waitFor(() => expect(selected()).toBe('Format'))
      })

      it('never remembers the automatic open or restore as the user’s choice', async () => {
        const panelMemory = fakePanelMemory()
        await start(1440, panelMemory)

        await editLine()
        await waitFor(() => expect(panel()).not.toBeNull())
        leave()
        await waitFor(() => expect(panel()).toBeNull())
        expect(panelMemory.remembered).toEqual([])
        // The user's own choice still is.
        fireEvent.click(await sheetButton())
        await waitFor(() => expect(panelMemory.remembered).toEqual([true]))
      })

      // Section 8, M4e (#198): 640 px plus the panel's width, 960 px at the default.
      it('opens nothing on an editor too narrow to dock, and switches a panel that is open to Format', async () => {
        const panelMemory = fakePanelMemory()
        await start(960, panelMemory)

        await editLine()
        // The Format tab's state follows the edit a render later: by then the panel would be up.
        await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
        expect(panel()).toBeNull()
        leave()
        await waitFor(() => expect(lineField()).toBeNull())
        expect(panel()).toBeNull()

        // Opened from Math settings, it is the user's: an edit switches it to Format and back.
        fireEvent.click(await sheetButton())
        await waitFor(() => expect(selected()).toBe('Variables'))
        await editLine()
        await waitFor(() => expect(selected()).toBe('Format'))
        leave()
        await waitFor(() => expect(selected()).toBe('Variables'))
        // A floating panel's open state is never remembered.
        expect(panelMemory.remembered).toEqual([])
      })

      it('opens it one px wider, where the panel docks', async () => {
        await start(961)
        await editLine()
        await waitFor(() => expect(selected()).toBe('Format'))
      })

      it('docks by the panel’s own width: at 480 px an editor of 1120 px is too narrow', async () => {
        await start(1120, fakePanelMemory({ width: 480 }))
        await editLine()
        await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
        expect(panel()).toBeNull()
      })
    })

    describe('the panel’s width (section 8, M4e, #198)', () => {
      const widthOf = () => document.querySelector<HTMLElement>('.excalidraw')!.parentElement!.style.getPropertyValue('--sheet-panel-width')
      const handle = () => screen.getByRole('separator', { name: 'Resize the panel' })
      const open = async (panelMemory = fakePanelMemory()) => {
        renderApp({ initialElements: sampleSheet(), panelMemory })
        await ready()
        await screen.findAllByRole('list', { name: 'Lines' })
        fireEvent.click(await sheetButton())
        await waitFor(() => expect(document.querySelector('.sheet-sidebar')).not.toBeNull())
        return panelMemory
      }

      it('is 320 px until one is remembered, between 280 and 480 px', async () => {
        await open()
        expect(widthOf()).toBe('320px')
        expect(handle()).toHaveAttribute('aria-valuenow', '320')
        expect(handle()).toHaveAttribute('aria-valuemin', '280')
        expect(handle()).toHaveAttribute('aria-valuemax', '480')
      })

      it('opens at the remembered width', async () => {
        await open(fakePanelMemory({ width: 400 }))
        expect(widthOf()).toBe('400px')
      })

      it('keeps a remembered width in range', async () => {
        await open(fakePanelMemory({ width: 2000 }))
        expect(widthOf()).toBe('480px')
      })

      it('← and → move the focused handle 16 px and Home puts 320 px back, each remembered', async () => {
        const memory = await open()
        const key = (name: string) => {
          const down = createEvent.keyDown(handle(), { key: name, code: name })
          fireEvent(handle(), down)
          return down
        }
        expect(handle()).toHaveAttribute('tabindex', '0')

        expect(key('ArrowLeft').defaultPrevented).toBe(true)
        expect(widthOf()).toBe('336px')
        key('ArrowRight')
        key('ArrowRight')
        expect(widthOf()).toBe('304px')
        key('ArrowRight')
        key('ArrowRight')
        // 280 px is the least.
        expect(widthOf()).toBe('280px')
        key('Home')
        expect(widthOf()).toBe('320px')
        expect(memory.widths).toEqual([336, 320, 304, 288, 280, 320])
      })

      it('a drag moves the width with the pointer, remembered once at the release; a double-click puts 320 px back', async () => {
        const memory = await open()
        fireEvent.pointerDown(handle(), { pointerId: 1, button: 0, clientX: 1000 })
        fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 960 })
        expect(widthOf()).toBe('360px')
        fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 500 })
        expect(widthOf()).toBe('480px')
        fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 950 })
        expect(memory.widths).toEqual([])
        fireEvent.pointerUp(handle(), { pointerId: 1, clientX: 950 })
        expect(widthOf()).toBe('370px')
        expect(memory.widths).toEqual([370])
        // A move with no press is no drag.
        fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 100 })
        expect(widthOf()).toBe('370px')

        fireEvent.doubleClick(handle())
        expect(widthOf()).toBe('320px')
        expect(memory.widths).toEqual([370, 320])
        expect(document.title).toBe('Untitled')
      })

      it('shows the tabs as icons, the shown tab’s name a heading over its content', async () => {
        await open()
        expect(screen.getByRole('heading', { name: 'Variables' })).toBeInTheDocument()
        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Settings' }))
        expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Variables' })).toBeNull()
        // Each tab keeps its name as its tooltip and its accessible name.
        expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('title'))).toEqual(['Format', 'Symbols', 'Variables', 'Problems', 'Constants', 'Settings'])
      })
    })

    describe('at launch on a wide window', () => {
      /** The canvas's box is 1440 px wide: the panel docks, so it opens at launch. */
      const wideWindow = () => editorWidth(1440)
      const selectedTab = async () => {
        await waitFor(() => expect(document.querySelector('.sheet-sidebar')).not.toBeNull())
        return screen.getByRole('tab', { selected: true })
      }

      it('opens the panel on Problems for an error', async () => {
        wideWindow()
        renderApp({ initialElements: problemSheet() })
        await ready()

        expect(await selectedTab()).toHaveTextContent('Problems')
      })

      it('opens it on Variables for a sheet with warnings alone (M4d)', async () => {
        wideWindow()
        renderApp({ initialElements: warningSheet() })
        await ready()

        expect(await selectedTab()).toHaveTextContent('Variables')
      })

      // Section 8, M4e (#198): the launch follows the docking width, 960 px at the default.
      it('opens it from 961 px, where the panel docks, and not at 960 px', async () => {
        editorWidth(961)
        renderApp({ initialElements: warningSheet() })
        await ready()
        expect(await selectedTab()).toHaveTextContent('Variables')
      })

      it('stays closed at 960 px', async () => {
        editorWidth(960)
        renderApp({ initialElements: warningSheet() })
        await ready()
        await screen.findAllByRole('list', { name: 'Lines' })
        await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
        expect(document.querySelector('.sheet-sidebar')).toBeNull()
      })
    })

    it('keeps the item clear of Excalidraw’s square-button style, which hid its label, and still a sidebar trigger (#102)', async () => {
      renderApp({ initialElements: problemSheet() })
      await ready()

      const item = await sheetButton()
      // Excalidraw's `.excalidraw .sidebar-trigger` sets `line-height: 0` and a fixed button look;
      // on the item it collapsed the label to no height (seen in Chromium).
      expect(item.matches('.excalidraw .sidebar-trigger')).toBe(false)
      expect(item.querySelector('.dropdown-menu-item__text')).toHaveTextContent('Math settings1')
      // A floating panel's outside click finds it through `closest`, so it doesn't close and reopen.
      expect(item.querySelector('.dropdown-menu-item__text')!.closest('.sidebar-trigger')).not.toBeNull()
    })

    it('has no badge while the sheet has no problems', async () => {
      renderApp({ initialElements: sampleSheet() })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })

      expect(await sheetButton()).toHaveTextContent(/^Math settings$/)
      expect(document.querySelector('[data-math-problems]')).toBeNull()
    })

    it('the item reads as pressed while the panel is open, and choosing it closes the panel and More tools', async () => {
      renderApp({ initialElements: sampleSheet() })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })

      fireEvent.click(await sheetButton())
      await waitFor(() => expect(document.querySelector('.math-tools')).toBeNull())
      expect(document.querySelector('.sheet-sidebar')).not.toBeNull()

      const item = await sheetButton()
      expect(item).toHaveAttribute('aria-pressed', 'true')
      fireEvent.click(item)
      await waitFor(() => expect(document.querySelector('.sheet-sidebar')).toBeNull())
      expect(document.querySelector('.math-tools')).toBeNull()
    })

    it('Constants lists the built-in constants with their values, and filters by name or description', async () => {
      renderApp({ initialElements: sampleSheet() })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })
      fireEvent.click(await sheetButton())

      // Radix's tabs switch on mouse down.
      fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Constants' }))

      expect(await screen.findByLabelText('Speed of light in vacuum: c or speedOfLight = 2.998·10⁵ km / s')).toBeInTheDocument()
      expect(screen.getByLabelText('Standard acceleration of gravity: gravity = 9.807 m / s^2')).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Mathematical' })).toBeInTheDocument()

      fireEvent.change(screen.getByRole('searchbox', { name: 'Filter constants' }), { target: { value: 'boltz' } })
      const rows = Array.from(document.querySelectorAll('.sheet-panel__constant'), (row) => row.getAttribute('aria-label'))
      expect(rows).toEqual([
        'Boltzmann constant: k or boltzmann = 1.381·10⁻²³ (kg m^2) / (s^2 K)',
        'Stefan–Boltzmann constant: sigma or stefanBoltzmann = 5.67·10⁻⁸ kg / (s^3 K^4)',
      ])

      fireEvent.change(screen.getByRole('searchbox', { name: 'Filter constants' }), { target: { value: 'zzz' } })
      expect(screen.getByText('No constant matches.')).toBeInTheDocument()
    })

    // Excalidraw runs its letter shortcuts on a key from any field it doesn't
    // count as writable, and only `text`, `number` and `password` inputs are.
    it.each([
      ['Variables', 'Filter names'],
      ['Constants', 'Filter constants'],
    ])("the %s filter keeps its keys from Excalidraw's shortcuts (#99)", async (tab, label) => {
      renderApp({ initialElements: sampleSheet() })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })
      fireEvent.click(await sheetButton())
      fireEvent.mouseDown(await screen.findByRole('tab', { name: tab }))
      const filter = await screen.findByRole<HTMLInputElement>('searchbox', { name: label })
      filter.focus()

      // S opens Excalidraw's stroke colour picker, which takes the keyboard;
      // Space is its pan key, which it stops from typing.
      fireEvent.keyDown(filter, { key: 's', code: 'KeyS' })
      const space = fireEvent.keyDown(filter, { key: ' ', code: 'Space' })

      expect(space).toBe(true)
      expect(document.querySelector('.color-picker-content')).toBeNull()
      expect(filter).toHaveFocus()
    })

    // Section 8, A press in the panel never leaves the line (M4d): a focused
    // control passes no key to Excalidraw, which counts a <select> as no field.
    it('keeps Delete on a focused Settings select from deleting the selection (the defect #117 found)', async () => {
      renderApp({ initialElements: sampleSheet() })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })
      fireEvent.click(await sheetButton())
      fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Settings' }))
      const excalidraw = document.querySelector<HTMLElement>('.excalidraw')!
      fireEvent.keyDown(excalidraw, { key: 'a', code: 'KeyA', ctrlKey: true })
      await waitFor(() => expect(document.querySelector('[data-math-selection]')).not.toBeNull())
      const select = screen.getAllByRole('combobox')[0]
      select.focus()

      fireEvent.keyDown(select, { key: 'Delete', code: 'Delete' })
      fireEvent.keyDown(select, { key: 'r', code: 'KeyR' })

      expect(mathElements()).toHaveLength(2)
      expect(document.querySelector('[data-testid="toolbar-rectangle"]')).not.toBeChecked()
      // The control: the same key on the canvas deletes the selected math.
      fireEvent.keyDown(excalidraw, { key: 'Delete', code: 'Delete' })
      await waitFor(() => expect(mathElements()).toHaveLength(0))
    })

    it('opens on Variables: names in reading order, by element, values in the system', async () => {
      renderApp({ initialElements: sampleSheet() })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })

      fireEvent.click(await sheetButton())

      expect(await screen.findByRole('button', { name: 'R: 10 kohm' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'I: 2 mA' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'U: 20 V' })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Element 1' })).toBeInTheDocument()
      expect(document.title).toBe('Untitled')
    })

    it('lists problems with where they are, and a click jumps: selects the element and flashes the line', async () => {
      renderApp({ initialElements: problemSheet() })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })

      fireEvent.click(await sheetButton())
      // Radix's tabs switch on mouse down.
      fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Problems' }))
      const problem = await screen.findByText('Units do not match', { selector: '.sheet-panel__message' })
      expect(screen.getByText('Pipe flow, line 2 · x')).toBeInTheDocument()
      expect(screen.getByText('K shadows the unit K')).toBeInTheDocument()

      fireEvent.click(problem)

      const row = document.querySelector('[data-anchor-id="m1"] [data-line="1"]')!
      await waitFor(() => expect(row).toHaveClass('is-flash'))
      // The jump selects the element, adds no undo step and leaves the sheet clean.
      expect(document.title).toBe('Untitled')
      // The next click clears the flash.
      fireEvent.pointerDown(window)
      await waitFor(() =>
        expect(document.querySelector('[data-anchor-id="m1"] [data-line="1"]')).not.toHaveClass('is-flash'),
      )
    })

    it('a jump from a ⚠ row shows that line’s ⚠ while it flashes, then hides it; nothing opens (M4d)', async () => {
      renderApp({ initialElements: problemSheet() })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })
      const gutter = () => document.querySelector('[data-anchor-id="m1"] [data-line="0"] .math-element__gutter')!
      // At rest the warning's ⚠ is hidden; the error's ● shows.
      expect(gutter()).toHaveTextContent('')
      expect(document.querySelector('[data-anchor-id="m1"] [data-line="1"] .math-element__gutter')).toHaveTextContent('●')

      fireEvent.click(await sheetButton())
      fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Problems' }))
      fireEvent.click(await screen.findByText('K shadows the unit K', { selector: '.sheet-panel__message' }))

      await waitFor(() => expect(document.querySelector('[data-anchor-id="m1"] [data-line="0"]')).toHaveClass('is-flash'))
      expect(gutter()).toHaveTextContent('⚠')
      expect(gutter()).toHaveAttribute('data-tip', 'K shadows the unit K')
      expect(lineField()).toBeNull()

      fireEvent.pointerDown(window)
      await waitFor(() => expect(gutter()).toHaveTextContent(''))
      expect(gutter()).not.toHaveAttribute('data-tip')
    })

    it('Settings: the unit system and Digits re-show every result, mark the sheet dirty, and undo never reaches them', async () => {
      renderApp({
        initialElements: createMathAnchorElements([
          { id: 'm1', x: 100, y: 100, width: 300, height: 48, source: 'p = 45430 Pa * 1\nq = 45430 Pa * 1 in kPa' },
        ]),
      })
      await ready()
      const [element] = await screen.findAllByRole('list', { name: 'Lines' })
      await waitFor(() => expect(resultsOf(element)).toBe('45.43 kPa 45.43 kPa'))

      fireEvent.click(await sheetButton())
      fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Settings' }))
      fireEvent.change(await screen.findByLabelText('Unit system'), { target: { value: 'si-base' } })

      // A chosen unit keeps it.
      await waitFor(() => expect(resultsOf(element)).toBe('4.543·10⁴ Pa 45.43 kPa'))
      await waitFor(() => expect(document.title).toBe('● Untitled'))

      fireEvent.change(screen.getByLabelText('Digits'), { target: { value: '6' } })
      await waitFor(() => expect(resultsOf(element)).toBe('45430 Pa 45.43 kPa'))

      act(() => {
        document
          .querySelector('.excalidraw')!
          .dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }))
      })
      expect(resultsOf(element)).toBe('45430 Pa 45.43 kPa')
    })

    it('Settings: the Result colour recolours every result at once, dirty and outside undo (M4c, #108)', async () => {
      renderApp({
        initialElements: createMathAnchorElements([
          { id: 'm1', x: 100, y: 100, width: 300, height: 48, source: 'p = 2 Pa * 1\nq = 3 Pa * 1 @text-green' },
        ]),
      })
      await ready()
      const overlay = () => document.querySelector<HTMLElement>('.math-overlay')!
      await waitFor(() => expect(overlay().style.getPropertyValue('--math-result')).toBe('#1971c2'))

      fireEvent.click(await sheetButton())
      fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Settings' }))
      expect(await screen.findByLabelText('Result colour')).toHaveValue('blue')
      fireEvent.change(screen.getByLabelText('Result colour'), { target: { value: 'red' } })

      await waitFor(() => expect(overlay().style.getPropertyValue('--math-result')).toBe('#e03131'))
      await waitFor(() => expect(document.title).toBe('● Untitled'))
      // A line's own text colour wins on its line.
      expect(document.querySelector('[data-anchor-id="m1"] [data-line="1"]')).toHaveClass('is-text-green')

      act(() => {
        document
          .querySelector('.excalidraw')!
          .dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }))
      })
      expect(overlay().style.getPropertyValue('--math-result')).toBe('#e03131')
    })

    it('Settings: the Page row sets the paper and orientation, saved in the file, dirty and outside undo (M5, #80)', async () => {
      const { files } = renderApp({
        initialElements: createMathAnchorElements([{ id: 'm1', x: 100, y: 100, width: 300, height: 48, source: 'p = 2 Pa' }]),
      })
      await ready()
      fireEvent.click(await sheetButton())
      fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Settings' }))
      const page = await screen.findByRole('group', { name: 'Page' })
      // A4 portrait by default (section 11, Page).
      expect(within(page).getByLabelText('Paper size')).toHaveValue('A4')
      expect(within(page).getByLabelText('Orientation')).toHaveValue('portrait')

      fireEvent.change(within(page).getByLabelText('Paper size'), { target: { value: 'Letter' } })
      fireEvent.change(within(page).getByLabelText('Orientation'), { target: { value: 'landscape' } })
      await waitFor(() => expect(document.title).toBe('● Untitled'))
      expect(within(page).getByLabelText('Paper size')).toHaveValue('Letter')
      expect(within(page).getByLabelText('Orientation')).toHaveValue('landscape')

      // Ctrl+Z doesn't reach it.
      act(() => {
        document
          .querySelector('.excalidraw')!
          .dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }))
      })
      expect(within(page).getByLabelText('Paper size')).toHaveValue('Letter')

      act(() => {
        document
          .querySelector('.excalidraw')!
          .dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }))
      })
      await waitFor(() => expect(files.saveAs).toHaveBeenCalledOnce())
      const saved = JSON.parse(files.disk.get('Untitled.excalimathpad')!)
      expect(saved.excalimathpad.format).toBe(2)
      expect(saved.excalimathpad.settings.page).toEqual({ size: 'Letter', orientation: 'landscape' })
    })

    it('Settings: Custom changes the unit for a chosen kind', async () => {
      renderApp({
        initialElements: createMathAnchorElements([
          { id: 'm1', x: 100, y: 100, width: 300, height: 48, source: 'p = 45430 Pa * 1\nw = 5412 W * 1' },
        ]),
      })
      await ready()
      const [element] = await screen.findAllByRole('list', { name: 'Lines' })

      fireEvent.click(await sheetButton())
      fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Settings' }))
      fireEvent.change(await screen.findByLabelText('Unit system'), { target: { value: 'custom' } })
      fireEvent.change(await screen.findByLabelText('Pressure'), { target: { value: 'bar' } })

      await waitFor(() => expect(resultsOf(element)).toBe('0.4543 bar 5.412 kW'))
      expect(screen.getByLabelText('Unit system')).toHaveValue('custom')
    })

    // Section 4, Renaming a name: The form, on a Variables row, and Afterwards (0.5.0, #261).
    describe('renaming a name from its Variables row', () => {
      const sourceOf = (id: string) =>
        [...document.querySelectorAll(`[data-anchor-id="${id}"] [data-line]`)].map((row) => row.getAttribute('aria-label'))
      const rowOf = (id: string, line: number) => document.querySelector(`[data-anchor-id="${id}"] [data-line="${line}"]`)!
      const form = () => screen.queryByRole('group', { name: /^Rename / })
      const field = (name: string) => screen.getByRole<HTMLInputElement>('textbox', { name: `Rename ${name} to` })
      const renameButton = () => within(form()!).getByRole('button', { name: 'Rename' })
      /** A press as the browser sends it: the panel keeps focus where it is, then the click. */
      const press = (button: HTMLElement) => {
        fireEvent.pointerDown(button)
        fireEvent.mouseDown(button)
        fireEvent.click(button)
      }
      const start = async (elements = sampleSheet()) => {
        renderApp({ initialElements: elements })
        await ready()
        await screen.findAllByRole('list', { name: 'Lines' })
        fireEvent.click(await sheetButton())
        await screen.findByRole('searchbox', { name: 'Filter names' })
      }
      const open = async (name: string, nth = 0) => {
        press(screen.getAllByRole('button', { name: `Rename ${name}` })[nth])
        await waitFor(() => expect(form()).not.toBeNull())
      }
      const type = (name: string, text: string) => fireEvent.change(field(name), { target: { value: text } })

      it('every row ends in a ✎, a function’s too, and a press on it opens the form and doesn’t jump', async () => {
        await start(
          createMathAnchorElements([{ id: 'm1', x: 100, y: 100, width: 300, height: 72, source: 'a = 2\nf(x) = a * x' }]),
        )
        expect(screen.getByRole('button', { name: 'Rename a' })).toHaveAttribute('title', 'Rename a')
        expect(screen.getByRole('button', { name: 'Rename f' })).toHaveTextContent('✎')

        await open('a')

        // The field holds the old name, selected, and has the keyboard.
        expect(field('a')).toHaveFocus()
        expect(field('a')).toHaveValue('a')
        expect([field('a').selectionStart, field('a').selectionEnd]).toEqual([0, 1])
        expect(field('a')).toHaveAttribute('type', 'text')
        expect(within(form()!).getByText('Changes 2 lines:')).toBeInTheDocument()
        expect(within(form()!).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
          'Element 1, line 1a = 2',
          'Element 1, line 2f(x) = a * x',
        ])
        // The old name: Rename is dimmed, and nothing is said.
        expect(renameButton()).toBeDisabled()
        expect(within(form()!).queryByRole('status')).toBeNull()
        // No jump: nothing selected, nothing flashing.
        expect(document.querySelector('[data-math-selection]')).toBeNull()
        expect(document.querySelector('.is-flash')).toBeNull()
        expect(document.title).toBe('Untitled')
      })

      it('Rename writes every changed line of every element as one undo step, then the toast, the flash and the new row', async () => {
        await start()
        const { canUndo, undo, redo } = undoControls(document)
        await open('R')
        type('R', 'R_1')
        // Nothing is written until Rename.
        expect(sourceOf('math-inputs')).toEqual(['R = 10 kohm', 'I = 2 mA'])
        expect(canUndo()).toBe(false)

        press(renameButton())

        await waitFor(() => expect(sourceOf('math-result')).toEqual(['U = I * R_1']))
        expect(sourceOf('math-inputs')).toEqual(['R_1 = 10 kohm', 'I = 2 mA'])
        const [, result] = screen.getAllByRole('list', { name: 'Lines' })
        expect(resultsOf(result)).toBe('20 V')
        expect(await screen.findByText('Renamed R to R_1 in 2 lines. Ctrl+Z takes it back.')).toBeInTheDocument()
        // Every changed line flashes where it is, and no other; nothing is selected.
        expect(rowOf('math-inputs', 0)).toHaveClass('is-flash')
        expect(rowOf('math-inputs', 1)).not.toHaveClass('is-flash')
        expect(rowOf('math-result', 0)).toHaveClass('is-flash')
        expect(document.querySelector('[data-math-selection]')).toBeNull()
        // The form closes, its row shows the new name, and the sheet is dirty.
        expect(form()).toBeNull()
        expect(await screen.findByRole('button', { name: 'R_1: 10 kohm' })).toBeInTheDocument()
        await waitFor(() => expect(document.title).toBe('● Untitled'))
        // The keyboard is the canvas's again, so Ctrl+Z reaches the sheet.
        expect(document.activeElement).toHaveClass('excalidraw')

        undo()
        await waitFor(() => expect(sourceOf('math-result')).toEqual(['U = I * R']))
        expect(sourceOf('math-inputs')).toEqual(['R = 10 kohm', 'I = 2 mA'])
        expect(canUndo()).toBe(false)

        redo()
        await waitFor(() => expect(sourceOf('math-result')).toEqual(['U = I * R_1']))
        expect(sourceOf('math-inputs')).toEqual(['R_1 = 10 kohm', 'I = 2 mA'])
      })

      it('refuses a name the sheet assigns, a reserved word and text that isn’t a name: Rename dimmed, the reason shown', async () => {
        await start()
        const { canUndo } = undoControls(document)
        await open('R')

        for (const [name, reason] of [
          ['U', 'U is already a name on this sheet.'],
          ['plot', 'plot is reserved.'],
          ['2x', "2x isn't a name."],
        ]) {
          type('R', name)
          await waitFor(() => expect(within(form()!).getByRole('status')).toHaveTextContent(reason))
          expect(renameButton()).toBeDisabled()
          // Enter writes nothing while the name is refused.
          fireEvent.keyDown(field('R'), { key: 'Enter', code: 'Enter' })
          expect(form()).not.toBeNull()
        }
        type('R', '')
        await waitFor(() => expect(within(form()!).queryByRole('status')).toBeNull())
        expect(renameButton()).toBeDisabled()
        expect(sourceOf('math-inputs')).toEqual(['R = 10 kohm', 'I = 2 mA'])
        expect(canUndo()).toBe(false)
      })

      it('allows a unit’s name under the amber shadow warning, and says which results a rename would change', async () => {
        await start(
          createMathAnchorElements([{ id: 'm1', x: 100, y: 100, width: 300, height: 72, source: 'L = 2\nd = 3 m * L' }]),
        )
        await open('L')

        type('L', 'm')

        await waitFor(() => expect(within(form()!).getByText('⚠ m shadows the unit m')).toHaveClass('is-warning'))
        expect(within(form()!).getByText('This changes 1 result:')).toHaveClass('is-warning')
        expect(within(form()!).getByRole('list', { name: 'This changes 1 result:' })).toHaveTextContent('Element 1, line 2d = 3 m * L')
        expect(renameButton()).toBeEnabled()
      })

      it('Enter renames and Esc cancels, and neither reaches the canvas', async () => {
        await start()
        // One math element selected: Enter on the canvas would open its line, Esc deselect it.
        const excalidraw = document.querySelector<HTMLElement>('.excalidraw')!
        fireEvent.keyDown(excalidraw, { key: 'a', code: 'KeyA', ctrlKey: true })
        await waitFor(() => expect(document.querySelector('[data-math-selection]')).not.toBeNull())

        await open('R')
        type('R', 'R_1')
        fireEvent.keyDown(field('R'), { key: 'Escape', code: 'Escape' })

        expect(form()).toBeNull()
        expect(document.querySelector('[data-math-selection]')).not.toBeNull()
        expect(sourceOf('math-inputs')).toEqual(['R = 10 kohm', 'I = 2 mA'])
        expect(document.title).toBe('Untitled')
        expect(document.activeElement).toHaveClass('excalidraw')

        await open('R')
        type('R', 'R_1')
        fireEvent.keyDown(field('R'), { key: 'Enter', code: 'Enter' })

        await waitFor(() => expect(sourceOf('math-inputs')).toEqual(['R_1 = 10 kohm', 'I = 2 mA']))
        expect(form()).toBeNull()
        expect(lineField()).toBeNull()
        expect(document.querySelector('[data-math-selection]')).not.toBeNull()
      })

      it('a name assigned twice has two rows, each form lists its own reach, and one form is open at a time', async () => {
        await start(
          createMathAnchorElements([{ id: 'm1', x: 100, y: 100, width: 300, height: 96, source: 'k = 1\nx = k\nk = k + 1\ny = k' }]),
        )
        expect(screen.getAllByRole('button', { name: 'Rename k' })).toHaveLength(2)

        await open('k', 0)
        expect(within(form()!).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
          'Element 1, line 1k = 1',
          'Element 1, line 2x = k',
          'Element 1, line 3k = k + 1',
        ])

        // A ✎ pressed on another row moves the form there.
        press(screen.getAllByRole('button', { name: 'Rename k' })[1])
        await waitFor(() =>
          expect(within(form()!).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
            'Element 1, line 3k = k + 1',
            'Element 1, line 4y = k',
          ]),
        )
        expect(screen.getAllByRole('group', { name: /^Rename / })).toHaveLength(1)

        type('k', 'k_2')
        press(renameButton())
        await waitFor(() => expect(sourceOf('m1')).toEqual(['k = 1', 'x = k', 'k_2 = k + 1', 'y = k_2']))
      })

      it('with a line open and half typed, the ✎’s field leaves it as its own undo step, before the rename’s', async () => {
        // An editor wide enough to dock the panel: it opens at launch, on Variables.
        editorWidth(1440)
        renderApp({
          initialElements: createMathAnchorElements([{ id: 'm1', x: 100, y: 100, width: 300, height: 72, source: 'a = 1\nb = a' }]),
        })
        await ready()
        await screen.findByRole('searchbox', { name: 'Filter names' })
        const { undo } = undoControls(document)
        const excalidraw = document.querySelector<HTMLElement>('.excalidraw')!
        fireEvent.keyDown(excalidraw, { key: 'a', code: 'KeyA', ctrlKey: true })
        await waitFor(() => expect(document.querySelector('[data-math-selection]')).not.toBeNull())
        fireEvent.keyDown(excalidraw, { key: 'Enter', code: 'Enter' })
        await waitFor(() => expect(lineField()).not.toBeNull())
        fireEvent.input(lineField()!, { target: { value: 'b = a + 1' } })
        // The edit showed Format; Variables is picked during it, and the line stays open.
        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Variables' }))
        await screen.findByRole('searchbox', { name: 'Filter names' })
        expect(lineField()).not.toBeNull()

        await open('a')

        // The form's field took the keyboard: the line is left, and written.
        await waitFor(() => expect(lineField()).toBeNull())
        expect(sourceOf('m1')).toEqual(['a = 1', 'b = a + 1'])
        expect(field('a')).toHaveFocus()
        type('a', 'a_1')
        await waitFor(() => expect(renameButton()).toBeEnabled())
        press(renameButton())
        await waitFor(() => expect(sourceOf('m1')).toEqual(['a_1 = 1', 'b = a_1 + 1']))

        undo()
        await waitFor(() => expect(sourceOf('m1')).toEqual(['a = 1', 'b = a + 1']))
        undo()
        await waitFor(() => expect(sourceOf('m1')).toEqual(['a = 1', 'b = a']))
      })

      it('closes the form when the filter is typed in, and it doesn’t come back when its row does', async () => {
        await start()
        await open('R')
        const filter = screen.getByRole('searchbox', { name: 'Filter names' })

        fireEvent.change(filter, { target: { value: 'U' } })
        expect(form()).toBeNull()
        fireEvent.change(filter, { target: { value: '' } })

        expect(screen.getByRole('button', { name: 'Rename R' })).toHaveAttribute('aria-expanded', 'false')
        expect(form()).toBeNull()
      })

      it('closes the form when its row’s line no longer assigns the name', async () => {
        await start()
        const { undo } = undoControls(document)
        await open('R')
        type('R', 'R_1')
        press(renameButton())
        await waitFor(() => expect(sourceOf('math-inputs')).toEqual(['R_1 = 10 kohm', 'I = 2 mA']))
        await open('R_1')

        undo()

        await waitFor(() => expect(form()).toBeNull())
        expect(await screen.findByRole('button', { name: 'R: 10 kohm' })).toBeInTheDocument()
      })
    })
  })
})

// Section 4, Renaming a name: The offer, on a committed line (0.5.0, #262).
describe('the offer to rename, on a committed line', () => {
  const sourceOf = (id: string) =>
    [...document.querySelectorAll(`[data-anchor-id="${id}"] [data-line]`)].map((row) => row.getAttribute('aria-label'))
  const cards = () => screen.queryAllByRole('group', { name: /^Rename .* in \d+ lines?\?$/ })
  const card = (name: string) => screen.queryByRole('group', { name })
  /** A press as the browser sends it: the card keeps focus where it is, then the click. */
  const press = (button: HTMLElement) => {
    fireEvent.pointerDown(button)
    const kept = !fireEvent.mouseDown(button)
    fireEvent.click(button)
    return kept
  }
  const type = (text: string) => fireEvent.input(lineField()!, { target: { value: text } })
  const key = (name: string) => fireEvent.keyDown(lineField()!, { key: name })
  const pump = () =>
    createMathAnchorElements([
      { id: 'fluid', x: 100, y: 100, width: 300, height: 72, source: 'rho = 1000 kg/m^3\nmu = 1 cP' },
      { id: 'use', x: 100, y: 300, width: 300, height: 72, source: 'a = rho * 2\nb = rho + 1 kg/m^3' },
    ])
  const start = async (elements = pump()) => {
    renderApp({ initialElements: elements })
    await ready()
    await screen.findAllByRole('list', { name: 'Lines' })
    return undoControls(document)
  }
  /** Opens line `n` (1-based) of `id` and types `text` in it. */
  const edit = (id: string, n: number, text: string) => {
    doubleClickLine(id, n)
    expect(lineField()).not.toBeNull()
    type(text)
  }

  it('↓ commits the line and shows the card with its count; the next line is typed while it waits; Rename changes the uses; two Ctrl+Z put the sheet back, the uses first', async () => {
    const { undo } = await start()
    edit('fluid', 1, 'rho_w = 1000 kg/m^3')
    key('ArrowDown')

    const asked = await screen.findByRole('group', { name: 'Rename rho to rho_w in 2 lines?' })
    expect(asked).toHaveTextContent('Rename rho to rho_w in 2 lines?')
    expect(within(asked).getByRole('button', { name: 'Keep rho' })).toBeInTheDocument()
    expect(sourceOf('fluid')).toEqual(['rho_w = 1000 kg/m^3', 'mu = 1 cP'])
    // The next line is open and has the keyboard; typing in it keeps the card.
    expect(lineField()).toHaveValue('mu = 1 cP')
    expect(lineField()).toHaveFocus()
    type('mu = 2 cP')
    expect(card('Rename rho to rho_w in 2 lines?')).not.toBeNull()
    // Until it is answered, the uses show what the sheet computes from the typed text.
    expect(sourceOf('use')).toEqual(['a = rho * 2', 'b = rho + 1 kg/m^3'])

    // The count opens the list of lines, and keeps the line open.
    expect(press(within(asked).getByRole('button', { name: 'in 2 lines' }))).toBe(true)
    expect(within(asked).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Element 2, line 1a = rho * 2',
      'Element 2, line 2b = rho + 1 kg/m^3',
    ])
    expect(lineField()).toHaveValue('mu = 2 cP')

    expect(press(within(asked).getByRole('button', { name: 'Rename' }))).toBe(true)

    // The open line is committed first, and no line is open afterwards.
    await waitFor(() => expect(sourceOf('use')).toEqual(['a = rho_w * 2', 'b = rho_w + 1 kg/m^3']))
    expect(sourceOf('fluid')).toEqual(['rho_w = 1000 kg/m^3', 'mu = 2 cP'])
    expect(lineField()).toBeNull()
    expect(cards()).toHaveLength(0)
    expect(await screen.findByText('Renamed rho to rho_w in 2 lines. Ctrl+Z takes it back.')).toBeInTheDocument()
    expect(document.querySelector('[data-anchor-id="use"] [data-line="0"]')).toHaveClass('is-flash')
    expect(document.activeElement).toHaveClass('excalidraw')

    undo()
    await waitFor(() => expect(sourceOf('use')).toEqual(['a = rho * 2', 'b = rho + 1 kg/m^3']))
    expect(sourceOf('fluid')).toEqual(['rho_w = 1000 kg/m^3', 'mu = 2 cP'])
    undo()
    await waitFor(() => expect(sourceOf('fluid')).toEqual(['rho_w = 1000 kg/m^3', 'mu = 1 cP']))
    undo()
    await waitFor(() => expect(sourceOf('fluid')).toEqual(['rho = 1000 kg/m^3', 'mu = 1 cP']))
  })

  it('Keep writes nothing, the card goes, and the open line keeps its text and caret', async () => {
    const { undo } = await start()
    edit('fluid', 1, 'rho_w = 1000 kg/m^3')
    key('ArrowDown')
    const asked = await screen.findByRole('group', { name: 'Rename rho to rho_w in 2 lines?' })
    type('mu = 3 cP')
    lineField()!.setSelectionRange(2, 2)

    expect(press(within(asked).getByRole('button', { name: 'Keep rho' }))).toBe(true)

    expect(cards()).toHaveLength(0)
    expect(lineField()).toHaveValue('mu = 3 cP')
    expect(lineField()).toHaveFocus()
    expect(lineField()!.selectionStart).toBe(2)
    expect(sourceOf('use')).toEqual(['a = rho * 2', 'b = rho + 1 kg/m^3'])
    fireEvent.keyDown(lineField()!, { key: 'Escape' })
    // Keep was no step: one Ctrl+Z each for the two lines.
    undo()
    await waitFor(() => expect(sourceOf('fluid')).toEqual(['rho_w = 1000 kg/m^3', 'mu = 1 cP']))
    undo()
    await waitFor(() => expect(sourceOf('fluid')).toEqual(['rho = 1000 kg/m^3', 'mu = 1 cP']))
  })

  it('goes on an undo of the line, and when the uses are edited by hand', async () => {
    const { undo } = await start()
    edit('fluid', 1, 'rho_w = 1000 kg/m^3')
    key('Escape')
    await screen.findByRole('group', { name: 'Rename rho to rho_w in 2 lines?' })
    undo()
    await waitFor(() => expect(cards()).toHaveLength(0))

    edit('fluid', 1, 'rho_w = 1000 kg/m^3')
    key('Escape')
    await screen.findByRole('group', { name: 'Rename rho to rho_w in 2 lines?' })
    edit('use', 1, 'a = rho_w * 2')
    key('Escape')
    await screen.findByRole('group', { name: 'Rename rho to rho_w in 1 line?' })
    edit('use', 2, 'b = rho_w + 1 kg/m^3')
    key('Escape')
    await waitFor(() => expect(cards()).toHaveLength(0))

  })

  it('goes when its element is removed', async () => {
    await start()
    edit('fluid', 1, 'rho_w = 1000 kg/m^3')
    key('Escape')
    await screen.findByRole('group', { name: 'Rename rho to rho_w in 2 lines?' })
    clickOnCanvas(linePoint('fluid', 1))
    await waitFor(() => expect(document.querySelector('[data-math-selection]')).not.toBeNull())
    fireEvent.keyDown(document.querySelector('.excalidraw')!, { key: 'Delete', code: 'Delete' })
    await waitFor(() => expect(document.querySelector('[data-anchor-id="fluid"]')).toBeNull())
    expect(cards()).toHaveLength(0)
  })

  it('asks about the new name when the line’s name changes again, and goes when the old name is back', async () => {
    await start()
    edit('fluid', 1, 'rho_w = 1000 kg/m^3')
    key('Escape')
    await screen.findByRole('group', { name: 'Rename rho to rho_w in 2 lines?' })
    edit('fluid', 1, 'rho_x = 1000 kg/m^3')
    key('Escape')
    await screen.findByRole('group', { name: 'Rename rho to rho_x in 2 lines?' })
    expect(cards()).toHaveLength(1)
    edit('fluid', 1, 'rho = 1000 kg/m^3')
    key('Escape')
    await waitFor(() => expect(cards()).toHaveLength(0))
  })

  it('lets two offers wait at once, each by its line', async () => {
    await start(
      createMathAnchorElements([
        { id: 'fluid', x: 100, y: 100, width: 300, height: 72, source: 'rho = 1000 kg/m^3\nmu = 1 cP' },
        { id: 'use', x: 100, y: 300, width: 300, height: 72, source: 'a = rho * 2\nb = mu * 2' },
      ]),
    )
    edit('fluid', 1, 'rho_w = 1000 kg/m^3')
    key('ArrowDown')
    type('mu_w = 1 cP')
    key('Escape')
    await screen.findByRole('group', { name: 'Rename mu to mu_w in 1 line?' })
    expect(cards().map((shown) => shown.getAttribute('data-offer'))).toEqual(['fluid:0', 'fluid:1'])
  })

  it('is made by ↑, Esc, a click outside and Enter at the end of the line', async () => {
    await start()
    edit('fluid', 2, 'nu = 1 cP')
    key('ArrowUp')
    // ↑ left line 2; its name changed, but nothing reads mu.
    expect(cards()).toHaveLength(0)
    type('rho_w = 1000 kg/m^3')
    // ↑ from the first line goes to the title.
    key('ArrowUp')
    await screen.findByRole('group', { name: 'Rename rho to rho_w in 2 lines?' })
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })

    edit('use', 1, 'a = rho_w * 2')
    clickOnCanvas({ clientX: 900, clientY: 900 })
    await screen.findByRole('group', { name: 'Rename rho to rho_w in 1 line?' })

    edit('fluid', 1, 'rho_q = 1000 kg/m^3')
    key('Enter')
    await screen.findByRole('group', { name: 'Rename rho to rho_q in 1 line?' })
  })

  it('is not made by an Enter inside the text, a join or a Format tab press', async () => {
    await start()
    edit('fluid', 1, 'rho_w = 1000 kg/m^3')
    lineField()!.setSelectionRange(12, 12)
    key('Enter')
    expect(sourceOf('fluid')).toEqual(['rho_w = 1000', ' kg/m^3', 'mu = 1 cP'])
    key('Backspace')
    expect(cards()).toHaveLength(0)
    expect(lineField()).toHaveValue('rho_w = 1000 kg/m^3')
  })

  it('is not made by a Format tab press; the line, left afterwards, makes it', async () => {
    // An editor wide enough to dock the panel: an edit opens it on Format.
    editorWidth(1440)
    const { undo } = await start()
    edit('fluid', 1, 'rho_w = 1000 kg/m^3')
    const bold = await screen.findByRole('button', { name: 'Bold (Ctrl+B)' })
    press(bold)
    // The press wrote the line, its new name with it, and made no offer.
    await waitFor(() => expect(sourceOf('fluid')).toEqual(['rho_w = 1000 kg/m^3', 'mu = 1 cP']))
    expect(lineField()).toHaveValue('rho_w = 1000 kg/m^3')
    expect(cards()).toHaveLength(0)
    // Before the edit is when the line opened: leaving it makes the offer.
    key('Escape')
    await screen.findByRole('group', { name: 'Rename rho to rho_w in 2 lines?' })
    undo()
    await waitFor(() => expect(cards()).toHaveLength(0))
  })

  it('is made where an older assignment higher up now feeds the lines below with no error', async () => {
    await start(
      createMathAnchorElements([
        { id: 'fluid', x: 100, y: 100, width: 300, height: 72, source: 'rho = 1\nrho = 1000' },
        { id: 'use', x: 100, y: 300, width: 300, height: 48, source: 'a = rho * 2' },
      ]),
    )
    edit('fluid', 2, 'rho_w = 1000')
    key('Escape')
    await screen.findByRole('group', { name: 'Rename rho to rho_w in 1 line?' })
  })

  it('says on the card a rename that would change a result', async () => {
    await start(
      createMathAnchorElements([{ id: 'fluid', x: 100, y: 100, width: 300, height: 72, source: 'L = 2\na = L * 3\nd = 5 m' }]),
    )
    edit('fluid', 1, 'm = 2')
    key('Escape')
    const asked = await screen.findByRole('group', { name: 'Rename L to m in 1 line?' })
    expect(await within(asked).findByText('This changes 1 result:')).toBeInTheDocument()
  })

  it('is never saved: the file holds nothing of it', async () => {
    const { files } = renderApp({ initialElements: pump() })
    await ready()
    await screen.findAllByRole('list', { name: 'Lines' })
    edit('fluid', 1, 'rho_w = 1000 kg/m^3')
    key('Escape')
    await screen.findByRole('group', { name: 'Rename rho to rho_w in 2 lines?' })
    act(() => {
      document
        .querySelector('.excalidraw')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }))
    })
    await waitFor(() => expect(files.saveAs).toHaveBeenCalledOnce())
    const saved = files.disk.get('Untitled.excalimathpad')!
    expect(saved).toContain('rho_w = 1000 kg/m^3')
    expect(saved).not.toMatch(/offer|Keep rho/i)
  })
})

