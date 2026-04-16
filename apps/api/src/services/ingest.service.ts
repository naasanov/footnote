import type { ObjectId } from "mongodb";
import type { EmbeddingService } from "../adapters/embeddings/EmbeddingService.js";
import type { ParserRegistry } from "../adapters/parsers/ParserRegistry.js";
import type { ChunkRepository } from "../repositories/chunk.repository.js";
import type { GridFsRepository } from "../repositories/gridfs.repository.js";
import type { SourceRepository } from "../repositories/source.repository.js";

export class IngestService {
  constructor(
    private sourceRepo: SourceRepository,
    private chunkRepo: ChunkRepository,
    private gridfsRepo: GridFsRepository,
    private parserRegistry: ParserRegistry,
    private embeddingService: EmbeddingService,
  ) {}

  async run(sourceId: ObjectId): Promise<void> {
    let source;
    try {
      source = await this.sourceRepo.findByIdInternal(sourceId);
    } catch {
      // Source may have been deleted before ingest ran
      return;
    }
    if (!source) return;

    try {
      const { buffer, mimeType: gridFsMimeType } =
        await this.gridfsRepo.getFile(source.gridfsFileId);
      const mimeType = source.mimeType ?? gridFsMimeType;

      // Parse the file into chunks
      const parser = this.parserRegistry.getParser(mimeType);
      const parsedChunks = await parser.parse(buffer, source.filename);

      if (parsedChunks.length === 0) {
        await this.sourceRepo.updateStatus(sourceId, "ready");
        return;
      }

      // Embed all chunk texts in batch
      const embeddings = await this.embeddingService.embedBatch(
        parsedChunks.map((c) => c.text),
      );

      // Build DocumentChunk objects
      const docChunks = parsedChunks.map((c, i) => ({
        sourceId,
        userId: source!.userId,
        text: c.text,
        locationLabel: c.locationLabel,
        chunkIndex: c.chunkIndex,
        embedding: embeddings[i],
        metadata: {
          filename: source!.filename,
          locationLabel: c.locationLabel,
          sourceId: sourceId.toHexString(),
        },
      }));

      await this.chunkRepo.bulkInsert(docChunks);
      await this.sourceRepo.updateStatus(sourceId, "ready");
    } catch (err) {
      // Clean up any partial chunks written before the failure
      await this.chunkRepo.deleteBySourceId(sourceId);
      await this.sourceRepo.updateStatus(sourceId, "error");
      // Log but do not rethrow — this is a fire-and-forget operation
      console.error(`Ingest failed for source ${sourceId}:`, err);
    }
  }
}
