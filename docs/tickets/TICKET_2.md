# Ticket 2 — Data Layer (Schemas, Repositories, Indexes)

**Model:** Sonnet | **Thinking:** Off | **Depends on:** Ticket 1
**Parallelizable with:** Tickets 3 and 4

## Objective

Build all MongoDB repositories and GridFS utilities. After this ticket, every collection can be read/written through typed repository classes, all MongoDB indexes exist, and GridFS file storage works.

## Acceptance Criteria

- [ ] All repositories created in `apps/api/src/repositories/`:
  - `notebook.repository.ts` — CRUD by userId
  - `note.repository.ts` — CRUD by notebookId + userId, includes `updateCanvasState()` and `updateActiveSourceIds()`
  - `source.repository.ts` — CRUD by scope + userId, includes status updates
  - `chunk.repository.ts` — bulk insert, delete by sourceId, vector search query (using `$vectorSearch` aggregation pipeline with `sourceId` pre-filter)
  - `ocr-result.repository.ts` — upsert by `(noteId, snapshotKey)`, text search by noteId + query string
- [ ] Every repository method calls `ZodSchema.parse()` on data read from MongoDB
- [ ] Repositories accept `Db` (from `mongodb` driver) via constructor injection — no global imports
- [ ] GridFS utility: `apps/api/src/repositories/gridfs.repository.ts`
  - `upload(buffer: Buffer, filename: string, mimeType: string): Promise<ObjectId>`
  - `download(fileId: ObjectId): Promise<Readable>` (returns a readable stream)
  - `delete(fileId: ObjectId): Promise<void>`
- [ ] MongoDB indexes created via a setup script or repository `ensureIndexes()` methods:
  - `notebooks`: `{ userId: 1 }`
  - `notes`: `{ notebookId: 1, userId: 1 }`
  - `sources`: `{ "scope.id": 1, "scope.type": 1 }`
  - `document_chunks`: `{ sourceId: 1 }`
  - `ocr_results`: `{ noteId: 1, snapshotKey: 1 }` (unique)
  - `ocr_results`: text index on `text`
- [ ] Note: the Atlas Vector Search index on `document_chunks.embedding` must be created manually in Atlas UI — add a comment in `chunk.repository.ts` explaining this

## Smoke Tests

- Notebook CRUD: create, read, update, delete — all return correctly typed documents
- Note CRUD: create with `activeSourceIds: []`, update canvas state, verify persistence
- Source CRUD: create with `status: 'processing'`, update to `ready`, read back
- Chunk: bulk insert 5 chunks, delete by sourceId, verify all removed
- GridFS: upload a buffer, download it back, compare bytes, delete
- OCR result: upsert same snapshotKey twice — verify only one document exists

## Out of Scope

- No route handlers (Ticket 4)
- No embedding or parsing logic (Ticket 3)
- No vector search index creation (manual Atlas step)
