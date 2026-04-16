'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { toast } from 'sonner'
import { listNotebooks, createNotebook, updateNotebook, deleteNotebook } from '@/lib/api/notebooks'
import type { CreateNotebookRequest, UpdateNotebookRequest } from '@/lib/types'

export function useNotebooks() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['notebooks'],
    queryFn: () => listNotebooks(getToken),
  })

  const create = useMutation({
    mutationFn: (data: CreateNotebookRequest) => createNotebook(getToken, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] })
    },
    onError: () => {
      toast.error('Failed to create notebook')
    },
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNotebookRequest }) =>
      updateNotebook(getToken, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] })
    },
    onError: () => {
      toast.error('Failed to rename notebook')
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteNotebook(getToken, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] })
    },
    onError: () => {
      toast.error('Failed to delete notebook')
    },
  })

  return { ...query, create, update, remove }
}
