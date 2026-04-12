# Ticket 8 — RAG Frontend Loop (OCR, Sidebar, Drag-to-Cite)

**Model:** Opus | **Thinking:** On | **Depends on:** Ticket 7

## Objective

Wire up the complete real-time RAG loop: canvas snapshot → OCR → embed → vector search → sidebar update → drag citation onto canvas. This is the core feature of the app.

## Acceptance Criteria

### OCR Debounce + Snapshot (TDD §5.2)
- [ ] `useOcrDebounce(editor, noteId)` hook:
  - Subscribes to tldraw store changes
  - Tracks new draw/text shape IDs since the last OCR query
  - On 3-second debounce after last stroke/text change:
    - **Short-circuits if:** no new shapes, or `activeSourceIds` is empty
    - Computes bounding box of new shapes
    - Exports that region as base64 PNG via tldraw's export APIs
    - Sends to `POST /ocr` with `{ imageBase64, mimeType, noteId, snapshotKey, bbox }`
    - `snapshotKey` = sorted joined string of shape IDs in the snapshot
  - Resets tracked shape IDs after successful query
- [ ] Typed text on canvas also triggers the debounce (text shapes are included)

### Text Buffer + RAG Query
- [ ] `useRagSidebar(noteId, activeSourceIds)` hook:
  - Maintains a rolling text buffer as a `useRef` — last ~5 OCR results, concatenated, ~300 tokens max
  - When new OCR result arrives (non-empty):
    - Appends to buffer, trims oldest if over limit
    - Calls `POST /rag/query` with `{ text: buffer, sourceIds: activeSourceIds }`
  - Stores RAG results in local state
  - **Short-circuits if:** OCR returned empty string, or buffer is empty, or no active sources
  - Exposes: `ragResults`, `isQuerying` (internal, not shown as loading indicator)

### RAG Sidebar Component (TDD §7.1)
- [ ] `RagSidebar.tsx` — right panel
  - Renders list of passage cards from `ragResults`
  - **Empty state:** centered message "Start writing to surface related passages" (subtle, warm grey text)
  - Header: "related passages" with count badge (e.g. "5 found")
  - Updates silently — no loading spinner, no animation flash
  - Uses `<ScrollArea>` for overflow
- [ ] `PassageCard.tsx` — individual result card:
  - Shows: source name (with colored left border matching source color), location label, match score percentage, excerpt text
  - Highlighted text: key matching terms bolded or colored (best effort — extract from excerpt if Claude's summary mentions specific terms)
  - **Draggable:** `draggable` attribute, `onDragStart` sets transfer data as JSON with all citation fields
  - Cursor changes to grab on hover

### Citation Drag-and-Drop (TDD §5.3)
- [ ] Drag a `PassageCard` from the sidebar
- [ ] Drop onto the tldraw canvas:
  - Canvas wrapper element has `onDragOver` (prevent default) and `onDrop` handlers
  - On drop: parse transfer data, convert screen coordinates to canvas space via `editor.screenToPage()`
  - Create `CitationChipShape` at the drop coordinates with the passage data as props
  - Citation chip renders immediately in collapsed state
- [ ] If drop occurs outside the canvas → nothing happens (no error)

### OCR Debug Overlay (TDD §9)
- [ ] When `NEXT_PUBLIC_OCR_DEBUG=true`:
  - Render a small fixed overlay at bottom-left of the canvas panel
  - Shows the latest OCR transcript text
  - Semi-transparent background, monospace font
  - Updates each time OCR returns

### API Client
- [ ] `apps/web/src/lib/api/ocr.ts` — `transcribeCanvas(imageBase64, mimeType, noteId, snapshotKey, bbox)`
- [ ] `apps/web/src/lib/api/rag.ts` — `queryRag(text, sourceIds)`

## Testing

Manual testing — this is the most important validation:
1. Upload a PDF source about a specific topic (e.g., economics chapter)
2. Wait for source to become "ready"
3. Draw handwriting related to the topic on the canvas
4. Wait 3+ seconds — verify sidebar updates with relevant passages
5. Type text on the canvas about the same topic — verify sidebar updates again
6. Drag a passage card onto the canvas — verify citation chip appears at drop location
7. Click the chip — verify it expands to show full excerpt
8. Toggle a source off — verify sidebar results exclude it on next update
9. Enable OCR debug → verify overlay shows reasonable OCR text
10. Write something unrelated to any source — verify sidebar shows different/fewer results

## Out of Scope

- No export (Ticket 9)
- No OCR search (Ticket 9)
- No E2E tests (Ticket 9)
