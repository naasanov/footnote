'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ChevronRight,
  ChevronDown,
  BookOpen,
  FileText,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useNotebooks } from '@/hooks/useNotebooks'
import { useNotes } from '@/hooks/useNotes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { persistExpandedNotebookIds, readExpandedNotebookIds } from '@/lib/session-state'
import type { Notebook, Note } from '@/lib/types'

export function NotebookTree() {
  const params = useParams()
  const currentNotebookId = params?.notebookId as string | undefined
  const { data: notebooks, isLoading, create, update, remove } = useNotebooks()
  const [newNotebookName, setNewNotebookName] = useState('')
  const [showNewNotebook, setShowNewNotebook] = useState(false)
  const [expandedNotebookIds, setExpandedNotebookIds] = useState<string[]>(() =>
    readExpandedNotebookIds(),
  )

  useEffect(() => {
    if (!currentNotebookId) return

    setExpandedNotebookIds((prev) =>
      prev.includes(currentNotebookId) ? prev : [...prev, currentNotebookId],
    )
  }, [currentNotebookId])

  useEffect(() => {
    persistExpandedNotebookIds(expandedNotebookIds)
  }, [expandedNotebookIds])

  useEffect(() => {
    if (!notebooks) return

    setExpandedNotebookIds((prev) =>
      prev.filter((notebookId) => notebooks.some((notebook) => notebook._id === notebookId)),
    )
  }, [notebooks])

  function toggleNotebookExpansion(notebookId: string) {
    setExpandedNotebookIds((prev) =>
      prev.includes(notebookId)
        ? prev.filter((id) => id !== notebookId)
        : [...prev, notebookId],
    )
  }

  async function handleCreateNotebook(e: React.FormEvent) {
    e.preventDefault()
    if (!newNotebookName.trim()) return
    await create.mutateAsync({ title: newNotebookName.trim() })
    setNewNotebookName('')
    setShowNewNotebook(false)
  }

  if (isLoading) {
    return (
      <div className="px-3 py-4 text-xs text-[#C8BFB0]">Loading…</div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium text-[#C8BFB0] uppercase tracking-wider">
          Notebooks
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setShowNewNotebook(true)}
          aria-label="New notebook"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {notebooks?.map((notebook) => (
          <NotebookItem
            key={notebook._id}
            notebook={notebook}
            expanded={expandedNotebookIds.includes(notebook._id)}
            onToggleExpanded={() => toggleNotebookExpansion(notebook._id)}
            onRename={(id, title) => update.mutate({ id, data: { title } })}
            onDelete={(id) => {
              setExpandedNotebookIds((prev) => prev.filter((notebookId) => notebookId !== id))
              remove.mutate(id)
            }}
          />
        ))}

        {notebooks?.length === 0 && (
          <p className="px-3 py-2 text-xs text-[#C8BFB0]">
            No notebooks yet. Create one to get started.
          </p>
        )}
      </div>

      {/* New notebook dialog */}
      <Dialog open={showNewNotebook} onOpenChange={setShowNewNotebook}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Notebook</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateNotebook} className="flex flex-col gap-4 mt-2">
            <Input
              placeholder="Notebook name"
              value={newNotebookName}
              onChange={(e) => setNewNotebookName(e.target.value)}
              autoFocus
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowNewNotebook(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!newNotebookName.trim() || create.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface NotebookItemProps {
  notebook: Notebook
  expanded: boolean
  onToggleExpanded: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

function NotebookItem({ notebook, expanded, onToggleExpanded, onRename, onDelete }: NotebookItemProps) {
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(notebook.title)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!renameValue.trim()) return
    onRename(notebook._id, renameValue.trim())
    setRenaming(false)
  }

  return (
    <div>
      <div className="flex items-center gap-1 px-2 py-1 rounded-sm hover:bg-[#E8E2D9]/30 group">
        <button
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          onClick={onToggleExpanded}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#C8BFB0]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#C8BFB0]" />
          )}
          <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#2D5016]" />
          <span className="truncate text-sm font-medium text-[#1C1917]">{notebook.title}</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              aria-label="Notebook options"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setRenaming(true); setRenameValue(notebook.title) }}>
              <Pencil className="h-3.5 w-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded && (
        <div className="ml-4">
          <NoteList notebookId={notebook._id} />
        </div>
      )}

      {/* Rename dialog */}
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Notebook</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="flex flex-col gap-4 mt-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setRenaming(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!renameValue.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Notebook</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#C8BFB0] mt-2">
            Delete &ldquo;{notebook.title}&rdquo;? This will also delete all its notes and cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => { onDelete(notebook._id); setConfirmDelete(false) }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface NoteListProps {
  notebookId: string
}

function NoteList({ notebookId }: NoteListProps) {
  const router = useRouter()
  const params = useParams()
  const currentNoteId = params?.noteId as string | undefined
  const currentNotebookId = params?.notebookId as string | undefined

  const { data: notes, isLoading, create, update, remove } = useNotes(notebookId)
  const [renaming, setRenaming] = useState<Note | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Note | null>(null)

  async function handleCreateNote() {
    const note = await create.mutateAsync({ title: 'Untitled Note' })
    router.push(`/notebooks/${notebookId}/notes/${note._id}`)
  }

  function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!renaming || !renameValue.trim()) return
    update.mutate({ id: renaming._id, data: { title: renameValue.trim() } })
    setRenaming(null)
  }

  if (isLoading) {
    return <div className="px-3 py-1 text-xs text-[#C8BFB0]">Loading…</div>
  }

  return (
    <div>
      {notes?.map((note) => {
        const isActive =
          currentNotebookId === notebookId && currentNoteId === note._id

        return (
          <div key={note._id}>
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-sm hover:bg-[#E8E2D9]/30 group cursor-pointer',
                isActive && 'bg-[#2D5016]/10',
              )}
            >
              <button
                className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                onClick={() => router.push(`/notebooks/${notebookId}/notes/${note._id}`)}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-[#C8BFB0]" />
                <span
                  className={cn(
                    'truncate text-sm text-[#1C1917]',
                    isActive && 'font-medium text-[#2D5016]',
                  )}
                >
                  {note.title}
                </span>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    aria-label="Note options"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => { setRenaming(note); setRenameValue(note.title) }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={() => setConfirmDelete(note)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

          </div>
        )
      })}

      {notes?.length === 0 && (
        <p className="px-2 py-1 text-xs text-[#C8BFB0]">
          Create your first note to get started
        </p>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-xs text-[#C8BFB0] hover:text-[#1C1917] mt-0.5"
        onClick={handleCreateNote}
        disabled={create.isPending}
      >
        <Plus className="h-3 w-3" />
        New note
      </Button>

      {/* Rename dialog */}
      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Note</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="flex flex-col gap-4 mt-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setRenaming(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!renameValue.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#C8BFB0] mt-2">
            Delete &ldquo;{confirmDelete?.title}&rdquo;? This cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (!confirmDelete) return

                const deletingNoteId = confirmDelete._id
                const fallbackNote = notes?.find((note) => note._id !== deletingNoteId)

                await remove.mutateAsync(deletingNoteId)

                if (currentNoteId === deletingNoteId) {
                  if (fallbackNote) {
                    router.push(`/notebooks/${notebookId}/notes/${fallbackNote._id}`)
                  } else {
                    router.push('/')
                  }
                }

                setConfirmDelete(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
