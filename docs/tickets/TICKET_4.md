# Ticket 4 — CRUD API Routes

**Model:** Sonnet | **Thinking:** Off | **Depends on:** Ticket 1
**Parallelizable with:** Tickets 2 and 3

## Objective

Build all CRUD route handlers for notebooks, notes, and sources. After this ticket, the API supports full CRUD operations and source file upload/download. These routes delegate to repositories (which may be stubs if Ticket 2 isn't merged yet — use the interfaces from `domain/schemas.ts`).

## Acceptance Criteria

- [ ] All routes in `apps/api/src/routes/` per TDD §6.1:
  - `notebooks.ts`:
    - `GET /notebooks` — list all for authenticated user
    - `POST /notebooks` — create with `{ title }`
    - `PATCH /notebooks/:id` — update title
    - `DELETE /notebooks/:id` — delete notebook + cascade delete all notes, sources, chunks within
  - `notes.ts`:
    - `GET /notebooks/:notebookId/notes` — list notes in notebook
    - `POST /notebooks/:notebookId/notes` — create note, initialize `activeSourceIds` from notebook-scoped sources
    - `GET /notes/:id` — get single note (includes canvasState)
    - `PATCH /notes/:id` — update `canvasState`, `activeSourceIds`, `title`
    - `DELETE /notes/:id` — delete note + cascade delete note-scoped sources and their chunks
    - `GET /notes/:id/ocr-search` — text search against ocr_results, return `[{ text, bbox }]`
  - `sources.ts`:
    - `POST /sources` — multipart file upload, accepts `scope` (type + id) in form data, stores file to GridFS, creates Source doc with `status: 'processing'`, triggers ingest pipeline async (fire-and-forget), returns 202
    - `GET /sources` — query by `scope` param (e.g. `?scope=notebook:abc123`)
    - `GET /sources/:id/file` — stream file from GridFS with correct `Content-Type`
    - `PATCH /sources/:id` — rename source (update `filename`)
    - `DELETE /sources/:id` — delete source + all its DocumentChunks + GridFS file; remove sourceId from `activeSourceIds` on all affected notes
- [ ] All route input validated with Zod (request body, params, query)
- [ ] All routes scoped to authenticated user — a user can never access another user's data
- [ ] Cascade deletes are handled in the route handler or a service — never leave orphaned data
- [ ] `activeSourceIds` auto-update:
  - When a notebook-scoped source finishes ingestion (`ready`): add its `_id` to `activeSourceIds` on all notes in that notebook
  - When a note-scoped source finishes ingestion: add its `_id` to that note only
  - This logic lives in `source.service.ts` and is called after ingest completes

## Smoke Tests

- Notebook CRUD: create → list → update → delete → list returns empty
- Note CRUD: create note in notebook → get → update title → delete
- Note inherits sources: create notebook → upload source → wait for ready → create note → verify `activeSourceIds` includes the source
- Source upload: POST multipart with a test PDF → verify 202 returned, source doc created with `status: 'processing'`
- Source delete cascade: create source + some chunks → delete source → verify chunks deleted, source removed from note's `activeSourceIds`
- Auth scoping: create notebook as user A → try to GET as user B → 404 (not 403, to avoid leaking existence)
- OCR search: insert test ocr_results → search → verify results returned with bbox

## Out of Scope

- No ingest pipeline logic (Ticket 3 — this ticket just fires it async)
- No RAG query or OCR routes (Ticket 5)
