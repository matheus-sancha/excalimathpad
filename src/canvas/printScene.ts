import { exportToSvg as excalidrawExportToSvg, getCommonBounds } from '@excalidraw/excalidraw'
import type { ExcalidrawElement, NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { isMathAnchor } from './mathAnchor.ts'

/**
 * Excalidraw 0.18.1's `exportToSvg`, with the shape this file uses stated:
 * its `.d.ts` imports types the package doesn't ship, so the type-aware lint
 * reads it as an error type (CONTEXT.md, Load-bearing).
 */
const exportToSvg = excalidrawExportToSvg as (options: {
  elements: readonly NonDeletedExcalidrawElement[]
  appState: { exportBackground: boolean; exportWithDarkMode: boolean; exportScale: number; exportEmbedScene: boolean }
  files: BinaryFiles | null
  exportPadding: number
  skipInliningFonts?: true
}) => Promise<SVGSVGElement>

/**
 * The scene's half of the print view (docs/spec-v1.md section 11, Print, and
 * section 14, Print): the drawings' boxes for the page breaks, the math
 * anchors' places, and the drawings as SVG for each page, from Excalidraw's
 * public `getCommonBounds` and `exportToSvg`. Nothing here writes the scene.
 */
export type PrintSceneApi = Pick<ExcalidrawImperativeAPI, 'getSceneElements' | 'getFiles'>

/** A drawing's axis-aligned box, in scene units. */
export interface DrawingBox {
  id: string
  x: number
  y: number
  width: number
  height: number
}

/** The drawings for one page as SVG, and where its top-left sits in the scene. */
export interface DrawingsSvg {
  svg: SVGSVGElement
  x: number
  y: number
}

/** Every drawing: what isn't a math anchor, Excalidraw text included. */
function drawingsOf(api: PrintSceneApi): NonDeletedExcalidrawElement[] {
  return api.getSceneElements().filter((element) => !element.isDeleted && !isMathAnchor(element))
}

/** An element's box, rotation included, as Excalidraw bounds it. */
function boxOf(element: ExcalidrawElement): DrawingBox {
  const [minX, minY, maxX, maxY] = getCommonBounds([element])
  return { id: element.id, x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** Every drawing's box (section 11, Page breaks: Excalidraw text counts as a drawing). */
export function drawingBoxes(api: PrintSceneApi): DrawingBox[] {
  return drawingsOf(api).map(boxOf)
}

/** The math anchors' places: position and rotation; their size is the overlay's laid-out body. */
export function anchorPlaces(api: PrintSceneApi): { id: string; x: number; y: number; angle: number }[] {
  return api
    .getSceneElements()
    .filter(isMathAnchor)
    .map(({ id, x, y, angle }) => ({ id, x, y, angle: Number(angle) || 0 }))
}

/**
 * The drawings that cross the band from `top` to `bottom`, as one SVG at 1
 * scene unit to 1 px, without the anchors, in light colours on no background
 * (section 11: a white page whatever the dark mode or canvas background), with
 * the scene's images. Null when no drawing crosses it. `inlineFonts` puts
 * Excalidraw's fonts inside the SVG, for a document that hasn't loaded them.
 */
export async function drawingsSvg(
  api: PrintSceneApi,
  top: number,
  bottom: number,
  { inlineFonts = false }: { inlineFonts?: boolean } = {},
): Promise<DrawingsSvg | null> {
  const elements = drawingsOf(api).filter((element) => {
    const box = boxOf(element)
    return box.y < bottom && box.y + box.height > top
  })
  if (elements.length === 0) return null
  const [x, y] = getCommonBounds(elements)
  const svg = await exportToSvg({
    elements,
    appState: { exportBackground: false, exportWithDarkMode: false, exportScale: 1, exportEmbedScene: false },
    files: api.getFiles(),
    exportPadding: 0,
    ...(inlineFonts ? {} : { skipInliningFonts: true as const }),
  })
  return { svg, x, y }
}
