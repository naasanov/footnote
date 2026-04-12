# Ticket 3 — Ingest Pipeline (Parsers, Embeddings, Orchestration)

**Model:** Sonnet | **Thinking:** On | **Depends on:** Ticket 1
**Parallelizable with:** Tickets 2 and 4

## Objective

Build the document ingestion pipeline: parser registry, concrete parsers, embedding adapter, and the ingest service that orchestrates parse → chunk → embed → store. After this ticket, a file buffer can be fed through the pipeline and chunks with embeddings appear in MongoDB.

## Acceptance Criteria

- [ ] Parser adapter pattern in `apps/api/src/adapters/parsers/`:
  - `SourceParser.ts` — interface with `supportedMimeTypes` and `parse(buffer, filename): Promise<ParsedChunk[]>`
  - `ParsedChunk` type: `{ text: string, locationLabel: string, chunkIndex: number }`
  - `ParserRegistry.ts` — register parsers, look up by MIME type, throw clear error for unsupported types
  - `PdfParser.ts` — uses `pdf-parse`, chunks by ~500 tokens with 100-token overlap, `locationLabel` = `"Page N"`
  - `DocxParser.ts` — uses `mammoth`, same chunking strategy, `locationLabel` = `"Section N"` or `"Paragraph N"`
  - `MarkdownParser.ts` — splits by headings/paragraphs, `locationLabel` = heading text or `"Paragraph N"`
  - `ImageParser.ts` — sends image to Claude Vision API for text extraction, returns as single chunk (delegates to OCR adapter)
- [ ] Embedding adapter in `apps/api/src/adapters/embeddings/`:
  - `EmbeddingService.ts` — interface: `embed(text: string): Promise<number[]>` and `embedBatch(texts: string[]): Promise<number[][]>`
  - `OpenAiEmbeddingService.ts` — uses OpenAI `text-embedding-3-small`, handles batching (max 2048 inputs per call)
- [ ] Ingest service in `apps/api/src/services/ingest.service.ts`:
  - `run(sourceId: ObjectId): Promise<void>`
  - Reads file from GridFS via repository
  - Gets MIME type from Source document
  - Calls `parserRegistry.getParser(mimeType).parse(buffer, filename)`
  - Embeds all chunks via `embeddingService.embedBatch()`
  - Stores DocumentChunk documents via `chunkRepository.bulkInsert()`
  - Updates source status to `ready` on success
  - On failure: deletes any partial chunks, sets source status to `error`, logs error
- [ ] Chunking logic:
  - Target ~500 tokens per chunk (estimate: 1 token ≈ 4 chars)
  - 100-token overlap between adjacent chunks from the same page/section
  - Prefer splitting at paragraph boundaries; fall back to sentence boundaries; last resort: hard split at token limit

## Smoke Tests

- PDF parser: parse a small test PDF, assert chunks have text and `locationLabel` = "Page 1"
- Markdown parser: parse a markdown string with headings, assert chunks split at headings
- Parser registry: lookup by MIME type succeeds, lookup for unsupported type throws
- Ingest service (with real test MongoDB, mocked embedding service that returns fixed vectors): run on a test source → verify chunks stored with embeddings, source status = 'ready'
- Ingest service failure: simulate embedding error → verify source status = 'error', no partial chunks left

## Out of Scope

- No route handlers for upload (Ticket 4)
- No vector search queries (Ticket 5)
- DOCX and Image parsers can be stub implementations that throw "not yet implemented" if needed to save time — PDF and Markdown are the priority
