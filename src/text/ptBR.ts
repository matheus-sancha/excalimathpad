import type { Words } from './en.ts'

/**
 * The Português (Brasil) text table (docs/spec-v1.md section 14, 0.6.0): the
 * same keys as `en.ts`, typed against them, so a key missing here or added
 * here alone fails `tsc -b`. The words are spec section 2's Português column
 * and section 13's; a wording not there is drafted from the glossary
 * (#286) and the edges (#287), and reviewed on its pull request.
 */
export const ptBR: Words = {
  menu: {
    open: 'Abrir…',
    save: 'Salvar',
    saveAs: 'Salvar como…',
    print: 'Imprimir…',
    mathGuide: 'Guia de cálculo',
    language: 'Idioma',
    buildStamp: 'Esta versão',
  },
  tools: {
    heading: 'Cálculo',
    addMath: 'Adicionar cálculo',
    addMathTitle: 'Adicionar cálculo — M',
    mathSettings: 'Configurações de cálculo',
    mathSettingsTitle: 'Configurações de cálculo: variáveis, problemas e configurações',
    errors: (count) => (count === 1 ? '1 erro' : `${count} erros`),
  },
  welcome: {
    hint: 'Pressione M, ou escolha Adicionar cálculo em Mais ferramentas, e clique na tela para inserir um cálculo',
    hintTouch: 'Toque em Mais ferramentas, depois em Adicionar cálculo, e então toque na folha',
    open: 'Abrir…',
  },
  hint: {
    selected: 'Clique duas vezes em uma linha ou pressione Enter para editar',
    selectedTouch: 'Toque duas vezes em uma linha, ou toque em Editar em Configurações de cálculo',
  },
  file: {
    untitled: 'Sem título',
    pickerType: 'Folha do Excalimathpad',
  },
  print: {
    browserLine: 'Use Imprimir… no menu do app',
  },
}
