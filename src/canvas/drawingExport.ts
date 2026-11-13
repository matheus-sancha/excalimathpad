import { exportToSvg, getCommonBounds } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { isMathAnchor } from './mathAnchor.ts'

/** The sheet's drawings as one SVG, and where its top-left sits in the scene. */
export interface DrawingExport {
  svg: SVGSVGElement
  left: number
  top: number
}

/**
 * The drawings for print (docs/spec-v1.md sections 11 and 14): Excalidraw's
 * public `exportToSvg` of every live element but the math anchors, in light
 * colours on no background, so the page is white whatever the dark mode or the
 * canvas background. No padding, so the SVG's top-left is the drawings' common
 * bounds. Null when the sheet has no drawings. Reads the scene; never writes it.
 */
export async function exportDrawings(
  api: Pick<ExcalidrawImperativeAPI, 'getSceneElements' | 'getAppState' | 'getFiles'>,
): Promise<DrawingExport | null> {
  const elements = api.getSceneElements().filter((element) => !isMathAnchor(element))
  if (elements.length === 0) return null
  const [left, top] = getCommonBounds(elements)
  const svg = await exportToSvg({
    elements,
    appState: {
      ...api.getAppState(),
      exportBackground: false,
      exportWithDarkMode: false,
      exportEmbedScene: false,
      frameRendering: { enabled: true, name: false, outline: false, clip: true },
    },
    files: api.getFiles(),
    exportPadding: 0,
  })
  return { svg, left, top }
}
