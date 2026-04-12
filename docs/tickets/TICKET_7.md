# Ticket 7 — Canvas Integration

**Model:** Opus | **Thinking:** On | **Depends on:** Ticket 6

## Objective

Integrate tldraw into the center panel. After this ticket, users can draw, type, erase, and highlight on an infinite canvas with a dot grid background, and the canvas state persists to the database across page loads.

## Acceptance Criteria

### tldraw Setup
- [ ] `@tldraw/tldraw` installed and rendering in the center panel of the note view
- [ ] Canvas fills the entire center panel (flex, full height)
- [ ] Canvas state loads from `note.canvasState` on page open via `editor.store.loadSnapshot()`
- [ ] Canvas state saves to backend on debounce (5s after last change) via `PATCH /notes/:id`

### Canvas Background (TDD §7.6)
- [ ] Custom `CanvasBackground` component passed via tldraw's `components` prop
- [ ] Warm off-white background (`#F5F0E8`)
- [ ] Subtle dot grid pattern: `radial-gradient(circle, #C8BFB0 1px, transparent 1px)` at `24px 24px` spacing

### Tool Curation (TDD §7.3)
- [ ] **Enabled tools:** pen/draw, highlighter, eraser, select+move, text, arrow
- [ ] **Disabled/hidden:** rectangle, ellipse, triangle, sticky note, frame, line/polyline, fill patterns
- [ ] Toolbar customized via tldraw's `components` prop — only shows enabled tools
- [ ] Color palette overridden to curated set: black, dark grey, red, blue, green, yellow, cyan, purple
- [ ] Stroke widths: S, M, L only (XL removed)

### Custom Shape: CitationChipShape
- [ ] `CitationChipShapeUtil` extending `BaseBoxShapeUtil`
- [ ] Shape type: `'citation-chip'`
- [ ] Props: `chunkId`, `sourceId`, `sourceName`, `locationLabel`, `excerpt`, `fullText`, `matchScore`
- [ ] **Collapsed render:** small chip with `font-mono` label — `[sourceName — locationLabel]` (e.g. `[Ch. 12 — Page 214]`). Off-white background, 3px colored left border, subtle shadow
- [ ] **Expanded render:** on click, expands to show: full excerpt text, source name, location, match score. Uses Fraunces for the excerpt text. Click again to collapse.
- [ ] **Orphaned state:** if `sourceId` is not found in the note's available sources, render greyed out with "Source deleted" replacing the excerpt
- [ ] Shape is selectable, movable, deletable via tldraw's built-in select tool
- [ ] Shape is NOT directly created by users — only created programmatically via drop events (Ticket 8)

### Hooks
- [ ] `useCanvas(editor, noteId)` hook:
  - Tracks new stroke shape IDs since last query (for OCR snapshot in Ticket 8)
  - Handles canvas state persistence (debounced save)
  - Exposes `getRecentStrokeBounds()` for OCR snapshot
  - Exposes `getRecentShapeIds()` for OCR snapshot key
  - Drop handler registration for citation chips (receives shape data, creates CitationChipShape at drop coordinates via `editor.createShape()`)

### Responsive Panels
- [ ] Left panel collapse: animated via Framer Motion (spring, not linear)
- [ ] Right panel collapse: same animation
- [ ] When panels collapse, canvas smoothly expands to fill space
- [ ] Panel toggle buttons visible in the main toolbar area

## Testing

Manual testing only for this ticket — canvas interaction is not smoke-testable. Verify:
- Draw strokes with pen tool
- Type text on canvas
- Use highlighter (semi-transparent)
- Erase strokes
- Switch colors, stroke widths
- Navigate away from note and back — all content preserved
- Resize browser window — canvas and panels respond correctly

## Out of Scope

- No OCR or RAG sidebar logic (Ticket 8)
- No citation drag-and-drop FROM sidebar (Ticket 8 — but the drop TARGET handler is built here)
- No export (Ticket 9)
- No OCR search (Ticket 9)
