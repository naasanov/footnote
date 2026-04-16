export interface CitationChunkInput {
  chunkId: string;
  text: string;
  locationLabel: string;
  filename: string;
}

export interface CitationSummaryResult {
  chunkId: string;
  summary: string;
}

export interface CitationService {
  summarize(
    query: string,
    chunk: Omit<CitationChunkInput, "chunkId">,
  ): Promise<string>;
  summarizeBatch(
    query: string,
    chunks: CitationChunkInput[],
  ): Promise<CitationSummaryResult[]>;
}
