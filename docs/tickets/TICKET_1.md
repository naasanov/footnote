# Ticket 1 — Project Scaffolding & Auth

**Model:** Sonnet | **Thinking:** Off | **Depends on:** Nothing

## Objective

Set up the pnpm monorepo, both applications, TypeScript config, database connection, Clerk auth on both sides, and env validation. After this ticket, both servers start, auth works end-to-end, and the folder structure from TDD §8 exists.

## Acceptance Criteria

- [ ] `pnpm-workspace.yaml` defines `apps/web` and `apps/api`
- [ ] `apps/api/` — Fastify server starts on `PORT` from env
  - `src/config/env.ts` validates all backend env vars with Zod at startup; server refuses to start if any are missing
  - `src/plugins/auth.ts` — Clerk JWT verification plugin, attaches `userId` to every request
  - `src/plugins/db.ts` — MongoDB connection plugin, decorates fastify with `db` client
  - `src/plugins/container.ts` — DI plugin, instantiates and registers all services/adapters on fastify (empty stubs for now)
  - `src/domain/schemas.ts` — all Zod schemas from TDD §3, exported with `z.infer<>` types
  - `src/domain/errors.ts` — custom exception hierarchy (`AppError`, `NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`)
  - Fastify `setErrorHandler` plugin maps `AppError` subclasses to HTTP responses, unknown errors to 500
  - `@fastify/cors` configured to allow frontend origin
  - `GET /health` returns `200 { status: 'ok' }`
  - Package scripts: `"dev": "tsx watch src/index.ts"`, `"dev:debug": "tsx watch --inspect src/index.ts"`
- [ ] `apps/web/` — Next.js App Router starts on port 3000
  - `src/config/env.ts` validates all frontend env vars, throws at module load if missing
  - Clerk `<ClerkProvider>` wraps the app
  - `middleware.ts` protects all routes except `/sign-in` and `/sign-up`
  - Sign-in and sign-up pages exist and work with Clerk
  - After sign-in redirects to `/`
  - `src/lib/api/` directory exists with a base client that reads `NEXT_PUBLIC_API_URL` and attaches Clerk JWT to every request
  - React Query (`@tanstack/react-query`) provider set up at root layout
  - Sonner `<Toaster>` rendered at root layout
- [ ] `.vscode/launch.json` exists (already created, verify it still works)
- [ ] `.gitignore` includes `node_modules`, `.env*`, `docs/EXTERNAL_CONFIG.md`
- [ ] TypeScript strict mode enabled for both apps, shared `tsconfig.base.json` at root
- [ ] `pnpm dev` (from root) starts both servers concurrently

## Smoke Tests

- Server starts and `GET /health` returns 200
- Request without auth token to any protected route returns 401
- Request with invalid auth token returns 401

## Out of Scope

- No routes beyond `/health`
- No frontend pages beyond auth pages and a blank home page
- No MongoDB collections or schemas beyond connection verification
