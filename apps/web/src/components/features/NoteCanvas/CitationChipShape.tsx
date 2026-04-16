'use client'

import { createContext } from 'react'
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  T,
  type TLBaseShape,
} from 'tldraw'

export interface CitationChipShapeProps {
  chunkId: string
  sourceId: string
  sourceName: string
  locationLabel: string
  excerpt: string
  fullText: string
  matchScore: number
  expanded: boolean
  w: number
  h: number
}

export type CitationChipShape = TLBaseShape<'citation-chip', CitationChipShapeProps>

interface CitationChipRenderContextValue {
  sourceIdSet: Set<string>
  sourceColors: Record<string, string>
}

const CitationChipRenderContext = createContext<CitationChipRenderContextValue>({
  sourceIdSet: new Set<string>(),
  sourceColors: {},
})

export function CitationChipRenderProvider({
  children,
  sourceIdSet,
  sourceColors,
}: {
  children: React.ReactNode
  sourceIdSet: Set<string>
  sourceColors: Record<string, string>
}) {
  return (
    <CitationChipRenderContext.Provider value={{ sourceIdSet, sourceColors }}>
      {children}
    </CitationChipRenderContext.Provider>
  )
}

const COLLAPSED_WIDTH = 280
const COLLAPSED_HEIGHT = 40
const EXPANDED_WIDTH = 360
const EXPANDED_HEIGHT = 172

export function getCitationChipDimensions(expanded: boolean) {
  return expanded
    ? { w: EXPANDED_WIDTH, h: EXPANDED_HEIGHT }
    : { w: COLLAPSED_WIDTH, h: COLLAPSED_HEIGHT }
}

function getCitationChipTogglePatch(shape: CitationChipShape) {
  const nextExpanded = !shape.props.expanded
  const nextSize = getCitationChipDimensions(nextExpanded)

  return {
    id: shape.id,
    type: shape.type,
    props: {
      expanded: nextExpanded,
      ...nextSize,
    },
  }
}

export class CitationChipShapeUtil extends BaseBoxShapeUtil<any> {
  static override type = 'citation-chip' as const

  static override props = {
    chunkId: T.string,
    sourceId: T.string,
    sourceName: T.string,
    locationLabel: T.string,
    excerpt: T.string,
    fullText: T.string,
    matchScore: T.number,
    expanded: T.boolean,
    w: T.number,
    h: T.number,
  }

  override canResize = () => false
  override canEdit = () => false

  getDefaultProps(): CitationChipShapeProps {
    return {
      chunkId: '',
      sourceId: '',
      sourceName: '',
      locationLabel: '',
      excerpt: '',
      fullText: '',
      matchScore: 0,
      expanded: false,
      w: COLLAPSED_WIDTH,
      h: COLLAPSED_HEIGHT,
    }
  }

  getGeometry(shape: CitationChipShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override onClick(shape: CitationChipShape) {
    return getCitationChipTogglePatch(shape)
  }

  component(shape: CitationChipShape) {
    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: 'none',
        }}
      >
        <CitationChipRenderContext.Consumer>
          {({ sourceIdSet, sourceColors }) => {
            const isOrphaned = !sourceIdSet.has(shape.props.sourceId)
            const sourceColor = isOrphaned ? '#A8A29E' : sourceColors[shape.props.sourceId] ?? '#2D5016'
            const label = `[${shape.props.sourceName} - ${shape.props.locationLabel}]`

            return (
              <div
                className="h-full w-full rounded-r-md bg-[#FFFDF8] text-left shadow-sm"
                style={{
                  borderLeft: `3px solid ${sourceColor}`,
                  opacity: isOrphaned ? 0.78 : 1,
                  userSelect: 'none',
                }}
              >
                <div className="truncate px-3 pt-2 font-mono text-xs text-[#44403C]">{label}</div>

                {shape.props.expanded && (
                  <div className="px-3 pb-2 pt-1">
                    <p className="line-clamp-3 font-display text-sm text-[#1C1917]">
                      {isOrphaned ? 'Source deleted' : shape.props.fullText || shape.props.excerpt}
                    </p>
                    <div className="mt-2 text-[11px] text-[#78716C]">
                      <span>{shape.props.sourceName}</span>
                      <span className="px-1">|</span>
                      <span>{shape.props.locationLabel}</span>
                      <span className="px-1">|</span>
                      <span>score {shape.props.matchScore.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          }}
        </CitationChipRenderContext.Consumer>
      </HTMLContainer>
    )
  }

  indicator(shape: CitationChipShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={0} ry={0} />
  }
}
