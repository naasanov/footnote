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
  onCanvasText: (params: {
    text: string
    pipelineId: string
    pipelineStartedAt: number
    flushReason: FlushReason
  }) => void
}

type FlushReason = 'debounce' | 'max-wait'

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
  const handwritingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handwritingBurstStartedAtRef = useRef<number | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingBurstStartedAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (!editor || !noteId) return

    const flushTypedText = async (
      pipelineId: string,
      debounceScheduledAt: number,
      pipelineStartedAt: number,
      flushReason: FlushReason,
    ) => {
      typingBurstStartedAtRef.current = null

      if (env.NEXT_PUBLIC_RAG_DEBUG_TIMING) {
        console.info('[pipeline] typing debounce elapsed', {
          pipelineId,
          flushReason,
          debounceMs: Math.round(pipelineStartedAt - debounceScheduledAt),
          noteId,
        })
      }

      if (activeSourceIds.length === 0) {
        return
      }

      const typedText = getRecentTypedText()
      const combinedText = typedText
        .filter((entry) => entry.trim())
        .join('\n')
        .trim()

      if (!combinedText) {
        return
      }

      resetRecentTypedText()

      if (env.NEXT_PUBLIC_RAG_DEBUG_TIMING) {
        console.info('[pipeline] typed canvas text ready', {
          pipelineId,
          totalPreRagMs: Math.round(performance.now() - pipelineStartedAt),
          textLength: combinedText.length,
        })
      }

      onCanvasText({ text: combinedText, pipelineId, pipelineStartedAt, flushReason })
    }

    const flushHandwritingText = async (
      pipelineId: string,
      debounceScheduledAt: number,
      pipelineStartedAt: number,
      flushReason: FlushReason,
    ) => {
      handwritingBurstStartedAtRef.current = null

      if (env.NEXT_PUBLIC_RAG_DEBUG_TIMING) {
        console.info('[pipeline] handwriting debounce elapsed', {
          pipelineId,
          flushReason,
          debounceMs: Math.round(pipelineStartedAt - debounceScheduledAt),
          noteId,
        })
      }

      if (activeSourceIds.length === 0) {
        return
      }

      const shapeIds = getRecentShapeIds()
      if (shapeIds.length === 0) {
        return
      }

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

            if (flushReason === 'debounce') {
              resetRecentHandwritingShapeIds()
            }

            const combinedText = text.trim()
            if (!combinedText) {
              return
            }

            if (env.NEXT_PUBLIC_RAG_DEBUG_TIMING) {
              console.info('[pipeline] handwritten canvas text ready', {
                pipelineId,
                totalPreRagMs: Math.round(performance.now() - pipelineStartedAt),
                textLength: combinedText.length,
              })
            }

            onCanvasText({ text: combinedText, pipelineId, pipelineStartedAt, flushReason })
          } catch {
            // Fail quietly: OCR should not interrupt writing flow.
          }
        }
      }
    }

    const scheduleTypedFlush = (now: number) => {
      const debounceScheduledAt = now

      if (typingBurstStartedAtRef.current === null) {
        typingBurstStartedAtRef.current = now
      }

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current)
      }

      const elapsedInBurst = now - typingBurstStartedAtRef.current
      const remainingMaxWait = Math.max(0, env.NEXT_PUBLIC_OCR_MAX_WAIT_MS - elapsedInBurst)
      const nextDelay = Math.min(env.NEXT_PUBLIC_OCR_DEBOUNCE_MS, remainingMaxWait)
      const flushReason: FlushReason =
        remainingMaxWait < env.NEXT_PUBLIC_OCR_DEBOUNCE_MS ? 'max-wait' : 'debounce'

      typingTimerRef.current = setTimeout(() => {
        const pipelineId = createPipelineId(noteId)
        const pipelineStartedAt = performance.now()
        void flushTypedText(pipelineId, debounceScheduledAt, pipelineStartedAt, flushReason)
      }, nextDelay)
    }

    const scheduleHandwritingFlush = (now: number) => {
      const debounceScheduledAt = now

      if (handwritingBurstStartedAtRef.current === null) {
        handwritingBurstStartedAtRef.current = now
      }

      if (handwritingTimerRef.current) {
        clearTimeout(handwritingTimerRef.current)
      }

      const elapsedInBurst = now - handwritingBurstStartedAtRef.current
      const remainingMaxWait = Math.max(0, env.NEXT_PUBLIC_OCR_MAX_WAIT_MS - elapsedInBurst)
      const nextDelay = Math.min(env.NEXT_PUBLIC_OCR_DEBOUNCE_MS, remainingMaxWait)
      const flushReason: FlushReason =
        remainingMaxWait < env.NEXT_PUBLIC_OCR_DEBOUNCE_MS ? 'max-wait' : 'debounce'

      handwritingTimerRef.current = setTimeout(() => {
        const pipelineId = createPipelineId(noteId)
        const pipelineStartedAt = performance.now()
        void flushHandwritingText(pipelineId, debounceScheduledAt, pipelineStartedAt, flushReason)
      }, nextDelay)
    }

    const handleChange = () => {
      const now = performance.now()

      if (getRecentTypedText().length > 0) {
        scheduleTypedFlush(now)
      }

      if (getRecentShapeIds().length > 0) {
        scheduleHandwritingFlush(now)
      }
    }

    const unlisten = editor.store.listen(handleChange)

    return () => {
      unlisten()
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current)
        typingTimerRef.current = null
      }
      if (handwritingTimerRef.current) {
        clearTimeout(handwritingTimerRef.current)
        handwritingTimerRef.current = null
      }
      typingBurstStartedAtRef.current = null
      handwritingBurstStartedAtRef.current = null
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
