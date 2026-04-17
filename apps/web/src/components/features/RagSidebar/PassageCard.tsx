"use client";

import { useAppShellCitationDrag } from "@/components/AppShell";
import type { RagResult } from "@/lib/types";
import { useMemo } from "react";

interface PassageCardProps {
  result: RagResult;
  sourceColor: string;
  sourceNumber: number;
  isSummaryLoading: boolean;
  queryText: string;
}

const STOP_WORDS = new Set([
  "this",
  "that",
  "with",
  "from",
  "have",
  "about",
  "because",
  "which",
  "there",
  "their",
  "where",
  "when",
  "into",
  "between",
  "during",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTerms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

function extractHighlightTerms(summary: string, queryText: string): string[] {
  const queryTerms = extractTerms(queryText);
  const summaryTerms = extractTerms(summary);

  return [...new Set([...queryTerms, ...summaryTerms])].slice(0, 6);
}

function renderHighlightedExcerpt(
  excerpt: string,
  summary: string,
  queryText: string,
) {
  const terms = extractHighlightTerms(summary, queryText);
  if (terms.length === 0) {
    return (
      <span className="whitespace-normal break-words [overflow-wrap:anywhere]">
        {excerpt}
      </span>
    );
  }

  const regex = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "ig");
  const parts = excerpt.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        const isHighlighted = terms.some(
          (term) => term.toLowerCase() === part.toLowerCase(),
        );

        if (!isHighlighted) {
          return (
            <span
              key={`${part}-${index}`}
              className="whitespace-normal break-words [overflow-wrap:anywhere]"
            >
              {part}
            </span>
          );
        }

        return (
          <span
            key={`${part}-${index}`}
            className="font-semibold text-[#2D5016] whitespace-normal break-words [overflow-wrap:anywhere]"
          >
            {part}
          </span>
        );
      })}
    </>
  );
}

function SummaryPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="h-[3.1rem] rounded-md border border-dashed border-[#E8E2D9] bg-[#F8F4EC]/80 px-2.5 py-2"
    >
      <div className="h-2.5 w-24 rounded-full bg-[#E9E1D3] animate-pulse" />
      <div className="mt-2 h-3 w-11/12 rounded-full bg-[#EFE7DB] animate-pulse" />
    </div>
  );
}

export function PassageCard({
  result,
  sourceColor,
  sourceNumber,
  isSummaryLoading,
  queryText,
}: PassageCardProps) {
  const citationDrag = useAppShellCitationDrag();
  const transferPayload = useMemo(
    () => ({
      chunkId: result.chunkId,
      sourceId: result.sourceId,
      sourceName: result.sourceName,
      locationLabel: result.locationLabel,
      excerpt: result.excerpt,
      fullText: result.fullText,
      matchScore: result.matchScore,
    }),
    [result],
  );
  const previewPayload = useMemo(
    () => ({
      ...transferPayload,
      sourceColor,
      sourceNumber,
    }),
    [sourceColor, sourceNumber, transferPayload],
  );

  return (
    <article
      draggable
      onDragStart={(event) => {
        const payload = JSON.stringify(transferPayload);

        event.dataTransfer.setData("application/json", payload);
        event.dataTransfer.setData("text/plain", payload);
        event.dataTransfer.effectAllowed = "copyMove";
        const transparentDragImage = document.createElement("div");
        transparentDragImage.style.width = "1px";
        transparentDragImage.style.height = "1px";
        transparentDragImage.style.opacity = "0";
        document.body.appendChild(transparentDragImage);
        event.dataTransfer.setDragImage(transparentDragImage, 0, 0);
        requestAnimationFrame(() => {
          transparentDragImage.remove();
        });
        citationDrag?.startDrag(previewPayload, {
          x: event.clientX,
          y: event.clientY,
        });
      }}
      onDragEnd={() => {
        citationDrag?.endDrag();
      }}
      className="min-w-0 max-w-full overflow-hidden cursor-grab rounded-xl border border-[#E8E2D9] bg-[#FFFDF8] p-2.5 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
      style={{ borderLeft: `3px solid ${sourceColor}` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex flex-1 items-start gap-2">
          <span
            aria-label={`Source ${sourceNumber}`}
            className="mt-0.5 inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
            style={{ backgroundColor: sourceColor }}
          >
            {sourceNumber}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold tracking-[0.01em] text-[#1C1917]">
              {result.sourceName}
            </p>
            <p className="mt-1 text-[11px] text-[#78716C]">
              {result.locationLabel}
            </p>
          </div>
        </div>

        <span className="rounded-full bg-[#F4EEE3] px-2 py-0.5 text-[11px] font-medium text-[#6B645C]">
          {Math.round(result.matchScore * 100)}%
        </span>
      </div>

      <div className="mt-3 min-w-0 min-h-[3.1rem]">
        <div
          className={`transition-all duration-200 ${
            result.summary
              ? "translate-y-0 opacity-100"
              : "translate-y-1 opacity-0"
          }`}
        >
          {result.summary ? (
            <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-[#EAE2D6] bg-[#F8F4EC]/90 px-2.5 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A7F71]">
                Why it matched
              </p>
              <p className="mt-1 max-w-full whitespace-normal text-sm font-medium leading-5 text-[#1C1917] break-words [overflow-wrap:anywhere]">
                {result.summary}
              </p>
            </div>
          ) : null}
        </div>

        {!result.summary && isSummaryLoading ? <SummaryPlaceholder /> : null}
      </div>

      <div className="mt-3 min-w-0 max-w-full overflow-hidden rounded-md border border-[#EFE7DB] bg-[#FCFAF5] px-2.5 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A7F71]">
          Source snippet
        </p>
        <p className="mt-1 max-w-full whitespace-normal text-sm leading-6 text-[#292524] break-words [overflow-wrap:anywhere]">
          {renderHighlightedExcerpt(result.excerpt, result.summary, queryText)}
        </p>
      </div>
    </article>
  );
}
