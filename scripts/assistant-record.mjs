// `npm run assistant:record` (docs/spec-v1.md section 14, 0.7.0, Fixtures): re-records the
// Math assistant's fixtures from a real provider, by hand, on Matheus's machine. Never in CI,
// and no key is ever put in GitHub, a workflow or the repository.
//
//   ASSISTANT_PROVIDER=anthropic ASSISTANT_KEY=… npm run assistant:record
//
// ASSISTANT_PROVIDER is a built-in's id: anthropic, openai, google or openrouter. It sends the
// same small requests the adapters build (src/assistant/adapters.ts): a good streamed answer,
// the same with a wrong key, the same with a model nobody has, and the model list, and
// rewrites those fixtures with the key and account ids taken out, but only when the answer and
// the model list both came back 200: a refused key writes nothing. No credit left, a stream cut
// short and messages/answer-pieces.http (an answer in two pieces) can't be asked for: those stay
// as written from documentation. Read the diff before
// committing it, and run `npm test`, which fails on any text shaped like a key.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { modelsRequest, sendRequest } from '../src/assistant/adapters.ts'
import { PROVIDERS } from '../src/assistant/providers.ts'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../src/assistant/fixtures')

/** Which fixture each request rewrites, per built-in; null where another provider's file holds it. */
const FILES = {
  anthropic: { answer: 'messages/answer', refused: 'messages/refused-key', unknown: 'messages/unknown-model', models: 'messages/models' },
  openai: { answer: 'chat/answer', refused: 'chat/refused-key', unknown: 'chat/unknown-model', models: 'chat/models' },
  openrouter: { answer: 'chat/openrouter-answer', refused: null, unknown: null, models: null },
  google: { answer: null, refused: 'chat/google-refused-key', unknown: null, models: null },
}

/** The answer, its key and account ids taken out; only its content type kept. */
export function scrub(text, key) {
  return (key ? text.split(key).join('[the key]') : text)
    .replace(/\b(msg|req|gen|toolu|chatcmpl|cmpl|org|proj|user|acct)([-_])[A-Za-z0-9-]{6,}/g, '$1$2recorded')
    .replace(/"system_fingerprint"\s*:\s*"[^"]*"/g, '"system_fingerprint":"fp_recorded"')
    .replace(/"(organization|organization_id|user_id|workspace_id|account_id)"\s*:\s*"[^"]*"/g, '"$1":"recorded"')
}

/**
 * Why a recording isn't written, or null: the answer and the model list must both be a 200,
 * or the key (or the address) is wrong and the fixtures would only hold that refusal.
 */
export function refusal(answers) {
  const bad = answers.filter(({ name, status }) => (name === 'answer' || name === 'models') && status !== 200)
  if (!bad.length) return null
  return (
    `Nothing was written: ${bad.map(({ name, status }) => `the ${name} request got ${status}`).join(', ')}. ` +
    'Check the key (and ASSISTANT_PROVIDER), then record again.'
  )
}

async function main() {
  if (process.env.CI) throw new Error('assistant:record is never run in CI.')
  const id = process.env.ASSISTANT_PROVIDER
  const key = process.env.ASSISTANT_KEY ?? ''
  const provider = PROVIDERS.find((one) => one.id === id)
  if (!provider || !key) throw new Error('Set ASSISTANT_PROVIDER (anthropic, openai, google or openrouter) and ASSISTANT_KEY.')
  const target = { address: provider.address, adapter: provider.adapter, provider: provider.id, key }
  const carried = (model) => ({
    model,
    instructions: 'You are a test of a streamed answer.',
    guide: 'Answer in one word.',
    listing: null,
    conversation: [],
    message: 'Reply with exactly: Hello!',
  })
  const host = new URL(provider.address).host
  const today = new Date().toISOString().slice(0, 10)
  const requests = {
    answer: sendRequest(target, carried(provider.defaultModel)),
    refused: sendRequest({ ...target, key: 'wrong-key-for-a-recording' }, carried(provider.defaultModel)),
    unknown: sendRequest(target, carried('no-such-model-excalimathpad')),
    models: modelsRequest(target),
  }
  // Every answer is read before any file is written, so a refused key or a fault changes nothing.
  const answers = []
  for (const [name, { address, ...init }] of Object.entries(requests)) {
    const answer = await fetch(address, init)
    const body = scrub(await answer.text(), key)
    if (body.includes(key)) throw new Error(`The key is still in the ${name} answer; nothing was written.`)
    answers.push({ name, status: answer.status, type: answer.headers.get('content-type'), body })
  }
  const failed = refusal(answers)
  if (failed) throw new Error(failed)
  for (const { name, status, type, body } of answers) {
    const file = FILES[provider.id][name]
    if (!file) continue
    const text = `# recorded ${today} from ${host}\n# by npm run assistant:record, the key and account ids taken out.\nHTTP ${status}\ncontent-type: ${type ?? 'application/octet-stream'}\n\n${body}`
    writeFileSync(join(fixtures, `${file}.http`), text)
    console.log(`${file}.http: ${status}`)
  }
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href)
  main().catch((error) => {
    // The message is the script's own, never the provider's answer, so it can't hold the key.
    console.error(error instanceof Error ? error.message : 'assistant:record failed')
    process.exit(1)
  })
