'use client'

import { NotebookPen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CanvasBackground } from '@/lib/types'

const CANVAS_BACKGROUND_OPTIONS: Array<{
  value: CanvasBackground
  label: string
  description: string
}> = [
  { value: 'none', label: 'None', description: 'Blank paper' },
  { value: 'dotted', label: 'Dotted', description: 'Dot grid' },
  { value: 'ruled', label: 'Ruled', description: 'Horizontal lines' },
]

interface CanvasBackgroundControlsProps {
  canvasBackground: CanvasBackground
  onChange: (nextCanvasBackground: CanvasBackground) => void
}

export function CanvasBackgroundControls({
  canvasBackground,
  onChange,
}: CanvasBackgroundControlsProps) {
  const activeOptionIndex = CANVAS_BACKGROUND_OPTIONS.findIndex(
    (option) => option.value === canvasBackground,
  )
  const safeActiveOptionIndex = activeOptionIndex >= 0 ? activeOptionIndex : 0
  const activeOption = CANVAS_BACKGROUND_OPTIONS[safeActiveOptionIndex]
  const nextOption =
    CANVAS_BACKGROUND_OPTIONS[(safeActiveOptionIndex + 1) % CANVAS_BACKGROUND_OPTIONS.length]

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 border-[#E8E2D9] text-xs text-[#78716C] hover:text-[#1C1917]"
      aria-label={`Canvas paper style: ${activeOption.label}. Click to switch to ${nextOption.label}.`}
      title={`${activeOption.label}: ${activeOption.description}. Next: ${nextOption.label}.`}
      onClick={() => onChange(nextOption.value)}
    >
      <NotebookPen className="h-3 w-3" />
      {activeOption.label}
    </Button>
  )
}
