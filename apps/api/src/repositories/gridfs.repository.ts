import { Db, GridFSBucket, ObjectId } from 'mongodb'
import { Readable } from 'stream'

export class GridFsRepository {
  private bucket: GridFSBucket

  constructor(db: Db) {
    this.bucket = new GridFSBucket(db)
  }

  upload(buffer: Buffer, filename: string, mimeType: string): Promise<ObjectId> {
    return new Promise((resolve, reject) => {
      const stream = this.bucket.openUploadStream(filename, {
        metadata: { mimeType },
      })
      stream.on('error', reject)
      stream.on('finish', () => resolve(stream.id as ObjectId))
      stream.end(buffer)
    })
  }

  async download(fileId: ObjectId): Promise<Readable> {
    return this.bucket.openDownloadStream(fileId)
  }

  async delete(fileId: ObjectId): Promise<void> {
    await this.bucket.delete(fileId)
  }

  // Returns the MIME type stored in the file's metadata (set at upload time)
  async getMimeType(fileId: ObjectId): Promise<string> {
    const files = await this.bucket.find({ _id: fileId }).toArray()
    return (files[0]?.metadata?.['mimeType'] as string | undefined) ?? 'application/octet-stream'
  }

  // Returns both the file buffer and its MIME type in one call (used by the ingest pipeline)
  async getFile(fileId: ObjectId): Promise<{ buffer: Buffer; mimeType: string }> {
    const mimeType = await this.getMimeType(fileId)
    const stream = this.bucket.openDownloadStream(fileId)
    const chunks: Buffer[] = []

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', resolve)
      stream.on('error', reject)
    })

    return { buffer: Buffer.concat(chunks), mimeType }
  }
}
