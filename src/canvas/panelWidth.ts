/**
 * The Sheet panel's width and the width it docks at (docs/spec-v1.md section
 * 8, Sheet panel, M4e, #198). The width is the value of Excalidraw's
 * `--right-sidebar-width`; the panel itself is 8 px narrower.
 */

/** The width a new device starts at, and the one a double-click or Home puts back. */
export const PANEL_WIDTH = 320
/** The drag handle's range. */
export const PANEL_WIDTH_MIN = 280
export const PANEL_WIDTH_MAX = 480
/** How far ← and → move the focused handle. */
export const PANEL_WIDTH_STEP = 16
/** The room Excalidraw's toolbar needs beside a docked panel. */
export const TOOLBAR_ROOM = 640

/** A width inside the handle's range, in whole px; anything that isn't a number is the default. */
export function clampPanelWidth(width: number | null | undefined): number {
  if (typeof width !== 'number' || !Number.isFinite(width)) return PANEL_WIDTH
  return Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, Math.round(width)))
}

/**
 * The docking width: the panel docks when the editor is wider than this, and
 * floats at or below it. The one value both Excalidraw
 * (`UIOptions.dockedSidebarBreakpoint`) and the app's own decisions use
 * (section 14): `SheetCanvas` passes it and answers `panelDocks()` from it.
 */
export function docksAbove(width: number): number {
  return TOOLBAR_ROOM + width
}

/** Where the width is remembered, per device and never in the file: `PanelMemory` is one. */
export interface PanelWidthMemory {
  /** The width as last remembered; null when none is. */
  rememberedWidth(): number | null
  rememberWidth(width: number): void
}
