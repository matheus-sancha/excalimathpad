import type { AssistantPorts } from './ports.ts'

export interface AssistantTabProps {
  /** How a request is made and where the setup is kept (`ports.ts`). */
  ports: AssistantPorts
}

/**
 * The Math assistant's tab (docs/spec-v1.md section 8, Math assistant): the
 * seventh of the Sheet panel, whose frame, heading and tab the canvas draws.
 * Empty in the first issue of the first slice: the setup card and the
 * conversation fill it. It makes no request and stores nothing.
 */
export function AssistantTab(_props: AssistantTabProps) {
  return <div className="assistant-tab" data-testid="assistant-tab" />
}
