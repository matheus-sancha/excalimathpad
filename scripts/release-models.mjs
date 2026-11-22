// A default model's retirement (docs/spec-v1.md section 12a, Releases; 0.7.0): a step of the
// Release button only. It refuses a release within 90 days of a known retirement date, or when
// any default was last checked more than 180 days ago. `npm run check` and pull requests aren't
// held by the calendar. Node runs the constants' TypeScript as it is (they import nothing).
import { pathToFileURL } from 'node:url'
import { PROVIDERS } from '../src/assistant/providers.ts'

export const RETIRES_WITHIN = 90
export const CHECKED_WITHIN = 180

const DAY = 86_400_000
const days = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY)

/** Why a release on `today` (`YYYY-MM-DD`) is refused, one line per default; none when it may go. */
export function refusals(providers, today) {
  const lines = []
  for (const { name, defaultModel, retires, checked, deprecations } of providers) {
    const where = `src/assistant/providers.ts`
    if (retires !== null && days(today, retires) <= RETIRES_WITHIN)
      lines.push(
        `${name}'s default model, ${defaultModel}, retires on ${retires}, ${days(today, retires)} days from ${today} ` +
          `(the limit is ${RETIRES_WITHIN}). Choose another default in ${where}, and check it on ${deprecations}.`,
      )
    if (days(checked, today) > CHECKED_WITHIN)
      lines.push(
        `${name}'s default model, ${defaultModel}, was last checked on ${checked}, ${days(checked, today)} days ago ` +
          `(the limit is ${CHECKED_WITHIN}). Read ${deprecations}, and update its line in ${where}, the date included.`,
      )
  }
  return lines
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const today = new Date().toISOString().slice(0, 10)
  const lines = refusals(PROVIDERS, today)
  if (lines.length) {
    for (const line of lines) console.error(line)
    process.exit(1)
  }
  console.log(`The default models: none retires within ${RETIRES_WITHIN} days, each checked within ${CHECKED_WITHIN}.`)
}
