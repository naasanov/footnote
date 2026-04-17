'use client'

import { AnimatePresence, motion } from 'framer-motion'
import type { RagResult } from '@/lib/types'
import { PassageCard } from './PassageCard'

interface RagSidebarProps {
  isLoading: boolean
  isSummarizing: boolean
  results: RagResult[]
  resultsVersion: number
  sourceColors: Record<string, string>
  queryText: string
}

function HeaderSpinner() {
  return (
    <span
      aria-hidden="true"
      className="h-3.5 w-3.5 rounded-full border-[1.5px] border-[#D6CEC3] border-t-[#8A7F71] animate-spin"
    />
  )
}

export function RagSidebar({
  isLoading,
  isSummarizing,
  results,
  resultsVersion,
  sourceColors,
  queryText,
}: RagSidebarProps) {
  const isRefreshing = isLoading || isSummarizing
  const sourceNumbers = new Map<string, number>()

  for (const result of results) {
    if (!sourceNumbers.has(result.sourceId)) {
      sourceNumbers.set(result.sourceId, sourceNumbers.size + 1)
    }
  }

  return (
    <div className="h-full min-w-0 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="min-w-0 text-xs font-medium uppercase tracking-wider text-[#78716C]">
            related passages
          </h2>
          {isRefreshing ? <HeaderSpinner /> : null}
        </div>
        <span className="rounded-full bg-[#E8E2D9] px-2 py-0.5 text-[11px] text-[#57534E]">
          {results.length} found
        </span>
      </div>

      {results.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center">
          <p className="text-sm text-[#A8A29E]">Start writing to surface related passages</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="relative min-h-full">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={resultsVersion}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20, position: 'absolute', inset: 0 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="space-y-2 pb-2"
              >
                {results.map((result) => (
                  <PassageCard
                    key={result.chunkId}
                    result={result}
                    isSummaryLoading={isSummarizing && !result.summary}
                    sourceColor={sourceColors[result.sourceId] ?? '#2D5016'}
                    sourceNumber={sourceNumbers.get(result.sourceId) ?? 0}
                    queryText={queryText}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  )
}
