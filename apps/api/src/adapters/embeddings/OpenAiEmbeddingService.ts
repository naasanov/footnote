import OpenAI from 'openai'
import type { EmbeddingService } from './EmbeddingService.js'

const MAX_BATCH_SIZE = 2048

export class OpenAiEmbeddingService implements EmbeddingService {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async embed(text: string): Promise<number[]> {
    const [embedding] = await this.embedBatch([text])
    return embedding
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const results: number[][] = []

    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE)
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      })
      const batchEmbeddings = response.data
        .sort((a, b) => a.index - b.index)
        .map(d => d.embedding)
      results.push(...batchEmbeddings)
    }

    return results
  }
}
