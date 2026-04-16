# Footnote E2E Tests

Playwright end-to-end tests for the Footnote web app.

## Prerequisites

Both servers must be running before executing the tests:

```bash
# Terminal 1 — API server
pnpm --filter api dev

# Terminal 2 — Web server
pnpm --filter web dev
```

Real API keys must be configured in `apps/api/.env` and `apps/web/.env.local`.

## Configuration

Copy `.env.example` in this directory (or set variables in your shell):

| Variable | Required | Description |
|---|---|---|
| `E2E_CLERK_EMAIL` | Yes | Clerk test account email |
| `E2E_CLERK_PASSWORD` | Yes | Clerk test account password |
| `E2E_NOTE_URL` | For rag-loop, cite | Full URL to a note that already has a ready source, e.g. `http://localhost:3002/notebooks/abc/notes/xyz` |
| `BASE_URL` | No | Override the web server URL (default: `http://localhost:3002`) |

## Running the tests

```bash
# From apps/web/
pnpm test:e2e

# Run a single spec
pnpm test:e2e tests/e2e/upload-source.spec.ts

# Run in headed mode (shows browser window)
pnpm test:e2e --headed
```

## Notes

- E2E tests hit the **real backend** and **real external services** (OpenAI, Anthropic, Clerk).
- `rag-loop.spec.ts` and `cite.spec.ts` require `E2E_NOTE_URL` to point to a pre-existing note
  with at least one `ready` source. Set this up manually or via `upload-source.spec.ts` first.
- OCR → RAG pipeline takes several seconds; the tests use generous timeouts (up to 30s) to allow for this.
- Accuracy is bounded by OCR quality — the RAG test asserts at least one passage card appears,
  not that the passage content is semantically correct.
