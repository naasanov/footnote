'use client'

import { useMemo } from 'react'
import { useEditor, useValue } from 'tldraw'
import { env } from '@/config/env'
import type { CanvasBackground } from '@/lib/types'

interface CanvasPaperBackgroundProps {
  canvasBackground: CanvasBackground
}

const BASE_BACKGROUND = '#F5F0E8'
const DOT_COLOR = '#C8BFB0'
const RULED_COLOR = 'rgba(200, 191, 176, 0.65)'
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

    const patternStep = env.NEXT_PUBLIC_CANVAS_PATTERN_STEP_PX

    if (canvasBackground === 'dotted') {
      const startX =
        Math.floor(viewportPageBounds.x / patternStep - OVERSCAN_STEPS) * patternStep
      const startY =
        Math.floor(viewportPageBounds.y / patternStep - OVERSCAN_STEPS) * patternStep
      const endX =
        Math.ceil((viewportPageBounds.x + viewportPageBounds.w) / patternStep + OVERSCAN_STEPS) *
        patternStep
      const endY =
        Math.ceil((viewportPageBounds.y + viewportPageBounds.h) / patternStep + OVERSCAN_STEPS) *
        patternStep

      return {
        position: 'absolute' as const,
        left: startX,
        top: startY,
        width: endX - startX,
        height: endY - startY,
        pointerEvents: 'none' as const,
        backgroundImage: `radial-gradient(circle, ${DOT_COLOR} 1.2px, transparent 1.2px)`,
        backgroundSize: `${patternStep}px ${patternStep}px`,
        backgroundPosition: '0 0',
      }
    }

    const startX = viewportPageBounds.x - viewportPageBounds.w * 0.5
    const startY = Math.floor(viewportPageBounds.y / patternStep - OVERSCAN_STEPS) * patternStep
    const endX = viewportPageBounds.x + viewportPageBounds.w * 1.5
    const endY =
      Math.ceil((viewportPageBounds.y + viewportPageBounds.h) / patternStep + OVERSCAN_STEPS) *
      patternStep

    return {
      position: 'absolute' as const,
      left: startX,
      top: startY,
      width: endX - startX,
      height: endY - startY,
      pointerEvents: 'none' as const,
      backgroundImage: `linear-gradient(to bottom, transparent ${patternStep - 1}px, ${RULED_COLOR} ${patternStep}px)`,
      backgroundSize: `100% ${patternStep}px`,
      backgroundPosition: '0 0',
    }
  }, [canvasBackground, viewportPageBounds])

  if (!patternStyle) return null

  return <div aria-hidden="true" style={patternStyle} />
}
