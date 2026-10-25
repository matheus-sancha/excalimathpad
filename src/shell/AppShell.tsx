import type { ReactNode } from 'react'
import './AppShell.css'

export interface AppShellProps {
  /** The drawing surface. Fills the main area. */
  canvas: ReactNode
  /**
   * Layer stacked exactly over the canvas (same box), for elements that must
   * stay glued to canvas coordinates. It does not take pointer events itself,
   * so the canvas stays interactive; children opt back in with
   * `pointer-events: auto`. Rendered only when truthy, so
   * `overlay={ready && <X />}` leaves no empty layer behind.
   */
  overlay?: ReactNode
  /** Docked panel on the right. Rendered only when truthy (same as overlay). */
  sidePanel?: ReactNode
}

/** Full-viewport layout with three slots: canvas, overlay and side panel. */
export function AppShell({ canvas, overlay, sidePanel }: AppShellProps) {
  return (
    <div className="app-shell">
      <main className="app-shell__stage">
        <div className="app-shell__canvas">{canvas}</div>
        {overlay ? (
          <div className="app-shell__overlay" data-testid="app-shell-overlay">
            {overlay}
          </div>
        ) : null}
      </main>
      {sidePanel ? (
        <aside className="app-shell__side-panel" aria-label="Side panel">
          {sidePanel}
        </aside>
      ) : null}
    </div>
  )
}
