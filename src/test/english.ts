import { evaluateSheet as evaluate, type SheetBlock, type SheetLine } from '../math/evaluate.ts'
import type { DisplaySettings } from '../math/display.ts'
import { isEngineMessage, type EngineMessage } from '../math/messages.ts'
import { planRename as plan, type RenamePlan } from '../math/rename.ts'
import { en } from '../text/en.ts'
import { wordMessage, wordPreview } from '../text/engine.ts'

/**
 * The engine's results in English, for the tests that compare English
 * (docs/spec-v1.md section 14, 0.6.0: engine tests keep their English,
 * through the English table). Every message in a value is worded by
 * `en.engine`, so a test reads a line's error, warnings, failed points and
 * rule states as the sheet shows them in English. New tests compare codes.
 */

/** A value with every engine message in it worded in English. */
export type English<T> = T extends EngineMessage
  ? string
  : T extends readonly (infer U)[]
    ? English<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: English<T[K]> }
      : T

/** A sheet line in English, its list's hover one text, a row per line. */
export type EnglishLine = Omit<English<SheetLine>, 'listPreview'> & { listPreview: string | null }

/** One message in English. */
export function english(message: EngineMessage): string {
  return wordMessage(en.engine, message)
}

/** Every engine message inside `value` in English. */
export function inEnglish<T>(value: T): English<T> {
  return word(value) as English<T>
}

function word(value: unknown): unknown {
  if (isEngineMessage(value)) return english(value)
  if (Array.isArray(value)) return value.map(word)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, word(inner)]))
  }
  return value
}

/** A sheet line in English. */
export function englishLine(line: SheetLine): EnglishLine {
  return { ...inEnglish(line), listPreview: line.listPreview === null ? null : wordPreview(en.engine, line.listPreview) }
}

/** `evaluateSheet`, with every line in English. */
export function evaluateSheet(
  blocks: readonly SheetBlock[],
  settings?: DisplaySettings,
): ReadonlyMap<string, EnglishLine[]> {
  return new Map([...evaluate(blocks, settings)].map(([id, lines]) => [id, lines.map(englishLine)]))
}

/** `planRename`, its refusal and warning in English. */
export function planRename(...args: Parameters<typeof plan>): English<RenamePlan> | null {
  const planned = plan(...args)
  return planned === null ? null : inEnglish(planned)
}
