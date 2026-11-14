import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { browserFileAccess } from './file/fileAccess.ts'
import { indexedDbRecovery } from './file/recovery.ts'
import { storagePanelMemory } from './panel/panelMemory.ts'

/**
 * The web app's entry (docs/spec-v1.md section 12a, One source, two builds):
 * the browser's own file pickers, IndexedDB recovery copy and per-browser panel
 * memory. The plugin's entry is `plugin/main.ts`, which gives App a vault.
 */
const panelMemory = storagePanelMemory(() => {
  try {
    return window.localStorage
  } catch {
    return null
  }
})

createRoot(window.document.getElementById('root')!).render(
  <StrictMode>
    <App files={browserFileAccess()} recovery={indexedDbRecovery()} panelMemory={panelMemory} />
  </StrictMode>,
)
