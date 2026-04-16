'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { ocrSearch } from '@/lib/api/notes'
import type { OcrSearchResult } from '@/lib/types'

export function useOcrSearch(noteId: string | null) {
  const { getToken } = useAuth()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data: results, isLoading } = useQuery<OcrSearchResult[]>({
    queryKey: ['ocr-search', noteId, debouncedQuery],
    queryFn: () => ocrSearch(getToken, noteId!, debouncedQuery),
    enabled: !!noteId && debouncedQuery.length > 0,
  })

  function clearSearch() {
    setQuery('')
    setDebouncedQuery('')
  }

  return {
    query,
    setQuery,
    clearSearch,
    results: results ?? [],
    isLoading,
    hasQuery: debouncedQuery.length > 0,
  }
}
