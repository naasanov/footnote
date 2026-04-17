'use client'

import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Search, X } from 'lucide-react'
import { NotebookTree } from './features/NotebookTree/NotebookTree'
import { SourceList } from './features/SourceList/SourceList'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'
import { Input } from './ui/input'
import { useOcrSearch } from '@/hooks/useOcrSearch'
import { persistAppShellLayoutState, readAppShellLayoutState } from '@/lib/session-state'
import { cn } from '@/lib/utils'
import type { OcrBbox } from '@/lib/types'

interface AppShellProps {
  children: React.ReactNode
  rightPanel?: React.ReactNode
}

interface AppShellRightPanelContextValue {
  setRightPanelNode: (node: React.ReactNode) => void
}

const AppShellRightPanelContext = createContext<AppShellRightPanelContextValue | null>(null)

// ─── Canvas zoom context ──────────────────────────────────────────────────────

type ZoomFn = (bbox: OcrBbox, padding?: number) => void

interface AppShellCanvasContextValue {
  registerZoom: (fn: ZoomFn | null) => void
  zoom: ZoomFn | null
}

const AppShellCanvasContext = createContext<AppShellCanvasContextValue | null>(null)

export function useAppShellRegisterZoom(fn: ZoomFn | null) {
  const ctx = useContext(AppShellCanvasContext)
  useEffect(() => {
    if (!ctx) return
    ctx.registerZoom(fn)
    return () => ctx.registerZoom(null)
  }, [ctx, fn])
}

export function useAppShellZoom(): ZoomFn | null {
  return useContext(AppShellCanvasContext)?.zoom ?? null
}

const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 }
const INSTANT = { duration: 0 }
const MIN_LEFT_TOP_RATIO = 0.25
const MAX_LEFT_TOP_RATIO = 0.75
const MIN_LEFT_WIDTH = 220
const DEFAULT_LEFT_WIDTH = 240
const MAX_LEFT_WIDTH = 420
const MIN_RIGHT_WIDTH = 320
const DEFAULT_RIGHT_WIDTH = 300
const MAX_RIGHT_WIDTH = 520
const DEFAULT_LEFT_TOP_RATIO = 0.62

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function useAppShellRightPanel(node: React.ReactNode) {
  const context = useContext(AppShellRightPanelContext)

  useEffect(() => {
    if (!context) return

    context.setRightPanelNode(node)
    return () => {
      context.setRightPanelNode(null)
    }
  }, [context, node])
}

export function AppShell({ children, rightPanel }: AppShellProps) {
  const params = useParams()
  const notebookId = typeof params?.notebookId === 'string' ? params.notebookId : null
  const noteId = typeof params?.noteId === 'string' ? params.noteId : null
  const hasSelectedNote = Boolean(notebookId && noteId)

  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [slottedRightPanel, setSlottedRightPanel] = useState<React.ReactNode>(null)
  const [zoomFn, setZoomFnState] = useState<ZoomFn | null>(null)
  const registerZoom = useCallback((fn: ZoomFn | null) => {
    setZoomFnState(() => fn)
  }, [])
  const [leftTopRatio, setLeftTopRatio] = useState(DEFAULT_LEFT_TOP_RATIO)
  const [isDraggingLeftDivider, setIsDraggingLeftDivider] = useState(false)
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH)
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH)
  const [draggingSidebar, setDraggingSidebar] = useState<'left' | 'right' | null>(null)
  const [hasHydratedLayout, setHasHydratedLayout] = useState(false)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const leftSplitRef = useRef<HTMLDivElement | null>(null)
  const leftDividerFrameRef = useRef<number | null>(null)
  const pendingLeftTopRatioRef = useRef(leftTopRatio)

  useEffect(() => {
    const storedLayout = readAppShellLayoutState()

    if (storedLayout) {
      setLeftWidth(storedLayout.leftWidth)
      setRightWidth(storedLayout.rightWidth)
      setLeftTopRatio(storedLayout.leftTopRatio)
      pendingLeftTopRatioRef.current = storedLayout.leftTopRatio
    }

    setHasHydratedLayout(true)
  }, [])

  // Tablet breakpoint: collapse left panel by default
  useEffect(() => {
    function onResize() {
      if (window.innerWidth < 1280) {
        setLeftOpen(false)
      } else {
        setLeftOpen(true)
      }
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!isDraggingLeftDivider) return

    function handlePointerMove(event: PointerEvent) {
      const container = leftSplitRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      if (!rect.height) return

      const nextRatio = (event.clientY - rect.top) / rect.height
      const clampedRatio = Math.min(MAX_LEFT_TOP_RATIO, Math.max(MIN_LEFT_TOP_RATIO, nextRatio))
      pendingLeftTopRatioRef.current = clampedRatio

      if (leftDividerFrameRef.current !== null) return

      leftDividerFrameRef.current = window.requestAnimationFrame(() => {
        leftDividerFrameRef.current = null
        setLeftTopRatio(pendingLeftTopRatioRef.current)
      })
    }

    function handlePointerUp() {
      if (leftDividerFrameRef.current !== null) {
        window.cancelAnimationFrame(leftDividerFrameRef.current)
        leftDividerFrameRef.current = null
      }

      setLeftTopRatio(pendingLeftTopRatioRef.current)
      setIsDraggingLeftDivider(false)
    }

    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      if (leftDividerFrameRef.current !== null) {
        window.cancelAnimationFrame(leftDividerFrameRef.current)
        leftDividerFrameRef.current = null
      }

      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDraggingLeftDivider])

  useEffect(() => {
    if (!draggingSidebar) return

    function handlePointerMove(event: PointerEvent) {
      const container = shellRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const maxAllowedWidth = Math.max(
        draggingSidebar === 'left' ? MIN_LEFT_WIDTH : MIN_RIGHT_WIDTH,
        Math.min(rect.width * 0.45, draggingSidebar === 'left' ? MAX_LEFT_WIDTH : MAX_RIGHT_WIDTH),
      )

      if (draggingSidebar === 'left') {
        setLeftWidth(clamp(event.clientX - rect.left, MIN_LEFT_WIDTH, maxAllowedWidth))
        return
      }

      setRightWidth(clamp(rect.right - event.clientX, MIN_RIGHT_WIDTH, maxAllowedWidth))
    }

    function handlePointerUp() {
      setDraggingSidebar(null)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [draggingSidebar])

  useEffect(() => {
    function syncSidebarWidths() {
      const viewportWidth = window.innerWidth
      setLeftWidth((currentWidth) =>
        clamp(currentWidth, MIN_LEFT_WIDTH, Math.min(viewportWidth * 0.45, MAX_LEFT_WIDTH)),
      )
      setRightWidth((currentWidth) =>
        clamp(currentWidth, MIN_RIGHT_WIDTH, Math.min(viewportWidth * 0.45, MAX_RIGHT_WIDTH)),
      )
    }

    syncSidebarWidths()
    window.addEventListener('resize', syncSidebarWidths)

    return () => window.removeEventListener('resize', syncSidebarWidths)
  }, [])

  useEffect(() => {
    if (!hasHydratedLayout) return

    persistAppShellLayoutState({
      leftWidth,
      rightWidth,
      leftTopRatio,
    })
  }, [hasHydratedLayout, leftTopRatio, leftWidth, rightWidth])

  const resolvedRightPanel = rightPanel ?? slottedRightPanel

  return (
    <AppShellCanvasContext.Provider value={{ registerZoom, zoom: zoomFn }}>
    <AppShellRightPanelContext.Provider
      value={{
        setRightPanelNode: setSlottedRightPanel,
      }}
    >
      <TooltipProvider delayDuration={400}>
        <div ref={shellRef} className="flex h-screen overflow-hidden bg-[#FAFAF8]">
        {/* Left sidebar */}
        <motion.div
          animate={{ width: leftOpen ? leftWidth : 0 }}
          transition={draggingSidebar === 'left' ? INSTANT : SPRING}
          className="shrink-0 overflow-hidden border-r border-[#E8E2D9] bg-[#FFFDF8]"
          style={{ minWidth: 0 }}
        >
          <div className="h-full flex flex-col overflow-hidden" style={{ width: leftWidth }}>
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-3 h-12 border-b border-[#E8E2D9] shrink-0">
              <span className="font-display text-sm font-semibold text-[#1C1917]">Footnote</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setLeftOpen(false)}
                    className="text-[#C8BFB0] hover:text-[#1C1917] transition-colors"
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Collapse sidebar</TooltipContent>
              </Tooltip>
            </div>
            <div ref={leftSplitRef} className="flex-1 min-h-0 flex flex-col">
              {hasSelectedNote && noteId && (
                <div className="shrink-0 px-2 pt-2 pb-1 border-b border-[#E8E2D9]">
                  <OcrSearchBar noteId={noteId} zoom={zoomFn} />
                </div>
              )}
              <div
                className="min-h-0 overflow-y-auto"
                style={{ height: hasSelectedNote ? `${leftTopRatio * 100}%` : '100%' }}
              >
                <NotebookTree />
              </div>

              {hasSelectedNote && notebookId && noteId && (
                <>
                  <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Resize note hierarchy and sources panels"
                    className={cn(
                      'group relative h-3 shrink-0 cursor-row-resize touch-none bg-[#FFFDF8]',
                      isDraggingLeftDivider && 'bg-[#F5F1E8]',
                    )}
                    onPointerDown={(event) => {
                      event.preventDefault()
                      setIsDraggingLeftDivider(true)
                    }}
                  >
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-3">
                      <div className="h-px rounded-full bg-[#E8E2D9] transition-colors group-hover:bg-[#C8BFB0]" />
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden border-t border-[#E8E2D9] bg-[#FCFAF5] flex flex-col">
                    <div className="flex items-center justify-between px-3 py-2 shrink-0">
                      <span className="text-xs font-medium uppercase tracking-wider text-[#C8BFB0]">
                        Sources
                      </span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto pb-2">
                      <SourceList noteId={noteId} notebookId={notebookId} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {leftOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize left sidebar"
              className={cn(
                'relative z-10 w-3 shrink-0 cursor-col-resize touch-none bg-[#FAFAF8]',
                draggingSidebar === 'left' && 'bg-[#F5F1E8]',
              )}
              onPointerDown={(event) => {
                event.preventDefault()
                setDraggingSidebar('left')
              }}
            >
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px rounded-full bg-[#E8E2D9] transition-colors hover:bg-[#C8BFB0]" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Left collapse toggle (when collapsed) */}
        <AnimatePresence>
          {!leftOpen && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute left-2 top-3 z-10"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setLeftOpen(true)}
                    className="flex items-center justify-center h-8 w-8 rounded-md border border-[#E8E2D9] bg-[#FFFDF8] text-[#C8BFB0] hover:text-[#1C1917] shadow-sm transition-colors"
                    aria-label="Open sidebar"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Open sidebar</TooltipContent>
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center panel */}
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>

        {/* Right sidebar */}
        <AnimatePresence>
          {rightOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize right panel"
              className={cn(
                'relative z-10 w-3 shrink-0 cursor-col-resize touch-none bg-[#FAFAF8]',
                draggingSidebar === 'right' && 'bg-[#F5F1E8]',
              )}
              onPointerDown={(event) => {
                event.preventDefault()
                setDraggingSidebar('right')
              }}
            >
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px rounded-full bg-[#E8E2D9] transition-colors hover:bg-[#C8BFB0]" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          animate={{ width: rightOpen ? rightWidth : 0 }}
          transition={draggingSidebar === 'right' ? INSTANT : SPRING}
          className="shrink-0 overflow-hidden border-l border-[#E8E2D9] bg-[#FFFDF8]"
          style={{ minWidth: 0 }}
        >
          <div className="h-full flex flex-col overflow-hidden" style={{ width: rightWidth }}>
            {/* Right header */}
            <div className="flex items-center justify-between px-3 h-12 border-b border-[#E8E2D9] shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setRightOpen(false)}
                    className="text-[#C8BFB0] hover:text-[#1C1917] transition-colors"
                    aria-label="Collapse right panel"
                  >
                    <PanelRightClose className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Collapse panel</TooltipContent>
              </Tooltip>
              <span className="text-xs font-medium text-[#C8BFB0] uppercase tracking-wider">
                Related
              </span>
            </div>
            <div className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-3">
              {resolvedRightPanel ?? (
                <p className="text-xs text-[#C8BFB0] text-center mt-8">
                  Related passages will appear here
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Right collapse toggle (when collapsed) */}
        <AnimatePresence>
          {!rightOpen && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="absolute right-2 top-3 z-10"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setRightOpen(true)}
                    className="flex items-center justify-center h-8 w-8 rounded-md border border-[#E8E2D9] bg-[#FFFDF8] text-[#C8BFB0] hover:text-[#1C1917] shadow-sm transition-colors"
                    aria-label="Open right panel"
                  >
                    <PanelRightOpen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Open panel</TooltipContent>
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </TooltipProvider>
    </AppShellRightPanelContext.Provider>
    </AppShellCanvasContext.Provider>
  )
}

// ─── OcrSearchBar ─────────────────────────────────────────────────────────────

interface OcrSearchBarProps {
  noteId: string
  zoom: ZoomFn | null
}

function OcrSearchBar({ noteId, zoom }: OcrSearchBarProps) {
  const { query, setQuery, clearSearch, results, isLoading, hasQuery } = useOcrSearch(noteId)
  const [isOpen, setIsOpen] = useState(false)

  function handleResultClick(bbox: OcrBbox) {
    if (zoom) {
      zoom(bbox, 48)
    }
    setIsOpen(false)
    clearSearch()
  }

  return (
    <div className="px-2 pb-1">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#C8BFB0]" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          placeholder="Search handwriting…"
          className="h-7 pl-7 pr-7 text-xs border-[#E8E2D9] bg-transparent placeholder:text-[#C8BFB0]"
        />
        {query && (
          <button
            onMouseDown={(e) => { e.preventDefault(); clearSearch(); setIsOpen(false) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#C8BFB0] hover:text-[#1C1917]"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {isOpen && hasQuery && (
        <div className="mt-1 rounded-sm border border-[#E8E2D9] bg-[#FFFDF8] shadow-sm max-h-40 overflow-y-auto">
          {isLoading && (
            <p className="px-3 py-2 text-xs text-[#C8BFB0]">Searching…</p>
          )}
          {!isLoading && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-[#C8BFB0]">No results found</p>
          )}
          {results.map((result, i) => (
            <button
              key={i}
              onMouseDown={(e) => { e.preventDefault(); handleResultClick(result.bbox) }}
              className="w-full text-left px-3 py-2 text-xs text-[#1C1917] hover:bg-[#E8E2D9]/30 truncate block border-t border-[#E8E2D9] first:border-t-0"
            >
              {result.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
