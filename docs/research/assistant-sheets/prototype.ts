/**
 * PROTOTYPE, throwaway. Not app code, not shipped, not tested.
 *
 * Question (wayfinder ticket #247): given the Math guide, does the chosen
 * model write sheets the engine runs?
 *
 * A scenario goes to a model with the first slice's instructions (spec
 * section 8, Math assistant), the Math guide whole and a drafting addendum of
 * the prototype's own. The model's code blocks become math elements, run
 * through `evaluateSheet`, and every line prints with its result or error.
 * With errors or warnings, the listing goes back once (the repair turn).
 *
 * Run (Node runs the TypeScript as it is):
 *   NODE_USE_ENV_PROXY=1 node docs/research/assistant-sheets/prototype.ts \
 *     [--models a,b] [--scenarios pump,beam] [--guide whole|none] [--trials n] [--at-once n] [--only-missing]
 * Keys: GEMINI_API_KEY and ANTHROPIC_API_KEY, or a proxy that adds them.
 * Writes runs/<model>/<scenario>-<guide>-<trial>.md and prints one row per run.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readSheetLine, splitLines } from '../../../src/math/evaluate.ts'
import { evaluateSheet, type EnglishLine } from '../../../src/test/english.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../..')

// --- what the model is told -------------------------------------------------

const spec = readFileSync(resolve(ROOT, 'docs/spec-v1.md'), 'utf8')
/** The instructions, read from the spec so the prototype can't drift from them. */
const INSTRUCTIONS = /\*\*The model's job\*\*[\s\S]*?```\n([\s\S]*?)```/.exec(spec)![1].trim()
const GUIDE = readFileSync(resolve(ROOT, 'docs/math-guide.md'), 'utf8')

/** The prototype's own: what a proposal is, until its ticket decides the form. */
const DRAFTING = `
Drafting a sheet. When the user asks for a sheet or a template, write it:
- as one or more code blocks; each code block is one math element, one line of source per
  line, only in the Math guide's forms;
- on the line before each code block, its title, written "Title: <title>";
- the app runs these lines, in the order given, in one scope: a line sees only names
  assigned above it;
- do not ask a question first. Write every assumption as an input line with a note, or as
  a comment line, so the user can change it;
- give every input its unit, show results in the unit an engineer expects (in <unit>), and
  do not name a variable like a unit;
- outside the code blocks write a few sentences at most.`.trim()

const REPAIR = `The app ran your lines. This is the sheet as the engine reads it, with each line's result, error and warnings. Fix every line with an error or a warning, and write the whole sheet again in the same form.`

const SCENARIOS: Record<string, string> = {
  pump: `I want to size a centrifugal pump. Water at 20 °C, 30 L/s, from an open tank to another one 12 m higher, through 85 m of 4 inch schedule 40 steel pipe with two 90° elbows and a gate valve. Draft a sheet I can use as a template: velocity, Reynolds number, friction factor (solve Colebrook), system head and shaft power at 70 % efficiency, a check that velocity is under 3 m/s, then the operating point against a pump curve H = 28 m - k Q^2 that I can edit, a table of system head and pump head over 0 to 40 L/s, and a plot of both curves.`,
  beam: `I need to dimension a simply supported steel beam: 6 m span, uniform load 12 kN/m and a 20 kN point load at midspan. Make me a template sheet: reactions, maximum moment, the section modulus required for a yield strength of 275 MPa with a safety factor I can change, the midspan deflection for a section whose I and E I type in, and a pass/fail check against span/250, in green and red.`,
  position: `Hole position check to ASME Y14.5, RFS. Measured deviation from true position: dx = 0.08 mm, dy = -0.05 mm. Position tolerance 0.25 mm (a diameter). I want the true position value, a Pass/Fail line in green and red, the percentage of the tolerance used, the margin, and a plot of the point inside the tolerance circle.`,
  hydro: `Draft a sheet for the hydrostatic body test of a pressure-containing body. Rated working pressure 10000 psi, test pressure 1.5 times rated. Bore 5.125 in, outside diameter 9 in, yield strength 75 ksi. I want the test pressure in psi and MPa, the hoop stress at the bore at test pressure as a thick-walled cylinder (Lamé), the same by the thin-wall formula for comparison, a check against an allowable fraction of yield that I set as an input, two hold periods as inputs with their total time, a pass/fail line for a measured pressure drop against a drop I allow, and a table of the bore hoop stress from 0 to the test pressure in ten steps.`,
}

// --- providers --------------------------------------------------------------

interface Model {
  shape: 'chat' | 'messages'
  base: string
  /** USD per million tokens, input and output (docs/research/provider-apis.md). */
  price: [number, number]
}
const GOOGLE = 'https://generativelanguage.googleapis.com/v1beta/openai'
const MODELS: Record<string, Model> = {
  'gemini-4-hydrogen': { shape: 'chat', base: GOOGLE, price: [1.5, 7.5] },
  'gemini-3.8-flash': { shape: 'chat', base: GOOGLE, price: [0.75, 3.75] },
  'gemini-3.5-flash-lite': { shape: 'chat', base: GOOGLE, price: [0.3, 2.5] },
  'claude-sonnet-5-5': { shape: 'messages', base: 'https://api.anthropic.com', price: [2, 10] },
  'claude-haiku-5-5': { shape: 'messages', base: 'https://api.anthropic.com', price: [0.1, 0.5] },
}

interface Turn {
  role: 'user' | 'assistant'
  content: string
}
interface Answer {
  text: string
  tokensIn: number
  tokensOut: number
  seconds: number
}

/** A free tier answers 429 and 503 often: wait and ask again, up to eight times. */
async function ask(name: string, system: string, turns: Turn[]): Promise<Answer> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await askOnce(name, system, turns)
    } catch (error) {
      if (attempt === 8 || !/: (429|503|500) /.test(String(error)) || /per day/.test(String(error))) throw error
      await new Promise((done) => setTimeout(done, 45_000 * attempt))
    }
  }
}

async function askOnce(name: string, system: string, turns: Turn[]): Promise<Answer> {
  const model = MODELS[name]
  const began = performance.now()
  let response: Response
  if (model.shape === 'chat') {
    response = await fetch(`${model.base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.GEMINI_API_KEY ?? 'proxy-injected'}`,
      },
      body: JSON.stringify({ model: name, messages: [{ role: 'system', content: system }, ...turns] }),
    })
  } else {
    response = await fetch(`${model.base}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? 'proxy-injected',
      },
      body: JSON.stringify({ model: name, max_tokens: 8000, system, messages: turns }),
    })
  }
  const seconds = (performance.now() - began) / 1000
  const body = await response.text()
  if (!response.ok) throw new Error(`${name}: ${response.status} ${body.slice(0, 400)}`)
  const json = JSON.parse(body)
  if (model.shape === 'chat') {
    return {
      text: json.choices[0].message.content ?? '',
      tokensIn: json.usage.prompt_tokens,
      // Thinking is billed as output; `total` holds it where `completion` doesn't.
      tokensOut: Math.max(json.usage.completion_tokens ?? 0, (json.usage.total_tokens ?? 0) - json.usage.prompt_tokens),
      seconds,
    }
  }
  return {
    text: json.content.filter((part: { type: string }) => part.type === 'text').map((part: { text: string }) => part.text).join(''),
    tokensIn: json.usage.input_tokens + (json.usage.cache_read_input_tokens ?? 0) + (json.usage.cache_creation_input_tokens ?? 0),
    tokensOut: json.usage.output_tokens,
    seconds,
  }
}

// --- the model's answer, through the engine ----------------------------------

interface Element {
  title: string | null
  source: string
}

/** Each code block is one math element; "Title: …" on the line before it names it. */
function elementsOf(answer: string): Element[] {
  const elements: Element[] = []
  const fence = /```[^\n]*\n([\s\S]*?)```/g
  let from = 0
  for (let match = fence.exec(answer); match !== null; match = fence.exec(answer)) {
    const before = answer.slice(from, match.index).trim().split('\n').at(-1) ?? ''
    const title = /^\**Title:\**\s*(.+?)\**$/i.exec(before.trim())
    elements.push({ title: title === null ? null : title[1], source: match[1].replace(/\n$/, '') })
    from = fence.lastIndex
  }
  return elements
}

interface Counts {
  elements: number
  lines: number
  comments: number
  errors: string[]
  warnings: string[]
  failedPoints: string[]
  forms: Record<string, number>
  /** Assigned values that show no unit: read them, some should have one. */
  bare: string[]
}

function run(elements: Element[]): { listing: string; counts: Counts } {
  const blocks = elements.map((element, index) => ({ id: `E${index + 1}`, source: element.source }))
  const results = evaluateSheet(blocks)
  const counts: Counts = { elements: elements.length, lines: 0, comments: 0, errors: [], warnings: [], failedPoints: [], forms: {}, bare: [] }
  const form = (name: string) => (counts.forms[name] = (counts.forms[name] ?? 0) + 1)
  const out = ['unit system: SI, Digits: 4', '']
  elements.forEach((element, index) => {
    const id = `E${index + 1}`
    out.push(element.title === null ? `${id}  (no title)` : `${id}  title: "${element.title}"`)
    const lines: EnglishLine[] = results.get(id) ?? []
    splitLines(element.source).forEach((text, at) => {
      const line = lines[at]
      const label = `${id}:${at + 1}`
      out.push(`${String(at + 1).padStart(3)} | ${text}`)
      const parsed = readSheetLine(text)
      if (parsed.kind === 'blank') {
        if (parsed.comment !== null) {
          counts.comments++
          form('comment')
        }
      } else {
        counts.lines++
        if (parsed.kind === 'syntax-error') form('unparsed')
        else {
          if (parsed.kind !== 'parsed') form(parsed.kind)
          if (parsed.display !== null) form('display unit')
          if (parsed.rules.length > 0) form('rule')
          if (parsed.note !== null) form('note')
          if (parsed.kind === 'parsed' && /\bif\(|\?/.test(text)) form('condition')
        }
      }
      const result = line.result
      if (result.kind === 'error') {
        out.push(`    ! error: ${result.message}`)
        counts.errors.push(`${label}  ${text}  →  ${result.message}`)
      } else if (line.table !== null) {
        const failed = line.table.rows.flat().filter((cell) => !cell.ok).length
        out.push(`    = table, ${line.table.rows.length} rows${failed > 0 ? `, ${failed} failed cells` : ''}; first 3:`)
        out.push(`      ${line.table.columns.map((column) => `${column.header}${column.unit === '' ? '' : ` (${column.unit})`}`).join(' | ')}`)
        for (const row of line.table.rows.slice(0, 3)) out.push(`      ${row.map((cell) => (cell.ok ? cell.text : `! ${cell.message}`)).join(' | ')}`)
        if (failed > 0) counts.failedPoints.push(`${label}  ${text}  →  ${failed} failed cells`)
      } else if (line.plot !== null) {
        const plot = line.plot
        out.push(`    = plot, ${plot.x.values.length} points, ${plot.series.length} series, ${plot.dots.length} dots, ${plot.circles.length} circles, ${plot.failed.length} failed; x ${plot.x.label}, y ${plot.y.label}`)
        if (plot.failed.length > 0) counts.failedPoints.push(`${label}  ${text}  →  ${plot.failed.length} failed points: ${plot.failed[0].message}`)
      } else if (result.kind === 'empty') {
        if (parsed.kind !== 'blank') out.push(`    = ${line.variables.some((variable) => variable.kind === 'function') ? '(function)' : '(input)'}`)
      } else {
        out.push(`    = ${result.text}`)
        if (result.kind === 'list' && result.failed !== null) {
          out.push(`    ! ${result.failed}`)
          counts.failedPoints.push(`${label}  ${text}  →  ${result.failed}`)
        }
        if (result.kind === 'value' && /^-?[\d.,e+\- ]+$/i.test(result.text) && parsed.kind !== 'blank' && parsed.defines.length > 0) {
          counts.bare.push(`${label}  ${text}  =  ${result.text}`)
        }
      }
      if (line.solveDetails !== null) out.push(`    solve: ${JSON.stringify(line.solveDetails).slice(0, 300)}`)
      for (const warning of line.warnings) {
        out.push(`    ~ warning: ${warning}`)
        counts.warnings.push(`${label}  ${text}  →  ${warning}`)
      }
    })
    out.push('')
  })
  return { listing: out.join('\n'), counts }
}

// --- one run ----------------------------------------------------------------

interface Row {
  model: string
  scenario: string
  guide: string
  trial: number
  first: Counts
  repaired: Counts | null
  cost: number
  seconds: number
  tokensIn: number
  tokensOut: number
}

async function one(model: string, scenario: string, guide: string, trial: number): Promise<Row> {
  const system = [INSTRUCTIONS, DRAFTING, ...(guide === 'whole' ? [`The Math guide:\n\n${GUIDE}`] : [])].join('\n\n')
  const turns: Turn[] = [{ role: 'user', content: SCENARIOS[scenario] }]
  const answers = [await ask(model, system, turns)]
  const first = run(elementsOf(answers[0].text))
  let repaired: ReturnType<typeof run> | null = null
  if (first.counts.errors.length + first.counts.warnings.length + first.counts.failedPoints.length > 0 || first.counts.elements === 0) {
    turns.push({ role: 'assistant', content: answers[0].text }, { role: 'user', content: `${REPAIR}\n\n${first.listing}` })
    answers.push(await ask(model, system, turns))
    repaired = run(elementsOf(answers[1].text))
  }
  const [priceIn, priceOut] = MODELS[model].price
  const tokensIn = answers.reduce((sum, answer) => sum + answer.tokensIn, 0)
  const tokensOut = answers.reduce((sum, answer) => sum + answer.tokensOut, 0)
  const row: Row = {
    model, scenario, guide, trial,
    first: first.counts,
    repaired: repaired?.counts ?? null,
    cost: (tokensIn * priceIn + tokensOut * priceOut) / 1e6,
    seconds: answers.reduce((sum, answer) => sum + answer.seconds, 0),
    tokensIn, tokensOut,
  }
  const report = (name: string, { listing, counts }: ReturnType<typeof run>, answer: Answer) =>
    [
      `## ${name}`,
      '',
      `${answer.seconds.toFixed(1)} s, ${answer.tokensIn} tokens in, ${answer.tokensOut} out.`,
      `${counts.elements} elements, ${counts.lines} lines, ${counts.comments} comment lines; ${counts.errors.length} errors, ${counts.warnings.length} warnings, ${counts.failedPoints.length} with failed points.`,
      `Forms: ${Object.entries(counts.forms).map(([form, count]) => `${form} ${count}`).join(', ')}`,
      '',
      ...(['errors', 'warnings', 'failedPoints', 'bare'] as const).flatMap((key) =>
        counts[key].length === 0 ? [] : [`**${key}**`, '', ...counts[key].map((entry) => `- \`${entry}\``), ''],
      ),
      '### The sheet as the engine reads it',
      '',
      '```',
      listing,
      '```',
      '',
      '### The answer as written',
      '',
      answer.text.replaceAll('```', '~~~'),
      '',
    ].join('\n')
  const file = resolve(HERE, 'runs', model, `${scenario}-${guide}-${trial}.md`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(
    file,
    [
      `# ${model}, ${scenario}, guide ${guide}, trial ${trial}`,
      '',
      `Cost $${row.cost.toFixed(4)}, ${row.seconds.toFixed(1)} s in all.`,
      '',
      `> ${SCENARIOS[scenario]}`,
      '',
      report('First answer', first, answers[0]),
      ...(repaired === null ? [] : [report('After one repair turn', repaired, answers[1])]),
    ].join('\n'),
  )
  return row
}

// --- all runs ---------------------------------------------------------------

const flag = (name: string, fallback: string) => {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? fallback : process.argv[at + 1]
}
const models = flag('models', 'gemini-4-hydrogen,gemini-3.5-flash-lite').split(',')
const scenarios = flag('scenarios', Object.keys(SCENARIOS).join(',')).split(',')
const guide = flag('guide', 'whole')
const trials = Number(flag('trials', '1'))

const jobs = models.flatMap((model) =>
  scenarios.flatMap((scenario) => Array.from({ length: trials }, (_, trial) => ({ model, scenario, trial: trial + 1 }))),
)
/** `--only-missing` skips a run whose file is there; `--at-once n` runs n at a time. */
const todo = process.argv.includes('--only-missing')
  ? jobs.filter(({ model, scenario, trial }) => !existsSync(resolve(HERE, 'runs', model, `${scenario}-${guide}-${trial}.md`)))
  : jobs
const rows: (Row | null)[] = []
const worker = async () => {
  for (let job = todo.shift(); job !== undefined; job = todo.shift()) {
    const { model, scenario, trial } = job
    rows.push(
      await one(model, scenario, guide, trial).catch((error: unknown) => {
        console.error(`FAILED ${model} ${scenario} ${trial}: ${String(error).slice(0, 300)}`)
        return null
      }),
    )
  }
}
await Promise.all(Array.from({ length: Number(flag('at-once', '8')) }, worker))
const cell = (counts: Counts | null) =>
  counts === null ? '—' : `${counts.lines} lines, ${counts.errors.length} err, ${counts.warnings.length} warn, ${counts.failedPoints.length} failed pts`
console.log('| Model | Scenario | Guide | Trial | First answer | After repair | Tokens in / out | Cost | Time |')
console.log('|---|---|---|---|---|---|---|---|---|')
for (const row of rows) {
  if (row === null) continue
  console.log(
    `| ${row.model} | ${row.scenario} | ${row.guide} | ${row.trial} | ${cell(row.first)} | ${cell(row.repaired)} | ${row.tokensIn} / ${row.tokensOut} | $${row.cost.toFixed(4)} | ${row.seconds.toFixed(0)} s |`,
  )
}
writeFileSync(resolve(HERE, 'runs', `rows-${guide}-${Date.now()}.json`), JSON.stringify(rows, null, 2))
