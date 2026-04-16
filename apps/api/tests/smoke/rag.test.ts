// Must be hoisted before any import that transitively loads @clerk/backend
vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn().mockResolvedValue({ sub: "smoke_rag_test_user" }),
}));

// Mock Claude adapters so smoke tests don't make real API calls
vi.mock("../../src/adapters/ocr/ClaudeOcrService.js", () => ({
  ClaudeOcrService: vi.fn().mockImplementation(() => ({
    transcribe: vi.fn().mockResolvedValue("transcribed handwriting text"),
  })),
}));

vi.mock("../../src/adapters/citation/ClaudeCitationService.js", () => ({
  ClaudeCitationService: vi.fn().mockImplementation(() => ({
    summarize: vi
      .fn()
      .mockResolvedValue("This passage is relevant because it discusses the topic."),
    summarizeBatch: vi.fn().mockResolvedValue([
      {
        chunkId: "chunk-0",
        summary: "This passage is relevant because it discusses the topic.",
      },
    ]),
  })),
}));

import type { FastifyInstance } from "fastify";
import { Db, MongoClient, ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { ChunkRepository } from "../../src/repositories/chunk.repository.js";
import { SourceRepository } from "../../src/repositories/source.repository.js";
import { RagService } from "../../src/services/rag.service.js";

const TEST_USER_ID = "smoke_rag_test_user";
const TEST_TOKEN = "Bearer smoke-test-token";

describe("OCR route smoke tests", () => {
  let app: FastifyInstance;
  let mongoClient: MongoClient;
  let db: Db;

  beforeAll(async () => {
    mongoClient = new MongoClient(env.MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(env.MONGODB_DB_NAME);
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await db
      .collection("ocr_results")
      .deleteMany({ userId: TEST_USER_ID });
    await mongoClient?.close();
  });

  it("POST /ocr with valid data returns transcribed text", async () => {
    const noteId = new ObjectId().toHexString();
    const res = await app.inject({
      method: "POST",
      url: "/ocr",
      headers: { Authorization: TEST_TOKEN },
      payload: {
        imageBase64: "aGVsbG8=",
        mimeType: "image/png",
        noteId,
        snapshotKey: "shape:abc,shape:def",
        bbox: { x: 0, y: 0, w: 100, h: 50 },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ text: "transcribed handwriting text" });
  });

  it("POST /ocr with missing imageBase64 returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/ocr",
      headers: { Authorization: TEST_TOKEN },
      payload: {
        mimeType: "image/png",
        noteId: new ObjectId().toHexString(),
        snapshotKey: "shape:abc",
        bbox: { x: 0, y: 0, w: 100, h: 50 },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("POST /ocr with invalid mimeType returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/ocr",
      headers: { Authorization: TEST_TOKEN },
      payload: {
        imageBase64: "aGVsbG8=",
        mimeType: "application/pdf",
        noteId: new ObjectId().toHexString(),
        snapshotKey: "shape:abc",
        bbox: { x: 0, y: 0, w: 100, h: 50 },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("POST /ocr with invalid noteId returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/ocr",
      headers: { Authorization: TEST_TOKEN },
      payload: {
        imageBase64: "aGVsbG8=",
        mimeType: "image/jpeg",
        noteId: "not-a-valid-id",
        snapshotKey: "shape:abc",
        bbox: { x: 0, y: 0, w: 100, h: 50 },
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("RAG route smoke tests", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("POST /rag/query with empty sourceIds returns { chunks: [] }", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/rag/query",
      headers: { Authorization: TEST_TOKEN },
      payload: { text: "some query text", sourceIds: [] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ chunks: [], summaryRequestId: null });
  });

  it("POST /rag/query with empty text returns { chunks: [] }", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/rag/query",
      headers: { Authorization: TEST_TOKEN },
      payload: { text: "", sourceIds: [new ObjectId().toHexString()] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ chunks: [], summaryRequestId: null });
  });

  it("POST /rag/query with whitespace-only text returns { chunks: [] }", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/rag/query",
      headers: { Authorization: TEST_TOKEN },
      payload: {
        text: "   ",
        sourceIds: [new ObjectId().toHexString()],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ chunks: [], summaryRequestId: null });
  });

  it("GET /rag/summaries/:id returns completed jobs", async () => {
    const jobId = app.ragSummaryJobService.createJob(TEST_USER_ID, undefined, async () => [
      {
        chunkId: "chunk-0",
        summary: "This passage is relevant because it discusses the topic.",
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: `/rag/summaries/${jobId}`,
      headers: { Authorization: TEST_TOKEN },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: "completed",
      summaries: [
        {
          chunkId: "chunk-0",
          summary: "This passage is relevant because it discusses the topic.",
        },
      ],
    });
  });

  it("GET /rag/summaries/:id returns 404 for missing jobs", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/rag/summaries/${crypto.randomUUID()}`,
      headers: { Authorization: TEST_TOKEN },
    });

    expect(res.statusCode).toBe(404);
  });

  it("GET /rag/summaries/:id rejects invalid ids", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/rag/summaries/not-a-uuid",
      headers: { Authorization: TEST_TOKEN },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("RagService unit tests", () => {
  let mongoClient: MongoClient;
  let db: Db;
  let chunkRepo: ChunkRepository;
  let sourceRepo: SourceRepository;
  const TEST_SOURCE_ID = new ObjectId();

  beforeAll(async () => {
    mongoClient = new MongoClient(env.MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(env.MONGODB_DB_NAME);
    chunkRepo = new ChunkRepository(db);
    sourceRepo = new SourceRepository(db);
  });

  afterAll(async () => {
    await mongoClient?.close();
  });

  it("returns 3 results without blocking on summaries when vector search returns 3 chunks", async () => {
    const fakeChunks = [
      {
        chunk: {
          _id: new ObjectId(),
          sourceId: TEST_SOURCE_ID,
          userId: TEST_USER_ID,
          text: "Lecture notes about mitosis explain the major phases of cell division in eukaryotic cells.",
          locationLabel: "Page 1",
          chunkIndex: 0,
          embedding: [0.1, 0.2],
          metadata: {
            filename: "biology.pdf",
            locationLabel: "Page 1",
            sourceId: TEST_SOURCE_ID.toHexString(),
          },
        },
        score: 0.92,
      },
      {
        chunk: {
          _id: new ObjectId(),
          sourceId: TEST_SOURCE_ID,
          userId: TEST_USER_ID,
          text: "Introductory overview. Cell division phases explained with emphasis on mitosis and cytokinesis.",
          locationLabel: "Page 2",
          chunkIndex: 1,
          embedding: [0.3, 0.4],
          metadata: {
            filename: "biology.pdf",
            locationLabel: "Page 2",
            sourceId: TEST_SOURCE_ID.toHexString(),
          },
        },
        score: 0.87,
      },
      {
        chunk: {
          _id: new ObjectId(),
          sourceId: TEST_SOURCE_ID,
          userId: TEST_USER_ID,
          text: "Historical note. Chromosome separation during anaphase ensures equal distribution of genetic material.",
          locationLabel: "Page 3",
          chunkIndex: 2,
          embedding: [0.5, 0.6],
          metadata: {
            filename: "biology.pdf",
            locationLabel: "Page 3",
            sourceId: TEST_SOURCE_ID.toHexString(),
          },
        },
        score: 0.81,
      },
    ];

    const mockEmbeddingService = {
      embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      embedBatch: vi.fn(),
    };

    const mockChunkRepo = {
      ...chunkRepo,
      vectorSearch: vi.fn().mockResolvedValue(fakeChunks),
    };

    const mockCitationService = {
      summarize: vi
        .fn()
        .mockResolvedValue("This passage is relevant to cell division."),
      summarizeBatch: vi.fn().mockResolvedValue([
        {
          chunkId: fakeChunks[0]!.chunk._id.toHexString(),
          summary: "This passage is relevant to cell division.",
        },
        {
          chunkId: fakeChunks[1]!.chunk._id.toHexString(),
          summary: "This passage is relevant to cell division.",
        },
        {
          chunkId: fakeChunks[2]!.chunk._id.toHexString(),
          summary: "This passage is relevant to cell division.",
        },
      ]),
    };

    const mockSourceRepo = {
      ...sourceRepo,
      findByIds: vi.fn().mockResolvedValue([
        { filename: "biology.pdf", _id: TEST_SOURCE_ID },
      ]),
    };

    const ragService = new RagService(
      mockEmbeddingService,
      mockChunkRepo as unknown as ChunkRepository,
      mockCitationService,
      mockSourceRepo as unknown as SourceRepository,
    );

    const results = await ragService.query(
      "cell division",
      [TEST_SOURCE_ID],
      TEST_USER_ID,
    );

    expect(results).toHaveLength(3);
    expect(mockChunkRepo.vectorSearch).toHaveBeenCalledWith(
      [0.1, 0.2, 0.3],
      [TEST_SOURCE_ID],
      3,
    );
    expect(mockCitationService.summarizeBatch).not.toHaveBeenCalled();

    for (const result of results) {
      expect(result).toMatchObject({
        chunkId: expect.any(String),
        sourceId: TEST_SOURCE_ID.toHexString(),
        sourceName: "biology.pdf",
        sourceFilename: "biology.pdf",
        locationLabel: expect.any(String),
        excerpt: expect.any(String),
        fullText: expect.any(String),
        matchScore: expect.any(Number),
        summary: "",
      });
    }

    expect(results[0]!.matchScore).toBe(0.92);
    expect(results[1]!.matchScore).toBe(0.87);
    expect(results[2]!.matchScore).toBe(0.81);
    expect(results[0]!.excerpt).toContain("cell division");
    expect(results[1]!.excerpt).toContain("Cell division phases explained");
  });

  it("summarizes existing rag results in a follow-up step", async () => {
    const mockEmbeddingService = {
      embed: vi.fn(),
      embedBatch: vi.fn(),
    };

    const mockChunkRepo = {
      ...chunkRepo,
      vectorSearch: vi.fn(),
    };

    const mockCitationService = {
      summarize: vi.fn(),
      summarizeBatch: vi.fn().mockResolvedValue([
        {
          chunkId: "chunk-0",
          summary: "This passage is relevant to cell division.",
        },
      ]),
    };

    const ragService = new RagService(
      mockEmbeddingService,
      mockChunkRepo as unknown as ChunkRepository,
      mockCitationService,
      sourceRepo,
    );

    const summaries = await ragService.summarize("cell division", [
      {
        chunkId: "chunk-0",
        fullText: "Lecture notes about mitosis",
        locationLabel: "Page 1",
        sourceFilename: "biology.pdf",
      },
    ]);

    expect(mockCitationService.summarizeBatch).toHaveBeenCalledWith(
      "cell division",
      [
        {
          chunkId: "chunk-0",
          text: "Lecture notes about mitosis",
          locationLabel: "Page 1",
          filename: "biology.pdf",
        },
      ],
    );
    expect(summaries).toEqual([
      {
        chunkId: "chunk-0",
        summary: "This passage is relevant to cell division.",
      },
    ]);
  });

  it("filters out low-confidence vector matches below the configured floor", async () => {
    const mockEmbeddingService = {
      embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      embedBatch: vi.fn(),
    };

    const mockChunkRepo = {
      ...chunkRepo,
      vectorSearch: vi.fn().mockResolvedValue([
        {
          chunk: {
            _id: new ObjectId(),
            sourceId: TEST_SOURCE_ID,
            userId: TEST_USER_ID,
            text: "Unrelated lecture fragment",
            locationLabel: "Page 4",
            chunkIndex: 0,
            embedding: [0.2, 0.3],
            metadata: {
              filename: "biology.pdf",
              locationLabel: "Page 4",
              sourceId: TEST_SOURCE_ID.toHexString(),
            },
          },
          score: 0.55,
        },
      ]),
    };

    const mockCitationService = {
      summarize: vi.fn(),
      summarizeBatch: vi.fn(),
    };

    const mockSourceRepo = {
      ...sourceRepo,
      findByIds: vi.fn(),
    };

    const ragService = new RagService(
      mockEmbeddingService,
      mockChunkRepo as unknown as ChunkRepository,
      mockCitationService,
      mockSourceRepo as unknown as SourceRepository,
    );

    const results = await ragService.query(
      "totally unrelated word",
      [TEST_SOURCE_ID],
      TEST_USER_ID,
    );

    expect(results).toEqual([]);
    expect(mockSourceRepo.findByIds).not.toHaveBeenCalled();
  });
});

describe("Adapter injection smoke tests", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("ocrService adapter is registered on fastify instance", () => {
    expect(app.ocrService).toBeDefined();
    expect(typeof app.ocrService.transcribe).toBe("function");
  });

  it("citationService adapter is registered on fastify instance", () => {
    expect(app.citationService).toBeDefined();
    expect(typeof app.citationService.summarize).toBe("function");
    expect(typeof app.citationService.summarizeBatch).toBe("function");
  });

  it("ragService is registered on fastify instance", () => {
    expect(app.ragService).toBeDefined();
    expect(typeof app.ragService.query).toBe("function");
  });

  it("ocrPipelineService is registered on fastify instance", () => {
    expect(app.ocrPipelineService).toBeDefined();
    expect(typeof app.ocrPipelineService.transcribeAndSave).toBe("function");
  });
});
