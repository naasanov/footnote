'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import { env } from '@/config/env'
import { queryRag, summarizeRagResults } from '@/lib/api/rag'
import type { RagResult } from '@/lib/types'

function tokenCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function trimBuffer(buffer: string[]): string[] {
  const next = [...buffer]

  while (next.length > env.NEXT_PUBLIC_RAG_BUFFER_MAX_ENTRIES) {
    next.shift()
  }

  while (tokenCount(next.join(' ')) > env.NEXT_PUBLIC_RAG_BUFFER_MAX_TOKENS && next.length > 1) {
    next.shift()
  }

  return next
}

interface UseRagSidebarReturn {
  ragResults: RagResult[]
  isQuerying: boolean
  isSummarizing: boolean
  latestCanvasText: string
  handleCanvasText: (params: { text: string; pipelineId: string; pipelineStartedAt: number }) => void
}

interface CanvasTextPayload {
  text: string
  pipelineId: string
  pipelineStartedAt: number
}

export function useRagSidebar(noteId: string, activeSourceIds: string[]): UseRagSidebarReturn {
  const { getToken } = useAuth()
  const bufferRef = useRef<string[]>([])
  const queryIdRef = useRef(0)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [ragResults, setRagResults] = useState<RagResult[]>([])
  const [isQuerying, setIsQuerying] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [latestCanvasText, setLatestCanvasText] = useState('')

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [])

  const handleCanvasText = useCallback(
    ({ text, pipelineId, pipelineStartedAt }: CanvasTextPayload) => {
      setLatestCanvasText(text)

      if (!text.trim() || !noteId || activeSourceIds.length === 0) {
        return
      }

      bufferRef.current = trimBuffer([...bufferRef.current, text.trim()])

      const queryText = bufferRef.current.join(' ')
      if (!queryText.trim()) {
        return
      }

      const queryId = queryIdRef.current + 1
      queryIdRef.current = queryId
      setIsQuerying(true)
      setIsSummarizing(false)

      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }

      void queryRag(getToken, queryText, activeSourceIds, pipelineId)
        .then((response) => {
          if (queryIdRef.current !== queryId) return
          setRagResults(response.chunks)
          setIsQuerying(false)

          if (env.NEXT_PUBLIC_RAG_DEBUG_TIMING) {
            console.info('[pipeline] first rag results ready', {
              pipelineId,
              durationMs: Math.round(performance.now() - pipelineStartedAt),
              resultCount: response.chunks.length,
              summaryRequestId: response.summaryRequestId,
            })
          }

          if (response.chunks.length === 0) {
            setIsSummarizing(false)
            return
          }

          if (!response.summaryRequestId) {
            setIsSummarizing(false)
            return
          }

          setIsSummarizing(true)

          const pollForSummaries = () => {
            void summarizeRagResults(getToken, response.summaryRequestId!)
              .then((summaryJob) => {
                if (queryIdRef.current !== queryId) return

                if (summaryJob.status === 'pending') {
                  pollTimerRef.current = setTimeout(pollForSummaries, 400)
                  return
                }

                if (summaryJob.status === 'completed') {
                  const summaryMap = new Map(
                    summaryJob.summaries.map((summary) => [summary.chunkId, summary.summary]),
                  )

                  setRagResults((currentResults) =>
                    currentResults.map((result) => ({
                      ...result,
                      summary: summaryMap.get(result.chunkId) ?? result.summary,
                    })),
                  )

                  if (env.NEXT_PUBLIC_RAG_DEBUG_TIMING) {
                    console.info('[pipeline] summaries hydrated', {
                      pipelineId,
                      durationMs: Math.round(performance.now() - pipelineStartedAt),
                      summaryCount: summaryJob.summaries.length,
                    })
                  }
                }

                setIsSummarizing(false)
                pollTimerRef.current = null
              })
              .catch(() => {
                if (queryIdRef.current !== queryId) return
                setIsSummarizing(false)
                pollTimerRef.current = null
              })
          }

          pollForSummaries()
        })
        .catch(() => {
          if (queryIdRef.current !== queryId) return
          setIsSummarizing(false)
        })
        .finally(() => {
          if (queryIdRef.current !== queryId) return
          setIsQuerying(false)
        })
    },
    [activeSourceIds, getToken, noteId],
  )

  return {
    ragResults,
    isQuerying,
    isSummarizing,
    latestCanvasText,
    handleCanvasText,
  }
}
