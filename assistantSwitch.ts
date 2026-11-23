/**
 * The Math assistant's build-time switch (docs/spec-v1.md section 14, 0.7.0,
 * Off until it is proved). Both builds define `__ASSISTANT__` from it
 * (`vite.config.ts`, `esbuild.plugin.mjs`), and each home passes App the
 * assistant's ports only when it is true. It is a constant of the build: no
 * address, setting or file changes it in a built home.
 *
 * On since the assistant run proved it (#312), so a build from `main` has the
 * tab on a computer. A developer's build can still turn it off with
 * `EXCALIMATHPAD_ASSISTANT=off` in the build's environment.
 */
export const ASSISTANT_SWITCH = 'EXCALIMATHPAD_ASSISTANT'

export function assistantSwitch(value: string | undefined): boolean {
  return value !== 'off'
}
