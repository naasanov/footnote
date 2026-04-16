import { Collection, Db, ObjectId } from 'mongodb'
import { Notebook, NotebookSchema } from '../domain/schemas.js'

export class NotebookRepository {
  private collection: Collection

  constructor(db: Db) {
    this.collection = db.collection('notebooks')
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ userId: 1 })
  }

  async findAllByUserId(userId: string): Promise<Notebook[]> {
    const docs = await this.collection.find({ userId }).toArray()
    return docs.map(doc => NotebookSchema.parse(doc))
  }

  async findById(id: ObjectId, userId: string): Promise<Notebook | null> {
    const doc = await this.collection.findOne({ _id: id, userId })
    if (!doc) return null
    return NotebookSchema.parse(doc)
  }

  async create(data: { userId: string; title: string }): Promise<Notebook> {
    const now = new Date()
    const doc = {
      userId: data.userId,
      title: data.title,
      createdAt: now,
      updatedAt: now,
    }
    const result = await this.collection.insertOne(doc)
    return NotebookSchema.parse({ _id: result.insertedId, ...doc })
  }

  async update(
    id: ObjectId,
    userId: string,
    updates: { title?: string }
  ): Promise<Notebook | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id, userId },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )
    if (!result) return null
    return NotebookSchema.parse(result)
  }

  async delete(id: ObjectId, userId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id, userId })
    return result.deletedCount === 1
  }
}
