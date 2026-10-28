/**
 * Scene <-> stage coordinates.
 *
 * Scene coordinates are the source of truth for where a math element is.
 * Stage coordinates are CSS pixels relative to the shell's stage box, which
 * is also the Excalidraw container (offset 0), so this matches Excalidraw's
 * own `sceneCoordsToViewportCoords` minus the container's page offset.
 */
export interface Viewport {
  scrollX: number
  scrollY: number
  zoom: number
}

export interface Point {
  x: number
  y: number
}

export function sceneToStage(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x + viewport.scrollX) * viewport.zoom,
    y: (point.y + viewport.scrollY) * viewport.zoom,
  }
}

export function stageToScene(point: Point, viewport: Viewport): Point {
  return {
    x: point.x / viewport.zoom - viewport.scrollX,
    y: point.y / viewport.zoom - viewport.scrollY,
  }
}
