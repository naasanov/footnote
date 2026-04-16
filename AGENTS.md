# Footnote — Codex Agent Instructions

## Read First

Before making changes, read:

1. `docs/TDD.md` — source of truth for architecture, flows, and product decisions
2. The relevant ticket file in `docs/tickets/` if one exists for the task

If a task is ambiguous, follow the TDD before inventing new structure or behavior.

## Stack

- TypeScript everywhere, strict mode
- Monorepo: `pnpm` workspaces only
- Backend: Fastify in `apps/api`
- Frontend: Next.js App Router in `apps/web`
- Database: MongoDB Atlas with the raw `mongodb` driver and Zod
- Auth: Clerk
- Canvas: `tldraw`

## Core Rules

### Backend layering

- Routes are HTTP-only: validate input, call a service, return a response
- Services own business logic and orchestration
- Repositories are the only place MongoDB queries are written
- Adapters wrap external systems like OCR, embeddings, citations, and parsing
- `apps/api/src/config/env.ts` is the only backend file that should read `process.env`

### Frontend layering

- App Router pages in `apps/web/src/app` stay thin
- Feature components render UI and call hooks
- Hooks own async state and call the API layer
- `apps/web/src/lib/api/` is the only place that should build API URLs or call `fetch`
- Presentational UI components in `components/ui` should stay reusable and domain-light

## Repository-Specific Conventions

- Use `pnpm`, never `npm` or `yarn`
- Do not add Mongoose, Prisma, or another ORM/ODM
- Do not write MongoDB queries outside repository files
- Parse DB documents with Zod on reads
- Services should depend on interfaces or registries, not concrete adapters
- For source parsing, always go through `ParserRegistry.getParser(...)`
- For OCR and citation work, program to the service interfaces, not the Claude implementations directly
- In `apps/api`, this is an ESM TypeScript project: local imports use `.js` extensions
- Preserve the existing style of the file you touch; formatting is not fully uniform across the repo
- Do not edit generated output or dependencies: `dist/`, `.next/`, `node_modules/`

## Current Project Shape

- Backend source lives under `apps/api/src/{routes,services,repositories,adapters,plugins,domain,config}`
- Backend tests live in `apps/api/tests/smoke` and `apps/api/tests/integration`
- Frontend source lives under `apps/web/src/{app,components,hooks,lib,config,types}`
- The frontend currently uses React Query hooks plus API helpers in `src/lib/api`

## Testing Expectations

- Backend changes should usually include or update smoke tests
- Smoke tests should use the real Fastify app and real test MongoDB wiring
- External services may be mocked in smoke tests
- Real external-service coverage belongs in `apps/api/tests/integration`
- If behavior changes and you do not add a test, explain why

## Useful Commands

- Root dev: `pnpm dev`
- API dev: `pnpm --filter api dev`
- API tests: `pnpm --filter api test`
- API integration tests: `pnpm --filter api test:integration`
- Web dev: `pnpm --filter web dev`
- Web lint: `pnpm --filter web lint`

## Runtime Notes

- The API defaults to port `3001`
- The web app dev server runs on port `3002`
- Backend env validation lives in `apps/api/src/config/env.ts`
- Frontend env validation lives in `apps/web/src/config/env.ts`

## Product Constraints

- GridFS is the file store; do not introduce local file persistence or S3 for app data
- RAG suggestions belong in the sidebar, not inline in the canvas
- Citations are stored inside `note.canvasState` as tldraw shapes, not in a separate collection
- Keep the existing note-taking flow handwriting-first and low-interruption

## What To Avoid

- Do not add abstractions or features that are not required for the task
- Do not move business logic into routes or React pages
- Do not call `fetch` directly from frontend pages or feature components
- Do not read backend env vars outside `apps/api/src/config/env.ts`
- Do not bypass registries or adapter interfaces for convenience
