'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { listSources, uploadSource, deleteSource, renameSource } from '@/lib/api/sources'
import { updateNote } from '@/lib/api/notes'
import type { Source } from '@/lib/types'

export function useSources(noteId: string, notebookId: string) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const noteSources = useQuery({
    queryKey: ['sources', 'note', noteId],
    queryFn: () => listSources(getToken, 'note', noteId),
    enabled: !!noteId,
    refetchInterval: (query) => {
      const sources = query.state.data as Source[] | undefined
      if (sources?.some((s) => s.status === 'processing')) return 2000
      return false
    },
  })

  const notebookSources = useQuery({
    queryKey: ['sources', 'notebook', notebookId],
    queryFn: () => listSources(getToken, 'notebook', notebookId),
    enabled: !!notebookId,
    refetchInterval: (query) => {
      const sources = query.state.data as Source[] | undefined
      if (sources?.some((s) => s.status === 'processing')) return 2000
      return false
    },
  })

  const allSources = useMemo(
    () => [...(notebookSources.data ?? []), ...(noteSources.data ?? [])],
    [notebookSources.data, noteSources.data],
  )
  const hasProcessingSources = allSources.some((source) => source.status === 'processing')

  useEffect(() => {
    if (!noteId || !hasProcessingSources) return

    queryClient.invalidateQueries({ queryKey: ['note', noteId] })
  }, [hasProcessingSources, noteId, queryClient, allSources])

  const upload = useMutation({
    mutationFn: ({
      file,
      scopeType,
      scopeId,
    }: {
      file: File
      scopeType: 'note' | 'notebook'
      scopeId: string
    }) => uploadSource(getToken, file, scopeType, scopeId),
    onSuccess: (_, { scopeType, scopeId }) => {
      queryClient.invalidateQueries({ queryKey: ['sources', scopeType, scopeId] })
      queryClient.invalidateQueries({ queryKey: ['note', noteId] })
    },
    onError: () => {
      toast.error('Failed to upload source')
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteSource(getToken, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
    },
    onError: () => {
      toast.error('Failed to delete source')
    },
  })

  const rename = useMutation({
    mutationFn: ({ id, filename }: { id: string; filename: string }) =>
      renameSource(getToken, id, { filename }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
    },
    onError: () => {
      toast.error('Failed to rename source')
    },
  })

  const toggle = useMutation({
    mutationFn: async ({
      activeSourceIds,
    }: {
      activeSourceIds: string[]
    }) => updateNote(getToken, noteId, { activeSourceIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note', noteId] })
    },
    onError: () => {
      toast.error('Failed to update source toggle')
    },
  })

  return {
    sources: allSources,
    noteSources: noteSources.data ?? [],
    notebookSources: notebookSources.data ?? [],
    isLoading: noteSources.isLoading || notebookSources.isLoading,
    isError: noteSources.isError || notebookSources.isError,
    upload,
    remove,
    rename,
    toggle,
  }
}
