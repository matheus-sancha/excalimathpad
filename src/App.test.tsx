import { act, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, onTestFinished } from 'vitest'
import App from './App.tsx'
import { WELCOME_HINT } from './canvas/SheetCanvas.tsx'
import { fakeFileAccess, fakeRecovery } from './test/files.ts'
import { clickOnCanvas } from './test/gestures.ts'
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
const lineField = () => screen.queryByRole<HTMLInputElement>('textbox', { name: 'Line source' })

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

      expect(await screen.findByText(WELCOME_HINT)).toBeInTheDocument()
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
      expect(screen.queryByText(WELCOME_HINT)).toBeNull()
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
      const start = async () => {
        renderApp({ initialElements: problemSheet() })
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
        const client = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!
        Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => 1440 })
        onTestFinished(() => {
          Object.defineProperty(Element.prototype, 'clientWidth', client)
        })
        const remembered: boolean[] = []
        const panelMemory = { rememberedOpen: () => false, rememberOpen: (open: boolean) => void remembered.push(open) }
        renderApp({ initialElements: problemSheet(), panelMemory })
        await ready()
        await screen.findAllByRole('list', { name: 'Lines' })

        await editLine()
        await waitFor(() => expect(panel()).not.toBeNull())
        leave()
        await waitFor(() => expect(panel()).toBeNull())
        expect(remembered).toEqual([])
        // The user's own choice still is.
        fireEvent.click(await sheetButton())
        await waitFor(() => expect(remembered).toEqual([true]))
      })
    })

    describe('at launch on a wide window', () => {
      /** The canvas's box is 1440 px wide: the panel docks, so it opens at launch. */
      const wideWindow = () => {
        const client = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!
        Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => 1440 })
        onTestFinished(() => {
          Object.defineProperty(Element.prototype, 'clientWidth', client)
        })
      }
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
  })
})
