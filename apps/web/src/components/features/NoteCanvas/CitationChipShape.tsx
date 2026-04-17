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
  sourceNumbers: Record<string, number>
}

const CitationChipRenderContext = createContext<CitationChipRenderContextValue>({
  sourceIdSet: new Set<string>(),
  sourceColors: {},
  sourceNumbers: {},
})

export function CitationChipRenderProvider({
  children,
  sourceIdSet,
  sourceColors,
  sourceNumbers,
}: {
  children: React.ReactNode
  sourceIdSet: Set<string>
  sourceColors: Record<string, string>
  sourceNumbers: Record<string, number>
}) {
  return (
    <CitationChipRenderContext.Provider value={{ sourceIdSet, sourceColors, sourceNumbers }}>
      {children}
    </CitationChipRenderContext.Provider>
  )
}

const COLLAPSED_WIDTH = 104
const COLLAPSED_HEIGHT = 48
const EXPANDED_WIDTH = 320
const EXPANDED_HEIGHT = 188
const CHIP_RADIUS = 24
const MIN_COLLAPSED_WIDTH = 148
const MAX_COLLAPSED_WIDTH = 240
const MIN_EXPANDED_WIDTH = 280
const MAX_EXPANDED_WIDTH = 420

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getCollapsedWidth(locationLabel: string) {
  const label = locationLabel.trim() || 'Citation'

  return clamp(COLLAPSED_WIDTH + label.length * 5.8, MIN_COLLAPSED_WIDTH, MAX_COLLAPSED_WIDTH)
}

function getExpandedWidth(locationLabel: string, detailText: string) {
  const collapsedWidth = getCollapsedWidth(locationLabel)
  const detailLength = detailText.trim().length
  const contentDrivenWidth = EXPANDED_WIDTH + Math.min(detailLength, 120) * 0.9

  return clamp(Math.max(collapsedWidth + 28, contentDrivenWidth), MIN_EXPANDED_WIDTH, MAX_EXPANDED_WIDTH)
}

export function getCitationChipDimensions(
  expanded: boolean,
  {
    locationLabel = '',
    detailText = '',
  }: {
    locationLabel?: string
    detailText?: string
  } = {},
) {
  return expanded
    ? {
        w: getExpandedWidth(locationLabel, detailText),
        h: EXPANDED_HEIGHT,
      }
    : {
        w: getCollapsedWidth(locationLabel),
        h: COLLAPSED_HEIGHT,
      }
}

function getCitationChipTogglePatch(shape: CitationChipShape) {
  const nextExpanded = !shape.props.expanded
  const nextSize = getCitationChipDimensions(nextExpanded, {
    locationLabel: shape.props.locationLabel,
    detailText: shape.props.excerpt,
  })

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
      w: getCollapsedWidth(''),
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
          transition:
            'width 240ms cubic-bezier(0.22, 1, 0.36, 1), height 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <CitationChipRenderContext.Consumer>
          {({ sourceIdSet, sourceColors, sourceNumbers }) => {
            const isOrphaned = !sourceIdSet.has(shape.props.sourceId)
            const sourceColor = isOrphaned ? '#A8A29E' : sourceColors[shape.props.sourceId] ?? '#2D5016'
            const sourceNumber = sourceNumbers[shape.props.sourceId]
            const sourceLabel = sourceNumber ? String(sourceNumber) : '?'
            const detailText = isOrphaned ? 'Source deleted' : shape.props.excerpt

            return (
              <div
                className="h-full w-full overflow-hidden border bg-[#FBF6EE] text-left shadow-sm"
                style={{
                  borderColor: isOrphaned ? '#D6D3D1' : '#E2D7C8',
                  borderLeftWidth: 3,
                  borderLeftColor: sourceColor,
                  borderRadius: CHIP_RADIUS,
                  opacity: isOrphaned ? 0.78 : 1,
                  userSelect: 'none',
                  transition:
                    'border-radius 240ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms ease, opacity 180ms ease',
                }}
              >
                <div className="flex h-full flex-col">
                  <div className="flex min-h-[45px] items-center gap-2 px-3.5 py-2.5">
                    <span
                      className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-[12px] font-semibold text-white"
                      style={{ backgroundColor: sourceColor }}
                    >
                      {sourceLabel}
                    </span>
                    <span className="truncate font-display text-sm font-medium text-[#3F3A35]">
                      {shape.props.locationLabel || 'Citation'}
                    </span>
                  </div>

                  <div
                    className="overflow-hidden px-3.5 pb-3 transition-[max-height,opacity,transform] duration-250 ease-out"
                    style={{
                      maxHeight: shape.props.expanded ? 160 : 0,
                      opacity: shape.props.expanded ? 1 : 0,
                      transform: shape.props.expanded ? 'translateY(0)' : 'translateY(-6px)',
                    }}
                  >
                    <p className="font-display text-sm leading-6 text-[#1C1917]">
                      {detailText}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-[#78716C]">
                      <span className="rounded-full bg-[#F2E8DA] px-2 py-1">Source {sourceLabel}</span>
                      <span>{Math.round(shape.props.matchScore * 100)}% match</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          }}
        </CitationChipRenderContext.Consumer>
      </HTMLContainer>
    )
  }

  indicator(shape: CitationChipShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={CHIP_RADIUS} ry={CHIP_RADIUS} />
  }
}
