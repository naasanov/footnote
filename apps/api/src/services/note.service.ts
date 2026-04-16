import type { ObjectId } from 'mongodb'
import type { NoteRepository } from '../repositories/note.repository.js'
import type { NotebookRepository } from '../repositories/notebook.repository.js'
import type { SourceRepository } from '../repositories/source.repository.js'
import type { ChunkRepository } from '../repositories/chunk.repository.js'
import type { OcrResultRepository } from '../repositories/ocr-result.repository.js'
import type { GridFsRepository } from '../repositories/gridfs.repository.js'
import type { Note, OcrResult } from '../domain/schemas.js'
import { NotFoundError } from '../domain/errors.js'

export class NoteService {
  constructor(
    private noteRepo: NoteRepository,
    private notebookRepo: NotebookRepository,
    private sourceRepo: SourceRepository,
    private chunkRepo: ChunkRepository,
    private ocrResultRepo: OcrResultRepository,
    private gridfsRepo: GridFsRepository,
  ) {}

  async listByNotebook(notebookId: ObjectId, userId: string): Promise<Note[]> {
    const notebook = await this.notebookRepo.findById(notebookId, userId)
    if (!notebook) throw new NotFoundError('Notebook not found')
    return this.noteRepo.findAllByNotebookId(notebookId, userId)
  }

  async create(notebookId: ObjectId, userId: string, title: string): Promise<Note> {
    const notebook = await this.notebookRepo.findById(notebookId, userId)
    if (!notebook) throw new NotFoundError('Notebook not found')

    // Initialize activeSourceIds from currently ready notebook-scoped sources
    const readySources = await this.sourceRepo.findReadyByScope(notebookId, 'notebook')
    const activeSourceIds = readySources.map(s => s._id)

    return this.noteRepo.create({ notebookId, userId, title, activeSourceIds })
  }

  async get(id: ObjectId, userId: string): Promise<Note> {
    const note = await this.noteRepo.findById(id, userId)
    if (!note) throw new NotFoundError('Note not found')
    return note
  }

  async update(
    id: ObjectId,
    userId: string,
    data: {
      title?: string
      canvasState?: Record<string, unknown>
      canvasBackground?: 'none' | 'dotted' | 'ruled'
      activeSourceIds?: ObjectId[]
    },
  ): Promise<Note> {
    const note = await this.noteRepo.patch(id, userId, data)
    if (!note) throw new NotFoundError('Note not found')
    return note
  }

  async delete(id: ObjectId, userId: string): Promise<void> {
    const note = await this.noteRepo.findById(id, userId)
    if (!note) throw new NotFoundError('Note not found')

    // Find note-scoped sources
    const sources = await this.sourceRepo.findByScopeInternal(id, 'note')
    const sourceIds = sources.map(s => s._id)

    // Delete chunks
    await this.chunkRepo.deleteBySourceIds(sourceIds)

    // Delete GridFS files
    for (const source of sources) {
      try {
        await this.gridfsRepo.delete(source.gridfsFileId)
      } catch {
        // ignore
      }
    }

    // Delete source documents
    await this.sourceRepo.deleteByIds(sourceIds)

    // Delete OCR results
    await this.ocrResultRepo.deleteByNoteId(id)

    // Delete the note
    await this.noteRepo.delete(id, userId)
  }

  async searchOcr(
    id: ObjectId,
    userId: string,
    query: string,
  ): Promise<Array<{ text: string; bbox: OcrResult['bbox'] }>> {
    const note = await this.noteRepo.findById(id, userId)
    if (!note) throw new NotFoundError('Note not found')
    const results = await this.ocrResultRepo.textSearch(id, query)
    return results.map(r => ({ text: r.text, bbox: r.bbox }))
  }
}
