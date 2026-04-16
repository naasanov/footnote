'use client'

import { Check, NotebookPen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  const activeOption =
    CANVAS_BACKGROUND_OPTIONS.find((option) => option.value === canvasBackground) ??
    CANVAS_BACKGROUND_OPTIONS[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 border-[#E8E2D9] text-xs text-[#78716C] hover:text-[#1C1917]"
          aria-label="Change canvas paper style"
        >
          <NotebookPen className="h-3 w-3" />
          {activeOption.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {CANVAS_BACKGROUND_OPTIONS.map((option) => {
          const isActive = option.value === canvasBackground

          return (
            <DropdownMenuItem key={option.value} onClick={() => onChange(option.value)}>
              <div className="flex min-w-[160px] items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span>{option.label}</span>
                  <span className="text-[11px] text-[#A8A29E]">{option.description}</span>
                </div>
                <Check className={`h-3.5 w-3.5 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
