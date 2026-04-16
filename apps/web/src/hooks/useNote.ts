'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { getNote } from '@/lib/api/notes'

export function useNote(noteId: string) {
  const { getToken } = useAuth()

  return useQuery({
    queryKey: ['note', noteId],
    queryFn: () => getNote(getToken, noteId),
    enabled: !!noteId,
  })
}
