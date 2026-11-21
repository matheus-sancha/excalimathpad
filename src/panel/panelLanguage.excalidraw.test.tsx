import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App.tsx'
import { createMathAnchorElements } from '../canvas/mathAnchor.ts'
import type { LanguageMemory, SheetLanguage } from '../canvas/language.ts'
import { fakeFileAccess, fakeRecovery } from '../test/files.ts'
import { en } from '../text/en.ts'
import { ptBR } from '../text/ptBR.ts'

/**
 * The Sheet panel in Português (docs/spec-v1.md section 8, Sheet panel;
 * section 13, Panel and the rename form; 0.6.0, #293), in the web home against
 * the real Excalidraw: every tab reads the text table of the language shown,
 * chosen through its memory as ☰ → Language leaves it, and a choice made while
 * the panel is open words it again at once.
 */

function languageMemory(language: SheetLanguage): LanguageMemory {
  return { rememberedLanguage: () => language, rememberLanguage: () => {} }
}

const sheet = () =>
  createMathAnchorElements([
    { id: 'm1', x: 100, y: 100, width: 300, height: 72, source: 'K = 5.4\nx = 1 m + 1 s', title: 'Pipe flow' },
    { id: 'm2', x: 100, y: 300, width: 300, height: 48, source: 'f(a) = 2 * a' },
  ])

async function openPanel(language: SheetLanguage) {
  render(<App files={fakeFileAccess()} recovery={fakeRecovery()} language={languageMemory(language)} initialElements={sheet()} />)
  await screen.findByTestId('file-name')
  await waitFor(() => expect(document.title).toBe(language === 'pt-BR' ? 'Sem título' : 'Untitled'))
  await screen.findAllByRole('list', { name: 'Lines' })
  if (!document.querySelector('.math-tools')) fireEvent.click(await screen.findByTitle(language === 'pt-BR' ? 'Mais ferramentas' : 'More tools'))
  const words = language === 'pt-BR' ? ptBR : en
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${words.tools.mathSettings}`) }))
  await screen.findAllByRole('tab')
}

const panel = () => document.querySelector<HTMLElement>('.sheet-sidebar')!
const show = (name: string) => fireEvent.mouseDown(within(panel()).getByRole('tab', { name }))

describe('the Sheet panel in Português (0.6.0)', () => {
  it('names its six tabs, and each tab’s words are Portuguese', async () => {
    await openPanel('pt-BR')
    const tabs = within(panel()).getAllByRole('tab')
    expect(tabs.map((tab) => tab.title)).toEqual(['Formato', 'Símbolos', 'Variáveis', 'Problemas', 'Constantes', 'Configurações'])

    // Format, nothing open.
    show('Formato')
    await waitFor(() => expect(within(panel()).getByText(ptBR.panel.format.nothingOpen)).toBeInTheDocument())

    // Variables: the filter, an element named by its place, a function and an error, the ✎.
    show('Variáveis')
    const filter = await within(panel()).findByRole('searchbox', { name: 'Filtrar nomes' })
    expect(filter).toHaveAttribute('placeholder', 'Filtrar nomes')
    expect(within(panel()).getByRole('region', { name: 'Bloco 2' })).toBeInTheDocument()
    expect(within(panel()).getByRole('button', { name: /^f: função/ })).toBeInTheDocument()
    expect(within(panel()).getByRole('button', { name: /^x: erro/ })).toBeInTheDocument()
    expect(within(panel()).getByRole('button', { name: 'Renomear K' })).toHaveAttribute('title', 'Renomear K')

    // Problems: the line named in Portuguese, the marks named.
    show('Problemas')
    await waitFor(() => expect(within(panel()).getByText('Pipe flow, linha 2 · x')).toBeInTheDocument())
    expect(within(panel()).getByLabelText('erro')).toBeInTheDocument()
    expect(within(panel()).getByLabelText('aviso')).toBeInTheDocument()

    // Constants: the groups, the descriptions, "ou", and the hover.
    show('Constantes')
    await waitFor(() => expect(within(panel()).getByRole('region', { name: 'Matemáticas' })).toBeInTheDocument())
    expect(within(panel()).getByText('Velocidade da luz no vácuo')).toBeInTheDocument()
    expect(within(panel()).getByText('c ou speedOfLight')).toBeInTheDocument()
    expect(within(panel()).getByText(ptBR.panel.openALine)).toBeInTheDocument()
    expect(within(panel()).getByRole('button', { name: /^Constante de Planck: h ou planckConstant/ })).toHaveAttribute('title', 'Inserir h')
    // The filter matches the Portuguese description.
    fireEvent.change(within(panel()).getByRole('searchbox', { name: 'Filtrar constantes' }), { target: { value: 'vácuo' } })
    expect(within(panel()).getByText('Velocidade da luz no vácuo')).toBeInTheDocument()
    expect(within(panel()).queryByText('Constante de Planck')).toBeNull()

    // Symbols: the groups and a hint in its hover, which the filter matches.
    show('Símbolos')
    await waitFor(() => expect(within(panel()).getByRole('region', { name: 'Grego' })).toBeInTheDocument())
    expect(within(panel()).getByRole('region', { name: 'Formas da folha' })).toBeInTheDocument()
    expect(within(panel()).getByRole('button', { name: 'sqrt' })).toHaveAttribute('title', 'sqrt — raiz quadrada')
    fireEvent.change(within(panel()).getByRole('searchbox', { name: 'Filtrar símbolos' }), { target: { value: 'raiz' } })
    expect(within(panel()).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(
      expect.arrayContaining(['sqrt', 'cbrt']),
    )

    // Settings: the systems, Custom's table with its kinds and its units-only options, the Page row.
    show('Configurações')
    const system = await within(panel()).findByLabelText<HTMLSelectElement>('Sistema de unidades')
    expect(Array.from(system.options, (option) => option.textContent)).toEqual([
      'SI com prefixos',
      'SI, unidades de base',
      'USCS',
      'Personalizado',
    ])
    fireEvent.change(system, { target: { value: 'custom' } })
    expect(within(panel()).getByLabelText<HTMLSelectElement>('Parte de').selectedOptions[0]).toHaveTextContent('SI com prefixos')
    expect(within(panel()).getByRole('table', { name: 'Unidades personalizadas' })).toBeInTheDocument()
    expect(within(within(panel()).getByLabelText('Vazão volumétrica')).getAllByRole('option')[0]).toHaveTextContent(/^mL\/s … m\^3\/s$/)
    expect(within(panel()).getByLabelText('Energia, torque')).toBeInTheDocument()
    expect(within(panel()).getByLabelText('Dígitos')).toBeInTheDocument()
    expect(Array.from(within(panel()).getByLabelText<HTMLSelectElement>('Cor dos resultados').options, (o) => o.textContent)).toEqual([
      'Preto',
      'Azul',
      'Vermelho',
      'Verde',
      'Laranja',
      'Cinza',
    ])
    expect(Array.from(within(panel()).getByLabelText<HTMLSelectElement>('Tamanho do papel').options, (o) => o.textContent)).toEqual(['A4', 'Carta'])
    expect(Array.from(within(panel()).getByLabelText<HTMLSelectElement>('Orientação').options, (o) => o.textContent)).toEqual(['Retrato', 'Paisagem'])
  })

  it('words the rename form in Português', async () => {
    await openPanel('pt-BR')
    show('Variáveis')
    fireEvent.click(await within(panel()).findByRole('button', { name: 'Renomear K' }))
    const form = await within(panel()).findByRole('group', { name: 'Renomear K' })
    expect(within(form).getByRole('textbox', { name: 'Renomear K para' })).toHaveValue('K')
    expect(form.querySelector('.sheet-rename__heading span')?.textContent).toBe('Renomear K para')
    expect(within(form).getByText('Altera 1 linha:')).toBeInTheDocument()
    expect(within(form).getByText('Pipe flow, linha 1')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Renomear' })).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('words the open tab again at once when the language changes', async () => {
    await openPanel('en')
    show('Variables')
    expect(await within(panel()).findByRole('searchbox', { name: 'Filter names' })).toBeInTheDocument()
    // The choice in ☰, as Excalidraw hands it back.
    fireEvent.click(screen.getByTestId('main-menu-trigger'))
    await act(async () => {
      fireEvent.change(screen.getByTestId('language-select'), { target: { value: 'pt-BR' } })
    })
    await waitFor(() => expect(within(panel()).getByRole('searchbox', { name: 'Filtrar nomes' })).toBeInTheDocument())
    expect(within(panel()).getAllByRole('tab').map((tab) => tab.title)).toContain('Variáveis')
    expect(within(panel()).getByRole('button', { name: /^f: função/ })).toBeInTheDocument()
  })
})
