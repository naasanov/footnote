'use client'

import { useRef, useState } from 'react'
import { Upload, Trash2, Eye } from 'lucide-react'
import { useSources } from '@/hooks/useSources'
import { useNote } from '@/hooks/useNote'
import { SourceToggle } from './SourceToggle'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { getSourceFileUrl } from '@/lib/api/sources'
import { cn } from '@/lib/utils'
import type { Source } from '@/lib/types'

const ACCEPTED_TYPES = '.pdf,.docx,.md,.txt,.png,.jpg,.jpeg'

const STATUS_BADGE: Record<Source['status'], { label: string; className: string }> = {
  processing: {
    label: 'processing',
    className: 'bg-amber-100 text-amber-700',
  },
  ready: {
    label: 'ready',
    className: 'bg-[#2D5016]/10 text-[#2D5016]',
  },
  error: {
    label: 'error',
    className: 'bg-red-100 text-red-600',
  },
}

interface SourceListProps {
  noteId: string
  notebookId: string
}

export function SourceList({ noteId, notebookId }: SourceListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { sources, noteSources, notebookSources, upload, remove, toggle } = useSources(
    noteId,
    notebookId,
  )
  const { data: note } = useNote(noteId)
  const [confirmDeleteSource, setConfirmDeleteSource] = useState<Source | null>(null)
  const [previewSource, setPreviewSource] = useState<Source | null>(null)

  const activeSourceIds = new Set(note?.activeSourceIds ?? [])

  function handleToggle(sourceId: string, active: boolean) {
    const next = active
      ? [...activeSourceIds, sourceId]
      : [...activeSourceIds].filter((id) => id !== sourceId)
    toggle.mutate({ activeSourceIds: next })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    upload.mutate({ file, scopeType: 'notebook', scopeId: notebookId })
    e.target.value = ''
  }

  if (sources.length === 0) {
    return (
      <div className="px-3 py-2">
        <p className="text-xs text-[#C8BFB0] mb-2">No sources yet</p>
        <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={handleFileChange} />
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
        >
          <Upload className="h-3 w-3" />
          Upload source
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 px-2 py-1">
      {notebookSources.map((source) => (
        <SourceRow
          key={source._id}
          source={source}
          scopeLabel="notebook"
          active={activeSourceIds.has(source._id)}
          onToggle={(v) => handleToggle(source._id, v)}
          onDelete={() => setConfirmDeleteSource(source)}
          onPreview={() => setPreviewSource(source)}
        />
      ))}
      {noteSources.map((source) => (
        <SourceRow
          key={source._id}
          source={source}
          scopeLabel="note"
          active={activeSourceIds.has(source._id)}
          onToggle={(v) => handleToggle(source._id, v)}
          onDelete={() => setConfirmDeleteSource(source)}
          onPreview={() => setPreviewSource(source)}
        />
      ))}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="ghost"
        size="sm"
        className="mt-1 w-full justify-start text-xs text-[#C8BFB0] hover:text-[#1C1917]"
        onClick={() => fileInputRef.current?.click()}
        disabled={upload.isPending}
      >
        <Upload className="h-3 w-3" />
        {upload.isPending ? 'Uploading…' : '+ upload source'}
      </Button>

      {/* Delete confirmation dialog */}
      <Dialog open={!!confirmDeleteSource} onOpenChange={(open) => !open && setConfirmDeleteSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Source</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#78716C] mt-2">
            This will remove &ldquo;{confirmDeleteSource?.filename}&rdquo; and its indexed content.
            Citation chips referencing this source will become orphaned.
          </p>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmDeleteSource(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                if (!confirmDeleteSource) return
                remove.mutate(confirmDeleteSource._id)
                setConfirmDeleteSource(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Source preview dialog */}
      {previewSource && (
        <SourcePreviewDialog
          source={previewSource}
          onClose={() => setPreviewSource(null)}
        />
      )}
    </div>
  )
}

interface SourceRowProps {
  source: Source
  scopeLabel: 'notebook' | 'note'
  active: boolean
  onToggle: (v: boolean) => void
  onDelete: () => void
  onPreview: () => void
}

function SourceRow({ source, scopeLabel, active, onToggle, onDelete, onPreview }: SourceRowProps) {
  const badge = STATUS_BADGE[source.status]

  return (
    <div className="flex items-center gap-2 rounded-sm px-1 py-1 hover:bg-[#E8E2D9]/30 group">
      <SourceToggle
        checked={active}
        onChange={onToggle}
        disabled={source.status !== 'ready'}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {/* Color dot */}
          <div
            className="shrink-0 h-2 w-2 rounded-full"
            style={{ backgroundColor: source.color }}
            aria-hidden="true"
          />
          <button
            onClick={onPreview}
            className="truncate text-xs text-[#1C1917] hover:underline text-left"
            title={source.filename}
          >
            {source.filename}
          </button>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-[#C8BFB0]">{scopeLabel}</span>
          <span
            className={cn(
              'inline-flex items-center rounded-sm px-1 text-[10px] font-medium',
              badge.className,
            )}
          >
            {badge.label}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onPreview}
          className="text-[#C8BFB0] hover:text-[#1C1917]"
          aria-label="Preview source"
        >
          <Eye className="h-3 w-3" />
        </button>
        <button
          onClick={onDelete}
          className="text-[#C8BFB0] hover:text-red-500"
          aria-label="Delete source"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// ─── Source Preview Dialog ────────────────────────────────────────────────────

interface SourcePreviewDialogProps {
  source: Source
  onClose: () => void
}

function SourcePreviewDialog({ source, onClose }: SourcePreviewDialogProps) {
  const fileUrl = getSourceFileUrl(source._id)
  const isImage = source.filename.match(/\.(png|jpe?g|gif|webp|bmp)$/i)
  const isPdf = source.filename.match(/\.pdf$/i) || source.filename === 'application/pdf'

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate">{source.filename}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden rounded-sm border border-[#E8E2D9]">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={source.filename}
              className="h-full w-full object-contain bg-[#FAFAF8]"
            />
          ) : isPdf ? (
            <iframe
              src={fileUrl}
              title={source.filename}
              className="h-full w-full"
            />
          ) : (
            <div className="h-full overflow-auto p-4">
              <iframe
                src={fileUrl}
                title={source.filename}
                className="h-full w-full border-none"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
