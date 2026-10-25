import { AppShell } from './shell/AppShell.tsx'
import { SheetCanvas } from './canvas/SheetCanvas.tsx'

/**
 * Composition root: decides what fills each slot of the shell.
 * The math overlay (issue #2) and the side panel are not built yet, so their
 * slots are left empty.
 */
export default function App() {
  return <AppShell canvas={<SheetCanvas />} />
}
