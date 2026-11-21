import { isEngineMessage, type EngineMessage, type MessageCode, type MessageOf } from '../math/messages.ts'

/**
 * The engine's messages in words (ADR 0007; docs/spec-v1.md section 13, and
 * section 14, 0.6.0). The engine returns a code and its arguments
 * (`src/math/messages.ts`); each text table words every code in its `engine`
 * group (`engine.en.ts`, `engine.ptBR.ts`), and `wordMessage` is the one way
 * a message becomes text: the overlay, the Sheet panel and the tests read it
 * through here, with the table of the language shown.
 *
 * A message inside a message (`in k(1 s): …`) reaches its code's wording
 * already worded, as a string.
 */

/** A message's arguments as its wording takes them: each message inside it already worded. */
export type Worded<M> = {
  [K in keyof M]: M[K] extends EngineMessage ? string : M[K] extends EngineMessage | null ? string | null : M[K]
}

/** A text table's `engine` group: one wording for every code. */
export type EngineWords = { [C in MessageCode]: (message: Worded<MessageOf<C>>) => string }

/** A message in the words of `engine`, a text table's `engine` group. */
export function wordMessage(engine: EngineWords, message: EngineMessage): string {
  const worded: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(message)) {
    worded[key] = isEngineMessage(value) ? wordMessage(engine, value) : value
  }
  return (engine[message.code] as (message: unknown) => string)(worded)
}

/** A list's hover, `1: 12.04 m` a row, each failed point's row worded (section 10). */
export function wordPreview(engine: EngineWords, rows: readonly (string | EngineMessage)[]): string {
  return rows.map((row) => (typeof row === 'string' ? row : wordMessage(engine, row))).join('\n')
}
