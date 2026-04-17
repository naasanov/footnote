import type { FastifyBaseLogger } from "fastify";
import { ObjectId } from "mongodb";
import type { CitationService } from "../adapters/citation/CitationService.js";
import type { EmbeddingService } from "../adapters/embeddings/EmbeddingService.js";
import { env } from "../config/env.js";
import type { ChunkRepository } from "../repositories/chunk.repository.js";
import type { SourceRepository } from "../repositories/source.repository.js";

export interface RagResult {
  chunkId: string;
  sourceId: string;
  sourceName: string;
  sourceFilename: string;
  locationLabel: string;
  excerpt: string;
  fullText: string;
  matchScore: number;
  summary: string;
}

const QUERY_STOP_WORDS = new Set([
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
  "would",
  "could",
  "should",
  "these",
  "those",
]);

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractQueryTerms(query: string): string[] {
  const words = normalizeText(query)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !QUERY_STOP_WORDS.has(word));

  return [...new Set(words)].sort((a, b) => b.length - a.length);
}

interface SentenceSegment {
  text: string;
  start: number;
  end: number;
}

function splitIntoSentenceSegments(text: string): SentenceSegment[] {
  const segments: SentenceSegment[] = [];
  const sentenceRegex = /[^.!?\n]+(?:[.!?]+(?=\s|$)|$)/g;

  for (const match of text.matchAll(sentenceRegex)) {
    const rawText = match[0];
    const start = match.index ?? 0;
    const trimmedText = rawText.trim();

    if (!trimmedText) {
      continue;
    }

    const leadingWhitespace = rawText.search(/\S/);
    const normalizedStart =
      start + (leadingWhitespace >= 0 ? leadingWhitespace : 0);
    const normalizedEnd = normalizedStart + trimmedText.length;

    segments.push({
      text: trimmedText,
      start: normalizedStart,
      end: normalizedEnd,
    });
  }

  return segments;
}

function buildSnippet(text: string, start: number, end: number): string {
  const snippet = text.slice(start, end).trim();
  return snippet;
}

function countTermOccurrences(text: string, term: string): number {
  const matches = text.match(new RegExp(`\\b${term}\\b`, "g"));
  return matches?.length ?? 0;
}

function scoreSentenceWindow(windowText: string, queryTerms: string[]): number {
  const loweredWindow = windowText.toLowerCase();

  let score = 0;
  let matchedTerms = 0;
  const matchPositions: number[] = [];

  for (const term of queryTerms) {
    const index = loweredWindow.indexOf(term);
    if (index === -1) {
      continue;
    }

    matchedTerms += 1;
    matchPositions.push(index);
    score += 3;
    score += Math.min(countTermOccurrences(loweredWindow, term), 2);
  }

  if (matchedTerms === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  score += matchedTerms * matchedTerms;

  if (matchedTerms >= 2) {
    const proximity = Math.max(...matchPositions) - Math.min(...matchPositions);
    score += proximity <= 80 ? 4 : proximity <= 140 ? 2 : 0;
  }

  const wordCount = windowText.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 8 && wordCount <= 40) {
    score += 2;
  } else if (wordCount < 5) {
    score -= 2;
  } else if (wordCount > 55) {
    score -= 1;
  }

  return score;
}

function extractContextualSnippet(fullText: string, query: string): string {
  const normalizedText = normalizeText(fullText);
  if (!normalizedText) return "";

  const queryTerms = extractQueryTerms(query);
  const sentenceSegments = splitIntoSentenceSegments(normalizedText);

  if (sentenceSegments.length === 0) {
    return normalizedText;
  }

  let bestSnippet = "";
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestStart = Number.POSITIVE_INFINITY;

  for (let index = 0; index < sentenceSegments.length; index += 1) {
    const current = sentenceSegments[index]!;
    const singleSentenceScore = scoreSentenceWindow(current.text, queryTerms);

    if (
      singleSentenceScore > bestScore ||
      (singleSentenceScore === bestScore && current.start < bestStart)
    ) {
      bestScore = singleSentenceScore;
      bestStart = current.start;
      bestSnippet = buildSnippet(normalizedText, current.start, current.end);
    }

    const next = sentenceSegments[index + 1];
    if (!next) {
      continue;
    }

    const combinedText = `${current.text} ${next.text}`;
    const combinedScore = scoreSentenceWindow(combinedText, queryTerms) - 1;

    if (
      combinedScore > bestScore ||
      (combinedScore === bestScore && current.start < bestStart)
    ) {
      bestScore = combinedScore;
      bestStart = current.start;
      bestSnippet = buildSnippet(normalizedText, current.start, next.end);
    }
  }

  if (bestSnippet) {
    return bestSnippet;
  }

  return sentenceSegments[0]?.text ?? normalizedText;
}

export class RagService {
  constructor(
    private embeddingService: EmbeddingService,
    private chunkRepo: ChunkRepository,
    private citationService: CitationService,
    private sourceRepo: SourceRepository,
    private logger?: FastifyBaseLogger,
    private timingEnabled = false,
  ) {}

  async query(
    text: string,
    sourceIds: ObjectId[],
    userId: string,
  ): Promise<RagResult[]> {
    const totalStartedAt = performance.now();
    if (!text.trim() || sourceIds.length === 0) return [];

    const embedStartedAt = performance.now();
    const embedding = await this.embeddingService.embed(text);
    const embedDurationMs = performance.now() - embedStartedAt;

    const vectorSearchStartedAt = performance.now();
    const rawChunks = await this.chunkRepo.vectorSearch(
      embedding,
      sourceIds,
      3,
    );
    const vectorSearchDurationMs = performance.now() - vectorSearchStartedAt;
    const chunks = rawChunks.filter(
      ({ score }) => score >= env.RAG_MIN_MATCH_SCORE,
    );

    if (chunks.length === 0) {
      this.logTimings({
        totalDurationMs: performance.now() - totalStartedAt,
        embedDurationMs,
        vectorSearchDurationMs,
        sourceLookupDurationMs: 0,
        summaryDurationMs: 0,
        resultCount: 0,
        sourceCount: sourceIds.length,
        textLength: text.length,
        summaryStatus:
          rawChunks.length === 0 ? "skipped-no-results" : "filtered-low-score",
      });
      return [];
    }

    const uniqueSourceIds = [
      ...new Set(chunks.map((c) => c.chunk.sourceId.toHexString())),
    ].map((id) => new ObjectId(id));
    const sourceLookupStartedAt = performance.now();
    const sources = await this.sourceRepo.findByIds(uniqueSourceIds, userId);
    const sourceLookupDurationMs = performance.now() - sourceLookupStartedAt;
    const sourceMap = new Map(
      sources.map((source) => [source._id.toHexString(), source.filename]),
    );

    const results = chunks.map(({ chunk, score }) => {
      const sourceId = chunk.sourceId.toHexString();
      const sourceFilename =
        sourceMap.get(sourceId) ?? chunk.metadata.filename ?? "Unknown";
      return {
        chunkId: chunk._id.toHexString(),
        sourceId,
        sourceName: sourceFilename,
        sourceFilename,
        locationLabel: chunk.locationLabel,
        excerpt: extractContextualSnippet(chunk.text, text),
        fullText: chunk.text,
        matchScore: score,
        summary: "",
      };
    });

    this.logTimings({
      totalDurationMs: performance.now() - totalStartedAt,
      embedDurationMs,
      vectorSearchDurationMs,
      sourceLookupDurationMs,
      summaryDurationMs: 0,
      resultCount: results.length,
      sourceCount: sourceIds.length,
      textLength: text.length,
      summaryStatus: "skipped-critical-path",
    });

    return results;
  }

  async summarize(
    text: string,
    results: Pick<
      RagResult,
      "chunkId" | "excerpt" | "locationLabel" | "sourceFilename"
    >[],
  ): Promise<Array<{ chunkId: string; summary: string }>> {
    if (!text.trim() || results.length === 0) return [];

    const summaryStartedAt = performance.now();

    try {
      const summaryResults = await this.citationService.summarizeBatch(
        text,
        results.map((result) => ({
          chunkId: result.chunkId,
          text: result.excerpt,
          locationLabel: result.locationLabel,
          filename: result.sourceFilename,
        })),
      );

      this.logSummaryTimings({
        totalDurationMs: performance.now() - summaryStartedAt,
        resultCount: results.length,
        textLength: text.length,
        summaryStatus: "success",
      });

      return summaryResults;
    } catch (error) {
      if (this.timingEnabled && this.logger) {
        this.logger.warn(
          {
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : String(error),
            textLength: text.length,
            resultCount: results.length,
          },
          "rag summary generation failed",
        );
      }

      this.logSummaryTimings({
        totalDurationMs: performance.now() - summaryStartedAt,
        resultCount: results.length,
        textLength: text.length,
        summaryStatus: "failed",
      });

      return [];
    }
  }

  private logTimings(timings: {
    totalDurationMs: number;
    embedDurationMs: number;
    vectorSearchDurationMs: number;
    sourceLookupDurationMs: number;
    summaryDurationMs: number;
    resultCount: number;
    sourceCount: number;
    textLength: number;
    summaryStatus:
      | "success"
      | "failed"
      | "skipped-no-results"
      | "skipped-critical-path"
      | "filtered-low-score";
  }): void {
    if (!this.timingEnabled || !this.logger) {
      return;
    }

    this.logger.info(
      {
        totalDurationMs: Math.round(timings.totalDurationMs),
        embedDurationMs: Math.round(timings.embedDurationMs),
        vectorSearchDurationMs: Math.round(timings.vectorSearchDurationMs),
        sourceLookupDurationMs: Math.round(timings.sourceLookupDurationMs),
        summaryDurationMs: Math.round(timings.summaryDurationMs),
        resultCount: timings.resultCount,
        sourceCount: timings.sourceCount,
        textLength: timings.textLength,
        minMatchScore: env.RAG_MIN_MATCH_SCORE,
        summaryStatus: timings.summaryStatus,
      },
      "rag query timings",
    );
  }

  private logSummaryTimings(timings: {
    totalDurationMs: number;
    resultCount: number;
    textLength: number;
    summaryStatus: "success" | "failed";
  }): void {
    if (!this.timingEnabled || !this.logger) {
      return;
    }

    this.logger.info(
      {
        totalDurationMs: Math.round(timings.totalDurationMs),
        resultCount: timings.resultCount,
        textLength: timings.textLength,
        summaryStatus: timings.summaryStatus,
      },
      "rag summary timings",
    );
  }
}
