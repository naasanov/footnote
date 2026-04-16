'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { toast } from 'sonner'
import { listNotes, createNote, updateNote, deleteNote } from '@/lib/api/notes'
import type { CreateNoteRequest, UpdateNoteRequest } from '@/lib/types'

export function useNotes(notebookId: string) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['notes', notebookId],
    queryFn: () => listNotes(getToken, notebookId),
    enabled: !!notebookId,
  })

  const create = useMutation({
    mutationFn: (data: CreateNoteRequest) => createNote(getToken, notebookId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', notebookId] })
    },
    onError: () => {
      toast.error('Failed to create note')
    },
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNoteRequest }) =>
      updateNote(getToken, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['notes', notebookId] })
      queryClient.invalidateQueries({ queryKey: ['note', id] })
    },
    onError: () => {
      toast.error('Failed to rename note')
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteNote(getToken, id),
    onSuccess: (_, id) => {
      queryClient.setQueryData(['notes', notebookId], (prev: unknown) => {
        if (!Array.isArray(prev)) return prev
        return prev.filter((note) => {
          if (!note || typeof note !== 'object') return true
          const noteId = (note as { _id?: unknown })._id
          return noteId !== id
        })
      })
      queryClient.invalidateQueries({ queryKey: ['notes', notebookId] })
      queryClient.removeQueries({ queryKey: ['note', id] })
    },
    onError: () => {
      toast.error('Failed to delete note')
    },
  })

  return { ...query, create, update, remove }
}
