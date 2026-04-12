# Footnote — Technical Design Document

## 1. Overview

**Footnote** is a handwriting-first note-taking app designed for the lecture context. Users upload course materials (PDFs, readings) before class, then take notes on a freehand canvas during the lecture. As they write, the app silently runs RAG against their uploaded sources and surfaces relevant passages in a sidebar. Users can drag any passage onto the canvas as a floating citation annotation.

### Core Differentiators
- RAG as a real-time writing aid, not a post-hoc Q&A interface
- Handwriting-first: the canvas is the primary input
- Citations are first-class canvas objects, not chatbot responses
- Sidebar updates silently — zero interruption to the writing flow

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Language | TypeScript | Used across both frontend and backend |
| Monorepo | pnpm workspaces | `pnpm-workspace.yaml` defines `apps/web` and `apps/api`; no extra tooling |
| Frontend | Next.js (App Router) | React server + client components |
| Backend | Fastify | Lightweight, fast, plugin-based |
| Database | MongoDB Atlas | NoSQL for notes/strokes/metadata |
| Vector Search | MongoDB Atlas Vector Search | Collocated with doc DB, no separate vector store |
| Auth | Clerk | Drop-in React components + JWT middleware |
| Canvas | tldraw | Freehand drawing + text on same canvas, serializable JSON state |
| Embeddings | OpenAI `text-embedding-3-small` | Consistent across ingest and query |
| OCR | Claude Vision API (swappable — see §6.4) | Snapshot-based, drives RAG only |
| Citation Generation | Claude API | Relevance summary per retrieved chunk |
| UI Components | shadcn/ui + Tailwind CSS | Fully overridden via CSS custom properties |
| Animation | Framer Motion | Panel collapse spring animations, citation chip drag scale |
| Toasts | Sonner | Transient error/success notifications |

---

## 3. Data Models

### 3.1 User
Managed entirely by Clerk. A `userId` (Clerk ID string) is the foreign key used across all collections. No separate users collection needed.

### 3.2 Notebook
```
{
  _id: ObjectId,
  userId: string,          // Clerk user ID
  title: string,
  createdAt: Date,
  updatedAt: Date
}
```

### 3.3 Note
```
{
  _id: ObjectId,
  notebookId: ObjectId,
  userId: string,
  title: string,
  canvasState: object,     // tldraw store snapshot (shapes, pages, camera)
  activeSourceIds: [ObjectId],  // persistent toggle state — sources included in RAG
  createdAt: Date,
  updatedAt: Date
}
```

**`activeSourceIds` initialization rules:**
- When a note is created, it inherits all currently `ready` sources scoped to its parent notebook — they are pre-toggled on.
- When a new source is uploaded to a notebook (scope: notebook), it is automatically added to `activeSourceIds` on every existing note in that notebook.
- When a new source is uploaded to a specific note (scope: note), it is added to `activeSourceIds` on that note only.
- Users can toggle any source off/on at any time; that state is persisted immediately via `PATCH /notes/:id`.

### 3.4 Source
```
{
  _id: ObjectId,
  userId: string,
  scope: {
    type: 'note' | 'notebook',
    id: ObjectId           // note._id or notebook._id
  },
  filename: string,
  gridfsFileId: ObjectId,  // reference to file stored in MongoDB GridFS
  status: 'processing' | 'ready' | 'error',
  createdAt: Date
}
```

Sources scoped to a `notebook` are available to all notes within that notebook.
Sources scoped to a `note` are only available to that note.
`activeSourceIds` on the note document controls which sources are actually queried — this is the toggle state.

### 3.5 DocumentChunk
```
{
  _id: ObjectId,
  sourceId: ObjectId,
  userId: string,          // for ownership scoping in vector queries
  text: string,            // raw chunk text
  locationLabel: string,   // e.g. "Page 12", "Slide 7", "Paragraph 14"
  chunkIndex: number,
  embedding: [number],     // 1536-dim vector (text-embedding-3-small)
  metadata: {
    filename: string,
    locationLabel: string,
    sourceId: string
  }
}
```

**MongoDB indexes:**
| Collection | Index | Type |
|---|---|---|
| `notebooks` | `{ userId: 1 }` | Standard |
| `notes` | `{ notebookId: 1, userId: 1 }` | Compound |
| `sources` | `{ "scope.id": 1, "scope.type": 1 }` | Compound |
| `document_chunks` | `{ sourceId: 1 }` | Standard |
| `document_chunks` | `{ embedding: "vectorSearch" }` with `sourceId` pre-filter | Atlas Vector Search |
| `ocr_results` | `{ noteId: 1, snapshotKey: 1 }` (unique) | Compound unique (upsert key) |
| `ocr_results` | `{ text: "text" }` | Text search |

### 3.6 Citation (Canvas Object)
Citations are **not** stored as a separate collection. They live inside `note.canvasState` as custom tldraw shapes. Each CitationChip shape contains:
```
{
  type: 'citation-chip',
  x: number, y: number,    // canvas coordinates
  props: {
    chunkId: string,
    sourceId: string,
    sourceName: string,
    locationLabel: string, // e.g. "Page 12", "Slide 7", "Paragraph 14" — generalizes pageNumber across source types
    excerpt: string,       // short display text
    fullText: string,      // expanded text on click
    matchScore: number
  }
}
```

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend — Next.js                    │
│                                                          │
│  ┌──────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Left    │  │  tldraw Canvas   │  │  RAG Sidebar  │  │
│  │ Sidebar  │  │  (center panel)  │  │ (right panel) │  │
│  │          │  │                  │  │               │  │
│  │ notebook │  │ freehand draw    │  │ related       │  │
│  │ note     │  │ + text nodes     │  │ passages      │  │
│  │ tree     │  │ + citation chips │  │               │  │
│  │          │  │                  │  │ [drag source] │  │
│  │ sources  │  │ [drop target]    │  │               │  │
│  └──────────┘  └──────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
         │                  │                    │
         │           stroke debounce        drag events
         │                  │
         ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                   Backend — Fastify                      │
│                                                          │
│  /notebooks  /notes  /sources  /ocr  /ingest  /rag      │
│                                                          │
│  ┌────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │ OCR        │   │ Ingest       │   │ RAG Query    │   │
│  │ Service    │   │ Pipeline     │   │ Handler      │   │
│  │ (adapter)  │   │              │   │              │   │
│  └────────────┘   └──────────────┘   └──────────────┘   │
│        │                 │                  │            │
│   Claude Vision      OpenAI embed      OpenAI embed      │
│   (swappable)        + chunk + store   + vector search   │
└─────────────────────────────────────────────────────────┘
         │                  │                    │
         ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                   MongoDB Atlas                          │
│                                                          │
│   notebooks   notes   sources   document_chunks          │
│                                 (+ vector search index)  │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Key Flows

### 5.1 Document Ingestion
1. User uploads PDF via the left sidebar
2. Frontend POSTs multipart form to `POST /sources` with scope (`note` or `notebook`)
3. Backend stores file to GridFS, creates Source document with `status: 'processing'`
4. Backend triggers ingestion pipeline:
   - Parse PDF text by page (e.g. `pdf-parse`)
   - Chunk each page into ~500-token segments with 100-token overlap (recursive paragraph splitter)
   - For each chunk: call OpenAI `text-embedding-3-small` → get 1536-dim vector
   - Insert DocumentChunk documents with embedding + metadata
5. Source status updated to `ready`. If ingestion fails, status is set to `error`.
6. Upload route returns `202 Accepted` immediately after GridFS write — ingestion runs async (fire-and-forget). Frontend polls `GET /sources?scope=...` every 2s until the source status changes to `ready` or `error`.
7. On completion, `activeSourceIds` is updated on all affected notes per the initialization rules in §3.3.

### 5.2 OCR + RAG Query (Core Real-Time Loop)
This loop fires continuously during note-taking.

**Short-circuit conditions** — the loop exits early without making any API calls if:
- `activeSourceIds` is empty (no sources toggled on)
- No new strokes exist since the last query
- The canvas snapshot produces no content (blank region)
- OCR returns an empty string

1. **Stroke Debounce**: tldraw fires an `onChange` event on every stroke. Frontend debounces 3 seconds after the last stroke ends. Tracks new stroke shape IDs since the last query — if none exist, skips.
2. **Canvas Snapshot**: Frontend captures the bounding box of new strokes since the last query using tldraw's store APIs. Exports that region as a base64 PNG.
3. **OCR Request**: `POST /ocr` with `{ imageBase64, mimeType }` → backend OCR service returns transcribed text string. If empty, loop exits.
4. **Text Buffer**: OCR result is appended to a rolling text buffer stored in `useRagSidebar` hook state (last ~5 OCR results, ~300 tokens). This gives the RAG query context across recent writing, not just the latest stroke.
5. **RAG Query**: `POST /rag/query` with `{ text: buffer, sourceIds: activeSourceIds }`:
   - Embed query text with OpenAI `text-embedding-3-small`
   - Run MongoDB Atlas Vector Search with pre-filter `{ sourceId: { $in: activeSourceIds } }`
   - Retrieve top-5 chunks with scores
   - For each chunk: call Claude API to generate a one-sentence relevance summary explaining *why* it matched
   - Return chunks with: sourceId, sourceName, locationLabel, excerpt, matchScore, summary
6. **Sidebar Update**: Frontend silently replaces sidebar contents with new results. No loading spinner, no animation flash.

### 5.3 Citation Drag-and-Drop
1. User sees a relevant passage in the RAG sidebar
2. User drags the passage card (HTML drag event, `dragstart` sets drag data payload: chunkId, sourceId, sourceName, locationLabel, excerpt, fullText, matchScore)
3. tldraw canvas registers as a drop target (`onDrop` handler)
4. On drop: convert browser drop coordinates to tldraw canvas space using `editor.screenToPage()`
5. Create a CitationChip custom shape at those coordinates with the drag payload as props
6. CitationChip renders as a small collapsed chip (e.g. `[Ch. 12 — Page 214]`)
7. On click: chip expands to show full excerpt + match score + source name + location label
8. Canvas state auto-saves to DB (see §5.4)

**Orphaned citations:** If the source a chip references is later deleted, the chip renders in a degraded state — greyed out with a "Source deleted" label instead of the excerpt. The chip is not automatically removed; the user can select and delete it manually. This avoids an expensive scan of all canvas states at deletion time.

### 5.4 Canvas State Persistence
- tldraw store emits change events on every edit
- Frontend debounces 5 seconds → `PATCH /notes/:id` with serialized `canvasState`
- On note open: load `canvasState` from DB → `editor.store.loadSnapshot(canvasState)`
- `activeSourceIds` is also saved on the same PATCH call when toggled

### 5.5 Handwriting Search via OCR History
Handwritten notes are not text, but they can be made searchable through accumulated OCR results.

**Data model addition** — `ocr_results` collection:
```
{
  _id: ObjectId,
  noteId: ObjectId,
  userId: string,
  text: string,            // OCR transcript for this region
  bbox: { x, y, w, h },   // canvas-space bounding box that was snapshotted
  createdAt: Date
}
```
MongoDB text index on `text`. Upsert key is `(noteId, snapshotKey)` where `snapshotKey` is a sorted, joined string of the tldraw shape IDs included in the snapshot (e.g. `"shape:abc,shape:def,shape:xyz"`). Shape IDs are stable across sessions, so the same set of strokes always produces the same key — avoiding the floating-point coordinate comparison problem that would arise from using bbox coordinates directly.

**Search flow:**
1. User types a search query
2. `GET /notes/:id/ocr-search?q=...` — text search against `ocr_results` for that note
3. Returns matching results with their `bbox`
4. Frontend calls `editor.zoomToBounds(bbox)` to pan and zoom the canvas to the matched region

**Caveat:** accuracy is bounded by OCR quality. Messy handwriting may not surface in search. This is a known and acceptable limitation — the search is best-effort, not exhaustive.

### 5.6 Export
Export is entirely **client-side** — no backend route required. tldraw's built-in export APIs do the work.

- **PNG**: `editor.toSvg()` → render to `<canvas>` → `canvas.toDataURL('image/png')`
- **SVG**: `editor.toSvg()` directly. Handwriting exports as clean vector paths.
- **PDF**: SVG output piped through `jspdf` + `svg2pdf.js` in the browser

Export is triggered from a toolbar button. The entire current canvas page is exported, named after the note title. No backend involvement, no per-shape filtering in v1.

---

## 6. Backend Architecture

### 6.1 Route Structure
All routes require Clerk JWT authentication (Fastify plugin validates token, attaches `userId`).

```
GET    /notebooks
POST   /notebooks
PATCH  /notebooks/:id
DELETE /notebooks/:id

GET    /notebooks/:notebookId/notes
POST   /notebooks/:notebookId/notes
GET    /notes/:id
PATCH  /notes/:id           // canvasState + activeSourceIds
DELETE /notes/:id

POST   /sources              // multipart upload — any supported MIME type; returns 202 immediately
GET    /sources?scope=note:id | notebook:id
GET    /sources/:id/file     // streams file from GridFS (for PDF preview)
PATCH  /sources/:id          // rename source
DELETE /sources/:id          // deletes source + all its DocumentChunks; citations become orphaned

POST   /ocr                  // { imageBase64, mimeType } → { text }
POST   /rag/query            // { text, sourceIds } → { chunks[] }
GET    /notes/:id/ocr-search // ?q=query → [{ text, bbox }]
```

**CORS:** `@fastify/cors` is registered as a plugin, allowing requests only from the frontend origin (`NEXT_PUBLIC_API_URL`). Configured at startup before any routes are registered.

### 6.2 Ingest Pipeline (Internal)
Triggered server-side after a source upload completes. Not a user-facing endpoint. Runs as an async fire-and-forget — the upload route returns `202` immediately and calls `ingestService.run(sourceId)` without awaiting it. Errors inside the ingest are caught, logged, and reflected in `source.status = 'error'`.

On partial failure (some chunks written before an error): all chunks for that sourceId are deleted before setting status to `error`, leaving no partial data.

### 6.5 Error Handling
**Backend — custom exception hierarchy:**
```typescript
// apps/api/src/domain/errors.ts
class AppError extends Error {
  constructor(public statusCode: number, message: string) { super(message) }
}
class NotFoundError extends AppError { constructor(m: string) { super(404, m) } }
class ForbiddenError extends AppError { constructor(m: string) { super(403, m) } }
class ValidationError extends AppError { constructor(m: string) { super(400, m) } }
class ConflictError extends AppError { constructor(m: string) { super(409, m) } }
```
Services throw these. A Fastify `setErrorHandler` plugin catches them and maps to structured JSON responses: `{ error: string, message: string }`. Unknown errors map to 500. This is the only place HTTP status codes are assigned.

**Frontend — error handling per layer:**
- **React Query** — query/mutation errors surface naturally via `isError` and `error` states. Components render inline error messages for data-loading failures.
- **Toasts (Sonner)** — used for transient action failures: save failed, OCR failed, upload failed, source delete failed. One-liner: `toast.error('Failed to save note')`.
- **Error boundaries** — wrap the `<NoteCanvas>` component only. A canvas crash should not take down the entire app.

### 6.3 Source Parser — Adapter Pattern
**Adding a new source type should require nothing more than creating and registering a new subclass.** The ingest pipeline is decoupled from any specific file format.

```typescript
// Interface — apps/api/src/adapters/parsers/SourceParser.ts
interface ParsedChunk {
  text: string
  locationLabel: string   // e.g. "Page 12", "Slide 7", "Paragraph 14"
  chunkIndex: number
}

interface SourceParser {
  readonly supportedMimeTypes: string[]
  parse(buffer: Buffer, filename: string): Promise<ParsedChunk[]>
}

// Implementations
class PdfParser implements SourceParser { ... }       // pdf-parse
class DocxParser implements SourceParser { ... }      // mammoth.js
class MarkdownParser implements SourceParser { ... }  // plain split
class ImageParser implements SourceParser { ... }     // Claude Vision text extraction

// Registry — apps/api/src/adapters/parsers/ParserRegistry.ts
class ParserRegistry {
  private parsers: SourceParser[] = []

  register(parser: SourceParser) {
    this.parsers.push(parser)
  }

  getParser(mimeType: string): SourceParser {
    const parser = this.parsers.find(p => p.supportedMimeTypes.includes(mimeType))
    if (!parser) throw new Error(`No parser registered for mime type: ${mimeType}`)
    return parser
  }
}

// Startup registration
const registry = new ParserRegistry()
registry.register(new PdfParser())
registry.register(new DocxParser())
registry.register(new MarkdownParser())
registry.register(new ImageParser())
```

The ingest pipeline calls `registry.getParser(mimeType).parse(buffer, filename)` — it has no knowledge of any specific format. Adding PPTX support later means writing one new class and one `registry.register()` call.

Note: `locationLabel` generalizes the `pageNumber` concept across source types. Citations store `locationLabel` as a string rather than a page integer.

### 6.4 OCR Service — Adapter Pattern
**The OCR implementation is intentionally abstracted.** Claude Vision is the initial implementation but the architecture must make it trivially swappable.

```typescript
// Interface — apps/api/src/adapters/ocr/OcrService.ts
interface OcrService {
  transcribe(imageBase64: string, mimeType: string): Promise<string>
}

// Implementation — apps/api/src/adapters/ocr/ClaudeOcrService.ts
class ClaudeOcrService implements OcrService {
  async transcribe(imageBase64: string, mimeType: string): Promise<string> {
    // Claude Vision API call
  }
}

// Registered once at startup, injected via Fastify's DI / decorator system
fastify.decorate('ocrService', new ClaudeOcrService())

// Route handler receives it via fastify instance — never imports the implementation directly
```

To swap implementations (e.g. to MyScript or Google Vision): create a new class implementing `OcrService`, change the one registration line at startup. No route handler changes required.

---

## 7. Frontend Architecture

### 7.1 Layout
Three-panel layout, fixed chrome:
- **Left (240px)**: Notebook/note tree, sources list per note, toggle controls, upload button
- **Center (flex)**: tldraw canvas — full height, full width of center panel
- **Right (320px)**: RAG sidebar — "related passages" with match score, source name, location label, excerpt, relevance summary. Cards are draggable.

**Collapsible panels:** Both the left and right panels have a toggle button to collapse them to an icon strip. Collapsed state is local UI state (not persisted). This is important for tablet use where screen width is constrained.

**Responsive behavior:**
- Desktop (≥1280px): all three panels visible by default
- Tablet (768px–1279px): left panel collapsed by default, right panel accessible via toggle
- Below 768px: not supported in v1 (mobile is out of scope)

**RAG sidebar empty state:** Before any RAG results exist (fresh note, no writing yet, or no sources toggled on), the sidebar shows a subtle centered message: *"Start writing to surface related passages"*. No icon, no animation — keeps it quiet.

### 7.2 tldraw Integration
- Use `@tldraw/tldraw` React component
- Define a `CitationChipShapeUtil` extending `BaseBoxShapeUtil` for the custom citation shape
- Canvas state persisted via `editor.store.getSnapshot()` / `editor.store.loadSnapshot()`
- Register a `TLDropTargetEvent` on the tldraw editor element to handle citation drops
- Use `editor.toSvg()` with a shape filter to snapshot only the recent stroke region for OCR

### 7.3 Canvas Capabilities

**Approach:** minimal curation — disable tools that don't belong in a lecture note context, keep everything else. Customized via tldraw's `components` and `overrides` props.

**Enabled tools:**

| Tool | Purpose |
|---|---|
| Pen / draw | Primary input — freehand handwriting |
| Highlighter | Semi-transparent strokes for emphasis — built into tldraw |
| Eraser | Point eraser and stroke eraser |
| Select + move | Multi-select, reposition, resize shapes |
| Text | Typed annotations directly on canvas |
| Arrow | Connecting concepts, labeling diagram elements |

**Disabled / hidden tools:** shape tools (rectangle, ellipse, triangle), sticky notes, frames, line/polyline, fill patterns. Hidden via the `components` prop — passing `null` for toolbar sections we don't want.

**Color palette** — curated subset passed via tldraw theme overrides:
- Black, dark grey — primary writing
- Red, blue, green — annotation colors  
- Yellow, cyan — highlighter colors (used with the highlighter tool's built-in transparency)
- Purple — additional annotation color

**Stroke widths:** S / M / L (XL removed — too broad for handwriting)

**Custom shapes (built by us):**
- `CitationChipShape` — floating annotation dropped from the RAG sidebar. Renders as a collapsed chip (e.g. `[Ch. 12, p. 214]`), expands on click to show full excerpt, source name, location, and match score.

### 7.4 Auth
Clerk's `<ClerkProvider>` wraps the app. `middleware.ts` protects all routes except `/sign-in` and `/sign-up`. Backend validates Clerk JWT on every request using the Fastify Clerk plugin.

### 7.5 State Management
- Server state (notes, sources, RAG results): React Query (TanStack Query) — handles caching, background refetch, optimistic updates
- Canvas state: owned entirely by tldraw, synced to server on debounce
- Sidebar state: local React state, replaced on each RAG response
- OCR text buffer: local `useRef` inside `useRagSidebar` — rolling array of last ~5 OCR strings, not React state (no re-render needed, mutated directly)
- Panel collapsed state: local `useState` per panel — not persisted
- Orphaned citation detection: derived at render time inside `CitationChipShape` — checks `sourceId` against the live sources list from React Query; no separate state needed

### 7.6 Design System

**Component base:** shadcn/ui + Tailwind. shadcn components are fully overridden via CSS custom properties in `globals.css` — the default look is a starting point only.

**Color palette** — warm paper tones, not cold greys:
```css
/* globals.css */
:root {
  --background:   28 25 23;      /* #1C1917 — near-black ink, used for text */
  --foreground:   250 250 248;   /* #FAFAF8 — warm off-white, app shell bg */
  --canvas-bg:    245 240 232;   /* #F5F0E8 — warmer, canvas background */
  --card:         255 253 250;   /* #FFFDF8 — card/panel surfaces */
  --border:       232 226 217;   /* #E8E2D9 — warm beige borders */
  --primary:      45  80  22;    /* #2D5016 — deep forest green accent */
  --muted:        210 203 194;   /* muted text */
}
```
One accent color (forest green) used sparingly — active states, citation chip borders, upload button. Avoid blue. Avoid gradients.

**Typography:**
- **Fraunces** (Google Fonts, variable) — note titles, notebook headings, any display text. Optical serif with character; signals "notebook" without being precious.
- **Inter** — all UI chrome, body text, sidebar content
- **`font-mono`** (system mono) — citation chip labels, location labels (e.g. `[Ch. 12 — Page 214]`)

**Canvas background:** SVG dot grid pattern on `--canvas-bg`. Override tldraw's `Canvas` component background:
```tsx
// Passed via tldraw's `components` prop
function CanvasBackground() {
  return (
    <div className="absolute inset-0" style={{
      backgroundColor: 'var(--canvas-bg)',
      backgroundImage: 'radial-gradient(circle, #C8BFB0 1px, transparent 1px)',
      backgroundSize: '24px 24px'
    }} />
  )
}
```

**Citation chips — index card aesthetic:**
- Off-white background, not a pill
- 3px colored left border — each source gets a consistent color from a fixed palette of 6 (assigned on upload, stored on the Source document)
- `font-mono` label when collapsed, readable serif excerpt when expanded
- Subtle box shadow (`shadow-sm`) — feels like a physical card lifted off the canvas
- No border-radius on the left edge (where the colored border is), `rounded-r-md` on the right only

**Motion:** Framer Motion for panel collapse (spring easing, not linear) and citation chip drag (slight scale-up to `1.03` while dragging). Nothing else animated — keep it calm.

**Avoid:**
- Glassmorphism / backdrop-blur
- Purple-to-blue gradients
- `rounded-xl` cards stacked on each other
- Dark mode as default (the paper aesthetic is light-first; dark mode is a future addition)

---

## 8. Code Architecture & Folder Structure

### 8.1 Layering Rules

Both frontend and backend enforce a strict top-to-bottom dependency. A layer may only call the layer directly below it.

| Layer violated | Consequence |
|---|---|
| Route calls MongoDB directly | HTTP and data concerns are coupled — changing the query means touching the route |
| Service receives `req`/`res` | Service becomes untestable without an HTTP context |
| Repository skipped by service | Queries scatter across the codebase |
| Component calls `fetch` directly | Data fetching logic duplicates across components, impossible to centralize caching |
| Hook constructs a URL | Backend contract is spread across hooks instead of owned by the API client |
| Any file reads `process.env` directly (except config) | Env changes require hunting across files; missing vars surface at runtime not startup |

### 8.2 Backend Layer Structure

```
Routes → Services → Repositories → MongoDB
              ↓
          Adapters (OCR, Embeddings, Citation, Parsers)
              ↑
           Config (env validation at startup)
```

**Folder structure:**
```
apps/api/src/
├── config/
│   └── env.ts                  # zod validates all env vars at startup; server won't start if any are missing
├── plugins/
│   ├── auth.ts                 # Clerk JWT verification — attaches userId to every request
│   ├── db.ts                   # MongoDB connection — decorates fastify with db client
│   └── container.ts            # DI — instantiates and registers all services/adapters on fastify
├── routes/
│   ├── notebooks.ts
│   ├── notes.ts
│   ├── sources.ts
│   ├── ocr.ts
│   └── rag.ts
├── services/
│   ├── notebook.service.ts
│   ├── note.service.ts
│   ├── source.service.ts
│   ├── ingest.service.ts       # orchestrates parse → embed → store pipeline
│   └── rag.service.ts          # orchestrates embed → vector search → citation generation
├── repositories/
│   ├── notebook.repository.ts
│   ├── note.repository.ts
│   ├── source.repository.ts
│   ├── chunk.repository.ts     # document chunks + vector search queries
│   └── ocr-result.repository.ts
├── adapters/
│   ├── ocr/
│   │   ├── OcrService.ts       # interface
│   │   └── ClaudeOcrService.ts
│   ├── embeddings/
│   │   ├── EmbeddingService.ts # interface
│   │   └── OpenAiEmbeddingService.ts
│   ├── citation/
│   │   ├── CitationService.ts  # interface
│   │   └── ClaudeCitationService.ts
│   └── parsers/
│       ├── SourceParser.ts     # interface + ParsedChunk type
│       ├── ParserRegistry.ts
│       ├── PdfParser.ts
│       ├── DocxParser.ts
│       ├── MarkdownParser.ts
│       └── ImageParser.ts
└── domain/
    └── schemas.ts              # zod schemas + inferred TypeScript types for all domain objects
                                # (Note, Notebook, Source, DocumentChunk, OcrResult)
                                # .parse() is called at every repository read boundary
```

**Key rule:** `domain/schemas.ts` is the single source of truth for types. No hand-written interfaces that duplicate a zod schema.

### 8.3 Frontend Layer Structure

```
Pages → Feature Components → Hooks → API Client → Backend
              ↓
        UI Components (no domain knowledge)
              ↑
           Config (env validation at module load)
```

**Folder structure:**
```
apps/web/src/
├── app/                              # Next.js App Router — thin pages only
│   ├── (auth)/
│   │   ├── sign-in/page.tsx
│   │   └── sign-up/page.tsx
│   └── (app)/
│       └── notebooks/[notebookId]/notes/[noteId]/page.tsx
├── components/
│   ├── features/                     # domain-aware, call hooks
│   │   ├── NoteCanvas/
│   │   │   ├── NoteCanvas.tsx        # renders <Tldraw>, delegates all logic to useCanvas
│   │   │   └── CitationChipShape.tsx # tldraw custom shape util
│   │   ├── RagSidebar/
│   │   │   ├── RagSidebar.tsx
│   │   │   └── PassageCard.tsx       # draggable citation card
│   │   ├── SourceList/
│   │   │   ├── SourceList.tsx
│   │   │   └── SourceToggle.tsx
│   │   └── NotebookTree/
│   │       └── NotebookTree.tsx
│   └── ui/                           # purely presentational, zero domain knowledge
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Modal.tsx
│       └── Tooltip.tsx
├── hooks/
│   ├── useNote.ts                    # CRUD for a single note, canvas state persistence
│   ├── useNotebook.ts
│   ├── useSources.ts                 # source list + toggle management
│   ├── useRagSidebar.ts              # owns debounce → OCR → RAG query → sidebar state
│   ├── useCanvas.ts                  # wraps tldraw editor: stroke tracking, snapshot, drop handling
│   └── useOcrDebounce.ts             # debounce + bounding box snapshot logic (used by useRagSidebar)
├── lib/
│   ├── api/                          # API client — one file per backend resource
│   │   ├── notes.ts
│   │   ├── notebooks.ts
│   │   ├── sources.ts
│   │   ├── rag.ts
│   │   └── ocr.ts
│   └── types.ts                      # domain types shared across hooks and components
│                                     # mirrored from backend domain/schemas.ts
└── config/
    └── env.ts                        # reads + validates NEXT_PUBLIC_* vars; throws at module load if missing
```

**Key rules:**
- `NoteCanvas.tsx` renders `<Tldraw>` and nothing else — all canvas logic lives in `useCanvas`
- `useRagSidebar` is the only place the OCR debounce and RAG query are wired together
- `lib/api/` functions are the only place URLs are constructed
- `lib/types.ts` mirrors backend schemas — when the backend schema changes, this is the one frontend file to update

---

## 9. Design Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Auth provider | Clerk | Fastest to integrate, drop-in React components, handles JWT |
| Canvas library | tldraw | Supports freehand + text on same canvas; serializable; React-native |
| Vector store | MongoDB Atlas Vector Search | Collocates with doc DB; no separate Pinecone/Weaviate needed |
| Embeddings | OpenAI text-embedding-3-small | Must be consistent at ingest + query time; Voyage/OpenAI are the recommended Claude complements; OpenAI chosen for simplicity |
| OCR | Claude Vision (adapter pattern) | Accuracy sufficient for RAG-only use (not displayed to user); easily swappable if quality insufficient |
| RAG trigger | Debounced stroke events (3s) | Avoids excessive API calls; natural pause after writing is the right moment to query |
| OCR scope | Bounding box of new strokes only | Keeps image small and focused; avoids re-OCR-ing old content |
| Text buffer | Rolling ~5 OCR results (~300 tokens) | Gives RAG context beyond just the last stroke without unbounded growth |
| Stroke persistence | Strokes stay as strokes (not converted) | Handwriting-first principle; OCR output is ephemeral (RAG only) |
| Citation storage | Embedded in tldraw canvasState | Citations are canvas objects, not DB records; simpler data model |
| Source scoping | Note-level or notebook-level, with per-note toggle | Flexibility for users who share readings across a course vs. lecture-specific sources |
| RAG sidebar update | Silent (no loading indicator) | Core UX principle — sidebar should never interrupt writing flow |
| Canvas save | Debounced PATCH 5s after last change | Avoids hammering DB on every stroke; 5s data loss window is acceptable |
| Typed text RAG trigger | Same debounce as handwriting | Unified trigger model; no special case for typing vs. drawing |
| OCR debug mode | `NEXT_PUBLIC_OCR_DEBUG=true` env flag | When enabled, renders the latest OCR transcript in a small fixed overlay on the canvas (bottom-left). Lets developers verify OCR quality during development without exposing it to users. |
| Data access | Raw MongoDB driver + Zod (no Mongoose) | Repository pattern already provides the abstraction Mongoose would add; Zod schemas are the single source of truth for types and runtime validation; raw driver gives clean access to `$vectorSearch` without falling back to raw queries |
| Source type extensibility | Parser registry (adapter pattern) | Adding a new format = one new class + one register() call; ingest pipeline has no format-specific logic |
| Citation location reference | `locationLabel: string` (not `pageNumber: int`) | Generalizes across source types — PDFs use "Page N", slides use "Slide N", etc. |
| Handwriting search | OCR history + MongoDB text index | Makes strokes best-effort searchable without storing a text representation of the note |
| Export | tldraw `toSvg()` + client-side PDF conversion | Canvas exports as clean SVG (vector strokes); PDF via jspdf + svg2pdf; no backend route needed |
| Error handling (backend) | Custom exception hierarchy + Fastify `setErrorHandler` | Services throw typed errors; one plugin maps them to HTTP responses; status codes assigned in one place |
| Error handling (frontend) | React Query error states + Sonner toasts + one error boundary | Query errors render inline; transient action failures use toasts; error boundary wraps canvas only |
| Monorepo | pnpm workspaces | Simplest setup for a solo sprint; no Turborepo overhead |
| Responsive layout | Collapsible panels, tablet-aware breakpoints | Left/right panels collapsible; tablet (768–1279px) collapses left by default; below 768px not supported |
| Orphaned citations | Degraded render state (no deletion) | Avoids expensive canvas scan at source deletion time; user can manually remove if desired |
| Design aesthetic | Warm paper tones + dot grid canvas + Fraunces serif | Differentiates from cold-grey generic AI apps; anchors the notebook metaphor visually |
| Citation chip style | Index card (colored left border, mono label, off-white bg) | Thematically consistent with academic citations; visually distinct from standard UI chips |
| Source color assignment | Fixed palette of 6 colors, assigned on upload, stored on Source | Consistent color coding across sidebar cards and canvas chips without user configuration |
| activeSourceIds init | Inherits notebook sources on note creation; auto-updated on new uploads | Ensures new sources are immediately available without manual toggles |

---

## 10. Environment Variables

### 10.1 Frontend (`apps/web/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (safe to expose to browser) |
| `CLERK_SECRET_KEY` | Clerk secret key — used server-side in Next.js route handlers |
| `NEXT_PUBLIC_API_URL` | Backend Fastify URL (e.g. `http://localhost:3001` in dev) |
| `NEXT_PUBLIC_OCR_DEBUG` | Set to `true` to show OCR transcript overlay on canvas. Dev only — never set in production. |

### 10.2 Backend (`apps/api/.env`)

| Variable | Description |
|---|---|
| `CLERK_SECRET_KEY` | Clerk secret key — used to verify JWTs on incoming requests |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `MONGODB_URI` | MongoDB Atlas connection string (includes credentials) |
| `OPENAI_API_KEY` | OpenAI API key — used for `text-embedding-3-small` embeddings |
| `ANTHROPIC_API_KEY` | Anthropic API key — used for Claude Vision OCR and citation generation |
| `PORT` | Fastify server port (default `3001`) |

### 10.3 File Storage Decision
Uploaded source files are stored in **MongoDB GridFS** — no separate storage service. This keeps the entire stack on a single Atlas connection and eliminates extra credentials and SDK setup. Files are written to GridFS on upload and read once during ingestion. The `Source` document stores a `gridfsFileId` (ObjectId) rather than a URL.

To serve a file back to the browser (e.g., for a PDF preview), the backend streams it via `GET /sources/:id/file`. Files are never served directly via public URL.

If this grows into a production product, migrating to S3/R2 is a one-day change: swap the GridFS read/write calls in the ingest and serve routes, add storage credentials to env, done.

---

## 11. Known Limitations (v1)

- **Handwriting search is best-effort** — OCR-based search (§5.5) is bounded by OCR accuracy. Messy handwriting may not surface in search results.
- **OCR errors affect RAG quality invisibly** — if Claude Vision misreads a word, the embedding and retrieval will be slightly off. Acceptable since OCR output is not shown. Use `NEXT_PUBLIC_OCR_DEBUG=true` during development to inspect OCR output (see §8 design decisions).
- **No collaboration** — notes are strictly private, single-user.
- **No web URL or PPTX sources** — the parser registry supports PDF, DOCX, Markdown, and image files. Web pages and PowerPoint are not in scope for v1 (parsers are complex and citation anchoring for those formats is non-trivial).
- **Undo history is session-only** — tldraw provides in-session undo. Undo does not persist across page loads.

---

## 12. Out of Scope (v1)

- Real-time collaboration / shared notebooks
- Mobile or native tablet app
- Audio recording and transcription
- Web URL and PPTX source parsing
- Per-shape or partial canvas export (full-page export only)
