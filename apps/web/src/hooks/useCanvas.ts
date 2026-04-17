'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { renderPlaintextFromRichText, type Editor, type TLShapeId } from 'tldraw'
import { updateNote } from '@/lib/api/notes'
import { env } from '@/config/env'
import { getCitationChipDimensions } from '@/components/features/NoteCanvas/CitationChipShape'
import type { CanvasBackground } from '@/lib/types'

export interface CitationDropPayload {
  chunkId: string
  sourceId: string
  sourceName: string
  locationLabel: string
  excerpt: string
  fullText: string
  matchScore: number
}

export interface CanvasBounds {
  x: number
  y: number
  w: number
  h: number
}

function isHandwritingShape(type: string): boolean {
  return type === 'draw' || type === 'highlight'
}

function isTrackedShape(type: string): boolean {
  return isHandwritingShape(type) || type === 'text'
}

function getTextShapeContent(editor: Editor, shape: unknown): string {
  if (typeof shape !== 'object' || shape === null || !('props' in shape)) {
    return ''
  }

  const props = shape.props
  if (typeof props !== 'object' || props === null) {
    return ''
  }

  if ('richText' in props && props.richText && typeof props.richText === 'object') {
    return renderPlaintextFromRichText(editor, props.richText as any).trim()
  }

  if ('text' in props && typeof props.text === 'string') {
    return props.text.trim()
  }

  return ''
}

function getInsertedText(previousText: string, nextText: string): string {
  if (!nextText || nextText === previousText) {
    return ''
  }

  let prefixLength = 0
  const maxPrefixLength = Math.min(previousText.length, nextText.length)

  while (
    prefixLength < maxPrefixLength &&
    previousText[prefixLength] === nextText[prefixLength]
  ) {
    prefixLength += 1
  }

  let suffixLength = 0
  const previousRemainingLength = previousText.length - prefixLength
  const nextRemainingLength = nextText.length - prefixLength
  const maxSuffixLength = Math.min(previousRemainingLength, nextRemainingLength)

  while (
    suffixLength < maxSuffixLength &&
    previousText[previousText.length - 1 - suffixLength] ===
      nextText[nextText.length - 1 - suffixLength]
  ) {
    suffixLength += 1
  }

  const insertedText = nextText.slice(prefixLength, nextText.length - suffixLength)

  return insertedText.trim() ? insertedText : ''
}

function getTrackedShapeIds(editor: Editor): Set<string> {
  const ids = new Set<string>()

  for (const shape of editor.getCurrentPageShapes()) {
    if (isTrackedShape(shape.type)) {
      ids.add(shape.id)
    }
  }

  return ids
}

function getCurrentTextByShapeId(editor: Editor): Map<string, string> {
  const textByShapeId = new Map<string, string>()

  for (const shape of editor.getCurrentPageShapes()) {
    if (shape.type !== 'text') {
      continue
    }

    const text = getTextShapeContent(editor, shape)
    textByShapeId.set(shape.id, text)
  }

  return textByShapeId
}

export function useCanvas(
  editor: Editor | null,
  noteId: string,
  initialCanvasBackground: CanvasBackground,
) {
  const { getToken } = useAuth()
  const [canvasBackground, setCanvasBackgroundState] =
    useState<CanvasBackground>(initialCanvasBackground)

  const recentHandwritingShapeIdsRef = useRef<Set<string>>(new Set())
  const recentTypedTextRef = useRef<Map<string, string>>(new Map())
  const knownTrackedShapeIdsRef = useRef<Set<string>>(new Set())
  const knownTextByShapeIdRef = useRef<Map<string, string>>(new Map())
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dropTargetElementRef = useRef<HTMLElement | null>(null)
  const detachDropListenersRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setCanvasBackgroundState(initialCanvasBackground)
  }, [initialCanvasBackground, noteId])

  const persistSnapshot = useCallback(async () => {
    if (!editor || !noteId) return

    try {
      await updateNote(getToken, noteId, {
        canvasState: editor.getSnapshot(),
      })
    } catch {
      toast.error('Failed to save — retrying...')
      // Retry once after 3 seconds
      setTimeout(async () => {
        try {
          if (!editor || !noteId) return
          await updateNote(getToken, noteId, { canvasState: editor.getSnapshot() })
        } catch {
          toast.error('Failed to save note')
        }
      }, 3000)
    }
  }, [editor, getToken, noteId])

  useEffect(() => {
    if (!editor) return

    knownTrackedShapeIdsRef.current = getTrackedShapeIds(editor)
    knownTextByShapeIdRef.current = getCurrentTextByShapeId(editor)

    const unlisten = editor.store.listen(() => {
      const currentTrackedIds = getTrackedShapeIds(editor)
      const currentTextByShapeId = getCurrentTextByShapeId(editor)

      for (const id of currentTrackedIds) {
        if (!knownTrackedShapeIdsRef.current.has(id)) {
          const shape = editor.getShape(id as TLShapeId)
          if (!shape) continue

          if (isHandwritingShape(shape.type)) {
            recentHandwritingShapeIdsRef.current.add(id)
          }

          if (shape.type === 'text') {
            const text = getTextShapeContent(editor, shape)
            if (text) {
              recentTypedTextRef.current.set(id, text)
            }
          }
        }
      }

      for (const [id, text] of currentTextByShapeId) {
        const previousText = knownTextByShapeIdRef.current.get(id) ?? ''

        if (text !== previousText) {
          const insertedText = getInsertedText(previousText, text)

          if (insertedText) {
            const pendingText = recentTypedTextRef.current.get(id) ?? ''
            recentTypedTextRef.current.set(id, `${pendingText}${insertedText}`)
          }
        }
      }

      knownTrackedShapeIdsRef.current = currentTrackedIds
      knownTextByShapeIdRef.current = currentTextByShapeId

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }

      saveTimerRef.current = setTimeout(() => {
        void persistSnapshot()
      }, env.NEXT_PUBLIC_CANVAS_SAVE_DEBOUNCE_MS)
    })

    return () => {
      unlisten()
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [editor, persistSnapshot])

  const getRecentShapeIds = useCallback(() => {
    if (!editor) {
      return []
    }

    const validIds: string[] = []

    for (const id of recentHandwritingShapeIdsRef.current) {
      const shape = editor.getShape(id as TLShapeId)

      if (!shape || !isHandwritingShape(shape.type)) {
        recentHandwritingShapeIdsRef.current.delete(id)
        continue
      }

      validIds.push(id)
    }

    return validIds.sort()
  }, [editor])

  const getRecentStrokeBounds = useCallback((): CanvasBounds | null => {
    if (!editor) return null

    const ids = getRecentShapeIds()
    if (ids.length === 0) return null

    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    let found = false

    for (const id of ids) {
      const shape = editor.getShape(id as TLShapeId)
      if (!shape) continue

      const bounds = editor.getShapePageBounds(shape)
      if (!bounds) continue

      found = true
      minX = Math.min(minX, bounds.x)
      minY = Math.min(minY, bounds.y)
      maxX = Math.max(maxX, bounds.x + bounds.w)
      maxY = Math.max(maxY, bounds.y + bounds.h)
    }

    if (!found) return null

    return {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
    }
  }, [editor, getRecentShapeIds])

  const getRecentTypedText = useCallback(() => {
    if (!editor) {
      return []
    }

    return [...recentTypedTextRef.current.entries()]
      .filter(([id, text]) => {
        const shape = editor.getShape(id as TLShapeId)
        if (!shape || shape.type !== 'text' || !text.trim()) {
          recentTypedTextRef.current.delete(id)
          return false
        }

        return true
      })
      .map(([, text]) => text)
      .filter(Boolean)
  }, [editor])

  const resetRecentHandwritingShapeIds = useCallback(() => {
    recentHandwritingShapeIdsRef.current.clear()
  }, [])

  const resetRecentTypedText = useCallback(() => {
    recentTypedTextRef.current.clear()
  }, [])

  const createCitationChipFromDrop = useCallback(
    (event: DragEvent) => {
      if (!editor || !event.dataTransfer) return

      const rawPayload =
        event.dataTransfer.getData('application/json') ||
        event.dataTransfer.getData('text/plain')

      if (!rawPayload) return

      let payload: CitationDropPayload
      try {
        payload = JSON.parse(rawPayload) as CitationDropPayload
      } catch {
        return
      }

      if (!payload.sourceId || !payload.chunkId) return

      const point = editor.screenToPage({ x: event.clientX, y: event.clientY })
      const size = getCitationChipDimensions(false, {
        locationLabel: payload.locationLabel,
        detailText: payload.excerpt,
      })
      const x = point.x - size.w / 2
      const y = point.y - size.h / 2

      ;(editor as any).createShape({
        type: 'citation-chip',
        x,
        y,
        props: {
          ...payload,
          expanded: false,
          ...size,
        },
      })
    },
    [editor],
  )

  const attachDropTarget = useCallback(
    (node: HTMLElement | null) => {
      if (dropTargetElementRef.current === node) return

      if (detachDropListenersRef.current) {
        detachDropListenersRef.current()
        detachDropListenersRef.current = null
      }

      dropTargetElementRef.current = node
      if (!node) return

      const handleDragOver = (event: DragEvent) => {
        event.preventDefault()
      }

      const handleDrop = (event: DragEvent) => {
        event.preventDefault()
        createCitationChipFromDrop(event)
      }

      node.addEventListener('dragover', handleDragOver)
      node.addEventListener('drop', handleDrop)

      detachDropListenersRef.current = () => {
        node.removeEventListener('dragover', handleDragOver)
        node.removeEventListener('drop', handleDrop)
      }
    },
    [createCitationChipFromDrop],
  )

  const updateCanvasBackground = useCallback(
    async (nextCanvasBackground: CanvasBackground) => {
      if (!noteId || nextCanvasBackground === canvasBackground) return

      const previousCanvasBackground = canvasBackground
      setCanvasBackgroundState(nextCanvasBackground)

      try {
        await updateNote(getToken, noteId, { canvasBackground: nextCanvasBackground })
      } catch {
        setCanvasBackgroundState(previousCanvasBackground)
        toast.error('Failed to update canvas background')
      }
    },
    [canvasBackground, getToken, noteId],
  )

  return {
    attachDropTarget,
    canvasBackground,
    getRecentStrokeBounds,
    getRecentShapeIds,
    getRecentTypedText,
    resetRecentHandwritingShapeIds,
    resetRecentTypedText,
    updateCanvasBackground,
  }
}
