'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Upload, Trash2, Eye } from 'lucide-react'
import { toast } from 'sonner'
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
import { fetchSourceFile } from '@/lib/api/sources'
import { cn } from '@/lib/utils'
import type { Source } from '@/lib/types'

const ACCEPTED_TYPES = '.pdf,.docx,.md,.txt,.png,.jpg,.jpeg'
const ACCEPTED_EXTENSIONS = new Set(ACCEPTED_TYPES.split(','))

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
  const [isDragActive, setIsDragActive] = useState(false)
  const [, setDragDepth] = useState(0)

  const activeSourceIds = new Set(note?.activeSourceIds ?? [])

  function handleToggle(sourceId: string, active: boolean) {
    const next = active
      ? [...activeSourceIds, sourceId]
      : [...activeSourceIds].filter((id) => id !== sourceId)
    toggle.mutate({ activeSourceIds: next })
  }

  function getAcceptedFiles(files: FileList | File[]) {
    return Array.from(files).filter((file) => {
      const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
      return ACCEPTED_EXTENSIONS.has(extension)
    })
  }

  async function handleFiles(files: FileList | File[]) {
    const acceptedFiles = getAcceptedFiles(files)

    if (acceptedFiles.length === 0) {
      toast.error('Unsupported file type')
      return
    }

    const rejectedCount = Array.from(files).length - acceptedFiles.length
    if (rejectedCount > 0) {
      toast.error('Some files were skipped because their type is not supported')
    }

    for (const file of acceptedFiles) {
      await upload.mutateAsync({ file, scopeType: 'notebook', scopeId: notebookId })
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return

    try {
      await handleFiles(files)
    } finally {
      e.target.value = ''
    }
  }

  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setDragDepth((depth) => depth + 1)
    setIsDragActive(true)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setDragDepth((depth) => {
      const nextDepth = Math.max(0, depth - 1)
      if (nextDepth === 0) {
        setIsDragActive(false)
      }
      return nextDepth
    })
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setDragDepth(0)
    setIsDragActive(false)

    const files = e.dataTransfer.files
    if (!files?.length) return

    await handleFiles(files)
  }

  return (
    <div
      className={cn(
        'mx-2 rounded-md border border-dashed border-transparent px-2 py-1 transition-colors',
        isDragActive && 'border-[#2D5016]/40 bg-[#F5F1E8]',
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => {
        void handleDrop(e)
      }}
    >
      <div className="flex flex-col gap-1">
        {sources.length === 0 ? (
          <div className="px-1 py-1">
            <p className="mb-2 text-xs text-[#C8BFB0]">No sources yet</p>
          </div>
        ) : (
          <>
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
          </>
        )}

        {isDragActive && (
          <div className="rounded-md border border-[#2D5016]/20 bg-[#FFFDF8] px-3 py-4 text-center">
            <p className="text-xs font-medium text-[#2D5016]">Drop files to upload them</p>
            <p className="mt-1 text-[11px] text-[#78716C]">
              Supports PDF, DOCX, Markdown, text, PNG, and JPG
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFileChange(e)
          }}
        />
        <Button
          variant={sources.length === 0 ? 'outline' : 'ghost'}
          size="sm"
          className={cn(
            'mt-1 w-full text-xs',
            sources.length === 0
              ? ''
              : 'justify-start text-[#C8BFB0] hover:text-[#1C1917]',
          )}
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
        >
          <Upload className="h-3 w-3" />
          {upload.isPending ? 'Uploading…' : '+ upload source'}
        </Button>
      </div>

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
  const { getToken } = useAuth()
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const isImage = source.filename.match(/\.(png|jpe?g|gif|webp|bmp)$/i)
  const isPdf = source.filename.match(/\.pdf$/i) || source.filename === 'application/pdf'

  useEffect(() => {
    let objectUrl: string | null = null
    let isCancelled = false

    async function loadPreview() {
      setIsLoading(true)
      setHasError(false)

      try {
        const blob = await fetchSourceFile(getToken, source._id)
        if (isCancelled) return

        objectUrl = URL.createObjectURL(blob)
        setFileUrl(objectUrl)
      } catch {
        if (!isCancelled) {
          setHasError(true)
          setFileUrl(null)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadPreview()

    return () => {
      isCancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [getToken, source._id])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate">{source.filename}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden rounded-sm border border-[#E8E2D9]">
          {isLoading ? (
            <div className="flex h-full items-center justify-center bg-[#FAFAF8] text-sm text-[#78716C]">
              Loading preview…
            </div>
          ) : hasError || !fileUrl ? (
            <div className="flex h-full items-center justify-center bg-[#FAFAF8] px-6 text-center text-sm text-[#78716C]">
              Unable to load this source preview.
            </div>
          ) : isImage ? (
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
