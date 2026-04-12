# Footnote — Claude Code Instructions

## Read First

Before doing anything, read:
1. `docs/TDD.md` — full architecture, data models, flows, and design decisions
2. The ticket file you've been given (e.g. `docs/tickets/TICKET_N.md`)

The TDD is the source of truth. If something isn't covered by your ticket, check the TDD before deciding.

---

## Stack

- **Language:** TypeScript everywhere (strict mode)
- **Monorepo:** pnpm workspaces — use `pnpm`, never `npm` or `yarn`
- **Backend:** Fastify (`apps/api/`)
- **Frontend:** Next.js App Router (`apps/web/`)
- **Database:** MongoDB Atlas — raw `mongodb` driver + Zod. **No Mongoose.**
- **Auth:** Clerk

---

## Layer Rules (Non-Negotiable)

### Backend
- **Routes** — HTTP only. Parse input, call a service, return response. No DB access, no adapter calls.
- **Services** — Business logic only. No `req`/`res`. No MongoDB queries.
- **Repositories** — The only place MongoDB queries are written. Call `.parse()` on every document read from the DB.
- **Adapters** — External service calls (OCR, embeddings, citation, parsers). Always behind an interface. Services call the interface, never the concrete class.
- **Config** — `src/config/env.ts` is the only file that reads `process.env`.

### Frontend
- **Pages** — Thin. Compose feature components, pass route params. No data fetching logic.
- **Feature components** — Call hooks. Render UI components. No `fetch` calls.
- **Hooks** — Only place that calls the API client. Own all async state.
- **`lib/api/`** — Only place that constructs URLs or calls `fetch`.
- **UI components** — Purely presentational. No hooks, no domain knowledge.

---

## Key Decisions

| Decision | Rule |
|---|---|
| No Mongoose | Use `mongodb` driver directly. Zod schemas in `domain/schemas.ts` are the type source. |
| Zod at boundaries | Call `Schema.parse()` on every document read from MongoDB. |
| OCR is swappable | Always program to `OcrService` interface, never `ClaudeOcrService` directly. |
| Source parsers are swappable | Always use `ParserRegistry.getParser()`, never import a parser directly. |
| Error handling | Services throw typed errors from `domain/errors.ts`. Only `setErrorHandler` assigns HTTP status codes. |
| File storage | MongoDB GridFS only. No S3, no local filesystem. |
| No inline RAG suggestions | RAG results go to the right sidebar only, never inline in the canvas. |
| Citations in canvas state | Citations are tldraw shapes stored in `canvasState`. No separate DB collection. |

---

## Testing Requirements

- Every backend ticket must include smoke tests.
- Smoke tests use a real Fastify instance and real test MongoDB. **Do not mock the database.**
- External services (OpenAI, Anthropic) may be mocked in smoke tests, but must have real integration tests in `tests/integration/`.
- Frontend canvas interaction is tested manually (see gate checklists in `docs/EXECUTION_PLAN.md`).

---

## What Not To Do

- Do not install Mongoose, Prisma, or any ORM/ODM.
- Do not use `npm` or `yarn` — pnpm only.
- Do not read `process.env` outside of `src/config/env.ts`.
- Do not write MongoDB queries outside of repository files.
- Do not call `fetch` directly in a component or page.
- Do not add features, abstractions, or error handling beyond what the ticket specifies.
- Do not create files outside the folder structure defined in TDD §8.
