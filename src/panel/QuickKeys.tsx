import type { SymbolInsert } from '../math/symbols.ts'
import { QUICK_KEYS } from './quickKeys.ts'
import { InsertButton } from './SymbolsTab.tsx'
import { useWords } from '../text/words.ts'

/**
 * The pinned row of quick keys above the Sheet panel's tab icons, on touch
 * while a line or the title is open. Each key is a no-focus button
 * (section 14), so a press keeps the open line and its on-screen keyboard;
 * each insert is one step of the field's own Ctrl+Z.
 */
export function QuickKeys({ onInsert }: { onInsert: (insert: SymbolInsert) => void }) {
  const w = useWords()
  return (
    <div className="sheet-quick-keys" role="toolbar" aria-label={w.panel.quickKeys}>
      {QUICK_KEYS.map((key) => (
        <InsertButton
          key={key.label}
          className="sheet-quick-keys__key"
          label={w.panel.keys[key.name]}
          hover={w.panel.keys[key.name]}
          dimmed={false}
          onPress={() => onInsert(key.insert)}
        >
          {key.label}
        </InsertButton>
      ))}
    </div>
  )
}
