import { describe, expect, it } from 'vitest'
import { readLine } from './lineForm.ts'

describe('readLine (docs/spec-v1.md section 3, step 1: the comment)', () => {
  it.each([
    ['an empty line', ''],
    ['spaces only', '   '],
    ['a bare #', '#'],
    ['a # with spaces', '  #  '],
  ])('reads %s as blank, a spacer row', (_, line) => {
    expect(readLine(line)).toEqual({ kind: 'blank' })
  })

  it('reads a line starting with # as a comment line, without the #', () => {
    expect(readLine('# Water at 20 C, 4" Sch 40 steel')).toEqual({
      kind: 'comment',
      text: 'Water at 20 C, 4" Sch 40 steel',
    })
    expect(readLine('   #indented')).toEqual({ kind: 'comment', text: 'indented' })
  })

  it('splits a note off code at the first #', () => {
    expect(readLine('K = 4*0.9 + 0.5 # 4 elbows # and more')).toEqual({
      kind: 'code',
      code: 'K = 4*0.9 + 0.5',
      note: '4 elbows # and more',
    })
  })

  it('keeps code without a note as typed, but for trailing spaces', () => {
    expect(readLine('  D = 102.3 mm  ')).toEqual({ kind: 'code', code: '  D = 102.3 mm', note: null })
    expect(readLine('D = 102.3 mm #')).toEqual({ kind: 'code', code: 'D = 102.3 mm', note: null })
  })

  it('ignores a # inside a string', () => {
    expect(readLine('s = "a # b" # note')).toEqual({ kind: 'code', code: 's = "a # b"', note: 'note' })
    expect(readLine("s = 'a # b'")).toEqual({ kind: 'code', code: "s = 'a # b'", note: null })
    expect(readLine('s = "say \\"#\\"" # n')).toEqual({
      kind: 'code',
      code: 's = "say \\"#\\""',
      note: 'n',
    })
  })

  it("reads ' after a value as a transpose, not a string", () => {
    expect(readLine("B = A' # transposed")).toEqual({ kind: 'code', code: "B = A'", note: 'transposed' })
  })
})
