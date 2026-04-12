# Ticket 5 — RAG Query + OCR Pipeline

**Model:** Opus | **Thinking:** On | **Depends on:** Tickets 2, 3, 4 (all merged)

## Objective

Build the RAG query pipeline and OCR service. After this ticket, the full backend is complete: a canvas snapshot can be OCR'd, the text can be embedded and used to search against uploaded sources, and matching chunks are returned with AI-generated relevance summaries.

## Acceptance Criteria

- [ ] OCR adapter in `apps/api/src/adapters/ocr/`:
  - `OcrService.ts` — interface: `transcribe(imageBase64: string, mimeType: string): Promise<string>`
  - `ClaudeOcrService.ts` — sends image to Claude Vision API with a prompt optimized for handwriting transcription. Returns raw text string. Returns empty string (not error) if no text is detected.
- [ ] Citation adapter in `apps/api/src/adapters/citation/`:
  - `CitationService.ts` — interface: `summarize(query: string, chunk: { text: string, locationLabel: string, filename: string }): Promise<string>`
  - `ClaudeCitationService.ts` — sends query + chunk to Claude, gets back a one-sentence relevance summary explaining *why* this chunk matches the user's writing
- [ ] RAG service in `apps/api/src/services/rag.service.ts`:
  - `query(text: string, sourceIds: ObjectId[], userId: string): Promise<RagResult[]>`
  - Embeds query text with `embeddingService.embed()`
  - Calls `chunkRepository.vectorSearch()` with pre-filter `{ sourceId: { $in: sourceIds } }`
  - Retrieves top-5 chunks with scores
  - For each chunk: calls `citationService.summarize()` to generate relevance summary
  - Returns `{ chunkId, sourceId, sourceName, locationLabel, excerpt, fullText, matchScore, summary }[]`
  - Short-circuits and returns `[]` if `sourceIds` is empty or `text` is empty
- [ ] OCR route in `apps/api/src/routes/ocr.ts`:
  - `POST /ocr` — accepts `{ imageBase64, mimeType }`, returns `{ text }`
  - Validates input (base64 string, valid MIME type)
  - Saves OCR result to `ocr_results` collection with `noteId`, `snapshotKey`, `text`, `bbox` (all passed from frontend)
- [ ] RAG route in `apps/api/src/routes/rag.ts`:
  - `POST /rag/query` — accepts `{ text, sourceIds }`, returns `{ chunks: RagResult[] }`
  - Validates input, returns empty array if text or sourceIds empty
- [ ] All adapters registered in `plugins/container.ts` via Fastify decorators
- [ ] Integration test file at `apps/api/tests/integration/external-services.test.ts`:
  - Test: embed a string with OpenAI → assert 1536-dim vector returned
  - Test: OCR a simple test image with Claude Vision → assert non-empty text returned
  - Test: generate a citation summary with Claude → assert non-empty summary returned
  - Test: full pipeline — embed + store chunk → vector search → verify chunk retrieved
  - Test file has clear instructions at top: "Requires real API keys in .env. Run manually with `pnpm --filter api test:integration`"

## Smoke Tests

- `POST /ocr` with valid image data → returns text (can mock the OCR adapter for speed)
- `POST /ocr` with missing/invalid data → returns 400
- `POST /rag/query` with empty sourceIds → returns `{ chunks: [] }`
- `POST /rag/query` with empty text → returns `{ chunks: [] }`
- RAG service: with mocked embedding + mocked vector search returning 3 chunks → verify 3 results with summaries
- All adapters are injectable (registered on fastify instance, not imported directly)

## Out of Scope

- No frontend (Ticket 6+)
- No debounce logic (that's frontend — Ticket 8)
- No text buffer management (frontend — Ticket 8)
