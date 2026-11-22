import { useState, useSyncExternalStore } from 'react'
import { useWords } from '../text/words.ts'
import { Chat } from './Chat.tsx'
import type { Conversation } from './conversation.ts'
import type { AssistantPorts, SetupStore } from './ports.ts'
import { SetupCard } from './SetupCard.tsx'
import { setupKeeper } from './setup.ts'
import { canSend, type AssistantSheet } from './sheet.ts'
import './AssistantTab.css'

export interface AssistantTabProps {
  /** How a request is made and where the setup is kept (`ports.ts`). */
  ports: AssistantPorts
  /** In Obsidian, where the card's words on the key's place differ (section 13). */
  vault?: boolean
  /**
   * The open sheet's conversation, held above the tab (section 14, 0.7.0), and the sheet it
   * reads. Without them the tab holds the setup card only.
   */
  conversation?: Conversation
  sheet?: AssistantSheet
}

/**
 * The Math assistant's tab (docs/spec-v1.md section 8, Math assistant): the seventh of the
 * Sheet panel, whose frame, heading and tab the canvas draws. With no setup saved it holds
 * the setup card; with one, the conversation, whose field gives way to the card when the key
 * button opens it or the key is removed. Where the home has no store (an Obsidian older than
 * 1.11.4) it says so and holds nothing else.
 */
export function AssistantTab({ ports, vault = false, conversation, sheet }: AssistantTabProps) {
  const words = useWords().assistant
  return (
    <div className="sheet-panel assistant-tab" data-testid="assistant-tab">
      {ports.store ? (
        <Inside store={ports.store} request={ports.request} vault={vault} conversation={conversation} sheet={sheet} />
      ) : (
        <p className="assistant-card__about">{words.needsObsidian}</p>
      )}
    </div>
  )
}

function Inside({
  store,
  request,
  vault,
  conversation,
  sheet,
}: { store: SetupStore; request: AssistantPorts['request']; vault: boolean; conversation?: Conversation; sheet?: AssistantSheet }) {
  const keeper = setupKeeper(store)
  const { setup } = useSyncExternalStore(keeper.subscribe, keeper.state)
  const [card, setCard] = useState(false)
  const setupCard = <SetupCard keeper={keeper} request={request} vault={vault} />
  if (!conversation || !sheet || !setup) return setupCard
  return (
    <Chat
      conversation={conversation}
      sheet={sheet}
      setup={setup}
      keeper={keeper}
      request={request}
      onKey={() => setCard(!card)}
      composer={card || !canSend(setup) ? setupCard : undefined}
    />
  )
}
