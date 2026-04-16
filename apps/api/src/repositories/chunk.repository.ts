// NOTE: The Atlas Vector Search index on document_chunks.embedding must be created
// manually in the MongoDB Atlas UI. It cannot be created via the MongoDB driver.
// Use the following configuration:
//   - Database:     footnote
//   - Collection:   document_chunks
//   - Index name:   vector_index
//   - Type:         vectorSearch
//   - Field:        embedding
//   - Dimensions:   1536  (matches text-embedding-3-small output)
//   - Similarity:   cosine
//   - Pre-filter:   { sourceId: 1 }  — allows the $vectorSearch filter below to work

import { Collection, Db, ObjectId } from 'mongodb'
import { DocumentChunk, DocumentChunkSchema } from '../domain/schemas.js'

export class ChunkRepository {
  private collection: Collection

  constructor(db: Db) {
    this.collection = db.collection('document_chunks')
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ sourceId: 1 })
  }

  async bulkInsert(chunks: Omit<DocumentChunk, '_id'>[]): Promise<ObjectId[]> {
    if (chunks.length === 0) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.collection.insertMany(chunks as any[])
    return Object.values(result.insertedIds) as ObjectId[]
  }

  async deleteBySourceId(sourceId: ObjectId): Promise<number> {
    const result = await this.collection.deleteMany({ sourceId })
    return result.deletedCount
  }

  async deleteBySourceIds(sourceIds: ObjectId[]): Promise<void> {
    if (sourceIds.length === 0) return
    await this.collection.deleteMany({ sourceId: { $in: sourceIds } })
  }

  // Requires the Atlas Vector Search index described at the top of this file.
  // Returns each matching chunk paired with its vector search score.
  async vectorSearch(
    embedding: number[],
    sourceIds: ObjectId[],
    limit = 5
  ): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
    const pipeline = [
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector: embedding,
          numCandidates: limit * 10,
          limit,
          filter: { sourceId: { $in: sourceIds } },
        },
      },
      {
        $addFields: { _score: { $meta: 'vectorSearchScore' } },
      },
    ]
    const docs = await this.collection.aggregate(pipeline).toArray()
    return docs.map(doc => {
      const score = typeof doc['_score'] === 'number' ? (doc['_score'] as number) : 0
      const { _score, ...chunkDoc } = doc
      return { chunk: DocumentChunkSchema.parse(chunkDoc), score }
    })
  }
}
