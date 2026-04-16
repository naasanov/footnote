'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { exportAs } from 'tldraw'
import type { Editor } from 'tldraw'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_\-. ]/gi, '_').trim() || 'note'
}

async function exportAsPdf(editor: Editor, filename: string): Promise<void> {
  const shapes = editor.getCurrentPageShapes()
  if (shapes.length === 0) return

  const result = await editor.getSvgString(shapes)
  if (!result) return

  const [{ jsPDF }, { svg2pdf }] = await Promise.all([
    import('jspdf'),
    import('svg2pdf.js'),
  ])

  // Parse the SVG to get its dimensions
  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(result.svg, 'image/svg+xml')
  const svgEl = svgDoc.documentElement as unknown as SVGSVGElement
  const width = parseFloat(svgEl.getAttribute('width') ?? '800')
  const height = parseFloat(svgEl.getAttribute('height') ?? '600')

  const pdf = new jsPDF({
    orientation: width > height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [width, height],
  })

  await svg2pdf(svgEl, pdf, { x: 0, y: 0, width, height })
  pdf.save(`${filename}.pdf`)
}

interface ExportButtonProps {
  editor: Editor | null
  noteTitle: string
}

export function ExportButton({ editor, noteTitle }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  async function handleExport(format: 'png' | 'svg' | 'pdf') {
    if (!editor || exporting) return
    setExporting(true)

    try {
      const filename = sanitizeFilename(noteTitle)
      const ids = editor.getCurrentPageShapes().map((s) => s.id)
      if (ids.length === 0) return

      if (format === 'png') {
        await exportAs(editor, ids, { format: 'png', name: filename })
      } else if (format === 'svg') {
        await exportAs(editor, ids, { format: 'svg', name: filename })
      } else {
        await exportAsPdf(editor, filename)
      }
    } catch {
      // silently ignore export errors — the export functions handle their own failures
    } finally {
      setExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs border-[#E8E2D9] text-[#78716C] hover:text-[#1C1917]"
          disabled={!editor || exporting}
          aria-label="Export canvas"
        >
          <Download className="h-3 w-3" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('png')}>PNG</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('svg')}>SVG</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
