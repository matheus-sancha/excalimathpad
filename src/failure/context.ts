import { createContext } from 'react'
import type { FailureHome } from './details.ts'

/** What the actions need from the app: where it runs, and the sheet's own text to keep out. */
export interface FailureReport {
  home: FailureHome
  words: () => readonly string[]
}

/** Given by `App`; alone (a test of one part), it reads as the web with no sheet. */
export const FailureContext = createContext<FailureReport>({
  home: { version: __APP_VERSION__, stamp: __BUILD_STAMP__, home: 'web', device: null },
  words: () => [],
})
