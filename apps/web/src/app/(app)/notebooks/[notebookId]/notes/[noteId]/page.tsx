'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNote } from '@/hooks/useNote'
import { useNotes } from '@/hooks/useNotes'
import { NoteCanvas } from '@/components/features/NoteCanvas/NoteCanvas'
import { useAppShellLeftOpen } from '@/components/AppShell'
import {
  clearLastSelectedNote,
  persistLastSelectedNote,
  readLastSelectedNote,
} from '@/lib/session-state'

interface NotePageProps {
  params: Promise<{ notebookId: string; noteId: string }>
}

export default function NotePage({ params }: NotePageProps) {
  const { notebookId, noteId } = use(params)
  const router = useRouter()
  const leftOpen = useAppShellLeftOpen()
  const { data: note, isLoading, isError } = useNote(noteId)
  const { update } = useNotes(notebookId)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    persistLastSelectedNote({ notebookId, noteId })
  }, [notebookId, noteId])

  useEffect(() => {
    if (!isError) return

    const savedSelection = readLastSelectedNote()
    if (
      !savedSelection ||
      savedSelection.notebookId !== notebookId ||
      savedSelection.noteId !== noteId
    ) {
      return
    }

    clearLastSelectedNote()
    router.replace('/')
  }, [isError, notebookId, noteId, router])

  useEffect(() => {
    if (!isEditingTitle && note?.title) {
      setTitleValue(note.title)
    }
  }, [isEditingTitle, note?.title])

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }
  }, [isEditingTitle])

  function startEditingTitle() {
    if (!note || update.isPending) return
    setTitleValue(note.title)
    setIsEditingTitle(true)
  }

  function cancelEditingTitle() {
    setTitleValue(note?.title ?? '')
    setIsEditingTitle(false)
  }

  function submitTitleChange() {
    const nextTitle = titleValue.trim()

    if (!note) return

    if (!nextTitle) {
      cancelEditingTitle()
      return
    }

    if (nextTitle === note.title) {
      setIsEditingTitle(false)
      return
    }

    update.mutate(
      { id: noteId, data: { title: nextTitle } },
      {
        onSuccess: () => {
          setIsEditingTitle(false)
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[#C8BFB0]">Loading note…</p>
      </div>
    )
  }

  if (isError || !note) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-red-500">Failed to load note.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Note title bar */}
      <div className={`flex items-center h-12 border-b border-[#E8E2D9] shrink-0 ${leftOpen ? 'px-6' : 'pl-14 pr-6'}`}>
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={submitTitleChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitTitleChange()
              }

              if (e.key === 'Escape') {
                e.preventDefault()
                cancelEditingTitle()
              }
            }}
            disabled={update.isPending}
            aria-label="Note title"
            className="w-full max-w-xl border-none bg-transparent p-0 font-display text-base font-semibold text-[#1C1917] outline-none ring-0 placeholder:text-[#C8BFB0]"
          />
        ) : (
          <button
            type="button"
            onClick={startEditingTitle}
            disabled={update.isPending}
            className="max-w-xl truncate text-left font-display text-base font-semibold text-[#1C1917] transition-opacity hover:opacity-70 disabled:cursor-default disabled:opacity-100"
            aria-label={`Rename note ${note.title}`}
            title="Click to rename"
          >
            {note.title}
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <NoteCanvas
          noteId={noteId}
          notebookId={notebookId}
          noteTitle={note.title}
          activeSourceIds={note.activeSourceIds}
          initialCanvasState={note.canvasState as Record<string, unknown>}
          initialCanvasBackground={note.canvasBackground}
        />
      </div>
    </div>
  )
}
