// Domain types — mirrored from backend domain/schemas.ts
// When the backend schema changes, this is the one frontend file to update.

export interface Notebook {
  _id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface Note {
  _id: string
  notebookId: string
  userId: string
  title: string
  canvasState: object
  canvasBackground: CanvasBackground
  activeSourceIds: string[]
  createdAt: string
  updatedAt: string
}

export type CanvasBackground = 'none' | 'dotted' | 'ruled'

export type SourceStatus = 'processing' | 'ready' | 'error'
export type SourceScopeType = 'note' | 'notebook'

export interface Source {
  _id: string
  userId: string
  scope: {
    type: SourceScopeType
    id: string
  }
  filename: string
  gridfsFileId: string
  color: string
  status: SourceStatus
  createdAt: string
}

export interface DocumentChunk {
  _id: string
  sourceId: string
  userId: string
  text: string
  locationLabel: string
  chunkIndex: number
  embedding: number[]
  metadata: {
    filename: string
    locationLabel: string
    sourceId: string
  }
}

export interface OcrBbox {
  x: number
  y: number
  w: number
  h: number
}

export interface OcrSearchResult {
  text: string
  bbox: OcrBbox
}

export interface RagResult {
  chunkId: string
  sourceId: string
  sourceName: string
  sourceFilename: string
  locationLabel: string
  excerpt: string
  fullText: string
  matchScore: number
  summary: string
}

export interface RagSummaryResult {
  chunkId: string
  summary: string
}

export interface RagSummaryJob {
  status: 'pending' | 'completed' | 'failed'
  summaries: RagSummaryResult[]
  error?: string
}

// API request/response types

export interface CreateNotebookRequest {
  title: string
}

export interface UpdateNotebookRequest {
  title: string
}

export interface CreateNoteRequest {
  title: string
}

export interface UpdateNoteRequest {
  title?: string
  canvasState?: object
  canvasBackground?: CanvasBackground
  activeSourceIds?: string[]
}

export interface UploadSourceRequest {
  file: File
  scopeType: SourceScopeType
  scopeId: string
}

export interface UpdateSourceRequest {
  filename: string
}
