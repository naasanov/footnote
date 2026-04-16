import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { ClaudeCitationService } from "../adapters/citation/ClaudeCitationService.js";
import type { CitationService } from "../adapters/citation/CitationService.js";
import { OpenAiEmbeddingService } from "../adapters/embeddings/OpenAiEmbeddingService.js";
import { ClaudeOcrService } from "../adapters/ocr/ClaudeOcrService.js";
import type { OcrService } from "../adapters/ocr/OcrService.js";
import { DocxParser } from "../adapters/parsers/DocxParser.js";
import { ImageParser } from "../adapters/parsers/ImageParser.js";
import { MarkdownParser } from "../adapters/parsers/MarkdownParser.js";
import { ParserRegistry } from "../adapters/parsers/ParserRegistry.js";
import { PdfParser } from "../adapters/parsers/PdfParser.js";
import { env } from "../config/env.js";
import { ChunkRepository } from "../repositories/chunk.repository.js";
import { GridFsRepository } from "../repositories/gridfs.repository.js";
import { NoteRepository } from "../repositories/note.repository.js";
import { NotebookRepository } from "../repositories/notebook.repository.js";
import { OcrResultRepository } from "../repositories/ocr-result.repository.js";
import { SourceRepository } from "../repositories/source.repository.js";
import { IngestService } from "../services/ingest.service.js";
import { NoteService } from "../services/note.service.js";
import { NotebookService } from "../services/notebook.service.js";
import { OcrPipelineService } from "../services/ocr.service.js";
import { RagService } from "../services/rag.service.js";
import { RagSummaryJobService } from "../services/rag-summary-job.service.js";
import { SourceService } from "../services/source.service.js";

declare module "fastify" {
  interface FastifyInstance {
    notebookService: NotebookService;
    noteService: NoteService;
    sourceService: SourceService;
    ocrService: OcrService;
    citationService: CitationService;
    ocrPipelineService: OcrPipelineService;
    ragService: RagService;
    ragSummaryJobService: RagSummaryJobService;
  }
}

const containerPlugin: FastifyPluginAsync = async (fastify) => {
  // Repositories
  const notebookRepo = new NotebookRepository(fastify.db);
  const noteRepo = new NoteRepository(fastify.db);
  const sourceRepo = new SourceRepository(fastify.db);
  const chunkRepo = new ChunkRepository(fastify.db);
  const ocrResultRepo = new OcrResultRepository(fastify.db);
  const gridfsRepo = new GridFsRepository(fastify.db);

  // Ensure DB indexes
  await Promise.all([
    notebookRepo.ensureIndexes(),
    noteRepo.ensureIndexes(),
    sourceRepo.ensureIndexes(),
    chunkRepo.ensureIndexes(),
    ocrResultRepo.ensureIndexes(),
  ]);

  // Adapters
  const ocrService = new ClaudeOcrService(env.ANTHROPIC_API_KEY, {
    maxRetryAttempts: env.OCR_MAX_RETRY_ATTEMPTS,
    initialBackoffMs: env.OCR_INITIAL_BACKOFF_MS,
  });
  const citationService = new ClaudeCitationService(env.ANTHROPIC_API_KEY, {
    model: env.CITATION_MODEL,
    maxRetryAttempts: env.CITATION_MAX_RETRY_ATTEMPTS,
    initialBackoffMs: env.CITATION_INITIAL_BACKOFF_MS,
  });
  const embeddingService = new OpenAiEmbeddingService(env.OPENAI_API_KEY);

  const parserRegistry = new ParserRegistry();
  parserRegistry.register(new PdfParser());
  parserRegistry.register(new DocxParser());
  parserRegistry.register(new MarkdownParser());
  parserRegistry.register(new ImageParser(ocrService));

  // Services
  let ingestRunner: (
    sourceId: import("mongodb").ObjectId,
  ) => Promise<void> = async () => {};
  const runIngest = async (
    sourceId: import("mongodb").ObjectId,
  ): Promise<void> => {
    await ingestRunner(sourceId);
  };

  const notebookService = new NotebookService(
    notebookRepo,
    noteRepo,
    sourceRepo,
    chunkRepo,
    ocrResultRepo,
    gridfsRepo,
  );

  const noteService = new NoteService(
    noteRepo,
    notebookRepo,
    sourceRepo,
    chunkRepo,
    ocrResultRepo,
    gridfsRepo,
  );

  const sourceService = new SourceService(
    sourceRepo,
    noteRepo,
    chunkRepo,
    gridfsRepo,
    runIngest,
  );

  const ingestService = new IngestService(
    sourceRepo,
    chunkRepo,
    gridfsRepo,
    parserRegistry,
    embeddingService,
  );

  const ocrPipelineService = new OcrPipelineService(
    ocrService,
    ocrResultRepo,
    fastify.log,
    env.RAG_DEBUG_TIMING,
  );
  const ragService = new RagService(
    embeddingService,
    chunkRepo,
    citationService,
    sourceRepo,
    fastify.log,
    env.RAG_DEBUG_TIMING,
  );
  const ragSummaryJobService = new RagSummaryJobService(
    fastify.log,
    env.RAG_DEBUG_TIMING,
  );

  ingestRunner = async (sourceId) => {
    await ingestService.run(sourceId);
    const source = await sourceRepo.findByIdInternal(sourceId);
    if (source?.status === "ready") {
      await sourceService.onSourceReady(sourceId);
    } else if (source?.status === "error") {
      await sourceService.onSourceError(sourceId);
    }
  };

  fastify.decorate("notebookService", notebookService);
  fastify.decorate("noteService", noteService);
  fastify.decorate("sourceService", sourceService);
  fastify.decorate("ocrService", ocrService);
  fastify.decorate("citationService", citationService);
  fastify.decorate("ocrPipelineService", ocrPipelineService);
  fastify.decorate("ragService", ragService);
  fastify.decorate("ragSummaryJobService", ragSummaryJobService);

  fastify.log.info("DI container initialized");
};

export default fp(containerPlugin, { name: "container" });
