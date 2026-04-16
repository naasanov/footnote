'use client'

import { useMemo } from 'react'
import { useEditor, useValue } from 'tldraw'
import type { CanvasBackground } from '@/lib/types'

interface CanvasPaperBackgroundProps {
  canvasBackground: CanvasBackground
}

const BASE_BACKGROUND = '#F5F0E8'
const DOT_COLOR = '#C8BFB0'
const RULED_COLOR = 'rgba(200, 191, 176, 0.65)'
const DOTTED_STEP = 24
const RULED_STEP = 32
const OVERSCAN_STEPS = 2

export function CanvasPaperBackground() {
  return <div className="tl-background" style={{ backgroundColor: BASE_BACKGROUND }} aria-hidden="true" />
}

export function CanvasPaperPattern({ canvasBackground }: CanvasPaperBackgroundProps) {
  const editor = useEditor()
  const viewportPageBounds = useValue(
    'viewportPageBounds',
    () => editor.getViewportPageBounds(),
    [editor],
  )

  const patternStyle = useMemo(() => {
    if (canvasBackground === 'none') {
      return null
    }

    if (canvasBackground === 'dotted') {
      const startX =
        Math.floor(viewportPageBounds.x / DOTTED_STEP - OVERSCAN_STEPS) * DOTTED_STEP
      const startY =
        Math.floor(viewportPageBounds.y / DOTTED_STEP - OVERSCAN_STEPS) * DOTTED_STEP
      const endX =
        Math.ceil((viewportPageBounds.x + viewportPageBounds.w) / DOTTED_STEP + OVERSCAN_STEPS) *
        DOTTED_STEP
      const endY =
        Math.ceil((viewportPageBounds.y + viewportPageBounds.h) / DOTTED_STEP + OVERSCAN_STEPS) *
        DOTTED_STEP

      return {
        position: 'absolute' as const,
        left: startX,
        top: startY,
        width: endX - startX,
        height: endY - startY,
        pointerEvents: 'none' as const,
        backgroundImage: `radial-gradient(circle, ${DOT_COLOR} 1.2px, transparent 1.2px)`,
        backgroundSize: `${DOTTED_STEP}px ${DOTTED_STEP}px`,
        backgroundPosition: '0 0',
      }
    }

    const startX = viewportPageBounds.x - viewportPageBounds.w * 0.5
    const startY = Math.floor(viewportPageBounds.y / RULED_STEP - OVERSCAN_STEPS) * RULED_STEP
    const endX = viewportPageBounds.x + viewportPageBounds.w * 1.5
    const endY =
      Math.ceil((viewportPageBounds.y + viewportPageBounds.h) / RULED_STEP + OVERSCAN_STEPS) *
      RULED_STEP

    return {
      position: 'absolute' as const,
      left: startX,
      top: startY,
      width: endX - startX,
      height: endY - startY,
      pointerEvents: 'none' as const,
      backgroundImage: `linear-gradient(to bottom, transparent ${RULED_STEP - 1}px, ${RULED_COLOR} ${RULED_STEP}px)`,
      backgroundSize: `100% ${RULED_STEP}px`,
      backgroundPosition: '0 0',
    }
  }, [canvasBackground, viewportPageBounds])

  if (!patternStyle) return null

  return <div aria-hidden="true" style={patternStyle} />
}
