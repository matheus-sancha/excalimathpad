// The plugin build's rewrite of Excalidraw's own files (`esbuild.plugin.mjs`;
// docs/spec-v1.md section 12a, Data protection). Pure, and apart from the
// build, so a test can feed it Excalidraw's text: esbuild doesn't load under
// jsdom.

/**
 * Rewrites one of Excalidraw's files so it reaches nothing outside the vault,
 * and adds what each rule found to `tally`.
 *
 * Storage: Excalidraw reads and writes `localStorage` for its Publish library
 * and Mermaid dialogs and the minimap's first-use note (`EditorLocalStorage`),
 * for the properties panel's compact-or-full setting and for its feature
 * flags (both in `@excalidraw/common`). A read finds nothing stored, and a
 * write does nothing; neither throws, so no rule here leans on a `try` of
 * Excalidraw's. Only the three calls are rewritten: any other use of
 * `localStorage` stays in the text, and the audit fails on it.
 */
export function neutralise(code, tally = {}) {
  const found = (name, replacement) => (...match) => {
    tally[name] = (tally[name] ?? 0) + 1
    return typeof replacement === 'function' ? replacement(...match) : replacement
  }
  return (
    code
      .replace(/(?<![\w$.])(?:window\.)?localStorage\.getItem\([^()]*\)/g, found('localStorage reads', 'null'))
      .replace(
        /(?<![\w$.])(?:window\.)?localStorage\.(?:setItem|removeItem)(?=\()/g,
        found('localStorage writes', '(()=>{})'),
      )
      // The warnings those calls can no longer raise: text, which the audit would count.
      .replace(/localStorage\.(getItem|setItem|removeItem) error/g, 'storage.$1 error')
      // The font fallback: a font the bundle lacks is never fetched.
      .replace(/https:\/\/esm\.sh\//g, found('the esm.sh font fallback', 'about:blank#'))
      // excalidraw.com's build environment: collaboration, sharing, AI and
      // library backends, and the Firebase config, none of which the app starts.
      .replace(
        /(VITE_APP_[A-Z0-9_]+):("[^"]*"|'[^']*'|`[^`]*`)/g,
        found("excalidraw.com's environment values", (_, key) => `${key}:""`),
      )
  )
}
