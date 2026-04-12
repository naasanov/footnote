# Footnote — Execution Plan

## How This Works

Nine tickets, five human gates. Each ticket is given to a Claude Code agent as a focused task. The agent receives the TDD (`docs/TDD.md`) and the specific ticket file as context. You dispatch each ticket, validate at gates, and only proceed once you're satisfied.

---

## Timeline & Dependency Graph

```
                    ┌──────────────┐
                    │  Ticket 1    │
                    │  Scaffolding │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Ticket 2 │ │ Ticket 3 │ │ Ticket 4 │   ◄── parallelizable
        │ Data     │ │ Ingest   │ │ CRUD API │
        │ Layer    │ │ Pipeline │ │          │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │             │            │
             └─────────────┼────────────┘
                           ▼
                    ┌──────────────┐
                    │   Ticket 5   │
                    │  RAG + OCR   │
                    └──────┬───────┘
                           │
                    ═══════╧═══════
                      GATE 1: Backend
                    ═══════╤═══════
                           │
                    ┌──────────────┐
                    │   Ticket 6   │
                    │ Frontend     │
                    │ Shell        │
                    └──────┬───────┘
                           │
                    ═══════╧═══════
                      GATE 2: Shell
                    ═══════╤═══════
                           │
                    ┌──────────────┐
                    │   Ticket 7   │
                    │ Canvas       │
                    └──────┬───────┘
                           │
                    ═══════╧═══════
                      GATE 3: Canvas
                    ═══════╤═══════
                           │
                    ┌──────────────┐
                    │   Ticket 8   │
                    │ RAG Frontend │
                    └──────┬───────┘
                           │
                    ═══════╧═══════
                      GATE 4: Core Feature
                    ═══════╤═══════
                           │
                    ┌──────────────┐
                    │   Ticket 9   │
                    │ Remaining +  │
                    │ Polish       │
                    └──────┬───────┘
                           │
                    ═══════╧═══════
                      GATE 5: Complete
                    ═══════════════
```

---

## Agent Configuration Per Ticket

| Ticket | Model | Extended Thinking | Why |
|---|---|---|---|
| 1 — Scaffolding | Sonnet | Off | Mechanical setup, well-specified |
| 2 — Data Layer | Sonnet | Off | Zod schemas and repos are mechanical |
| 3 — Ingest Pipeline | Sonnet | On | Chunking + embedding logic needs some judgment |
| 4 — CRUD API | Sonnet | Off | Standard route handlers |
| 5 — RAG + OCR | Opus | On | Most complex backend logic — vector search, citation generation, multiple services orchestrated |
| 6 — Frontend Shell | Sonnet | Off | Scaffolding + shadcn setup, well-specified |
| 7 — Canvas | Opus | On | tldraw integration is complex, custom shapes, responsive panels — needs judgment |
| 8 — RAG Frontend | Opus | On | Hardest ticket — debounce, snapshot, drag-and-drop across DOM/canvas boundary |
| 9 — Polish + Tests | Sonnet | On | E2E tests need careful thought, but implementation is mechanical |

---

## Parallelization

**Tickets 2, 3, and 4 can run in parallel** after Ticket 1 completes. They're independent:
- Ticket 2 builds the data layer (schemas, repositories)
- Ticket 3 builds the ingest pipeline (parsers, embedding adapter)
- Ticket 4 builds CRUD routes for notebooks/notes/sources

All three depend on Ticket 1's scaffolding (DB connection, auth plugin, folder structure) but not on each other.

**How to dispatch them in parallel:** Open three separate Claude Code sessions. Give each one the TDD + its ticket file. Let them all run against the same repo on separate branches:
```bash
# Before dispatching
git checkout -b ticket-2-data-layer
git checkout -b ticket-3-ingest
git checkout -b ticket-4-crud

# After all three complete, merge sequentially
git checkout main
git merge ticket-2-data-layer
git merge ticket-3-ingest     # resolve any conflicts
git merge ticket-4-crud       # resolve any conflicts
```

Everything else runs sequentially — each ticket builds on the previous.

---

## Your Role At Each Gate

### Gate 1 — Backend Complete (after Ticket 5)

**What to validate:**
- [ ] Run `pnpm --filter api dev` — server starts without errors
- [ ] Run smoke tests: `pnpm --filter api test`
- [ ] Test with curl or Postman:
  - Create a notebook, create a note
  - Upload a PDF source → watch status go from `processing` → `ready`
  - Hit `POST /rag/query` with test text and active source IDs → get chunks back
  - Hit `POST /ocr` with a base64 image → get text back
- [ ] Run integration tests: `pnpm --filter api test:integration` (hits real external services)
- [ ] Check: does the folder structure match the TDD §8.2? Are layer boundaries respected?

**Common problems to look for:**
- Env vars not validated at startup (server starts but crashes on first request)
- Auth middleware not applied to all routes
- Vector search index not created in Atlas (agent can't do this — you have to)

### Gate 2 — Frontend Shell (after Ticket 6)

**What to validate:**
- [ ] Run `pnpm dev` (compound) — both servers start
- [ ] Open browser → redirected to Clerk sign-in
- [ ] Sign in → see three-panel layout
- [ ] Left sidebar shows notebook/note tree, can create notebook and note
- [ ] Design tokens correct: warm off-white background, Fraunces headings, green accent
- [ ] Panels collapse on toggle, responsive at tablet width

**Common problems to look for:**
- CORS errors in browser console (backend not allowing frontend origin)
- Clerk redirect loop
- API client using wrong base URL

### Gate 3 — Canvas Working (after Ticket 7)

**What to validate:**
- [ ] Click into a note → tldraw canvas loads with dot grid background
- [ ] Pen tool: draw freehand strokes — smooth, no lag
- [ ] Text tool: type on canvas
- [ ] Highlighter: semi-transparent strokes
- [ ] Eraser: erases strokes
- [ ] Color picker: shows curated palette only (no default tldraw colors)
- [ ] Navigate away and back → canvas state persisted (strokes still there)
- [ ] Collapse panels → canvas expands to fill space
- [ ] Test on a tablet/iPad if available — stylus input works

**Common problems to look for:**
- tldraw toolbar showing default tools (shapes, frames, etc.)
- Canvas state not saving (check network tab for PATCH requests)
- Performance issues with large number of strokes

### Gate 4 — Core Feature Working (after Ticket 8)

**What to validate:**
This is the most important gate. Test the full RAG loop end-to-end:
- [ ] Upload a PDF source to a note (should process and become ready)
- [ ] Write something related to the PDF content on the canvas
- [ ] Wait 3+ seconds → RAG sidebar updates with related passages
- [ ] Passage cards show: source name, location label, excerpt, match score
- [ ] Drag a passage card from the sidebar → drop onto the canvas
- [ ] Citation chip appears at drop location — displays collapsed label
- [ ] Click the chip → expands to show full excerpt, source, location
- [ ] Type text on the canvas → sidebar also updates (typed text triggers RAG too)
- [ ] Toggle a source off → sidebar results no longer include it
- [ ] Toggle `NEXT_PUBLIC_OCR_DEBUG=true` → verify OCR output is reasonable

**Common problems to look for:**
- Drag-and-drop not registering (cross-boundary DOM→tldraw drops are tricky)
- OCR returning garbage for handwriting (check with debug overlay)
- Sidebar updating too aggressively (debounce not working)
- Empty sidebar even after writing (check: are embeddings being generated? Is vector search returning results?)

### Gate 5 — Feature Complete (after Ticket 9)

**What to validate:**
- [ ] OCR search: type a query → results found → canvas zooms to matched region
- [ ] Export: PNG, SVG, PDF all produce correct output with note title as filename
- [ ] Delete a source → citation chips become orphaned (greyed out, "Source deleted")
- [ ] Rename a source → reflected everywhere
- [ ] Create a new note in a notebook → inherits notebook-level sources automatically
- [ ] Upload a source to a notebook → all existing notes get it toggled on
- [ ] RAG sidebar empty state shows "Start writing to surface related passages"
- [ ] Error states work: disconnect backend → toast appears, reconnect → recovers
- [ ] Playwright E2E tests pass: `pnpm test:e2e`

---

## Testing Strategy

### Smoke Tests (written by the agent, per ticket)

Each backend ticket includes smoke tests using `vitest` + `supertest`. These tests:
- Spin up a real Fastify instance with a **test MongoDB database** (not mocked)
- Assert routes exist, return correct status codes, handle auth
- Assert service logic with real DB operations
- Run on every `pnpm --filter api test`

The agent writes these as part of the ticket. No separate testing ticket.

### Integration Tests (real external services)

One file at `apps/api/tests/integration/external-services.test.ts`. Tests:
- OpenAI embedding: embed a string, assert 1536-dim vector back
- Claude Vision OCR: send a simple image, assert text back
- Claude citation: send a chunk, assert summary back
- Atlas Vector Search: embed → store → query → retrieve

Run manually with `pnpm --filter api test:integration`. Requires real API keys in `.env`. **Never runs in CI** — costs money and hits rate limits.

Written during Ticket 5 (RAG + OCR pipeline).

### Playwright E2E Tests

Three critical path tests in `apps/web/tests/e2e/`:
1. `upload-source.spec.ts` — upload a PDF, verify it appears in source list as "ready"
2. `rag-loop.spec.ts` — write on canvas, verify sidebar updates with results
3. `cite.spec.ts` — drag a passage card onto canvas, verify citation chip renders

Written during Ticket 9. Runs with `pnpm test:e2e`. Hits real backend + real external services.

---

## How To Dispatch An Agent

For each ticket, start a new Claude Code session:

```
Read docs/TDD.md and docs/tickets/TICKET_N.md.

Implement everything specified in the ticket. Follow the TDD strictly —
do not deviate from the architecture, folder structure, or layer rules
defined in §8. Write smoke tests for all backend code as specified
in the ticket.

When done, run the smoke tests and fix any failures before finishing.
```

For parallel tickets (2, 3, 4), create branches first and tell each agent which branch to work on.

For Opus tickets (5, 7, 8), enable extended thinking.
