'use client'

import { useAuth } from '@clerk/nextjs'
import { useEffect, useRef } from 'react'
import { Box, type Editor, type TLShapeId } from 'tldraw'
import { env } from '@/config/env'
import { transcribeCanvas } from '@/lib/api/ocr'
import type { OcrBbox } from '@/lib/types'

function stripDataUrlPrefix(value: string): string {
  const commaIndex = value.indexOf(',')
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Invalid image result'))
        return
      }
      resolve(reader.result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image blob'))
    reader.readAsDataURL(blob)
  })
}

async function exportSnapshotBase64(
  editor: Editor,
  shapeIds: string[],
  bounds: OcrBbox,
): Promise<string | null> {
  const imageCapableEditor = editor as Editor & {
    toImage?: (
      shapeIds: TLShapeId[],
      options: {
        format: 'png'
        background: boolean
        padding: number
        bounds: Box
      },
    ) => Promise<
      | string
      | Blob
      | {
          blob?: Blob
          src?: string
        }
    >
  }

  if (typeof imageCapableEditor.toImage !== 'function') {
    return null
  }

  const exportableShapeIds = shapeIds.filter((shapeId) => {
    const shape = editor.getShape(shapeId as TLShapeId)

    if (!shape) {
      return false
    }

    return Boolean(editor.getShapePageBounds(shape))
  })

  if (exportableShapeIds.length === 0) {
    return null
  }

  const imageResult = await imageCapableEditor.toImage(exportableShapeIds as TLShapeId[], {
    format: 'png',
    background: false,
    padding: env.NEXT_PUBLIC_OCR_SNAPSHOT_PADDING_PX,
    bounds: new Box(bounds.x, bounds.y, bounds.w, bounds.h),
  })

  if (typeof imageResult === 'string') {
    return stripDataUrlPrefix(imageResult)
  }

  if (imageResult instanceof Blob) {
    return stripDataUrlPrefix(await blobToDataUrl(imageResult))
  }

  if (imageResult && imageResult.blob instanceof Blob) {
    return stripDataUrlPrefix(await blobToDataUrl(imageResult.blob))
  }

  if (imageResult && 'src' in imageResult && typeof imageResult.src === 'string') {
    return stripDataUrlPrefix(imageResult.src)
  }

  return null
}

interface UseOcrDebounceParams {
  editor: Editor | null
  noteId: string
  activeSourceIds: string[]
  getRecentShapeIds: () => string[]
  getRecentTypedText: () => string[]
  getRecentStrokeBounds: () => OcrBbox | null
  resetRecentHandwritingShapeIds: () => void
  resetRecentTypedText: () => void
  onCanvasText: (params: { text: string; pipelineId: string; pipelineStartedAt: number }) => void
}

function createPipelineId(noteId: string): string {
  return `${noteId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useOcrDebounce({
  editor,
  noteId,
  activeSourceIds,
  getRecentShapeIds,
  getRecentTypedText,
  getRecentStrokeBounds,
  resetRecentHandwritingShapeIds,
  resetRecentTypedText,
  onCanvasText,
}: UseOcrDebounceParams) {
  const { getToken } = useAuth()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const burstStartedAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (!editor || !noteId) return

    const flushCanvasText = async (
      pipelineId: string,
      debounceScheduledAt: number,
      pipelineStartedAt: number,
    ) => {
      burstStartedAtRef.current = null

      if (env.NEXT_PUBLIC_RAG_DEBUG_TIMING) {
        console.info('[pipeline] debounce elapsed', {
          pipelineId,
          debounceMs: Math.round(pipelineStartedAt - debounceScheduledAt),
          noteId,
        })
      }

      if (activeSourceIds.length === 0) {
        return
      }

      const typedText = getRecentTypedText()
      const shapeIds = getRecentShapeIds()
      if (typedText.length === 0 && shapeIds.length === 0) {
        return
      }

      const nextTextEntries = typedText
        .map((entry) => entry.trim())
        .filter(Boolean)

      if (nextTextEntries.length > 0) {
        resetRecentTypedText()
      }

      if (shapeIds.length > 0) {
        const bounds = getRecentStrokeBounds()
        if (bounds) {
          const snapshotStartedAt = performance.now()
          const imageBase64 = await exportSnapshotBase64(editor, shapeIds, bounds)

          if (env.NEXT_PUBLIC_RAG_DEBUG_TIMING) {
            console.info('[pipeline] snapshot export completed', {
              pipelineId,
              durationMs: Math.round(performance.now() - snapshotStartedAt),
              shapeCount: shapeIds.length,
            })
          }

          if (imageBase64) {
            const snapshotKey = shapeIds.join(',')

            try {
              const { text } = await transcribeCanvas(getToken, {
                imageBase64,
                mimeType: 'image/png',
                noteId,
                snapshotKey,
                bbox: bounds,
                pipelineId,
              })

              resetRecentHandwritingShapeIds()

              if (text.trim()) {
                nextTextEntries.push(text.trim())
              }
            } catch {
              // Fail quietly: OCR should not interrupt writing flow.
            }
          }
        }
      }

      const combinedText = nextTextEntries.join('\n').trim()
      if (!combinedText) {
        return
      }

      if (env.NEXT_PUBLIC_RAG_DEBUG_TIMING) {
        console.info('[pipeline] canvas text ready', {
          pipelineId,
          totalPreRagMs: Math.round(performance.now() - pipelineStartedAt),
          textLength: combinedText.length,
        })
      }

      onCanvasText({ text: combinedText, pipelineId, pipelineStartedAt })
    }

    const handleChange = () => {
      const now = performance.now()
      const debounceScheduledAt = now

      if (burstStartedAtRef.current === null) {
        burstStartedAtRef.current = now
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      const elapsedInBurst = now - burstStartedAtRef.current
      const remainingMaxWait = Math.max(0, env.NEXT_PUBLIC_OCR_MAX_WAIT_MS - elapsedInBurst)
      const nextDelay = Math.min(env.NEXT_PUBLIC_OCR_DEBOUNCE_MS, remainingMaxWait)

      timerRef.current = setTimeout(() => {
        const pipelineId = createPipelineId(noteId)
        const pipelineStartedAt = performance.now()
        void flushCanvasText(pipelineId, debounceScheduledAt, pipelineStartedAt)
      }, nextDelay)
    }

    const unlisten = editor.store.listen(handleChange)

    return () => {
      unlisten()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      burstStartedAtRef.current = null
    }
  }, [
    activeSourceIds,
    editor,
    getRecentShapeIds,
    getRecentTypedText,
    getRecentStrokeBounds,
    getToken,
    noteId,
    onCanvasText,
    resetRecentHandwritingShapeIds,
    resetRecentTypedText,
  ])
}
