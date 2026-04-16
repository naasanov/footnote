import { env } from '@/config/env'
import { apiFetch } from './client'
import type { RagResult, RagSummaryJob } from '@/lib/types'

type GetToken = () => Promise<string | null>

export async function queryRag(
  getToken: GetToken,
  text: string,
  sourceIds: string[],
  pipelineId?: string,
): Promise<{ chunks: RagResult[]; summaryRequestId: string | null }> {
  const startedAt = performance.now()
  const res = await apiFetch('/rag/query', getToken, {
    method: 'POST',
    body: JSON.stringify({ text, sourceIds, pipelineId }),
  })

  if (env.NEXT_PUBLIC_RAG_DEBUG_TIMING) {
    console.info('[pipeline] rag query request completed', {
      pipelineId: pipelineId ?? null,
      durationMs: Math.round(performance.now() - startedAt),
      ok: res.ok,
      sourceCount: sourceIds.length,
      textLength: text.length,
    })
  }

  if (!res.ok) {
    throw new Error('Failed to query related passages')
  }

  return res.json()
}

export async function summarizeRagResults(
  getToken: GetToken,
  summaryRequestId: string,
): Promise<RagSummaryJob> {
  const startedAt = performance.now()
  const res = await apiFetch(`/rag/summaries/${summaryRequestId}`, getToken)

  if (env.NEXT_PUBLIC_RAG_DEBUG_TIMING) {
    console.info('[pipeline] rag summary poll completed', {
      summaryRequestId,
      durationMs: Math.round(performance.now() - startedAt),
      ok: res.ok,
    })
  }

  if (!res.ok) {
    throw new Error('Failed to summarize related passages')
  }

  return res.json()
}
