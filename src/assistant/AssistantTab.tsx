import { useWords } from '../text/words.ts'
import type { AssistantPorts } from './ports.ts'
import { SetupCard } from './SetupCard.tsx'
import { setupKeeper } from './setup.ts'
import './AssistantTab.css'

export interface AssistantTabProps {
  /** How a request is made and where the setup is kept (`ports.ts`). */
  ports: AssistantPorts
  /** In Obsidian, where the card's words on the key's place differ (section 13). */
  vault?: boolean
}

/**
 * The Math assistant's tab (docs/spec-v1.md section 8, Math assistant): the
 * seventh of the Sheet panel, whose frame, heading and tab the canvas draws.
 * It holds the setup card; the conversation takes its place, once built, where
 * a setup is saved. Where the home has no store (an Obsidian older than
 * 1.11.4) it says so and holds nothing else. It makes no request.
 */
export function AssistantTab({ ports, vault = false }: AssistantTabProps) {
  const words = useWords().assistant
  return (
    <div className="sheet-panel assistant-tab" data-testid="assistant-tab">
      {ports.store ? (
        <SetupCard keeper={setupKeeper(ports.store)} vault={vault} />
      ) : (
        <p className="assistant-card__about">{words.needsObsidian}</p>
      )}
    </div>
  )
}
