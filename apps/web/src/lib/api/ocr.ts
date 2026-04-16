import { apiFetch } from './client'
import { env } from '@/config/env'
import type { OcrBbox } from '@/lib/types'

type GetToken = () => Promise<string | null>

export async function transcribeCanvas(
  getToken: GetToken,
  params: {
    imageBase64: string
    mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
    noteId: string
    snapshotKey: string
    bbox: OcrBbox
    pipelineId?: string
  },
): Promise<{ text: string }> {
  const startedAt = performance.now()
  const res = await apiFetch('/ocr', getToken, {
    method: 'POST',
    body: JSON.stringify(params),
  })

  if (env.NEXT_PUBLIC_RAG_DEBUG_TIMING) {
    console.info('[pipeline] ocr request completed', {
      pipelineId: params.pipelineId ?? null,
      durationMs: Math.round(performance.now() - startedAt),
      ok: res.ok,
      noteId: params.noteId,
    })
  }

  if (!res.ok) {
    throw new Error('Failed to transcribe canvas snapshot')
  }

  return res.json()
}
