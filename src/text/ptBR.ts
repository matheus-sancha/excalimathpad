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
  dialogs: {
    restore: (name) =>
      name ? `Restaurar as alterações não salvas de ${name}?` : 'Restaurar as alterações não salvas de uma folha sem título?',
    saveChanges: (name) => `Salvar as alterações em ${name}?`,
    restoreButton: 'Restaurar',
    discard: 'Descartar',
    save: 'Salvar',
    dontSave: 'Não salvar',
    cancel: 'Cancelar',
    newer: 'Esta folha foi salva por um Excalimathpad mais novo. Atualize o app.',
    notASheet: 'Este arquivo não é uma folha, então não foi aberto.',
    saveFailed: (name, reason) => `Não foi possível salvar ${name}: ${reason}`,
    openFailed: (reason) => `Não foi possível abrir o arquivo: ${reason}`,
    reasons: {
      writeRefused: 'a permissão para gravar o arquivo foi negada',
      cannotWriteBack: 'este navegador não consegue gravar de volta em um arquivo',
      cannotReadAgain: 'este navegador não consegue ler um arquivo de novo',
      storeWontOpen: 'o IndexedDB não abriu',
      storeFailed: 'a transação do IndexedDB falhou',
      storeAborted: 'a transação do IndexedDB foi abortada',
    },
  },
  printView: {
    pageOf: (page, pages) => `${page} de ${pages}`,
    failed: 'Não foi possível montar as páginas, então nada foi impresso.',
  },
  failure: {
    element: 'este bloco encontrou um erro inesperado no Excalimathpad',
    chart: 'este gráfico encontrou um erro inesperado no Excalimathpad',
    tab: 'esta aba encontrou um erro inesperado no Excalimathpad',
    view: 'Esta folha encontrou um erro inesperado no Excalimathpad.',
    kept: 'Sua folha está guardada até a última linha concluída.',
    typing: 'Você estava digitando:',
    reload: 'Recarregar a folha',
    copyDetails: 'Copiar detalhes',
    copy: 'Copiar',
    copied: 'Copiado',
    report: 'Relatar este erro',
  },
  offer: {
    ask: (from, to, count) => `Renomear ${from} para ${to} em ${count === 1 ? '1 linha' : `${count} linhas`}?`,
    question: (from, to, count) => ['Renomear ', from, ' para ', to, ' ', count, '?'],
    count: (count) => (count === 1 ? 'em 1 linha' : `em ${count} linhas`),
    rename: 'Renomear',
    keep: (from) => `Manter ${from}`,
    of: (index, total) => `${index} de ${total}`,
    results: (count) => (count === 1 ? 'Isto altera 1 resultado:' : `Isto altera ${count} resultados:`),
    where: (title, element, line) => `${title ?? `Bloco ${element}`}, linha ${line}`,
    renamed: (from, to, count, touch) =>
      `${from} foi renomeado para ${to} em ${count === 1 ? '1 linha' : `${count} linhas`}. ${touch ? 'Toque em Desfazer para voltar.' : 'Ctrl+Z desfaz.'}`,
  },
  unitSlot: {
    field: 'Unidade',
    list: 'Unidades',
    sheetUnits: 'Unidades da folha',
  },
  plotSettings: {
    dialog: 'Configurações do gráfico',
    mark: 'Marca',
    point: 'Ponto',
    circle: 'Círculo',
    seriesNames: 'Nomes das séries',
    legend: 'Legenda',
    atLineEnds: 'No fim das linhas',
    points: 'Pontos',
    axis: (axis) => `Eixo ${axis}`,
    scale: (axis) => `Escala de ${axis}`,
    linear: 'Linear',
    log: 'Log',
    from: (axis) => `${axis} de`,
    to: (axis) => `${axis} até`,
    auto: 'auto',
    equalScales: 'Escalas iguais',
    size: 'Tamanho',
    title: 'Título',
    none: 'Nenhum',
  },
  vault: {
    newSheet: 'Nova folha',
    addMath: 'Adicionar cálculo',
    toggleMathSettings: 'Mostrar ou ocultar Configurações de cálculo',
    openMathGuide: 'Abrir Guia de cálculo',
    print: 'Imprimir…',
    untitled: 'Sem título',
    conflictCopy: (name, stamp) => `${name} (conflito ${stamp})`,
    conflict: (sheet, copy) => `${sheet} foi alterado em outro lugar. Sua versão foi salva ao lado como ${copy}.`,
    writeFailed: (file, reason) => `Não foi possível salvar ${file}: ${reason}. Seu trabalho continua aberto.`,
    createFailed: (file, reason) => `Não foi possível criar ${file}: ${reason}.`,
    noLookbehind: 'O Excalimathpad precisa do iOS 16.4 ou mais recente.',
    pickImage: 'Escolha uma imagem do cofre para colocar na folha',
    paper: (size, orientation) => `Escolha ${size}, ${orientation} na janela de impressão.`,
    paperSize: { A4: 'A4', Letter: 'Carta' },
    orientation: { portrait: 'retrato', landscape: 'paisagem' },
  },
}
