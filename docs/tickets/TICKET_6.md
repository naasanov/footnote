# Ticket 6 — Frontend Shell & Design System

**Model:** Sonnet | **Thinking:** Off | **Depends on:** Ticket 1 (backend must be running for auth)

## Objective

Build the frontend application shell: layout, navigation, design system, notebook/note CRUD UI, and source management UI. After this ticket, a user can sign in, create notebooks and notes, upload sources, and toggle sources on/off. The center panel is a placeholder — no canvas yet.

## Acceptance Criteria

### Design System (TDD §7.6)
- [ ] Tailwind CSS configured with custom theme:
  - Colors: warm off-white bg (`#FAFAF8`), canvas bg (`#F5F0E8`), card (`#FFFDF8`), warm beige borders (`#E8E2D9`), forest green accent (`#2D5016`), near-black text (`#1C1917`)
  - shadcn CSS custom properties in `globals.css` overridden to match palette
- [ ] Fonts:
  - Fraunces (Google Fonts) loaded in root layout — used for note titles, notebook headings
  - Inter — all UI chrome
  - System mono — citation labels (for later tickets)
- [ ] shadcn/ui components installed: Button, Card, Dialog, DropdownMenu, Input, ScrollArea, Tooltip, Separator
- [ ] No default shadcn styling visible — all components reflect the warm paper aesthetic

### Layout (TDD §7.1)
- [ ] Three-panel layout:
  - Left sidebar (240px) — notebook/note tree + source list
  - Center panel (flex) — placeholder text for now: "Select a note to start writing"
  - Right sidebar (320px) — placeholder text: "Related passages will appear here"
- [ ] Both sidebars collapsible via toggle buttons (Framer Motion spring animation)
- [ ] Responsive breakpoints:
  - Desktop (>=1280px): all panels visible
  - Tablet (768-1279px): left collapsed by default
  - Below 768px: not supported, show a "Desktop required" message

### Left Sidebar
- [ ] Notebook tree:
  - List of notebooks for the user (fetched via React Query)
  - Click to expand → shows notes inside
  - "+ new notebook" button at top, creates via API
  - Notebook context menu (right-click or "...") → rename, delete (with confirmation dialog)
- [ ] Note list:
  - Notes listed under their notebook
  - Click a note → navigate to `/notebooks/[notebookId]/notes/[noteId]`
  - "+ new note" button per notebook
  - Note context menu → rename, delete (with confirmation)
- [ ] Source list:
  - Shown below notes when a note is selected
  - Lists sources scoped to the current note AND its parent notebook (labeled accordingly)
  - Each source shows: filename, scope label ("notebook" or "note"), status badge (processing/ready/error)
  - Toggle switch per source — controls `activeSourceIds`, persists immediately via PATCH
  - "+ upload source" button at bottom → file picker (accepts `.pdf`, `.docx`, `.md`, `.txt`, `.png`, `.jpg`)
  - Upload triggers `POST /sources` → source appears with "processing" status → polls until "ready"

### API Client (TDD §8.3)
- [ ] `apps/web/src/lib/api/` — one file per resource:
  - `notebooks.ts` — listNotebooks, createNotebook, updateNotebook, deleteNotebook
  - `notes.ts` — listNotes, getNote, createNote, updateNote, deleteNote
  - `sources.ts` — listSources, uploadSource, deleteSource, renameSource, getSourceFileUrl
- [ ] All functions typed with request/response types from `lib/types.ts`
- [ ] Base client attaches Clerk JWT to every request

### Hooks
- [ ] `useNotebooks()` — React Query wrapper for notebook list
- [ ] `useNotes(notebookId)` — React Query wrapper for notes in a notebook
- [ ] `useNote(noteId)` — single note data
- [ ] `useSources(noteId, notebookId)` — combined list of sources for a note (note-scoped + notebook-scoped), with toggle mutation

### Pages
- [ ] `app/(auth)/sign-in/page.tsx` — Clerk sign-in (already from Ticket 1)
- [ ] `app/(auth)/sign-up/page.tsx` — Clerk sign-up (already from Ticket 1)
- [ ] `app/(app)/page.tsx` — home page, redirects to first notebook or shows "Create your first notebook"
- [ ] `app/(app)/notebooks/[notebookId]/notes/[noteId]/page.tsx` — main note view (center panel is placeholder for now)

## Out of Scope

- No tldraw canvas (Ticket 7)
- No RAG sidebar content (Ticket 8)
- No export, OCR search (Ticket 9)
- Sonner toasts are set up at root but only used for error feedback on CRUD operations in this ticket
