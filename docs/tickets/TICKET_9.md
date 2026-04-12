# Ticket 9 — Remaining Features, Polish, E2E Tests

**Model:** Sonnet | **Thinking:** On | **Depends on:** Ticket 8

## Objective

Build the remaining v1 features (OCR search, export, source color assignment), polish edge cases, and write Playwright E2E tests. After this ticket, the product is feature-complete for v1.

## Acceptance Criteria

### OCR Search (TDD §5.5)
- [ ] Search input in the left sidebar (above the notebook tree, or as a collapsible search bar)
- [ ] `useOcrSearch(noteId)` hook:
  - Debounced input (300ms)
  - Calls `GET /notes/:id/ocr-search?q=query`
  - Returns `[{ text, bbox }]`
- [ ] Search results shown as a dropdown or inline list below the search input
- [ ] Click a result → canvas zooms to that region via `editor.zoomToBounds(bbox)` with padding
- [ ] Clear search → canvas returns to previous view

### Export (TDD §5.6)
- [ ] Export button in the toolbar (top of center panel or as a menu)
- [ ] Export dropdown: PNG, SVG, PDF
- [ ] **PNG:** `editor.toSvg()` → render to offscreen canvas → `toDataURL('image/png')` → trigger download
- [ ] **SVG:** `editor.toSvg()` → serialize to string → trigger download
- [ ] **PDF:** SVG piped through `jspdf` + `svg2pdf.js` → trigger download
- [ ] All exports use the note title as the filename (sanitized for filesystem)
- [ ] Citation chips are included in the export (they're tldraw shapes)

### Source Color Assignment
- [ ] Fixed palette of 6 colors (coordinated with the design system — not the canvas stroke colors)
- [ ] Color assigned automatically on source creation: cycle through the palette in order
- [ ] Stored on the Source document: add `colorIndex: number` to Source schema
- [ ] Color used for:
  - Left border on citation chips (both on canvas and in sidebar passage cards)
  - Small color dot next to source name in the source list

### Source File Preview
- [ ] Click a source filename in the left sidebar → opens a modal/dialog
- [ ] Dialog streams the file from `GET /sources/:id/file` and renders it:
  - PDF: render in an `<iframe>` or `<embed>` tag
  - Images: render in an `<img>` tag
  - Text/Markdown/DOCX: show raw text in a `<pre>` block (good enough for v1)

### Edge Cases & Polish
- [ ] Orphaned citation detection: `CitationChipShape` checks if its `sourceId` is in the available sources list (from React Query). If not, renders degraded state (greyed out, "Source deleted").
- [ ] Source delete confirmation: "This will remove the source and its indexed content. Citation chips referencing this source will become orphaned." with confirm/cancel buttons.
- [ ] Empty notebook state: "Create your first note to get started"
- [ ] Error recovery: if canvas save fails (network error), show a Sonner toast "Failed to save — retrying..." and retry once after 3s
- [ ] Notebook delete confirmation: "This will delete all notes and sources in this notebook."

### Playwright E2E Tests
- [ ] `apps/web/tests/e2e/` directory with Playwright config
- [ ] Test: `upload-source.spec.ts`
  - Sign in → create notebook → create note
  - Upload a small test PDF
  - Assert source appears in source list
  - Poll until status badge shows "ready"
- [ ] Test: `rag-loop.spec.ts`
  - Sign in → navigate to a note with a ready source
  - Type text on the canvas (use tldraw's text tool)
  - Wait for sidebar to update (poll for passage cards to appear)
  - Assert at least one passage card is visible with a match score
- [ ] Test: `cite.spec.ts`
  - Sign in → navigate to note with sidebar results visible
  - Drag a passage card onto the canvas
  - Assert a citation chip shape exists on the canvas
- [ ] E2E tests hit real backend + real external services
- [ ] Run with `pnpm test:e2e`
- [ ] Instructions in test README: "Requires both servers running and real API keys configured"

## Out of Scope

- Dark mode
- Mobile layout
- Real-time collaboration
- Performance optimization of large canvases
