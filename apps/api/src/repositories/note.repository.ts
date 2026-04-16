import { Collection, Db, ObjectId } from 'mongodb'
import { Note, NoteSchema } from '../domain/schemas.js'

export class NoteRepository {
  private collection: Collection

  constructor(db: Db) {
    this.collection = db.collection('notes')
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ notebookId: 1, userId: 1 })
  }

  async findAllByNotebookId(notebookId: ObjectId, userId: string): Promise<Note[]> {
    const docs = await this.collection.find({ notebookId, userId }).toArray()
    return docs.map(doc => NoteSchema.parse(doc))
  }

  async findById(id: ObjectId, userId: string): Promise<Note | null> {
    const doc = await this.collection.findOne({ _id: id, userId })
    if (!doc) return null
    return NoteSchema.parse(doc)
  }

  async create(data: {
    notebookId: ObjectId
    userId: string
    title: string
    activeSourceIds?: ObjectId[]
  }): Promise<Note> {
    const now = new Date()
    const doc = {
      notebookId: data.notebookId,
      userId: data.userId,
      title: data.title,
      canvasState: {},
      canvasBackground: 'none',
      activeSourceIds: data.activeSourceIds ?? [],
      createdAt: now,
      updatedAt: now,
    }
    const result = await this.collection.insertOne(doc)
    return NoteSchema.parse({ _id: result.insertedId, ...doc })
  }

  // Unified patch — accepts any combination of title, canvasState, activeSourceIds
  async patch(
    id: ObjectId,
    userId: string,
    updates: {
      title?: string
      canvasState?: Record<string, unknown>
      canvasBackground?: 'none' | 'dotted' | 'ruled'
      activeSourceIds?: ObjectId[]
    },
  ): Promise<Note | null> {
    const setPayload: {
      updatedAt: Date
      title?: string
      canvasState?: Record<string, unknown>
      canvasBackground?: 'none' | 'dotted' | 'ruled'
      activeSourceIds?: ObjectId[]
    } = { updatedAt: new Date() }

    if (updates.title !== undefined) {
      setPayload.title = updates.title
    }

    if (updates.canvasState !== undefined) {
      setPayload.canvasState = updates.canvasState
    }

    if (updates.canvasBackground !== undefined) {
      setPayload.canvasBackground = updates.canvasBackground
    }

    if (updates.activeSourceIds !== undefined) {
      setPayload.activeSourceIds = updates.activeSourceIds
    }

    const result = await this.collection.findOneAndUpdate(
      { _id: id, userId },
      { $set: setPayload },
      { returnDocument: 'after' },
    )
    if (!result) return null
    return NoteSchema.parse(result)
  }

  // Convenience wrappers kept for backward compatibility with repositories.test.ts
  async update(id: ObjectId, userId: string, updates: { title?: string }): Promise<Note | null> {
    return this.patch(id, userId, updates)
  }

  async updateCanvasState(
    id: ObjectId,
    userId: string,
    canvasState: Record<string, unknown>,
  ): Promise<Note | null> {
    return this.patch(id, userId, { canvasState })
  }

  async updateActiveSourceIds(
    id: ObjectId,
    userId: string,
    activeSourceIds: ObjectId[],
  ): Promise<Note | null> {
    return this.patch(id, userId, { activeSourceIds })
  }

  async delete(id: ObjectId, userId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id, userId })
    return result.deletedCount === 1
  }

  async deleteByNotebookId(notebookId: ObjectId): Promise<void> {
    await this.collection.deleteMany({ notebookId })
  }

  // Adds a sourceId to every note in a notebook (used when a notebook-scoped source becomes ready)
  async addActiveSourceIdToNotebookNotes(notebookId: ObjectId, sourceId: ObjectId): Promise<void> {
    await this.collection.updateMany(
      { notebookId },
      { $addToSet: { activeSourceIds: sourceId }, $set: { updatedAt: new Date() } },
    )
  }

  // Adds a sourceId to a single note (used when a note-scoped source becomes ready)
  async addActiveSourceIdToNote(noteId: ObjectId, sourceId: ObjectId): Promise<void> {
    await this.collection.updateOne(
      { _id: noteId },
      { $addToSet: { activeSourceIds: sourceId }, $set: { updatedAt: new Date() } },
    )
  }

  // Removes a sourceId from all notes (used when a source is deleted)
  async removeActiveSourceIdFromAllNotes(sourceId: ObjectId): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.collection.updateMany(
      { activeSourceIds: sourceId },
      { $pull: { activeSourceIds: sourceId } as any, $set: { updatedAt: new Date() } },
    )
  }
}
