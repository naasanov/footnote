import type { ObjectId } from 'mongodb'
import type { NotebookRepository } from '../repositories/notebook.repository.js'
import type { NoteRepository } from '../repositories/note.repository.js'
import type { SourceRepository } from '../repositories/source.repository.js'
import type { ChunkRepository } from '../repositories/chunk.repository.js'
import type { OcrResultRepository } from '../repositories/ocr-result.repository.js'
import type { GridFsRepository } from '../repositories/gridfs.repository.js'
import type { Notebook } from '../domain/schemas.js'
import { NotFoundError } from '../domain/errors.js'

export class NotebookService {
  constructor(
    private notebookRepo: NotebookRepository,
    private noteRepo: NoteRepository,
    private sourceRepo: SourceRepository,
    private chunkRepo: ChunkRepository,
    private ocrResultRepo: OcrResultRepository,
    private gridfsRepo: GridFsRepository,
  ) {}

  async list(userId: string): Promise<Notebook[]> {
    return this.notebookRepo.findAllByUserId(userId)
  }

  async create(userId: string, title: string): Promise<Notebook> {
    return this.notebookRepo.create({ userId, title })
  }

  async update(id: ObjectId, userId: string, title: string): Promise<Notebook> {
    const notebook = await this.notebookRepo.update(id, userId, { title })
    if (!notebook) throw new NotFoundError('Notebook not found')
    return notebook
  }

  async delete(id: ObjectId, userId: string): Promise<void> {
    const notebook = await this.notebookRepo.findById(id, userId)
    if (!notebook) throw new NotFoundError('Notebook not found')

    // Gather all notes in this notebook
    const notes = await this.noteRepo.findAllByNotebookId(id, userId)
    const noteIds = notes.map(n => n._id)

    // Gather all sources (notebook-scoped + note-scoped)
    const notebookSources = await this.sourceRepo.findByScopeInternal(id, 'notebook')
    const noteSources = (
      await Promise.all(noteIds.map(noteId => this.sourceRepo.findByScopeInternal(noteId, 'note')))
    ).flat()
    const allSources = [...notebookSources, ...noteSources]
    const allSourceIds = allSources.map(s => s._id)

    // Delete document chunks
    await this.chunkRepo.deleteBySourceIds(allSourceIds)

    // Delete GridFS files (ignore individual failures — file may already be gone)
    for (const source of allSources) {
      try {
        await this.gridfsRepo.delete(source.gridfsFileId)
      } catch {
        // ignore
      }
    }

    // Delete source documents
    await this.sourceRepo.deleteByIds(allSourceIds)

    // Delete OCR results for every note
    await Promise.all(noteIds.map(noteId => this.ocrResultRepo.deleteByNoteId(noteId)))

    // Delete all notes
    await this.noteRepo.deleteByNotebookId(id)

    // Delete the notebook itself
    await this.notebookRepo.delete(id, userId)
  }
}
