import { expect, it, vi } from 'vitest'
import { acceptanceSheet, guideSheets, report, sheetChecker } from './test/sheetStates.tsx'

/**
 * The typing test (docs/spec-v1.md section 14, M4e): every Math guide example
 * and every acceptance sheet, typed one character at a time with the lines
 * above in place, through the engine and the view. It fails on any throw and
 * on any state that reaches the per-line guard (section 4, Unexpected
 * failures): a half-typed line is the sheet's own error, never the app's.
 *
 * It reads its lines from the guide and from `docs/acceptance/*.md`, so it
 * grows with them: the pump sheet today, the true-position sheet once its
 * file is there.
 */
const ACCEPTANCE = import.meta.glob<string>('../docs/acceptance/*.md', { query: '?raw', import: 'default', eager: true })

it('types every guide example and acceptance sheet one character at a time', { timeout: 900_000 }, async () => {
  const sheets = [
    ...guideSheets(),
    ...Object.entries(ACCEPTANCE).map(([path, text]) => acceptanceSheet(path.replace(/^.*\//, ''), text)),
  ]
  // The guide's sections with examples, and the pump sheet's 43 lines.
  expect(sheets.filter(({ name }) => name.startsWith('guide: ')).length).toBeGreaterThanOrEqual(13)
  expect(sheets.find(({ name }) => name === 'pump-sizing.md')?.lines).toHaveLength(43)
  for (const { name, lines } of sheets) expect(lines.length, name).toBeGreaterThan(0)

  const checker = await sheetChecker()
  // React reports a render's throw here; anything else printed is a finding too.
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  for (const sheet of sheets) {
    sheet.lines.forEach((full, k) => {
      const above = sheet.lines.slice(0, k)
      for (let end = 1; end <= full.length; end++) checker.check(sheet.name, [...above, full.slice(0, end)], k)
    })
  }
  const printed = errors.mock.calls.map((call) => call.map(String).join(' ').slice(0, 300))
  errors.mockRestore()

  expect(checker.states()).toBeGreaterThan(4000)
  expect(report(checker.findings), `${checker.findings.length} findings`).toBe('')
  expect([...new Set(printed)]).toEqual([])
})
