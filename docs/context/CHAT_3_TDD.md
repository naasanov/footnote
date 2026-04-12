Hello. I am starting a new project, and the goal of this conversation is to create a TDD that covers all aspects of my mental model, and to decide on several design decisions. Then the TDD and a completion criteria list will be given to an agent/agents to code out the project. Begin by consuming @docs/context/ to get an idea for what the project is
Show less
Read CHAT_ONE.md
Read CHAT_TWO.md
Read Project Proposal (1).pdf
Good, I have a clear picture. Let me check the existing TDD file before writing anything.

Read TDD.md
Empty file. Before I write anything, I want to nail down several open design decisions that will significantly shape the architecture. Let me ask the most important ones:

Open design decisions I need your input on:

1. Auth / Multi-user
Is this single-user (local app, no login), or multi-user with accounts? If multi-user, are notes private per user?

2. Note organization model
From the mock I see a flat list of notes with course names in the title (e.g., "Econ 301 — Week 8"). Is that the full model — just a list of notes with freeform titles? Or do you want a concept of "courses" that group notes and sources together?

3. Source scoping
When RAG runs, does it search across all uploaded sources, or only sources associated with the current note/course?

4. Handwriting canvas mechanics
The mock shows a small "handwrite here..." strip at the bottom with a "convert to text" button, while the main area looks like a rich text editor. Is the intent:

(a) The main canvas is typed text, and handwriting is a dedicated strip that converts and appends text upward
(b) The entire main area is a canvas where you can freely handwrite anywhere
5. Drag-to-cite target
When you drag a citation card from the sidebar, where does it land? Options:

At the end of the typed/converted text (cursor position)
As a floating annotation pinned to a location on the canvas
Into a dedicated "citations" section
6. Typing mode RAG trigger
For typed notes (not handwriting), what triggers the RAG query — debounce on keystrokes (fires automatically every N seconds of idle), or a manual hotkey/button?

7. Stroke persistence
After handwriting is converted to text, are the raw strokes discarded or saved (e.g., for re-OCR later if the first pass was bad)?

1. multi user with auth, notes private per user
2. Lets have a notebook concept where users can nest notes in a notebook. Hierarchy is user/account > notebook > note
3. Users will associate sources with speicifc notes. they can have the option to add a source to a notebook to make it available across all notes in the notebook. they can also toggle on and off sources to exclude them from search.
4. The entire main area is a canvas where they can write on.
5. floating annotation pinned to a loc on canvas
6. Debounced on keystrokes, similar to debounce on handwriting. Idfeally i would add the ability to both type and handwrite on the same main area canvas, but if you feel like that would be difficult, we can leave it for a later feature. 
7. Handwriting is not converted to text. it stays as strokes


Lmk what you're opinions are on this. For context, this is not a months long project. I will be working intensely on it for a couplee weeks for a course. feel free to push back on ideas for scope and time spent, but for the most part I think its doable.
Good decisions overall. Here are my opinions, including a few scope flags:

On Auth — Agree, but use Clerk instead of rolling NextAuth yourself. Drop-in React components, handles sessions, JWTs, social login if you want it later. Saves you half a sprint.

On Notebook > Note hierarchy — Clean. Simple two-level tree. Keep it.

On Source scoping + toggles — Solid UX. One question: is the toggle state persistent (saved to DB per note) or ephemeral (resets on page load)? Persistent is better UX but adds a tiny bit of model complexity. My recommendation: persistent, stored as an array of active source IDs on the note document.

On full canvas — Do not build this from scratch. Use tldraw. It's MIT licensed, has a React/Next.js package, gives you freehand drawing + text nodes + selection + serializable JSON state out of the box. This also solves your #6 question — tldraw natively supports both text and drawing on the same canvas, so mixed typing + handwriting is in scope if you use tldraw. Don't leave it for later.

On floating citation annotations — With tldraw, citations become custom shapes with (x, y) coordinates. Totally feasible.

On strokes staying as strokes — Right call. The OCR result only feeds the RAG buffer; it's not the authoritative content. This means the note has no searchable text representation (known limitation, fine for scope). For OCR debounce, you snapshot the canvas via canvas.toDataURL() and send that to Claude Vision. One nuance: you'd want to snapshot only the recent stroke bounding box, not the whole canvas, to keep the image small and focused.

Scope concern I want to flag: The drag-to-cite interaction (drag a card from the sidebar, drop it onto the canvas as a floating annotation) requires implementing a cross-boundary drag — the source is a React DOM element, the target is a tldraw canvas. This is solvable (tldraw exposes drop handlers) but it's non-trivial. Budget time for it.

Overall this is doable in 2 weeks of intense work if you commit to tldraw + Clerk. The RAG pipeline is the most novel part and deserves the most time. The canvas interaction is the most technically fiddly.

Two remaining questions before I write the TDD:

A. For the RAG sidebar, does it update silently in the background (new results just appear), or does it have a loading state the user sees each time a new query fires?

B. What does a dropped citation look like visually on the canvas? A small chip/tag (e.g., [Ch. 12, p. 214]) that the user can tap to expand? Or a larger sticky-note style card?

A. update silently
B. expandable chip sounds good.

toggle is def persistent

I do want to ask about the ocr implementation. Can you see how good of a fit claude OCR is for this by searching the internet? I remember doing some OCR impl before and a couple solutions were not good, and i ended up going with myscript, but that made us use its own built in canvas.
Web SearchClaude Vision API handwriting OCR accuracy 2025 2026
OUT
Web search results for query: "Claude Vision API handwriting OCR accuracy 2025 2026"

Links: [{"title":"DeepSeek OCR vs Claude Vision: A Deep Dive into ...","url":"https://sparkco.ai/blog/deepseek-ocr-vs-claude-vision-a-deep-dive-into-accuracy"},{"title":"OCR Benchmark: Text Extraction / Capture Accuracy","url":"https://aimultiple.com/ocr-accuracy"},{"title":"Teaching Claude a Skill: How I Built PDF Manipulation and Handwriting OCR as Reusable AI Skills (With a Web UI Too) | by Ranjith Gonugunta | Feb, 2026 | Medium","url":"https://medium.com/@learngvrk/teaching-claude-a-skill-how-i-built-pdf-manipulation-and-handwriting-ocr-as-reusable-ai-skills-2a5e3ae06dc4"},{"title":"Claude OCR vs. Graphlit: Raw LLM Calls vs. Document Infrastructure","url":"https://www.graphlit.com/vs/claude-ocr"},{"title":"Vision - Claude API Docs","url":"https://platform.claude.com/docs/en/build-with-claude/vision"},{"title":"ChatGPT, Claude and other AI models for OCR","url":"https://www.handwritingocr.com/blog/chatgpt-claude-and-ai-for-ocr"},{"title":"Claude-OCR - Poe","url":"https://poe.com/Claude-OCR"},{"title":"Claude Vision for Document Analysis - A Developer's Guide","url":"https://getstream.io/blog/anthropic-claude-visual-reasoning/"},{"title":"Best Handwriting OCR Tools in 2026: Comparison","url":"https://www.suparse.com/blog/best-handwriting-ocr-tools-2026"},{"title":"Claude Vision: Analyzing Images, Charts & Visual Documents | Learnia Blog","url":"https://learn-prompting.fr/blog/claude-vision-guide"}]

Based on the search results, here's what I found about Claude Vision API handwriting OCR accuracy in 2025-2026:

## Performance Benchmarks

Claude Vision achieves a Character Error Rate (CER) of 2.1% on printed texts, and performs admirably in complex handwriting recognition, with slightly higher acceptable CER thresholds.

In comparative benchmarks, Claude Sonnet 4.5 leads in printed media with the highest score. For handwriting specifically, according to AIMultiple's 2026 handwriting benchmark, Gemini 2.5 Pro achieved 93% handwriting accuracy, placing it just behind GPT-5 (95%) and among the top multimodal models tested, though Claude's specific handwriting accuracy percentage wasn't explicitly stated in these benchmarks.

## Practical Performance

Claude's vision capabilities match and sometimes exceed GPT-4's performance, and it particularly shines when handling complex document layouts and can maintain formatting better than most other LLMs. However, Claude shows exceptional accuracy with typed text but, like other LLMs, can struggle with particularly messy handwriting.

For complex documents with tables and mixed layouts, Claude often outperforms traditional OCR and even specialized document AI services.

## Summary

Claude Vision performs very well for typed and printed text, competitive performance on complex document layouts, but like other LLMs, shows limitations with highly complex or messy handwriting compared to models like GPT-5.


REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.
Web Searchbest handwriting OCR API for note taking app 2025 comparison
OUT
Web search results for query: "best handwriting OCR API for note taking app 2025 comparison"

Links: [{"title":"The Best Note-Taking Apps for iPad in 2025 | Handwriting OCR","url":"https://www.handwritingocr.com/blog/best-note-taking-apps-for-ipad-in-2025"},{"title":"5 Best Handwriting OCR Apps Tested & Reviewed (Free & Paid)","url":"https://machow2.com/best-handwriting-ocr-software/"},{"title":"What Apps Can Convert Handwriting to Text? 2025 Guide","url":"https://www.handwritingocr.com/handwriting-to-text/what-apps-can-convert-handwriting-to-text"},{"title":"12 Notable Note-Taking Apps That Convert Handwriting to Text - Antispace's Blog on Antispace","url":"https://blog.anti.space/note-taking-app-that-converts-handwriting-to-text"},{"title":"Note-Taking Apps with OCR: Enhance Your Productivity - Oneboard | Notes, simplified. | Notes-app","url":"https://oneboard.framer.website/blog/note-taking-apps-with-ocr-enhance-your-producti"},{"title":"8 Best Handwriting to Text Apps - EducationalAppStore","url":"https://www.educationalappstore.com/best-apps/best-handwriting-to-text-apps"},{"title":"What is the Best Handwriting to Text App?","url":"https://www.pen-to-print.com/handwriting-to-text/best-handwriting-to-text-app/"},{"title":"Handwriting to Text PenToPrint – Apps on Google Play","url":"https://play.google.com/store/apps/details/Pen_to_Print_Scan_handwriting_to_text?id=p2p.serendi.me.p2p&hl=en_GB"},{"title":"12 Notable Note-Taking Apps That Convert Handwriting to Text","url":"https://antispace.ghost.io/note-taking-app-that-converts-handwriting-to-text/"},{"title":"Capturing my handwriting in a searchable digital format - the long way round ~ colinramsay.co.uk","url":"https://colinramsay.co.uk/2025/06/23/handwriting-ocr.html"}]

Based on the search results, here's a comprehensive overview of the best handwriting OCR solutions for note-taking apps in 2025:

## Top Handwriting-to-Text Apps

### iPad-Focused Solutions

Nebo continues to set the standard for handwriting-to-text functionality in 2025, with exceptional accuracy and speed in converting handwritten notes into editable text. Its engine handles a wide range of writing styles, from careful cursive to quick scribbles.

GoodNotes is a strong contender with good handwriting recognition and excellent overall experience. Notes Writer Pro offers impressive AI-powered handwriting-to-text with advanced features.

### Mobile Apps

Google Keep has a surprisingly robust OCR feature and produced some of the best results when it comes to transcribing handwriting. It can extract text from photos, including handwriting, and make it editable while offering a quick and free solution.

Pen to Print is available on both the App Store and Google Play, with an advanced handwriting OCR engine offering unmatched accuracy for deciphering handwritten notes, messy handwriting, and cursive.

### Comprehensive Note-Taking Platforms

Evernote's robust OCR technology lets you scan handwritten notes and printed materials, making it a favorite among students and professionals.

OneNote's OCR functionality works remarkably well, enabling you to convert images of handwritten notes into editable text.

### Specialized OCR Solutions

For processing existing documents rather than real-time note-taking, HandwritingOCR.com uses AI models specifically trained on handwritten documents and typically achieves over 95% accuracy, compared to OneNote which might achieve 60% on cursive letters.

## Key Considerations

Your choice depends on whether you're taking live notes or digitizing existing documents, your accuracy requirements, and how much you value privacy, with mobile apps excelling at real-time conversion and web-based tools delivering higher accuracy on photos and scanned documents.


REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.
Web SearchMyScript iink SDK web canvas handwriting recognition API 2025
OUT
Web search results for query: "MyScript iink SDK web canvas handwriting recognition API 2025"

Links: [{"title":"Handwriting recognition & digital ink SDK | MyScript","url":"https://www.myscript.com/sdk/"},{"title":"MyScript - Handwriting technology & digital ink solutions | MyScript","url":"https://www.myscript.com/"},{"title":"MyScript iink SDK for web-based platform | MyScript Developer","url":"https://developer.myscript.com/docs/interactive-ink/2.0/web/overview/introduction/"},{"title":"MyScript Developer: Docs","url":"https://developer.myscript.com/"},{"title":"MyScript — Handwriting Recognition SDK and Digital Ink","url":"https://idp-software.com/vendors/myscript/"},{"title":"Get started | MyScript Developer","url":"https://developer.myscript.com/docs/interactive-ink/latest/web/iinkts/get-started/"},{"title":"About MyScript iink SDK","url":"https://developer.myscript.com/docs/interactive-ink"},{"title":"GitHub - MyScript/interactive-ink-additional-examples-android · GitHub","url":"https://github.com/MyScript/interactive-ink-additional-examples-android"},{"title":"GitHub - MyScript/iinkJS: :pencil2: iinkJS is the fastest way to integrate rich handwriting recognition features in your webapp.","url":"https://github.com/MyScript/iinkJS"},{"title":"About MyScript Interactive Ink SDK | MyScript Developer","url":"https://developer.myscript.com/docs/interactive-ink/1.4/overview/about/"}]

## Search Results for MyScript iink SDK Web Canvas Handwriting Recognition API

Here are the key findings from the web search:

### Overview
MyScript iink SDK web is a set of graphical libraries and server APIs that helps developers add digital ink capture and recognition in web interfaces.

### Web Implementation
iinkTS is the core of the MyScript browser technology and is a graphical library that makes the integration of handwriting recognition and interactive ink easier in any web application. The editing zone captures and renders the user input as the user writes on it, and depending on the editor, a canvas or a SVG element is created.

### Recent Developments (2025-2026)
The January 2026 release of iink SDK 4.3 marks the most significant architectural change in the product's recent history, with MyScript replacing its per-language model architecture with a unified encoder-decoder attention model that handles 7 Latin languages simultaneously. The practical results include 20% fewer English recognition errors, an 83% reduction in resource file size (from over 100 MB to a single 18 MB file), and 30% faster batch processing.

### Supported Content Types and Protocols
MyScript iink web only supports text and math content parts using the WebSocket protocol and text, math and diagram using the REST protocol.

### Language Support
The company supports 66 languages across its consumer products and has expanded language coverage with each SDK release.


REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.
Web Searchtldraw handwriting OCR integration canvas snapshot approach
OUT
Web search results for query: "tldraw handwriting OCR integration canvas snapshot approach"

Links: [{"title":"GitHub - tldraw/tldraw: very good whiteboard infinite canvas SDK · GitHub","url":"https://github.com/tldraw/tldraw"},{"title":"GitHub - daledesilva/obsidian_ink · GitHub","url":"https://github.com/daledesilva/obsidian_ink"},{"title":"The Accidental AI Canvas - with Steve Ruiz of tldraw","url":"https://www.latent.space/p/tldraw"},{"title":"tldraw: Infinite Canvas SDK for React","url":"https://tldraw.dev/"},{"title":"computer · tldraw | Visual computing on a canvas","url":"https://computer.tldraw.com/"},{"title":"tldraw/packages/tldraw/src/lib/utils/tldr/file.ts at main · tldraw/tldraw","url":"https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/utils/tldr/file.ts"},{"title":"tldraw examples","url":"https://examples.tldraw.com/"},{"title":"Save and load snapshots • tldraw Docs","url":"https://tldraw.dev/examples/snapshots"},{"title":"Release Notes — June 20th 2024 - tldraw","url":"https://tldraw.substack.com/p/release-notes-june-20th-2024"},{"title":"make real, the story so far - by Steve Ruiz - tldraw - Substack","url":"https://tldraw.substack.com/p/make-real-the-story-so-far"}]

Based on the search results, here's what I found about tldraw's handwriting and canvas capabilities:

## Canvas and Snapshot Approach

Tldraw allows you to save and load snapshots of the editor's contents, where the 'document' state includes the set of shapes and pages and images. The 'session' state includes the state of the editor like the current page, camera positions, and zoom level.

## Handwriting Support

Tldraw's flatten feature is especially useful for grouping handwriting together - you can flatten multiple shapes by right-clicking a selection and pressing Flatten.

## AI Integration and Canvas Capabilities

Tldraw features AI integrations with canvas primitives for building with LLMs and DOM canvas web rendering that supports anything the browser supports, including embedded websites. Because tldraw's canvas is made of regular HTML, it can support iframes directly.

## Vision-Based AI Features

The "make real" project demonstrates advanced AI integration: users can sketch a website and generate a working prototype, all without leaving the canvas. To enable GPT-4V to "see" what's in the canvas, the system provides the previous result's HTML together with a note to "fill in" areas with provided HTML.

However, the search results don't specifically detail a dedicated handwriting OCR integration feature. The platform supports handwriting as drawable content that can be grouped and managed, but specific OCR capabilities weren't mentioned in the available documentation.


REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.
Here's my assessment:

Claude Vision is fine for this use case, and here's why it's different from your past project.

Your previous OCR implementation presumably needed to display the converted text accurately to the user, so errors were visible and painful. In this app, the OCR result is never shown — it only feeds the RAG text buffer that drives vector search. A rough transcription that's 85% accurate is perfectly fine when it's just generating an embedding. The semantic search doesn't care if a word is slightly wrong.

So the accuracy bar is lower here than what burned you before.

On MyScript specifically: The Jan 2026 iink SDK 4.3 release is significantly improved (20% fewer errors, 83% smaller resource file, 30% faster). The REST protocol accepts raw stroke data — meaning theoretically you could capture strokes from tldraw and POST them to MyScript's endpoint without using their canvas. This would give you better real-time recognition than a snapshot approach. But it's a non-trivial integration (stroke format translation), and their pricing model adds a dependency. Not worth it for the scope here.

My recommendation: Stick with Claude Vision. The implementation is simple: on debounce, tldraw's editor.toSvg() / getSvgElement() exports the canvas, you crop to the bounding box of recent strokes, convert to base64, and POST to Claude Vision. Two week project, one AI vendor, no format translation.

The one real risk is cost — Claude Vision on every debounce cycle during a lecture could add up. Mitigation: set a minimum debounce of ~3 seconds and only send when new strokes exist since the last query.

Ready to write the TDD now. I have everything I need. Give me a moment.

Sources:

DeepSeek OCR vs Claude Vision accuracy
Best Handwriting OCR Tools 2026
MyScript iink SDK for web
tldraw canvas SDK
ChatGPT, Claude and other AI models for OCR
Okay i'll trust you for now. however i want to make the app resilient to OCR vendor changes in case claude OCR doesn't cut it. please make a note that the architecture should be designed in a way that the OCR service can be easily swappable with a new implementation
Noted — the OCR layer will be defined as a swappable service interface (adapter pattern) on the backend. Concrete implementations are injected, so swapping Claude for MyScript, Google Vision, or anything else touches one file. I'll make this explicit in the architecture section.

Writing the TDD now.

Write TDD.md
334 lines
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
| Frontend | Next.js (App Router) | React server + client components |
| Backend | Fastify | Lightweight, fast, plugin-based |
| Database | MongoDB Atlas | NoSQL for notes/strokes/metadata |
| Vector Search | MongoDB Atlas Vector Search | Collocated with doc DB, no separate vector store |
| Auth | Clerk | Drop-in React components + JWT middleware |
| Canvas | tldraw | Freehand drawing + text on same canvas, serializable JSON state |
| Embeddings | OpenAI `text-embedding-3-small` | Consistent across ingest and query |
| OCR | Claude Vision API (swappable — see §6.3) | Snapshot-based, drives RAG only |
| Citation Generation | Claude API | Relevance summary per retrieved chunk |

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
  fileUrl: string,         // blob storage URL (e.g. S3 or similar)
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
  pageNumber: number,
  chunkIndex: number,
  embedding: [number],     // 1536-dim vector (text-embedding-3-small)
  metadata: {
    filename: string,
    pageNumber: number,
    sourceId: string
  }
}
```

MongoDB Atlas Vector Search index is defined on the `embedding` field, with `sourceId` as a pre-filter field.

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
    pageNumber: number,
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
3. Backend stores file (blob storage), creates Source document with `status: 'processing'`
4. Backend triggers ingestion pipeline:
   - Parse PDF text by page (e.g. `pdf-parse`)
   - Chunk each page into ~500-token segments with 100-token overlap (recursive paragraph splitter)
   - For each chunk: call OpenAI `text-embedding-3-small` → get 1536-dim vector
   - Insert DocumentChunk documents with embedding + metadata
5. Source status updated to `ready`
6. Frontend polls or receives a status update (simple polling on upload is fine for v1)

### 5.2 OCR + RAG Query (Core Real-Time Loop)
This loop fires continuously during note-taking.

1. **Stroke Debounce**: tldraw fires an `onChange` event on every stroke. Frontend debounces 3 seconds after the last stroke ends. Only fires if new strokes exist since the last query.
2. **Canvas Snapshot**: Frontend captures the bounding box of new strokes since the last query using tldraw's store APIs. Exports that region as a base64 PNG.
3. **OCR Request**: `POST /ocr` with `{ imageBase64, mimeType }` → backend OCR service returns transcribed text string.
4. **Text Buffer**: OCR result is appended to a rolling text buffer (last ~5 OCR results, ~300 tokens). This gives the RAG query context across recent writing, not just the latest stroke.
5. **RAG Query**: `POST /rag/query` with `{ text: buffer, sourceIds: activeSourceIds }`:
   - Embed query text with OpenAI `text-embedding-3-small`
   - Run MongoDB Atlas Vector Search with pre-filter `{ sourceId: { $in: activeSourceIds } }`
   - Retrieve top-5 chunks with scores
   - For each chunk: call Claude API to generate a one-sentence relevance summary explaining *why* it matched
   - Return chunks with: sourceId, sourceName, pageNumber, excerpt, matchScore, summary
6. **Sidebar Update**: Frontend silently replaces sidebar contents with new results. No loading spinner, no animation flash.

### 5.3 Citation Drag-and-Drop
1. User sees a relevant passage in the RAG sidebar
2. User drags the passage card (HTML drag event, `dragstart` sets drag data payload: chunkId, sourceId, sourceName, pageNumber, excerpt, fullText, matchScore)
3. tldraw canvas registers as a drop target (`onDrop` handler)
4. On drop: convert browser drop coordinates to tldraw canvas space using `editor.screenToPage()`
5. Create a CitationChip custom shape at those coordinates with the drag payload as props
6. CitationChip renders as a small collapsed chip (e.g. `[Ch. 12, p. 214]`)
7. On click: chip expands to show full excerpt + match score + source name
8. Canvas state auto-saves to DB (see §5.4)

### 5.4 Canvas State Persistence
- tldraw store emits change events on every edit
- Frontend debounces 5 seconds → `PATCH /notes/:id` with serialized `canvasState`
- On note open: load `canvasState` from DB → `editor.store.loadSnapshot(canvasState)`
- `activeSourceIds` is also saved on the same PATCH call when toggled

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

POST   /sources              // multipart PDF upload
GET    /sources?scope=note:id | notebook:id
DELETE /sources/:id

POST   /ocr                  // { imageBase64, mimeType } → { text }
POST   /rag/query            // { text, sourceIds } → { chunks[] }
```

### 6.2 Ingest Pipeline (Internal)
Triggered server-side after a source upload completes. Not a user-facing endpoint. Can be run as an async background job (simple async function in v1; can be moved to a queue later).

### 6.3 OCR Service — Adapter Pattern
**The OCR implementation is intentionally abstracted.** Claude Vision is the initial implementation but the architecture must make it trivially swappable.

```typescript
// Interface — backend/src/services/ocr/OcrService.ts
interface OcrService {
  transcribe(imageBase64: string, mimeType: string): Promise<string>
}

// Implementation — backend/src/services/ocr/ClaudeOcrService.ts
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
- **Right (320px)**: RAG sidebar — "related passages" with match score, source name, page number, excerpt, relevance summary. Cards are draggable.

### 7.2 tldraw Integration
- Use `@tldraw/tldraw` React component
- Define a `CitationChipShapeUtil` extending `BaseBoxShapeUtil` for the custom citation shape
- Canvas state persisted via `editor.store.getSnapshot()` / `editor.store.loadSnapshot()`
- Register a `TLDropTargetEvent` on the tldraw editor element to handle citation drops
- Use `editor.toSvg()` with a shape filter to snapshot only the recent stroke region for OCR

### 7.3 Auth
Clerk's `<ClerkProvider>` wraps the app. `middleware.ts` protects all routes except `/sign-in` and `/sign-up`. Backend validates Clerk JWT on every request using the Fastify Clerk plugin.

### 7.4 State Management
- Server state (notes, sources, RAG results): React Query (TanStack Query) — handles caching, background refetch, optimistic updates
- Canvas state: owned entirely by tldraw, synced to server on debounce
- Sidebar state: local React state, replaced on each RAG response

---

## 8. Design Decisions Log

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

---

## 9. Known Limitations (v1)

- **Handwritten notes are not text-searchable** — strokes are stored but not indexed as text. Search within your own notes is not possible.
- **OCR errors affect RAG quality invisibly** — if Claude Vision misreads a word, the embedding and retrieval will be slightly off. Acceptable since OCR output is not shown.
- **No export** — notes cannot be exported to PDF, Markdown, or any format in v1.
- **No collaboration** — notes are strictly private, single-user.
- **PDF only** — only PDF source documents are supported. No DOCX, slides, or web pages.

---

## 10. Out of Scope (v1)

- Real-time collaboration / shared notebooks
- Mobile or native tablet app
- Audio recording and transcription
- Note export
- Full-text search within notes
- Image sources (only PDF text extraction)
- Undo history across sessions (tldraw provides in-session undo only)
TDD is written. Here's a summary of what it covers:

Sections:

Overview — concept and differentiators
Tech Stack — full table with every technology and its role
Data Models — Notebook, Note, Source, DocumentChunk, and Citation (as tldraw shape, not a DB record)
System Architecture — ASCII diagram of the three-tier system
Key Flows — step-by-step for (1) document ingestion, (2) OCR + RAG real-time loop, (3) citation drag-and-drop, (4) canvas persistence
Backend Architecture — full route structure + the OCR adapter pattern with TypeScript interface
Frontend Architecture — layout, tldraw integration specifics, auth, state management
Design Decisions Log — every decision we made, with rationale, in a table
Known Limitations — honest list of v1 gaps
Out of Scope — explicit boundary for the agent
The OCR adapter pattern is documented in §6.3 with the TypeScript interface. Swapping implementations requires creating one new class and changing one line at startup.

Want me to now write the completion criteria / acceptance checklist for the coding agent?

TDD.md
what known limitations should we address in v1? Some ideas
- search notes: store which part of the doc was snapshotted for OCR along with the resulting text. Add a search that will match to the OCR'd text and move to the part that was snapshotted after serach. 
- export seems like it would be simple to implement
- Is adding other sources types than pdf that difficult?
Good instincts. Let me give honest effort assessments for each:

1. Search via stored OCR snapshots — Include in v1

This is clever and the marginal cost is low since OCR is already running. The change is:

Persist each OCR result: { noteId, text, bbox: { x, y, width, height }, createdAt } in a new ocr_results collection
Put a MongoDB text index on the text field
On search match: frontend calls editor.zoomToBounds(bbox) — tldraw has this built in
One thing to handle: the same region gets OCR'd on every debounce, so you need to upsert by bounding box rather than insert. Use the bbox coordinates as a composite key.
Effort: Low-medium. Data model is small, MongoDB text search is turnkey, tldraw camera navigation is one API call.

2. Export — Include in v1

tldraw already does this. editor.toSvg() exports the entire canvas (strokes + citation chips) as SVG. From there:

PNG: canvas.toDataURL() — trivial
PDF: one library (jspdf can embed SVG, or use svg2pdf.js) — an afternoon of work
The handwriting actually exports beautifully as SVG since strokes are vector paths. Effort: Low.

3. Additional source types — Partial yes

It depends on the type:

Source type	Effort	Notes
Plain text / Markdown	Trivial	No parser needed
DOCX	Low	mammoth.js extracts clean text + structure
Web URL	Medium	cheerio to parse, but no natural "page number" — need a different citation anchor (section heading or paragraph index)
PPTX	Medium-high	Parsers are flaky; skip for v1
Images of text	Low	Already have Claude Vision in the stack — send image directly to existing OCR endpoint
The one design issue with non-PDF sources is the citation anchor. Currently citations reference pageNumber, which is PDF-specific. You'd need to generalize it to a locationLabel field (e.g., "Page 12", "Slide 7", "Section 3.2", "Paragraph 14").

My recommendation: add plain text, Markdown, and images in v1 (near zero work). Add DOCX if you want (one library). Skip PPTX and web URLs — they're rabbit holes.

Revised Known Limitations for v1:

Things to keep as known limitations:

Handwriting OCR search (if you include it, it's approximate — messy handwriting may not surface in search)
No real-time collaboration
No PPTX or web URL sources
Want me to update the TDD to reflect these decisions?

Sounds good. add a note that adding new source types should be simple to add and decoupled similar to the ocr. so taht adding a new source type should be as simple as making and registering a new subclass. you can updat ehte tdd
Read TDD.md (from line 201)
Edit TDD.md
Added 49 lines
Now update the data model for locationLabel, the Known Limitations, Out of Scope, and add the new features to the relevant sections:

Edit TDD.md
Modified
Edit TDD.md
Modified
Now update the Known Limitations and Out of Scope sections, and add a new §5.5 for OCR-based search and §5.6 for export:

Edit TDD.md
Added 33 lines
Edit TDD.md
Removed 2 lines
Also update the design decisions table and the route structure to reflect these additions:

Edit TDD.md
Added 2 lines
Edit TDD.md
Added 4 lines
Done. Now addressing your message — adding the OCR debug flag:

Edit TDD.md
Added 1 line
Edit TDD.md
Modified
All updates done. Summary of what changed:

§3 — pageNumber replaced with locationLabel: string everywhere (DocumentChunk and CitationChip)
§5.5 — New section: handwriting search via ocr_results collection + editor.zoomToBounds()
§5.6 — New section: export via tldraw's toSvg() → PNG/SVG/PDF
§6.2 → §6.3 — New source parser adapter pattern with SourceParser interface, ParserRegistry, and concrete implementations for PDF/DOCX/Markdown/Image
§6.4 — OCR adapter (renumbered from §6.3)
Routes — Added GET /notes/:id/ocr-search and GET /notes/:id/export
§8 — New design decision rows for parser registry, locationLabel, search, export, and OCR debug mode
§9 — Known limitations updated (removed export and PDF-only, added nuanced caveats)
§10 — Out of scope tightened to just web URLs, PPTX, and partial canvas export
did you add the dev feature
Yes — in two places:

§8 Design Decisions table — documents the flag name (NEXT_PUBLIC_OCR_DEBUG=true), behavior (fixed overlay bottom-left of canvas showing the latest OCR transcript), and intent (dev-only, not exposed to users)

§9 Known Limitations — the OCR accuracy caveat now points developers to the flag

It's not a full section of its own since it's a small dev utility. If you want it more prominent — e.g. a dedicated "Developer Tools" section in the frontend architecture — I can add that. Otherwise the design decisions table entry is enough for the coding agent to know what to build.

can yo uadd a section for required env vars? so secrets and api keys
Read TDD.md (lines 2-11)
Also noticed the TDD never settled on file storage (the fileUrl on Source just says "blob storage URL"). I'll resolve that here too — Cloudflare R2 is the right call for a 2-week project (S3-compatible API, generous free tier, zero egress costs).

Edit TDD.md
Added 32 lines
Also update the section numbers that shifted:

Edit TDD.md
Added 1 line
Edit TDD.md
Edit failed
Grep "Known Limitations"
2 lines of output
Grep "Known Limitations" (in /Users/naasanov/Projects/Code/footnote/docs/TDD.md)
1 line of output
Read TDD.md (lines 435-454)
Edit TDD.md
Removed 1 line
Edit TDD.md
Modified
Done. §9 now has three subsections:

9.1 Frontend env vars (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_OCR_DEBUG)
9.2 Backend env vars (Clerk, MongoDB, OpenAI, Anthropic, Cloudflare R2, PORT)
9.3 File storage decision — Cloudflare R2, S3-compatible via @aws-sdk/client-s3, swappable by changing env vars and endpoint config only
What about GridFS for file storage? Keep it in Mongo?
Honest take: GridFS is the better call for this project timeline.

The only reason I defaulted to R2 is that it's the "correct" production pattern — but for this scope it's unnecessary overhead. Here's the actual tradeoff:

GridFS wins because:

Zero extra service to set up, zero extra credentials
Removes 5 env vars
Files are ingested once by the backend and never need a public CDN URL
Atlas free tier handles it fine at semester-project scale
The one thing you lose: a fileUrl you can serve directly to the browser. If you want users to be able to open/preview the original PDF, you'd need a backend proxy route (GET /sources/:id/file streams from GridFS). That's a small addition but worth knowing about.

If this becomes a real product you'd migrate to R2/S3 — but that's a one-day migration, not a reason to complicate the build now.

I'll update the TDD to swap R2 for GridFS:

Edit TDD.md
Removed 1 line
Also update the Source data model to reflect gridfsFileId:

Edit TDD.md
Modified
And add the file serve route:

Edit TDD.md
Added 1 line
Done. Changes:

R2 env vars removed — backend env is now just Clerk, MongoDB, OpenAI, Anthropic, and PORT
source.fileUrl → source.gridfsFileId: ObjectId
§9.3 explains the decision and the migration path if the project grows
GET /sources/:id/file added to the route list for streaming file previews
how do you feel about a notion type nested note strucutre, where users can nest as much as they want, and parent pages also act as regular notes. is that overkill?
Overkill for this timeline, and here's the specific reason: source scoping.

With a flat Notebook > Note hierarchy, the rule is simple — a source is scoped to a note or its parent notebook. Two hops max.

With infinite nesting, to build the list of sources available to a given note you have to walk the entire ancestor chain. In MongoDB that means $graphLookup or application-level recursal — neither is fun. Every RAG query has to first resolve which sources are in scope, which means that traversal runs constantly.

The UI also gets harder — a deeply nested tree needs collapse/expand state, indentation levels, drag-to-reorder between levels. That's real work.

The honest case for it: Notion-style nesting is a genuinely better mental model for users. No distinction between "container" and "content" is cleaner. And for some users, Course > Unit > Week > Lecture is a natural structure.

My recommendation: Split the difference. Use a self-referential model (parentId: ObjectId | null) which is the same data model as infinite nesting, but enforce a max depth of 3 at the API level. This gives you:

Flexible enough for any realistic lecture note structure (Course > Week > Note, or just Notebook > Note if they don't need more)
Every page is a note (no container/content distinction)
Source scoping traversal is at most 3 hops — trivial
The UI tree never gets pathologically deep
Data model is one field change — parentId instead of notebookId
The depth limit is one validation line in the API. If you ever want to remove it, you remove one line. It's not a commitment.

Want me to update the data model in the TDD to reflect this?

Nah lets ust keep it as is for now. Now i want to talk about code impl a little bit, because i care about code quality and system design because it makes future changes with AI cause less issues. For both frontend and backend i want to enforce a layer based design. what would you split up the layers as for both frontend nad backend?
Good instinct — this is exactly what makes AI-assisted changes reliable. When every layer has one job, a future agent can change the RAG query logic without accidentally touching HTTP parsing, or restyle a component without touching data fetching.

Backend (Fastify)

Four layers, strict top-to-bottom dependency:


Routes → Services → Repositories → MongoDB
              ↓
          Adapters (OCR, OpenAI, Claude, GridFS)
Routes — HTTP only. Parse request, validate input (with zod), call a service, return response. No business logic, no MongoDB, no direct adapter calls.
Services — Business logic and orchestration. A service calls repositories and adapters, but knows nothing about HTTP. req and res never enter a service. This is where the ingest pipeline, RAG query flow, and OCR debounce logic live.
Repositories — All MongoDB queries live here and nowhere else. Returns typed domain objects. Services never write a collection.find() directly.
Adapters — External service calls: OcrService, EmbeddingService, CitationService, ParserRegistry. Already adapter-patterned. Services call these through interfaces, never the concrete classes.
Config — One module reads and validates all env vars (via zod). Nothing else touches process.env. If a var is missing at startup, the server refuses to start with a clear error.
Frontend (Next.js)

Four layers:


Pages → Feature Components → Hooks → API Client
              ↓
        UI Components
API Client — One file (or folder) per resource: notes.ts, sources.ts, rag.ts. Plain async functions that call the backend. Typed request and response shapes. Nothing else constructs a URL or calls fetch directly.
Hooks — Encapsulate all stateful logic. React Query calls go here, not in components. Examples: useNote(id), useRagSidebar(noteId, activeSourceIds), useCanvas(editor). A hook is the only thing that calls the API client.
Feature Components — Components that know about the domain: NoteCanvas, RagSidebar, SourceList, CitationChip. They call hooks. They render UI components. They don't call fetch.
UI Components — Purely presentational: Button, Card, Modal, Tooltip. No domain knowledge, no hooks, no API calls. Reusable anywhere.
Pages — Thin. Compose feature components, handle routing, pass route params down. As little logic as possible.
The rules that matter most:

Rule	Why
Routes never touch MongoDB	Keeps HTTP and data concerns separate
Services never see req/res	Services stay testable without spinning up HTTP
Repositories are the only MongoDB writers	One place to audit all queries
Components never call fetch	Hooks are the boundary — components stay pure UI
Hooks never construct URLs	API client owns the contract with the backend
Only config reads process.env	Env changes touch one file
Want me to add a section to the TDD documenting this, including the folder structure for each layer?

yeah add that in
Grep "^## 8\." (in /Users/naasanov/Projects/Code/footnote/docs/TDD.md)
1 line of output
pause. should we use mongoose as our repositories, or just mongo + zod
Good pause. My recommendation: raw MongoDB driver + Zod, and here's why for this specific project:

The case against Mongoose here:

Mongoose's main value is giving you structure when you don't have a repository pattern — schema enforcement, a query API, middleware hooks. But you're already getting all of that from other things in the stack:

Structure → repositories are the abstraction layer. Mongoose on top is a redundant abstraction.
Schema enforcement → Zod at the repository boundary, which you're already using for route validation and env vars. One tool, consistent.
updatedAt auto-update → one helper function, not a reason to add an ODM.
TypeScript types → Zod's z.infer<> gives you the types for free from the same schema. Mongoose's TS support has improved but still has rough edges (_id typing, .lean() return types, etc.).
The practical clincher: MongoDB Atlas Vector Search ($vectorSearch) has limited Mongoose support — you end up dropping to raw queries anyway. With the raw driver you're writing the same query language throughout, no mental switching.

What raw driver + Zod looks like in a repository:


// domain/schemas.ts
export const NoteSchema = z.object({
  _id: z.instanceof(ObjectId),
  notebookId: z.instanceof(ObjectId),
  userId: z.string(),
  title: z.string(),
  canvasState: z.record(z.unknown()),
  activeSourceIds: z.array(z.instanceof(ObjectId)),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type Note = z.infer<typeof NoteSchema>

// repositories/note.repository.ts
export class NoteRepository {
  private col: Collection<Note>

  async findById(id: ObjectId, userId: string): Promise<Note | null> {
    const doc = await this.col.findOne({ _id: id, userId })
    return doc ? NoteSchema.parse(doc) : null
  }
}
Zod's .parse() at the DB boundary means if your data is malformed, you find out immediately with a clear error — not somewhere downstream.

The only thing Mongoose gives you that this doesn't: population (virtual joins). You won't need it — your repositories handle any cross-collection lookups explicitly, which is clearer anyway.

Shall I continue adding the layer/folder structure section with this in mind?

sounds good. keep adding that and take a note of mongo + zod
Read TDD.md (lines 376-385)
Edit TDD.md
Added 142 lines
Now fix the duplicate section number and add the MongoDB + Zod decision to the table:

Edit TDD.md
Modified
Grep "^## 9\. Environment|^## 10\. Known|^## 11\. Out" (in /Users/naasanov/Projects/Code/footnote/docs/TDD.md)
3 lines of output
Edit TDD.md
Modified
Edit TDD.md
Modified
Edit TDD.md
Modified
Now add the MongoDB + Zod decision to the table and save the memory:

Edit TDD.md
Added 1 line
Now save the memory:

Read MEMORY.md
Write project_decisions.md
10 lines
---
name: Footnote project decisions
description: Key architectural and technology decisions made for the Footnote project
type: project
---

- **No Mongoose** — raw MongoDB driver + Zod only. Repository pattern already provides the abstraction Mongoose adds. Zod schemas in `domain/schemas.ts` are the single source of truth for types and runtime validation. `.parse()` is called at every repository read boundary.
- **Why:** Mongoose adds a redundant abstraction on top of the repository layer, has TS rough edges, and complicates `$vectorSearch` queries which need raw driver access anyway.
- **How to apply:** Never suggest Mongoose. If touching data access, use `mongodb` npm package directly with typed collections (`Collection<Note>`) and Zod parse at the boundary.
Write MEMORY.md
4 lines
# Memory Index

- [Footnote project decisions](project_decisions.md) — No Mongoose; raw MongoDB driver + Zod; repo pattern owns all queries
Done. What was added:

§8 — Full code architecture section with layering rules table, backend folder structure with annotations, and frontend folder structure with annotations. Key callouts like "NoteCanvas renders <Tldraw> and nothing else" and "lib/api/ is the only place URLs are constructed" are explicit so a coding agent doesn't have to infer them.
§9 Design Decisions — MongoDB + Zod row added
Sections renumbered (9→10 env vars, 10→11 limitations, 11→12 out of scope)
Memory saved so future conversations won't suggest Mongoose
lets flesh out canvas capabilities (highlight, colors, etc.). What should we include? what comes with our lib?
tldraw is generous out of the box. Let me break down what you get for free vs. what needs thought:

Comes with tldraw, directly useful:

Tool/Feature	Notes
Freehand pen	Primary input. Variable stroke width, pressure-sensitive on supported devices
Highlighter	Built-in — semi-transparent strokes, perfect for emphasizing notes
Eraser	Point eraser and stroke eraser both included
Select + move	Multi-select, resize, rotate
Text tool	Type directly on canvas, supports font size and alignment
Arrow tool	Useful for connecting concepts and drawing diagrams
Undo/redo	In-session, keyboard shortcuts included
Color palette	~12 preset colors out of the box
Stroke width	S/M/L/XL, configurable
Opacity	Per-shape opacity control
Pan + zoom	Infinite canvas, pinch-to-zoom, scroll-to-zoom
Export	editor.toSvg() / editor.toImage() — already in our export plan
Comes with tldraw, probably skip for this app:

Shape tools (rectangle, ellipse, triangle) — debatable, students do draw diagrams
Sticky notes — redundant with the text tool
Frames — for grouping/sectioning, not needed for lecture notes
Fill patterns — noise for this use case
Line/polyline tool — arrow covers it
The main decision: how much do you customize the toolbar?

tldraw lets you pass a custom components prop to replace or hide any part of the UI. Two approaches:

Option A — Minimal curation: Hide the tools that don't belong (frames, fills, sticky notes), keep everything else. Faster to build, more familiar to anyone who's used tldraw-based apps.

Option B — Purpose-built toolbar: Strip it down to exactly what a student needs — pen, highlighter, eraser, select, text, arrow, colors, stroke width. Cleaner UX, more opinionated, slightly more work.

For a 2-week timeline I'd lean Option A with light curation. Option B is a polish pass, not a core feature.

One thing worth deciding now — color palette:

tldraw's default colors are fine but generic. For a note-taking app, a curated set makes the product feel intentional:

Black, dark grey (primary writing)
Red, blue, green (annotation colors)
Yellow, cyan (highlighter colors — pair with the highlighter tool's transparency)
Purple (optional)
You'd pass a custom color palette via tldraw's theme overrides. Small effort, high visual impact.

What we need to build custom (not in tldraw):

CitationChipShape — already planned, custom shape util
The drop target handler for citation drag-and-drop
The bounding box snapshot logic for OCR
That's it. Everything else is configuration, not construction.

Want to decide on Option A vs B and the color palette, then I'll add a canvas capabilities section to the TDD?

yeah your recommendations are fine. add it to the tdd
Grep "^### 7\." (in /Users/naasanov/Projects/Code/footnote/docs/TDD.md)
4 lines of output
Read TDD.md (lines 363-377)
Edit TDD.md
Added 28 lines
Now renumber 7.3 and 7.4:

Edit TDD.md
Modified
Edit TDD.md
Modified
Done. §7.3 now covers enabled tools, disabled tools, color palette, stroke widths, and the custom CitationChipShape. Anything else to flesh out before we move to the completion criteria list?

TDD.md
do an audit for me. Look carefully over the doc and report any gaps you find. We should be thorough about this
Read TDD.md
Thorough read done. Here's what I found, grouped by severity:

Critical — will cause implementation ambiguity or bugs

pageNumber vs locationLabel inconsistency — §5.2 step 5 returns pageNumber in the RAG response. §5.3 step 2 puts pageNumber in the drag payload. Both should be locationLabel — this was a decided change that didn't propagate everywhere.

"blob storage" in §5.1 step 3 — says "backend stores file (blob storage)". Should say GridFS. Contradicts the decision in §10.

Export: client-side vs server-side conflict — §5.6 describes client-side export using tldraw's APIs. §6.1 routes lists GET /notes/:id/export as a backend route. These contradict each other. Needs a decision: client-side (no backend route needed) or server-side (Puppeteer rendering).

activeSourceIds initialization undefined — when a note is created, what sources are pre-toggled on? All notebook-scoped sources automatically? Empty? And when a new notebook-scoped source is uploaded mid-course, does it automatically appear in activeSourceIds for all notes in that notebook, or does the user have to manually toggle it on? This interaction is never specified.

Text buffer lives nowhere in the state management section — §5.2 describes a rolling frontend text buffer of ~5 OCR results, but §7.5 doesn't mention it. A coding agent will invent its own solution.

OCR/RAG short-circuit behavior undefined — what happens when: (a) activeSourceIds is empty, (b) OCR returns empty string, (c) the user is typing but hasn't uploaded any sources yet? The loop should short-circuit but it's never stated.

Important — gaps that will produce incomplete implementation

CSS/styling approach never decided — significant frontend decision with no mention anywhere. Tailwind? shadcn/ui? CSS Modules? The coding agent will guess.

MongoDB indexes not specified — only the vector search index is mentioned. Missing: userId on notebooks, compound (notebookId, userId) on notes, (scope.id, scope.type) on sources, compound (noteId, bbox) on ocr_results for upsert, text index on ocr_results.text.

Source deletion cascade — what happens when a user deletes a source? The DocumentChunks for that source should be deleted. Any CitationChips on the canvas referencing that sourceId become orphaned. Neither is addressed.

Error handling strategy — nothing in the doc about how errors are caught and formatted. Backend: Fastify error handler plugin? Frontend: React error boundaries + React Query error states? A coding agent needs this to avoid inconsistent error handling everywhere.

Monorepo tooling not mentioned — §8 folder structure clearly implies apps/api + apps/web but never states the monorepo tool (Turborepo, pnpm workspaces, npm workspaces).

TypeScript never explicitly stated — implied by every code sample and the Zod usage, but never declared in the tech stack.

Subsection numbering under §10 — the env vars section is §10 but its subsections are numbered §9.1, §9.2, §9.3.

Path inconsistency in adapter code examples — §6.3 and §6.4 comments say backend/src/services/... but §8.2 folder structure uses apps/api/src/adapters/....

Tablet/iPad responsiveness unaddressed — the project proposal and design mock show a tablet UI. The three-panel layout will break on smaller screens. Even if it's desktop-only for v1 that should be explicitly stated.

Minor — incomplete coverage

CORS not mentioned — backend needs to allow requests from the frontend origin. Fastify has @fastify/cors but it's not listed anywhere.

PATCH /sources/:id missing — no route exists for renaming a source. The route list only has POST, GET, DELETE.

RAG sidebar empty state not described — what does the sidebar show before any RAG results exist (fresh note, no writing yet)?

Ingest pipeline trigger ambiguity — §6.2 says "triggered server-side after upload" but doesn't say whether the upload route awaits it (blocking) or fires it async. If async, the upload returns immediately and the frontend needs to know that.

OCR bbox upsert key is fragile — §5.5 says "upsert by (noteId, bbox)" but bbox coordinates will shift slightly for the same region as the user moves shapes. A floating point coordinate comparison will cause duplicate inserts instead of upserts.

Tech stack table still references §6.3 for OCR — it says "swappable — see §6.3" but after renumbering the OCR adapter is now §6.4.

That's 21 gaps. Want me to fix the clear-cut ones (inconsistencies, numbering, wrong section refs) now and then we discuss the decisions that still need your input (styling, export location, activeSourceIds initialization, error handling)?

i'll say "cool" for anything that i agree with you on and you should make the necessary chagne
1. cool
2. cool
3. good point. whatever you decide
4. When a note is created it inherits the source toggles of the notebook. If the user uploads a new source to a notebook with existing notes, its auto toggled on for all of them. If its a new source to a singular note it just applies to the singular note, as expected
5. cool yeah add it 
6. in all of these cases no rag search sould be done
7. Lets have a denser convo about this after. put a pin in that and bring it up after you make the initial changes
8. cool
9. What do yoou think? Should we keep the citation chips and make a note that its source was deleted or should we warn the user all citation chips will be deleted?
10. I'll say simpler is better while still keeping layer separation for the most part. usually for backend i create custom exceptions that get thrown in teh service and bubble up, getting mapped to an exception by a plugin. if this is a common pattern in fastify go for it. What do you think should be done for frontend?
11. Interesting, gimme some options
12. cool
13. cool fix that
14. cool fix that
15. yeah lets make sure its responsive. collapsible panels as well if that wasnt' mentioned
16. cool
17. cool add it
18. you decide
19.  you decide
20. fix that
21. okay fix that.
Quick takes on the three discussion items before I make all the changes:

#9 Source deletion — Recommend keeping orphaned chips but rendering them degraded (greyed out, "Source deleted" label instead of excerpt). Reason: scanning all canvas states to count chips before showing a warning is expensive (citations are embedded in tldraw JSON, not a DB collection). The chip renderer just checks if its sourceId still exists in the available sources list — if not, it renders orphaned. User can select and delete it themselves. Clean, no expensive pre-scan required.

#10 Frontend error handling — React Query handles async errors naturally on queries/mutations. For transient errors that need user feedback (save failed, OCR failed, upload failed) use Sonner — it's the lightest toast library, zero config, works well with Next.js App Router. Error boundaries only for catastrophic canvas crashes. Loading/error states live co-located with the component, not centralized.

#11 Monorepo options:

pnpm workspaces only — just a pnpm-workspace.yaml, no extra tooling. Simplest, fast installs, good enough for a solo sprint
Turborepo + pnpm — adds build caching and parallel task running. Genuine value if you're running dev, build, lint across both apps constantly. ~30min setup overhead
npm workspaces — similar to pnpm, slower installs, no real advantage
My recommendation: pnpm workspaces only. Turborepo is worth it in a team CI context, not for a 2-week solo build.

Making all the changes now:

Edit TDD.md
Added 2 lines
Edit TDD.md
Added 6 lines
Edit TDD.md
Modified
Edit TDD.md
Added 1 line
Edit TDD.md
Added 6 lines
Edit TDD.md
Modified
Edit TDD.md
Added 2 lines
Edit TDD.md
Modified
Edit TDD.md
Modified
Now fix the routes section — remove export route, add PATCH /sources/:id, add CORS note:

Edit TDD.md
Added 2 lines
Now fix the ingest pipeline section, fix the path inconsistencies, and add error handling:

Edit TDD.md
Added 21 lines
9. i like it sounds good
10. Cool i like reqct query. and sononer soud s good
11. yeah lets stick with pnpm
Good — 9, 10, 11 confirmed. Continuing with the remaining fixes:

Edit TDD.md
Modified
Edit TDD.md
Modified
Edit TDD.md
Modified
Now fix §7.1 for responsive design + collapsible panels, and add empty state to sidebar:

Edit TDD.md
Added 9 lines
Now add text buffer and orphaned chip state to §7.5 state management:

Edit TDD.md
Added 3 lines
Now add MongoDB indexes and remaining design decision rows, and fix the §10 subsection numbering:

Edit TDD.md
Added 9 lines
Edit TDD.md
Added 6 lines
Now fix the §10 subsection numbering:

Edit TDD.md
Modified
Edit TDD.md
Modified
Edit TDD.md
Modified
All 21 fixes done. Full summary of what changed:

§2 Tech Stack — Added TypeScript and pnpm workspaces rows; fixed §6.3→§6.4 OCR reference
§3.3 Note — Added activeSourceIds initialization rules (inherits notebook sources, auto-updates on new uploads)
§5.1 Ingestion — Fixed "blob storage"→GridFS; clarified 202 async response; added activeSourceIds update step; added partial failure cleanup
§5.2 OCR+RAG — Added short-circuit conditions block; fixed pageNumber→locationLabel; documented text buffer location (useRef in useRagSidebar)
§5.3 Drag-and-Drop — Fixed pageNumber→locationLabel in drag payload; added orphaned citation behavior
§5.5 OCR Search — Fixed bbox upsert key → stable tldraw shape IDs
§5.6 Export — Clarified client-side only; removed backend route
§6.1 Routes — Removed export route; added PATCH /sources/:id; added CORS note; documented source delete cascade
§6.2 Ingest — Clarified async fire-and-forget with partial failure cleanup
§6.3/§6.4 — Fixed path references to apps/api/src/adapters/...
§6.5 — New error handling section (custom exceptions + Fastify handler + React Query + Sonner)
§7.1 Layout — Added collapsible panels, responsive breakpoints, sidebar empty state
§7.5 State — Added OCR text buffer, panel state, orphaned citation detection
§3.5 DocumentChunk — Added MongoDB indexes table
§9 Design Decisions — Added 7 new rows
§10 subsections — Fixed numbering from 9.x→10.x
Now — you pinned styling (#7). What's your preference: Tailwind + shadcn/ui, Tailwind only, or something else?

I think i'd go shadcn + tailwind. I'd want it to look uniqiue and not ai generated though. Any ideas for that?
Good choice. The generic AI look comes from a few specific habits — here's what to do differently:

The single highest-impact change: canvas background

Instead of tldraw's default white/grey, give the canvas a subtle dot grid (SVG background pattern) on a warm off-white base. This immediately reads as "notebook" rather than "whiteboard app" and nothing else in this space does it. tldraw lets you override the canvas background entirely.

Color palette — go warm, not cold

Generic AI apps live in cold greys and default blue accents. For a note-taking app the analog metaphor is paper and ink:

Background: warm off-white (#FAFAF8) for the app shell, slightly warmer (#F5F0E8) for the canvas — feels like aged paper
Text: near-black with a warm undertone (#1C1917) rather than pure black
Accent: pick one strong color and use it sparingly. I'd suggest deep forest green (#2D5016 range) — calm, focused, scholarly. Avoids the purple-to-blue AI gradient everyone uses.
Borders: warm beige (#E8E2D9) instead of cold grey
shadcn is fully driven by CSS custom properties in globals.css — override --background, --card, --primary, --border and every component inherits it automatically. You're not locked into the default look at all.

Typography — add a serif somewhere

Inter everywhere is the most reliable signal that an app is generic. A distinctive pairing:

Note titles / headings: Fraunces — an optical serif with personality, feels like a notebook label
UI chrome: Inter or Plus Jakarta Sans — clean, readable
Citation chips: font-mono — reinforces the academic/footnote aesthetic
Citation chips — index card, not pill

The default shadcn badge/chip is a rounded pill. For citations, style them as index cards — slightly off-white background, a colored left border (1 source = 1 color, consistent across the app), subtle drop shadow. When expanded they look like a library catalog card. This is visually distinctive and thematically on point.

Motion

One subtle thing that makes a UI feel crafted: spring animations on panel collapse (not linear easing). Framer Motion handles this with one line. Also a very slight scale-up on the citation chip when dragging it. Nothing flashy — just enough to feel physical.

What to avoid:

Glassmorphism / backdrop blur on anything
Purple-to-blue gradients
Lots of rounded-xl cards stacked on each other
Dark mode as the default (the paper aesthetic only works light-first)
This all layers on top of shadcn without fighting it — you're just overriding tokens and adding one font. Want me to add a §7.6 Design System section to the TDD capturing these decisions, then we can move on to the completion criteria list?

alirght yeah update that
Grep "^### 7\.4 Auth" (in /Users/naasanov/Projects/Code/footnote/docs/TDD.md)
1 line of output
Read TDD.md (lines 456-465)
Edit TDD.md
Added 53 lines
while i wait for you to make changes in between turns, gimme some external setup steps to do while i wait
Also add Framer Motion and Sonner to the tech stack, and the design decisions:

Edit TDD.md
Added 3 lines
Edit TDD.md
Added 3 lines
Done. Now, while you wait between turns — here's what you can set up right now in parallel:

External setup you can do now:

MongoDB Atlas — create a free M0 cluster, create a database named footnote, grab the connection string. Also enable Atlas Vector Search on the cluster (it's a checkbox in the UI under "Search").

Clerk — create an application at clerk.com, grab the publishable key and secret key. Set up email/password auth (already on by default). Note the sign-in/sign-up URLs.

OpenAI — create an API key at platform.openai.com. No special setup needed — text-embedding-3-small is available on any account.

Anthropic — create an API key at console.anthropic.com. Claude Vision and the standard Claude API both work on the same key.

Google Fonts — go to fonts.google.com, find Fraunces, grab the <link> embed or the @import URL. You'll drop this into the Next.js layout.

Verify your Node version — tldraw and Next.js App Router both want Node 18+. Run node -v.

Install pnpm if you don't have it — npm install -g pnpm.

Create a GitHub repo named footnote — you'll want this for the agent handoff anyway.

create a doc where i can load in all the external info that you need
Write EXTERNAL_CONFIG.md
69 lines
# External Configuration

Fill this in before handing off to an agent. Do not commit with real values — add this file to `.gitignore`.

---

## MongoDB Atlas

| Field | Value |
|---|---|
| Connection string | `mongodb+srv://...` |
| Database name | `footnote` |
| Cluster region | e.g. `us-east-1` |
| Vector Search enabled | yes / no |

**Atlas Vector Search index name:** _(name you gave the index when creating it)_

---

## Clerk

| Field | Value |
|---|---|
| Publishable key | `pk_test_...` |
| Secret key | `sk_test_...` |
| Sign-in URL | `/sign-in` |
| Sign-up URL | `/sign-up` |
| After sign-in redirect | `/` |

---

## OpenAI

| Field | Value |
|---|---|
| API key | `sk-...` |
| Embedding model | `text-embedding-3-small` |

---

## Anthropic

| Field | Value |
|---|---|
| API key | `sk-ant-...` |
| OCR model | `claude-opus-4-5-20251001` or `claude-sonnet-4-6` |
| Citation model | `claude-sonnet-4-6` |

---

## Runtime

| Field | Value |
|---|---|
| Backend port | `3001` |
| Frontend URL (dev) | `http://localhost:3000` |
| Backend URL (dev) | `http://localhost:3001` |
| Node version | e.g. `v20.11.0` |
| pnpm version | e.g. `9.x` |

---

## GitHub

| Field | Value |
|---|---|
| Repo URL | `https://github.com/...` |
| Default branch | `main` |
Done — docs/EXTERNAL_CONFIG.md. Fill it in as you complete the setup steps.

Two notes:

Add it to .gitignore before you commit anything — echo "docs/EXTERNAL_CONFIG.md" >> .gitignore
For the Anthropic OCR model — use claude-sonnet-4-6 for both OCR and citation generation. It's the current Sonnet, fast enough for the debounce loop, and cheaper than Opus.
Btw i also want vs code launch configs so i can run it easy
Globpattern: ".vscode/**"
No files found
Write launch.json
58 lines
{
  "version": "0.2.0",
  "configurations": [
    {
      // Runs Next.js dev server (localhost:3000)
      "name": "Frontend",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm --filter web dev",
      "cwd": "${workspaceFolder}"
    },
    {
      // Runs Fastify with tsx watch (localhost:3001)
      "name": "API",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm --filter api dev",
      "cwd": "${workspaceFolder}"
    },
    {
      // Fastify with Node inspector — attach VS Code debugger for breakpoints
      // Requires "dev:debug": "tsx watch --inspect src/index.ts" in apps/api/package.json
      "name": "API (debug)",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "api", "dev:debug"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      // Attach to a running Next.js dev server for server-side breakpoints
      // Start the frontend first, then run this
      "name": "Frontend (attach)",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true,
      "skipFiles": ["<node_internals>/**"]
    }
  ],
  "compounds": [
    {
      // Starts both dev servers together — use this for normal development
      "name": "Full Stack",
      "configurations": ["Frontend", "API"],
      "stopAll": true
    },
    {
      // Full stack with API debugger attached
      "name": "Full Stack (debug API)",
      "configurations": ["Frontend", "API (debug)"],
      "stopAll": true
    }
  ]
}
Done — .vscode/launch.json.

Four configs, two compounds:

Full Stack — what you'll use 95% of the time. Starts both servers with one click from the Run & Debug panel (Cmd+Shift+D).
Full Stack (debug API) — same but with the Node inspector on the API, so you can set breakpoints in service/repository code.
Frontend (attach) — for the rare case you need breakpoints in Next.js server components. Start the frontend separately with NODE_OPTIONS='--inspect' first, then attach.
One thing to note for the coding agent: apps/api/package.json needs these two scripts:


"dev": "tsx watch src/index.ts",
"dev:debug": "tsx watch --inspect src/index.ts"
The tsx package handles TypeScript execution directly — no separate compilation step needed in dev.

I think the TDD is finally done. Now lets talk about how we're gonna get this coded up. we already mentioned a completion criteria doc. thats fine. before we make that, whats the agent setup gonna be. one agent on its own? split it up into tickets? What model should i use? what thinking effort level? the goal is to set it off and come back to a finisehd product (not really but ill explain more)

AI agents also sometimes have a hard time with frontend stuff, especially such interactive things like a canvas. I dont wanna come back and it be a buggy UI mess and have to untangle a mssive knot. I'd rather check in every once in a while and untangle a small knot before it compounds. Do you think preset check in points where i come in and validate the current progress would be a good idea?

I also want everything to be validated as they go. if the agents could write smoke tests as they make backend stuff that would be great. I also want a sparcely ran end to end test that acutally uses the external services because my expereince with mocking is that it all breaks when its actually time to connect ot the outside world.

What are your thoughts on all of that? Im just kinda rambling
Good ramble, clear signal. Here are my thoughts:

One agent vs. tickets

Tickets, absolutely. One agent on the whole codebase will drift — context gets long, it forgets constraints from the TDD, starts making inconsistent decisions. Smaller focused agents with the TDD + one specific ticket each stay sharp. They should run sequentially, not in parallel, since each layer depends on the one before it.

Model and thinking

Sonnet 4.6 for well-specified tickets (CRUD routes, repositories, scaffolding) — it follows tight specs well and is fast
Opus 4.6 for the hard tickets: canvas integration, RAG frontend loop, anything requiring judgment calls. Don't cheap out on the canvas ticket especially.
Extended thinking: on for canvas and RAG pipeline tickets, off for the mechanical ones. Thinking costs tokens on tasks that don't need it.
Check-in points — yes, 100%

Your instinct is exactly right and I'd go further: make them gates, not suggestions. The next ticket doesn't start until you've validated the current one. The natural gates:

Backend complete — all routes, RAG pipeline, ingest working. Validate with curl/Postman. Before any frontend starts.
Frontend shell — auth, three-panel layout, API client wired up. No canvas yet. Validate navigation and auth flow.
Canvas working — tldraw integrated, drawing works, state persists, panels collapse. Validate manually on tablet if you have one.
Full RAG loop — write something, sidebar updates, drag a citation onto canvas. This is the core feature gate. Validate end-to-end with real content.
Feature complete — search, export, edge cases. Final pass before polish.
Five gates, ~10 tickets total between them. The frontend ones especially — if the canvas ticket comes back broken, you catch it before the RAG integration agent builds on top of a broken foundation.

Testing — your mock instinct is right

Mocks lie. Here's the split I'd use:

Smoke tests per backend ticket — fast, hit the real Fastify instance, real MongoDB (test DB), assert routes exist and return expected shapes. No mocking of the DB. Written by the agent as part of each ticket.
Integration tests with real external services — one test file (tests/integration/) that actually calls OpenAI embeddings, actually calls Claude Vision, actually runs Atlas Vector Search. Runs manually via pnpm test:integration, never in CI. The agent writes the scaffolding, you run them at gate 1 to verify before touching the frontend.
Playwright E2E — two or three critical path tests only: (1) upload a source, (2) write on canvas and see sidebar update, (3) drag a citation. Written at the end. Also hits real services.
Proposed ticket breakdown (rough):


Ticket 1 — Scaffolding & auth         → Gate 1 check-in
Ticket 2 — Data layer (schemas, repos)
Ticket 3 — Ingest pipeline
Ticket 4 — RAG + OCR pipeline         → Gate 1
Ticket 5 — Frontend shell & design    → Gate 2
Ticket 6 — Canvas integration         → Gate 3
Ticket 7 — RAG frontend loop          → Gate 4
Ticket 8 — Remaining features
Ticket 9 — Polish + E2E tests         → Gate 5
What did you mean by "not really but I'll explain more"? That'll shape how tight the completion criteria need to be.

okay. please make a new doc(s) that go over the stuff we talked about. Break it up into well defined tickets, mark which ones should ahve what models/thinking, talk about testing, schedule the check in points. if some things can be parellelized then do so, mention what my role is in all of this, including how i'll dispatch the models.
Read TDD.md
Read TDD.md (lines 2-101)
I have the full picture from our conversation. Let me write both documents — the execution plan and the ticket specs.

Write EXECUTION_PLAN.md
262 lines
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
Now the individual ticket files:

Bash Create tickets directory
IN
mkdir -p /Users/naasanov/Projects/Code/footnote/docs/tickets

OUT
[rerun: b1]
Write TICKET_1.md
48 lines
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
Write TICKET_2.md
47 lines
# Ticket 2 — Data Layer (Schemas, Repositories, Indexes)

**Model:** Sonnet | **Thinking:** Off | **Depends on:** Ticket 1
**Parallelizable with:** Tickets 3 and 4

## Objective

Build all MongoDB repositories and GridFS utilities. After this ticket, every collection can be read/written through typed repository classes, all MongoDB indexes exist, and GridFS file storage works.

## Acceptance Criteria

- [ ] All repositories created in `apps/api/src/repositories/`:
  - `notebook.repository.ts` — CRUD by userId
  - `note.repository.ts` — CRUD by notebookId + userId, includes `updateCanvasState()` and `updateActiveSourceIds()`
  - `source.repository.ts` — CRUD by scope + userId, includes status updates
  - `chunk.repository.ts` — bulk insert, delete by sourceId, vector search query (using `$vectorSearch` aggregation pipeline with `sourceId` pre-filter)
  - `ocr-result.repository.ts` — upsert by `(noteId, snapshotKey)`, text search by noteId + query string
- [ ] Every repository method calls `ZodSchema.parse()` on data read from MongoDB
- [ ] Repositories accept `Db` (from `mongodb` driver) via constructor injection — no global imports
- [ ] GridFS utility: `apps/api/src/repositories/gridfs.repository.ts`
  - `upload(buffer: Buffer, filename: string, mimeType: string): Promise<ObjectId>`
  - `download(fileId: ObjectId): Promise<Readable>` (returns a readable stream)
  - `delete(fileId: ObjectId): Promise<void>`
- [ ] MongoDB indexes created via a setup script or repository `ensureIndexes()` methods:
  - `notebooks`: `{ userId: 1 }`
  - `notes`: `{ notebookId: 1, userId: 1 }`
  - `sources`: `{ "scope.id": 1, "scope.type": 1 }`
  - `document_chunks`: `{ sourceId: 1 }`
  - `ocr_results`: `{ noteId: 1, snapshotKey: 1 }` (unique)
  - `ocr_results`: text index on `text`
- [ ] Note: the Atlas Vector Search index on `document_chunks.embedding` must be created manually in Atlas UI — add a comment in `chunk.repository.ts` explaining this

## Smoke Tests

- Notebook CRUD: create, read, update, delete — all return correctly typed documents
- Note CRUD: create with `activeSourceIds: []`, update canvas state, verify persistence
- Source CRUD: create with `status: 'processing'`, update to `ready`, read back
- Chunk: bulk insert 5 chunks, delete by sourceId, verify all removed
- GridFS: upload a buffer, download it back, compare bytes, delete
- OCR result: upsert same snapshotKey twice — verify only one document exists

## Out of Scope

- No route handlers (Ticket 4)
- No embedding or parsing logic (Ticket 3)
- No vector search index creation (manual Atlas step)
Write TICKET_3.md
50 lines
# Ticket 3 — Ingest Pipeline (Parsers, Embeddings, Orchestration)

**Model:** Sonnet | **Thinking:** On | **Depends on:** Ticket 1
**Parallelizable with:** Tickets 2 and 4

## Objective

Build the document ingestion pipeline: parser registry, concrete parsers, embedding adapter, and the ingest service that orchestrates parse → chunk → embed → store. After this ticket, a file buffer can be fed through the pipeline and chunks with embeddings appear in MongoDB.

## Acceptance Criteria

- [ ] Parser adapter pattern in `apps/api/src/adapters/parsers/`:
  - `SourceParser.ts` — interface with `supportedMimeTypes` and `parse(buffer, filename): Promise<ParsedChunk[]>`
  - `ParsedChunk` type: `{ text: string, locationLabel: string, chunkIndex: number }`
  - `ParserRegistry.ts` — register parsers, look up by MIME type, throw clear error for unsupported types
  - `PdfParser.ts` — uses `pdf-parse`, chunks by ~500 tokens with 100-token overlap, `locationLabel` = `"Page N"`
  - `DocxParser.ts` — uses `mammoth`, same chunking strategy, `locationLabel` = `"Section N"` or `"Paragraph N"`
  - `MarkdownParser.ts` — splits by headings/paragraphs, `locationLabel` = heading text or `"Paragraph N"`
  - `ImageParser.ts` — sends image to Claude Vision API for text extraction, returns as single chunk (delegates to OCR adapter)
- [ ] Embedding adapter in `apps/api/src/adapters/embeddings/`:
  - `EmbeddingService.ts` — interface: `embed(text: string): Promise<number[]>` and `embedBatch(texts: string[]): Promise<number[][]>`
  - `OpenAiEmbeddingService.ts` — uses OpenAI `text-embedding-3-small`, handles batching (max 2048 inputs per call)
- [ ] Ingest service in `apps/api/src/services/ingest.service.ts`:
  - `run(sourceId: ObjectId): Promise<void>`
  - Reads file from GridFS via repository
  - Gets MIME type from Source document
  - Calls `parserRegistry.getParser(mimeType).parse(buffer, filename)`
  - Embeds all chunks via `embeddingService.embedBatch()`
  - Stores DocumentChunk documents via `chunkRepository.bulkInsert()`
  - Updates source status to `ready` on success
  - On failure: deletes any partial chunks, sets source status to `error`, logs error
- [ ] Chunking logic:
  - Target ~500 tokens per chunk (estimate: 1 token ≈ 4 chars)
  - 100-token overlap between adjacent chunks from the same page/section
  - Prefer splitting at paragraph boundaries; fall back to sentence boundaries; last resort: hard split at token limit

## Smoke Tests

- PDF parser: parse a small test PDF, assert chunks have text and `locationLabel` = "Page 1"
- Markdown parser: parse a markdown string with headings, assert chunks split at headings
- Parser registry: lookup by MIME type succeeds, lookup for unsupported type throws
- Ingest service (with real test MongoDB, mocked embedding service that returns fixed vectors): run on a test source → verify chunks stored with embeddings, source status = 'ready'
- Ingest service failure: simulate embedding error → verify source status = 'error', no partial chunks left

## Out of Scope

- No route handlers for upload (Ticket 4)
- No vector search queries (Ticket 5)
- DOCX and Image parsers can be stub implementations that throw "not yet implemented" if needed to save time — PDF and Markdown are the priority
Write TICKET_4.md
53 lines
# Ticket 4 — CRUD API Routes

**Model:** Sonnet | **Thinking:** Off | **Depends on:** Ticket 1
**Parallelizable with:** Tickets 2 and 3

## Objective

Build all CRUD route handlers for notebooks, notes, and sources. After this ticket, the API supports full CRUD operations and source file upload/download. These routes delegate to repositories (which may be stubs if Ticket 2 isn't merged yet — use the interfaces from `domain/schemas.ts`).

## Acceptance Criteria

- [ ] All routes in `apps/api/src/routes/` per TDD §6.1:
  - `notebooks.ts`:
    - `GET /notebooks` — list all for authenticated user
    - `POST /notebooks` — create with `{ title }`
    - `PATCH /notebooks/:id` — update title
    - `DELETE /notebooks/:id` — delete notebook + cascade delete all notes, sources, chunks within
  - `notes.ts`:
    - `GET /notebooks/:notebookId/notes` — list notes in notebook
    - `POST /notebooks/:notebookId/notes` — create note, initialize `activeSourceIds` from notebook-scoped sources
    - `GET /notes/:id` — get single note (includes canvasState)
    - `PATCH /notes/:id` — update `canvasState`, `activeSourceIds`, `title`
    - `DELETE /notes/:id` — delete note + cascade delete note-scoped sources and their chunks
    - `GET /notes/:id/ocr-search` — text search against ocr_results, return `[{ text, bbox }]`
  - `sources.ts`:
    - `POST /sources` — multipart file upload, accepts `scope` (type + id) in form data, stores file to GridFS, creates Source doc with `status: 'processing'`, triggers ingest pipeline async (fire-and-forget), returns 202
    - `GET /sources` — query by `scope` param (e.g. `?scope=notebook:abc123`)
    - `GET /sources/:id/file` — stream file from GridFS with correct `Content-Type`
    - `PATCH /sources/:id` — rename source (update `filename`)
    - `DELETE /sources/:id` — delete source + all its DocumentChunks + GridFS file; remove sourceId from `activeSourceIds` on all affected notes
- [ ] All route input validated with Zod (request body, params, query)
- [ ] All routes scoped to authenticated user — a user can never access another user's data
- [ ] Cascade deletes are handled in the route handler or a service — never leave orphaned data
- [ ] `activeSourceIds` auto-update:
  - When a notebook-scoped source finishes ingestion (`ready`): add its `_id` to `activeSourceIds` on all notes in that notebook
  - When a note-scoped source finishes ingestion: add its `_id` to that note only
  - This logic lives in `source.service.ts` and is called after ingest completes

## Smoke Tests

- Notebook CRUD: create → list → update → delete → list returns empty
- Note CRUD: create note in notebook → get → update title → delete
- Note inherits sources: create notebook → upload source → wait for ready → create note → verify `activeSourceIds` includes the source
- Source upload: POST multipart with a test PDF → verify 202 returned, source doc created with `status: 'processing'`
- Source delete cascade: create source + some chunks → delete source → verify chunks deleted, source removed from note's `activeSourceIds`
- Auth scoping: create notebook as user A → try to GET as user B → 404 (not 403, to avoid leaking existence)
- OCR search: insert test ocr_results → search → verify results returned with bbox

## Out of Scope

- No ingest pipeline logic (Ticket 3 — this ticket just fires it async)
- No RAG query or OCR routes (Ticket 5)
Write TICKET_5.md
54 lines
# Ticket 5 — RAG Query + OCR Pipeline

**Model:** Opus | **Thinking:** On | **Depends on:** Tickets 2, 3, 4 (all merged)

## Objective

Build the RAG query pipeline and OCR service. After this ticket, the full backend is complete: a canvas snapshot can be OCR'd, the text can be embedded and used to search against uploaded sources, and matching chunks are returned with AI-generated relevance summaries.

## Acceptance Criteria

- [ ] OCR adapter in `apps/api/src/adapters/ocr/`:
  - `OcrService.ts` — interface: `transcribe(imageBase64: string, mimeType: string): Promise<string>`
  - `ClaudeOcrService.ts` — sends image to Claude Vision API with a prompt optimized for handwriting transcription. Returns raw text string. Returns empty string (not error) if no text is detected.
- [ ] Citation adapter in `apps/api/src/adapters/citation/`:
  - `CitationService.ts` — interface: `summarize(query: string, chunk: { text: string, locationLabel: string, filename: string }): Promise<string>`
  - `ClaudeCitationService.ts` — sends query + chunk to Claude, gets back a one-sentence relevance summary explaining *why* this chunk matches the user's writing
- [ ] RAG service in `apps/api/src/services/rag.service.ts`:
  - `query(text: string, sourceIds: ObjectId[], userId: string): Promise<RagResult[]>`
  - Embeds query text with `embeddingService.embed()`
  - Calls `chunkRepository.vectorSearch()` with pre-filter `{ sourceId: { $in: sourceIds } }`
  - Retrieves top-5 chunks with scores
  - For each chunk: calls `citationService.summarize()` to generate relevance summary
  - Returns `{ chunkId, sourceId, sourceName, locationLabel, excerpt, fullText, matchScore, summary }[]`
  - Short-circuits and returns `[]` if `sourceIds` is empty or `text` is empty
- [ ] OCR route in `apps/api/src/routes/ocr.ts`:
  - `POST /ocr` — accepts `{ imageBase64, mimeType }`, returns `{ text }`
  - Validates input (base64 string, valid MIME type)
  - Saves OCR result to `ocr_results` collection with `noteId`, `snapshotKey`, `text`, `bbox` (all passed from frontend)
- [ ] RAG route in `apps/api/src/routes/rag.ts`:
  - `POST /rag/query` — accepts `{ text, sourceIds }`, returns `{ chunks: RagResult[] }`
  - Validates input, returns empty array if text or sourceIds empty
- [ ] All adapters registered in `plugins/container.ts` via Fastify decorators
- [ ] Integration test file at `apps/api/tests/integration/external-services.test.ts`:
  - Test: embed a string with OpenAI → assert 1536-dim vector returned
  - Test: OCR a simple test image with Claude Vision → assert non-empty text returned
  - Test: generate a citation summary with Claude → assert non-empty summary returned
  - Test: full pipeline — embed + store chunk → vector search → verify chunk retrieved
  - Test file has clear instructions at top: "Requires real API keys in .env. Run manually with `pnpm --filter api test:integration`"

## Smoke Tests

- `POST /ocr` with valid image data → returns text (can mock the OCR adapter for speed)
- `POST /ocr` with missing/invalid data → returns 400
- `POST /rag/query` with empty sourceIds → returns `{ chunks: [] }`
- `POST /rag/query` with empty text → returns `{ chunks: [] }`
- RAG service: with mocked embedding + mocked vector search returning 3 chunks → verify 3 results with summaries
- All adapters are injectable (registered on fastify instance, not imported directly)

## Out of Scope

- No frontend (Ticket 6+)
- No debounce logic (that's frontend — Ticket 8)
- No text buffer management (frontend — Ticket 8)
Write TICKET_6.md
78 lines
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
Write TICKET_7.md
70 lines
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
Write TICKET_8.md
86 lines
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
Write TICKET_9.md
78 lines
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
Done. Here's what was created:

docs/EXECUTION_PLAN.md — the master plan:

Dependency graph showing which tickets can be parallelized
Model + thinking level per ticket (table)
Parallelization instructions (branches, merge order)
Your role at each of the 5 gates with concrete checklists
Testing strategy (smoke, integration, E2E)
Exact agent dispatch instructions (what to paste)
docs/tickets/ — 9 ticket files:

Ticket	File	Summary
1	TICKET_1.md	Monorepo, auth, DB connection, env validation
2	TICKET_2.md	Repositories, GridFS, MongoDB indexes
3	TICKET_3.md	Parser registry, chunking, embedding adapter
4	TICKET_4.md	All CRUD routes, cascade deletes, source toggles
5	TICKET_5.md	RAG query service, OCR service, integration tests
6	TICKET_6.md	Frontend shell, design system, navigation, source UI
7	TICKET_7.md	tldraw canvas, custom shapes, tools, persistence
8	TICKET_8.md	The core feature — OCR debounce, RAG sidebar, drag-to-cite
9	TICKET_9.md	Search, export, polish, Playwright E2E
Key points:

Tickets 2, 3, 4 run in parallel on separate branches after Ticket 1
Opus + extended thinking for tickets 5, 7, 8 (the hard ones)
Sonnet for everything mechanical
5 gates where you validate before proceeding