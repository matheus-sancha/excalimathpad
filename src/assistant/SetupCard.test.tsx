import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { showLanguage } from '../text/words.ts'
import { en } from '../text/en.ts'
import { ptBR } from '../text/ptBR.ts'
import { AssistantTab } from './AssistantTab.tsx'
import { sessionSetupStore, type AssistantPorts, type SetupStore } from './ports.ts'
import { readSetup, setupText, type Setup } from './setup.ts'

/**
 * The setup card (docs/spec-v1.md section 8, Math assistant, The setup card;
 * section 13, Math assistant), in the tab by itself: the fake ports record
 * every request, and nothing here may make one.
 */
const CANARY = 'sk-canary-9f3c7e21d8b64a05-a1B2'
const w = en.assistant

function ports<S extends SetupStore | null = SetupStore>(store: S = sessionSetupStore() as S) {
  const request = vi.fn<AssistantPorts['request']>(() => Promise.reject(new Error('no request is made')))
  return { request, store }
}
const saved = (setup: Partial<Setup> = {}) => {
  const store = sessionSetupStore()
  store.write(setupText({ provider: 'anthropic', address: 'https://api.anthropic.com', model: 'claude-sonnet-5-5', key: CANARY, hosts: [], ...setup }))
  return store
}

const tab = () => screen.getByTestId('assistant-tab')
const provider = () => screen.getByRole<HTMLSelectElement>('combobox', { name: w.provider })
const address = () => screen.queryByRole<HTMLInputElement>('textbox', { name: w.address })
const key = () => screen.queryByLabelText<HTMLInputElement>(w.key, { selector: 'input' })
const model = () => screen.getByRole<HTMLInputElement>('textbox', { name: w.model })
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name })
const lines = () => Array.from(tab().querySelectorAll('.assistant-card__lines li'), (line) => line.textContent)
const type = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } })
const pick = (value: string) => fireEvent.change(provider(), { target: { value } })
const alert = () => screen.queryByRole('alert')?.textContent ?? null

afterEach(() => showLanguage('en'))

describe('the card, with no setup saved', () => {
  it('is as section 8 lists it, top to bottom', () => {
    render(<AssistantTab ports={ports()} />)
    const card = tab().querySelector('.assistant-card')!
    expect(card.firstElementChild).toHaveTextContent(w.about)

    // The provider list in order, then Other.
    expect(Array.from(provider().options, (option) => option.textContent)).toEqual([
      'Anthropic',
      'OpenAI',
      'Google Gemini',
      'OpenRouter',
      'Other (type an address)',
    ])
    expect(provider()).toHaveValue('anthropic')
    // A built-in has no address field; the key is masked; the model is its default.
    expect(address()).toBeNull()
    expect(key()).toHaveAttribute('type', 'password')
    expect(model()).toHaveValue('claude-sonnet-5-5')
    expect(lines()).toEqual([w.cost.anthropic, w.keeps('api.anthropic.com'), w.keptWeb, w.confidential('api.anthropic.com')])

    // Top to bottom: the fields, the lines, Save and Check key. No Forget this setup with nothing to forget.
    const order = Array.from(card.querySelectorAll('select, input, button, ul'), (control) =>
      control instanceof HTMLButtonElement ? control.textContent || control.getAttribute('aria-label') : control.tagName,
    )
    expect(order).toEqual(['SELECT', 'INPUT', w.showKey, 'INPUT', w.showModels, 'UL', w.save, w.checkKey])
    expect(screen.queryByRole('button', { name: w.forget })).toBeNull()
  })

  it('fills in each built-in’s default model and lines, and nothing for OpenRouter’s model until its name is read', () => {
    render(<AssistantTab ports={ports()} />)
    pick('openai')
    expect(model()).toHaveValue('gpt-6.2-sol')
    expect(lines()).toEqual([w.cost.openai, w.keeps('api.openai.com'), w.keptWeb, w.confidential('api.openai.com')])
    pick('google')
    expect(model()).toHaveValue('gemini-4-hydrogen')
    expect(lines()[0]).toBe(w.cost.google)
    expect(lines()[1]).toBe(w.keeps('generativelanguage.googleapis.com'))
    pick('openrouter')
    expect(model()).toHaveValue('')
    expect(lines()).toEqual([w.cost.openrouter, w.keeps('openrouter.ai'), w.keptWeb, w.confidential('openrouter.ai')])
  })

  it('Other shows the address field, an empty model, and names the host once the address is one', () => {
    render(<AssistantTab ports={ports()} />)
    pick('other')
    expect(address()).toHaveValue('')
    expect(model()).toHaveValue('')
    expect(lines()).toEqual([w.cost.other, w.keptWeb])
    type(address()!, 'http://localhost:11434/v1')
    expect(lines()).toEqual([w.cost.other, w.keeps('localhost:11434'), w.keptWeb, w.confidential('localhost:11434')])
  })

  it('in Obsidian, says the key is kept in Obsidian’s keychain', () => {
    render(<AssistantTab ports={ports()} vault />)
    expect(lines()[2]).toBe(w.keptVault)
  })

  it('the eye shows the key, to check a paste, and hides it again', () => {
    render(<AssistantTab ports={ports()} />)
    type(key()!, CANARY)
    expect(key()).toHaveAttribute('type', 'password')
    fireEvent.click(button(w.showKey))
    expect(key()).toHaveAttribute('type', 'text')
    expect(key()).toHaveValue(CANARY)
    expect(button(w.hideKey)).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(button(w.hideKey))
    expect(key()).toHaveAttribute('type', 'password')
  })

  it('leaves Show models and Check key their places, and they send nothing', () => {
    const fake = ports()
    render(<AssistantTab ports={fake} />)
    expect(button(w.showModels)).toBeDisabled()
    expect(button(w.checkKey)).toBeDisabled()
    fireEvent.click(button(w.showModels))
    fireEvent.click(button(w.checkKey))
    expect(fake.request).not.toHaveBeenCalled()
  })
})

describe('Save', () => {
  it('keeps the record, makes no request, and a wrong key saves', () => {
    const fake = ports()
    render(<AssistantTab ports={fake} />)
    // A built-in needs a key before Save.
    expect(button(w.save)).toBeDisabled()
    type(key()!, `  ${CANARY}\n`)
    fireEvent.click(button(w.save))

    expect(readSetup(fake.store.read())).toEqual({
      provider: 'anthropic',
      address: 'https://api.anthropic.com',
      model: 'claude-sonnet-5-5',
      key: CANARY,
      hosts: [],
    })
    expect(fake.request).not.toHaveBeenCalled()
    expect(alert()).toBeNull()
  })

  it.each([
    ['', w.refused.notUrl],
    ['api.mistral.ai/v1', w.refused.notUrl],
    ['http://192.168.1.20:11434/v1', w.refused.notHttps],
    ['ftp://api.example.com', w.refused.notHttps],
    ['https://user:pass@api.example.com/v1', w.refused.credentials],
  ])('refuses the address "%s", with section 13’s words', (typed, message) => {
    const fake = ports()
    render(<AssistantTab ports={fake} />)
    pick('other')
    type(address()!, typed)
    type(model(), 'llama')
    fireEvent.click(button(w.save))
    expect(alert()).toBe(message)
    expect(address()).toHaveAttribute('aria-invalid', 'true')
    expect(fake.store.read()).toBeNull()
    // The words go when the field is typed in again.
    type(address()!, 'https://api.example.com/v1')
    expect(alert()).toBeNull()
  })

  // A single-line field drops a pasted line break itself; a space or a tab inside reaches Save.
  it.each(['sk-one two', 'sk-one\ttwo', 'sk-one\u00a0two'])('refuses a key with a space inside: "%s"', (typed) => {
    const fake = ports()
    render(<AssistantTab ports={fake} />)
    type(key()!, typed)
    fireEvent.click(button(w.save))
    expect(alert()).toBe(w.refused.keySpaces)
    expect(key()).toHaveAttribute('aria-invalid', 'true')
    expect(fake.store.read()).toBeNull()
  })

  it('refuses no model', () => {
    const fake = ports()
    render(<AssistantTab ports={fake} />)
    type(key()!, CANARY)
    type(model(), '   ')
    fireEvent.click(button(w.save))
    expect(alert()).toBe(w.refused.noModel)
    expect(fake.store.read()).toBeNull()
  })

  it('a typed address may have no key, for a local model', () => {
    const fake = ports()
    render(<AssistantTab ports={fake} />)
    pick('other')
    type(address()!, ' http://localhost:11434/v1 ')
    type(model(), 'llama3')
    fireEvent.click(button(w.save))
    expect(readSetup(fake.store.read())).toEqual({ provider: 'other', address: 'http://localhost:11434/v1', model: 'llama3', key: '', hosts: [] })
    expect(fake.request).not.toHaveBeenCalled()
  })
})

describe('a saved key', () => {
  it('is never shown again: only "Saved key ending a1B2", with Replace and Remove', () => {
    const fake = ports()
    render(<AssistantTab ports={fake} />)
    type(key()!, CANARY)
    fireEvent.click(button(w.save))

    expect(screen.getByTestId('assistant-saved-key')).toHaveTextContent('Saved key ending a1B2')
    expect(key()).toBeNull()
    expect(button(w.replace)).toBeEnabled()
    expect(button(w.remove)).toBeEnabled()
    expect(button(w.forget)).toBeEnabled()
    expect(document.body.innerHTML).not.toContain(CANARY)
  })

  it('is read back the same when the tab is drawn again, as after another tab showed', () => {
    const fake = ports(saved({ provider: 'openai', address: 'https://api.openai.com/v1', model: 'gpt-mine' }))
    const { unmount } = render(<AssistantTab ports={fake} />)
    unmount()
    render(<AssistantTab ports={fake} />)
    expect(provider()).toHaveValue('openai')
    expect(model()).toHaveValue('gpt-mine')
    expect(screen.getByTestId('assistant-saved-key')).toHaveTextContent('Saved key ending a1B2')
    expect(document.body.innerHTML).not.toContain(CANARY)
  })

  it('stays when only the model changes', () => {
    const fake = ports(saved())
    render(<AssistantTab ports={fake} />)
    type(model(), 'claude-opus-5-5')
    fireEvent.click(button(w.save))
    expect(readSetup(fake.store.read())).toMatchObject({ model: 'claude-opus-5-5', key: CANARY })
  })

  it('Replace gives the field back, empty, and Save keeps the new key', () => {
    const fake = ports(saved({ hosts: ['api.anthropic.com'] }))
    render(<AssistantTab ports={fake} />)
    fireEvent.click(button(w.replace))
    expect(key()).toHaveValue('')
    type(key()!, 'sk-new-key-0000-zZ99')
    fireEvent.click(button(w.save))
    expect(readSetup(fake.store.read())).toMatchObject({ key: 'sk-new-key-0000-zZ99', hosts: ['api.anthropic.com'] })
    expect(screen.getByTestId('assistant-saved-key')).toHaveTextContent('Saved key ending zZ99')
  })

  it('Remove forgets the key only, and heads the card "Key removed from this device."', () => {
    const fake = ports(saved({ model: 'claude-mine', hosts: ['api.anthropic.com'] }))
    render(<AssistantTab ports={fake} />)
    fireEvent.click(button(w.remove))

    expect(readSetup(fake.store.read())).toEqual({
      provider: 'anthropic',
      address: 'https://api.anthropic.com',
      model: 'claude-mine',
      key: '',
      hosts: ['api.anthropic.com'],
    })
    expect(tab().querySelector('.assistant-card')!.firstElementChild).toHaveTextContent(w.keyRemoved)
    // A new key is one paste: the field is back, and the rest stayed.
    expect(key()).toHaveValue('')
    expect(model()).toHaveValue('claude-mine')
    type(key()!, CANARY)
    fireEvent.click(button(w.save))
    expect(screen.queryByText(w.keyRemoved)).toBeNull()
    expect(readSetup(fake.store.read())).toMatchObject({ key: CANARY, hosts: ['api.anthropic.com'] })
  })

  it('Forget this setup forgets all of it, and the card starts over', () => {
    const fake = ports(saved({ provider: 'openai', address: 'https://api.openai.com/v1', model: 'gpt-mine' }))
    render(<AssistantTab ports={fake} />)
    fireEvent.click(button(w.forget))
    expect(fake.store.read()).toBeNull()
    expect(provider()).toHaveValue('anthropic')
    expect(model()).toHaveValue('claude-sonnet-5-5')
    expect(key()).toHaveValue('')
    expect(screen.queryByRole('button', { name: w.forget })).toBeNull()
    expect(fake.request).not.toHaveBeenCalled()
  })
})

describe('another provider chosen while a key is saved', () => {
  it('asks first; Cancel keeps the setup', () => {
    const fake = ports(saved())
    render(<AssistantTab ports={fake} />)
    pick('openai')
    const confirm = screen.getByRole('alertdialog')
    expect(confirm).toHaveTextContent('Change the provider? The key saved for api.anthropic.com is forgotten.')
    expect(within(confirm).getAllByRole('button').map((each) => each.textContent)).toEqual(['Cancel', 'Change'])
    expect(readSetup(fake.store.read())).toMatchObject({ provider: 'anthropic', key: CANARY })

    fireEvent.click(within(confirm).getByRole('button', { name: w.cancel }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(provider()).toHaveValue('anthropic')
    expect(screen.getByTestId('assistant-saved-key')).toHaveTextContent('Saved key ending a1B2')
    expect(readSetup(fake.store.read())).toMatchObject({ provider: 'anthropic', key: CANARY })
  })

  it('Change forgets the saved key, and Save then keeps the new setup in its place', () => {
    const fake = ports(saved({ hosts: ['api.anthropic.com'] }))
    render(<AssistantTab ports={fake} />)
    pick('openai')
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: w.changeProvider }))

    expect(fake.store.read()).toBeNull()
    expect(provider()).toHaveValue('openai')
    expect(model()).toHaveValue('gpt-6.2-sol')
    expect(key()).toHaveValue('')
    type(key()!, 'sk-openai-0000-qQ77')
    fireEvent.click(button(w.save))
    expect(readSetup(fake.store.read())).toEqual({
      provider: 'openai',
      address: 'https://api.openai.com/v1',
      model: 'gpt-6.2-sol',
      key: 'sk-openai-0000-qQ77',
      hosts: [],
    })
    expect(fake.request).not.toHaveBeenCalled()
  })

  it('with no key saved there is nothing to forget, so nothing is asked', () => {
    render(<AssistantTab ports={ports(saved({ key: '' }))} />)
    pick('google')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(provider()).toHaveValue('google')
  })
})

describe('a store that throws, or is blocked or full', () => {
  const full = (): SetupStore => ({
    read: vi.fn(() => null),
    write: vi.fn(() => {
      throw new Error('The quota has been exceeded.')
    }),
    remove: vi.fn(),
  })

  it('keeps the setup for the session, and the card says so with the store’s error', () => {
    const fake = ports(full())
    const { unmount } = render(<AssistantTab ports={fake} />)
    type(key()!, CANARY)
    fireEvent.click(button(w.save))

    expect(alert()).toBe(`${w.cantKeepWeb} The quota has been exceeded.`)
    expect(screen.getByTestId('assistant-saved-key')).toHaveTextContent('Key for this session, ending a1B2')
    // There is never a second store: the one write, and nothing else.
    expect(fake.store.write).toHaveBeenCalledTimes(1)
    expect(fake.request).not.toHaveBeenCalled()

    // Another tab shows and this one comes back: the setup is still held.
    unmount()
    render(<AssistantTab ports={fake} />)
    expect(screen.getByTestId('assistant-saved-key')).toHaveTextContent('Key for this session, ending a1B2')
    expect(document.body.innerHTML).not.toContain(CANARY)
  })

  it('in Obsidian, it is until Obsidian closes', () => {
    render(<AssistantTab ports={ports(full())} vault />)
    type(key()!, CANARY)
    fireEvent.click(button(w.save))
    expect(alert()).toBe(`${w.cantKeepVault} The quota has been exceeded.`)
  })
})

describe('a home with no store (an Obsidian older than 1.11.4)', () => {
  it('says it needs 1.11.4, and holds nothing else', () => {
    render(<AssistantTab ports={ports(null)} vault />)
    expect(tab()).toHaveTextContent(/^The Math assistant needs Obsidian 1\.11\.4 or later\.$/)
    expect(tab().querySelector('input, select, button')).toBeNull()
  })
})

describe('in Português', () => {
  it('words the whole card, the providers’ names kept', () => {
    showLanguage('pt-BR')
    const p = ptBR.assistant
    render(<AssistantTab ports={ports(saved())} />)
    expect(tab()).toHaveTextContent(p.about)
    expect(Array.from(screen.getByRole<HTMLSelectElement>('combobox', { name: p.provider }).options, (option) => option.textContent)).toEqual([
      'Anthropic',
      'OpenAI',
      'Google Gemini',
      'OpenRouter',
      'Outro (digite um endereço)',
    ])
    expect(screen.getByTestId('assistant-saved-key')).toHaveTextContent('Chave salva terminada em a1B2')
    expect(screen.getAllByRole('button').map((each) => each.textContent)).toEqual([
      'Substituir',
      'Remover',
      'Mostrar modelos',
      'Salvar',
      'Verificar chave',
      'Esquecer esta configuração',
    ])
    expect(lines()).toEqual([p.cost.anthropic, p.keeps('api.anthropic.com'), p.keptWeb, p.confidential('api.anthropic.com')])
  })
})

describe('the three key pages in the cost lines', () => {
  it('are plain text with no https://, in both tables', () => {
    for (const table of [en, ptBR]) {
      const cost = table.assistant.cost
      expect(cost.openai).toContain('platform.openai.com/api-keys')
      expect(cost.google).toContain('aistudio.google.com/apikey')
      expect(cost.openrouter).toContain('openrouter.ai/settings/keys')
      for (const line of Object.values(cost)) expect(line).not.toMatch(/https?:\/\//)
    }
  })
})
