import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { browserFileAccess } from './file/fileAccess.ts'
import { indexedDbRecovery } from './file/recovery.ts'
import { storagePanelMemory } from './panel/panelMemory.ts'
import { storageLanguageMemory } from './canvas/language.ts'

/**
 * The web app's entry (docs/spec-v1.md section 12a, One source, two builds):
 * the browser's own file pickers, IndexedDB recovery copy and per-browser panel
 * and language memory (section 8, Language, 0.5.0). The plugin's entry is `plugin/main.ts`, which gives App a vault.
 */
const storage = () => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
const panelMemory = storagePanelMemory(storage)
const language = storageLanguageMemory(storage)

createRoot(window.document.getElementById('root')!).render(
  <StrictMode>
    <App files={browserFileAccess()} recovery={indexedDbRecovery()} panelMemory={panelMemory} language={language} />
  </StrictMode>,
)
