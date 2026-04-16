'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNotebooks } from '@/hooks/useNotebooks'
import { useNotes } from '@/hooks/useNotes'
import { readLastSelectedNote } from '@/lib/session-state'

function RedirectToFirstNote({ notebookId }: { notebookId: string }) {
  const router = useRouter()
  const { data: notes } = useNotes(notebookId)

  useEffect(() => {
    if (notes && notes.length > 0) {
      router.replace(`/notebooks/${notebookId}/notes/${notes[0]._id}`)
    }
  }, [notes, notebookId, router])

  return null
}

export default function HomePage() {
  const { data: notebooks, isLoading } = useNotebooks()
  const [checkedSavedSelection, setCheckedSavedSelection] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const savedSelection = readLastSelectedNote()

    if (savedSelection) {
      router.replace(`/notebooks/${savedSelection.notebookId}/notes/${savedSelection.noteId}`)
      return
    }

    setCheckedSavedSelection(true)
  }, [router])

  if (!checkedSavedSelection) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[#C8BFB0]">Loading…</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[#C8BFB0]">Loading…</p>
      </div>
    )
  }

  if (!notebooks || notebooks.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="font-display text-lg text-[#1C1917]">Welcome to Footnote</p>
        <p className="text-sm text-[#C8BFB0]">
          Create your first notebook using the sidebar to get started.
        </p>
      </div>
    )
  }

  return (
    <>
      <RedirectToFirstNote notebookId={notebooks[0]._id} />
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[#C8BFB0]">Select a note to start writing</p>
      </div>
    </>
  )
}
