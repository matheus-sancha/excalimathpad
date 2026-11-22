/**
 * The Math assistant's build-time switch (docs/spec-v1.md section 14, 0.7.0,
 * Off until it is proved). Both builds define `__ASSISTANT__` from it
 * (`vite.config.ts`, `esbuild.plugin.mjs`), and each home passes App the
 * assistant's ports only when it is true. It is a constant of the build: no
 * address, setting or file changes it in a built home.
 *
 * Off by default, so a build from `main` has no tab and makes no request. A
 * developer's build turns it on with `EXCALIMATHPAD_ASSISTANT=on` in the
 * build's environment. The issue that adds the assistant run turns the
 * default on (#312).
 */
export const ASSISTANT_SWITCH = 'EXCALIMATHPAD_ASSISTANT'

export function assistantSwitch(value: string | undefined): boolean {
  return value === 'on'
}
