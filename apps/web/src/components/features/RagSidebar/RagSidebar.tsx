'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import type { RagResult } from '@/lib/types'
import { PassageCard } from './PassageCard'

interface RagSidebarProps {
  isLoading: boolean
  isSummarizing: boolean
  results: RagResult[]
  sourceColors: Record<string, string>
}

function RagSidebarSkeleton() {
  return (
    <ScrollArea className="h-full pr-1">
      <div className="space-y-2 pb-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-md border border-[#E8E2D9] bg-[#FFFDF8] p-3 shadow-sm animate-pulse"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="h-3 w-28 rounded-full bg-[#EFE7DB]" />
              <div className="h-3 w-10 rounded-full bg-[#F3ECE2]" />
            </div>

            <div className="mt-2 h-3 w-20 rounded-full bg-[#F6F0E7]" />
            <div className="mt-3 h-4 w-11/12 rounded-full bg-[#ECE2D4]" />
            <div className="mt-2 h-3 w-full rounded-full bg-[#F3ECE2]" />
            <div className="mt-2 h-3 w-5/6 rounded-full bg-[#F3ECE2]" />
            <div className="mt-2 h-3 w-4/6 rounded-full bg-[#F6F0E7]" />
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

export function RagSidebar({ isLoading, isSummarizing, results, sourceColors }: RagSidebarProps) {
  return (
    <div className="h-full min-w-0 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-3">
        <h2 className="min-w-0 text-xs font-medium uppercase tracking-wider text-[#78716C]">
          related passages
        </h2>
        <span className="rounded-full bg-[#E8E2D9] px-2 py-0.5 text-[11px] text-[#57534E]">
          {results.length} found
        </span>
      </div>

      {isLoading ? (
        <RagSidebarSkeleton />
      ) : results.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center">
          <p className="text-sm text-[#A8A29E]">Start writing to surface related passages</p>
        </div>
      ) : (
        <ScrollArea className="h-full min-w-0 pr-1">
          <div className="min-w-0 space-y-2 pb-2">
            {results.map((result) => (
              <PassageCard
                key={result.chunkId}
                result={result}
                isSummaryLoading={isSummarizing && !result.summary}
                sourceColor={sourceColors[result.sourceId] ?? '#2D5016'}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
