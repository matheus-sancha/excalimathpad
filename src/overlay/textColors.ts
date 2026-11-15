import type { TextColor } from '../math/lineForm.ts'

/**
 * The six text colours' values (docs/spec-v1.md section 4, Colours and rules):
 * the overlay's `--math-result`, and the Format tab's sample, which draws results
 * as the sheet does.
 */
export const TEXT_COLOR_VALUES: Record<TextColor, string> = {
  black: '#1e1e1e',
  blue: '#1971c2',
  red: '#e03131',
  green: '#2f9e44',
  orange: '#e8590c',
  gray: '#868e96',
}
