'use client'

import { useMemo, useState } from 'react'
import {
  DefaultSizeStyle,
  DefaultToolbar,
  DefaultColorStyle,
  StylePanelButtonPicker,
  StylePanelContextProvider,
  StylePanelSection,
  Tldraw,
  useStylePanelContext,
  type Editor,
  type TLUiToolsContextType,
  type TLUiOverrides,
  type TLUiStylePanelProps,
} from 'tldraw'
import 'tldraw/tldraw.css'
import { useAppShellRightPanel, useAppShellRegisterZoom } from '@/components/AppShell'
import { useSources } from '@/hooks/useSources'
import { useCanvas } from '@/hooks/useCanvas'
import { useOcrDebounce } from '@/hooks/useOcrDebounce'
import { useRagSidebar } from '@/hooks/useRagSidebar'
import { env } from '@/config/env'
import { RagSidebar } from '@/components/features/RagSidebar/RagSidebar'
import { CanvasPaperBackground, CanvasPaperPattern } from './CanvasPaper'
import { CanvasBackgroundControls } from './CanvasBackgroundControls'
import { ExportButton } from './ExportButton'
import {
  CitationChipRenderProvider,
  CitationChipShapeUtil,
} from './CitationChipShape'
import type { CanvasBackground as CanvasBackgroundVariant, OcrBbox } from '@/lib/types'

const CURATED_TOOL_IDS = ['select', 'draw', 'highlight', 'eraser', 'text', 'arrow']

const CURATED_COLORS = [
  { icon: 'color', value: 'black' },
  { icon: 'color', value: 'grey' },
  { icon: 'color', value: 'red' },
  { icon: 'color', value: 'blue' },
  { icon: 'color', value: 'green' },
  { icon: 'color', value: 'yellow' },
  { icon: 'color', value: 'light-blue' },
  { icon: 'color', value: 'violet' },
] as const

const CURATED_SIZES = [
  { icon: 'size-small', value: 's' },
  { icon: 'size-medium', value: 'm' },
  { icon: 'size-large', value: 'l' },
] as const

function CuratedStylePanel(props: TLUiStylePanelProps) {
  const styles = props.styles
  if (!styles) return null

  return (
    <StylePanelContextProvider styles={styles}>
      <CuratedStylePanelContent />
    </StylePanelContextProvider>
  )
}

function CuratedStylePanelContent() {
  const { styles, onValueChange, onHistoryMark } = useStylePanelContext()

  const color = styles.get(DefaultColorStyle)
  const size = styles.get(DefaultSizeStyle)

  if (!color || !size) return null

  return (
    <div className="tlui-style-panel__wrapper">
      <StylePanelSection>
        <StylePanelButtonPicker
          title="Color"
          uiType="color"
          style={DefaultColorStyle}
          value={color}
          items={CURATED_COLORS}
          onValueChange={onValueChange}
          onHistoryMark={onHistoryMark}
        />
      </StylePanelSection>

      <StylePanelSection>
        <StylePanelButtonPicker
          title="Size"
          uiType="size"
          style={DefaultSizeStyle}
          value={size}
          items={CURATED_SIZES}
          onValueChange={onValueChange}
          onHistoryMark={onHistoryMark}
        />
      </StylePanelSection>
    </div>
  )
}

interface NoteCanvasProps {
  noteId: string
  notebookId: string
  noteTitle: string
  activeSourceIds: string[]
  initialCanvasState: Record<string, unknown>
  initialCanvasBackground: CanvasBackgroundVariant
}

export function NoteCanvas({
  noteId,
  notebookId,
  noteTitle,
  activeSourceIds,
  initialCanvasState,
  initialCanvasBackground,
}: NoteCanvasProps) {
  const [editor, setEditor] = useState<Editor | null>(null)

  const { sources } = useSources(noteId, notebookId)
  const {
    attachDropTarget,
    canvasBackground,
    getRecentStrokeBounds,
    getRecentShapeIds,
    getRecentTypedText,
    resetRecentHandwritingShapeIds,
    resetRecentTypedText,
    updateCanvasBackground,
  } = useCanvas(editor, noteId, initialCanvasBackground)
  const { ragResults, isQuerying, isSummarizing, latestCanvasText, handleCanvasText } =
    useRagSidebar(noteId, activeSourceIds)

  const zoomToBoundsCallback = useMemo(
    () =>
      editor
        ? (bbox: OcrBbox, padding = 48) => {
            editor.zoomToBounds(
              { x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h },
              {
                inset: -padding,
                targetZoom: env.NEXT_PUBLIC_OCR_SEARCH_MAX_ZOOM,
                animation: { duration: 300 },
              },
            )
          }
        : null,
    [editor],
  )
  useAppShellRegisterZoom(zoomToBoundsCallback)

  const sourceIdSet = useMemo(() => new Set(sources.map((source) => source._id)), [sources])

  const sourceColors = useMemo(() => {
    return Object.fromEntries(sources.map((source) => [source._id, source.color ?? '#2D5016']))
  }, [sources])

  const rightPanelNode = useMemo(
    () => (
      <RagSidebar
        isLoading={isQuerying}
        isSummarizing={isSummarizing}
        results={ragResults}
        sourceColors={sourceColors}
      />
    ),
    [isQuerying, isSummarizing, ragResults, sourceColors],
  )

  useAppShellRightPanel(rightPanelNode)

  useOcrDebounce({
    editor,
    noteId,
    activeSourceIds,
    getRecentShapeIds,
    getRecentTypedText,
    getRecentStrokeBounds,
    resetRecentHandwritingShapeIds,
    resetRecentTypedText,
    onCanvasText: handleCanvasText,
  })

  const uiOverrides = useMemo<TLUiOverrides>(
    () => ({
      tools(_editor, tools) {
        const typedTools = tools as TLUiToolsContextType
        const curatedEntries = CURATED_TOOL_IDS
          .map((id) => [id, typedTools[id]])
          .filter((entry): entry is [string, NonNullable<(typeof typedTools)[string]>] => Boolean(entry[1]))

        return Object.fromEntries(curatedEntries)
      },
    }),
    [],
  )

  return (
    <CitationChipRenderProvider sourceIdSet={sourceIdSet} sourceColors={sourceColors}>
      <div ref={attachDropTarget} className="h-full w-full relative">
        <Tldraw
          key={noteId}
          licenseKey={env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY}
          persistenceKey={`footnote-note-${noteId}`}
          shapeUtils={[CitationChipShapeUtil as any]}
          overrides={uiOverrides}
          components={{
            Background: CanvasPaperBackground,
            OnTheCanvas: () => <CanvasPaperPattern canvasBackground={canvasBackground} />,
            Toolbar: DefaultToolbar,
            StylePanel: CuratedStylePanel,
            MainMenu: null,
            PageMenu: null,
            NavigationPanel: null,
          }}
          onMount={(mountedEditor) => {
            const hasInitialSnapshot =
              typeof initialCanvasState === 'object' &&
              initialCanvasState !== null &&
              Object.keys(initialCanvasState).length > 0

            if (hasInitialSnapshot) {
              try {
                mountedEditor.loadSnapshot(initialCanvasState as any)
              } catch {
                // If the snapshot is invalid or from an incompatible version, start fresh.
              }
            }

            setEditor(mountedEditor)
          }}
        />

        <div className="pointer-events-auto absolute top-3 right-3 z-10 flex items-center gap-2">
          <CanvasBackgroundControls
            canvasBackground={canvasBackground}
            onChange={(nextCanvasBackground) => {
              void updateCanvasBackground(nextCanvasBackground)
            }}
          />
          <ExportButton editor={editor} noteTitle={noteTitle} />
        </div>

        {env.NEXT_PUBLIC_OCR_DEBUG && (
          <div className="pointer-events-none absolute bottom-3 left-3 max-w-[360px] rounded-md bg-[#1C1917]/75 px-3 py-2 font-mono text-[11px] text-[#FAFAF8]">
            {latestCanvasText || 'OCR debug enabled - waiting for canvas text...'}
          </div>
        )}
      </div>
    </CitationChipRenderProvider>
  )
}
