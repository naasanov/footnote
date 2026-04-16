import { Collection, Db, ObjectId } from 'mongodb'
import { OcrResult, OcrResultSchema } from '../domain/schemas.js'

export class OcrResultRepository {
  private collection: Collection

  constructor(db: Db) {
    this.collection = db.collection('ocr_results')
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex(
      { noteId: 1, snapshotKey: 1 },
      { unique: true }
    )
    await this.collection.createIndex({ text: 'text' })
  }

  async upsert(data: {
    noteId: ObjectId
    userId: string
    snapshotKey: string
    text: string
    bbox: { x: number; y: number; w: number; h: number }
  }): Promise<OcrResult> {
    const now = new Date()
    const result = await this.collection.findOneAndUpdate(
      { noteId: data.noteId, snapshotKey: data.snapshotKey },
      {
        $set: {
          userId: data.userId,
          text: data.text,
          bbox: data.bbox,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, returnDocument: 'after' }
    )
    return OcrResultSchema.parse(result)
  }

  async textSearch(noteId: ObjectId, query: string): Promise<OcrResult[]> {
    // Normalize each word: strip non-alphanumeric chars, build a pattern
    // that allows any non-alphanumeric characters between letters/digits.
    // e.g. "abc" matches "** a b c**", "a b c", "abc", "A.B.C"
    const words = query.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return []

    const wordPatterns = words.map((word) => {
      const normalized = word.replace(/[^a-zA-Z0-9]/g, '')
      if (!normalized) return null
      return normalized.split('').join('[^a-zA-Z0-9]*')
    }).filter((p): p is string => p !== null)

    if (wordPatterns.length === 0) return []

    // Each word must appear somewhere in the text (all words required, any order)
    const andConditions = wordPatterns.map((pattern) => ({
      noteId,
      text: { $regex: pattern, $options: 'i' },
    }))

    const filter = andConditions.length === 1
      ? andConditions[0]
      : { $and: andConditions }

    const docs = await this.collection.find(filter).toArray()
    return docs.map(doc => OcrResultSchema.parse(doc))
  }

  async deleteByNoteId(noteId: ObjectId): Promise<void> {
    await this.collection.deleteMany({ noteId })
  }
}
