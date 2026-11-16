// The KaTeX font families the plugin leaves out (docs/spec-v1.md section 14,
// M4e, Lighter plugin). Pure, so the build (`esbuild.plugin.mjs`, which Node
// runs with this file as it is) and the font test (`katexFonts.test.tsx`) read
// the same list and the same CSS. Not app code: nothing in `src/` imports it.
//
// The app writes its own TeX (`src/math/typeset.ts`) and never asks for
// `\mathcal`, `\mathfrak`, `\mathscr` or `\mathsf`. A Unicode math letter pasted into a
// name or a text (𝔄, 𝖠, 𝒜) is the one way in: KaTeX sets it in its Fraktur,
// SansSerif or Script class, and the plugin then draws it in a system font
// (section 14). The font test typesets every Math guide line and the
// acceptance sheets, and fails on a class whose font is dropped here.

/** KaTeX's families that the plugin's `styles.css` carries no font for. */
export const DROPPED_KATEX_FONTS: readonly string[] = ['Caligraphic', 'Fraktur', 'SansSerif', 'Script']

const FACE = /@font-face\s*\{[^}]*\}/g
const FAMILY = /font-family:\s*["']?KaTeX_([A-Za-z0-9]+)/

/**
 * KaTeX's CSS as the plugin ships it: woff2 only (the browsers that run
 * Obsidian read it), and no `@font-face` for a dropped family. Throws if a
 * dropped family has no face to drop, so a KaTeX upgrade that renames one
 * fails the build rather than shipping the font.
 */
export function trimKatexCss(css: string): string {
  const dropped = new Set<string>()
  const trimmed = css
    .replace(/,\s*url\([^)]*\.(woff|ttf)\)\s*format\("(woff|truetype)"\)/g, '')
    .replace(FACE, (face) => {
      const family = FAMILY.exec(face)?.[1]
      if (family === undefined || !DROPPED_KATEX_FONTS.includes(family)) return face
      dropped.add(family)
      return ''
    })
  const missed = DROPPED_KATEX_FONTS.filter((family) => !dropped.has(family))
  if (missed.length > 0) throw new Error(`KaTeX's CSS has no @font-face for KaTeX_${missed.join(', KaTeX_')} to drop`)
  return trimmed
}

/**
 * The classes KaTeX draws in a dropped family, read from its CSS
 * (`.katex .mathfrak, .katex .textfrak { font-family: KaTeX_Fraktur }`).
 */
export function droppedClasses(css: string): Set<string> {
  const classes = new Set<string>()
  for (const [, selectors, body] of css.replace(FACE, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!DROPPED_KATEX_FONTS.includes(FAMILY.exec(body)?.[1] ?? '')) continue
    for (const [, name] of selectors.matchAll(/\.([\w-]+)/g)) if (name !== 'katex') classes.add(name)
  }
  return classes
}
