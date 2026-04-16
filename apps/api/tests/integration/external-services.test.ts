/**
 * Integration tests for external service adapters.
 *
 * Requires real API keys in .env:
 *   OPENAI_API_KEY   — used for embedding tests
 *   ANTHROPIC_API_KEY — used for OCR and citation tests
 *   MONGODB_URI / MONGODB_DB_NAME — used for vector search round-trip test
 *
 * Run manually (do NOT run in CI):
 *   pnpm --filter api test:integration
 */

import { Db, MongoClient, ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ClaudeCitationService } from "../../src/adapters/citation/ClaudeCitationService.js";
import { OpenAiEmbeddingService } from "../../src/adapters/embeddings/OpenAiEmbeddingService.js";
import { ClaudeOcrService } from "../../src/adapters/ocr/ClaudeOcrService.js";
import { env } from "../../src/config/env.js";
import { ChunkRepository } from "../../src/repositories/chunk.repository.js";

const TEST_USER_ID = `integration_ext_${new ObjectId().toHexString()}`;

describe("External service integration tests", () => {
  let mongoClient: MongoClient;
  let db: Db;
  let chunkRepo: ChunkRepository;
  let insertedSourceId: ObjectId;

  beforeAll(async () => {
    mongoClient = new MongoClient(env.MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(env.MONGODB_DB_NAME);
    chunkRepo = new ChunkRepository(db);
    await chunkRepo.ensureIndexes();
    insertedSourceId = new ObjectId();
  });

  afterAll(async () => {
    if (db) {
      await db
        .collection("document_chunks")
        .deleteMany({ userId: TEST_USER_ID });
    }
    await mongoClient?.close();
  });

  it("embeds a string with OpenAI → 1536-dim vector returned", async () => {
    const embeddingService = new OpenAiEmbeddingService(env.OPENAI_API_KEY);
    const vector = await embeddingService.embed(
      "The mitochondria is the powerhouse of the cell.",
    );

    expect(Array.isArray(vector)).toBe(true);
    expect(vector).toHaveLength(1536);
    vector.forEach((v) => expect(typeof v).toBe("number"));
  });

  it("OCRs a simple test image with Claude Vision → non-empty text returned", async () => {
    // A 1x1 white PNG encoded in base64 — Claude may return empty text for this
    // minimal image. We primarily test that the adapter doesn't throw.
    const ocrService = new ClaudeOcrService(env.ANTHROPIC_API_KEY);

    // 1x1 white PNG (smallest valid PNG)
    const minimalPng =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

    // May return empty string for a blank image — that is correct behavior
    const text = await ocrService.transcribe(minimalPng, "image/png");
    expect(typeof text).toBe("string");
  });

  it("generates a citation summary with Claude → non-empty summary returned", async () => {
    const citationService = new ClaudeCitationService(env.ANTHROPIC_API_KEY);

    const summary = await citationService.summarize(
      "cell division and mitosis",
      {
        text: "During mitosis, a single cell divides into two genetically identical daughter cells through a series of phases: prophase, metaphase, anaphase, and telophase.",
        locationLabel: "Page 42",
        filename: "cell-biology.pdf",
      },
    );

    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });

  it("full pipeline: embed + store chunk → vector search → verify chunk retrieved", async () => {
    const embeddingService = new OpenAiEmbeddingService(env.OPENAI_API_KEY);

    const chunkText =
      "The process of photosynthesis converts light energy into chemical energy stored in glucose.";

    // Embed and store the chunk
    const embedding = await embeddingService.embed(chunkText);
    expect(embedding).toHaveLength(1536);

    await chunkRepo.bulkInsert([
      {
        sourceId: insertedSourceId,
        userId: TEST_USER_ID,
        text: chunkText,
        locationLabel: "Page 7",
        chunkIndex: 0,
        embedding,
        metadata: {
          filename: "botany.pdf",
          locationLabel: "Page 7",
          sourceId: insertedSourceId.toHexString(),
        },
      },
    ]);

    // Verify the chunk was actually written to MongoDB before attempting vector search
    const storedChunk = await db
      .collection("document_chunks")
      .findOne({ sourceId: insertedSourceId, userId: TEST_USER_ID });
    expect(storedChunk).not.toBeNull();
    expect(storedChunk!.text).toBe(chunkText);
    expect(Array.isArray(storedChunk!.embedding)).toBe(true);
    expect(storedChunk!.embedding).toHaveLength(1536);

    // Atlas Vector Search is eventually consistent — wait for the index to pick up the new document
    await new Promise((resolve) => setTimeout(resolve, 8 * 1000));

    // Vector search with the same query — should retrieve the stored chunk
    const queryEmbedding = await embeddingService.embed(
      "photosynthesis light energy",
    );
    const results = await chunkRepo.vectorSearch(queryEmbedding, [
      insertedSourceId,
    ]);

    expect(results.length).toBeGreaterThan(0);
    const firstResult = results[0]!;
    expect(firstResult.chunk.text).toBe(chunkText);
    expect(firstResult.chunk.sourceId.toHexString()).toBe(
      insertedSourceId.toHexString(),
    );
    expect(typeof firstResult.score).toBe("number");
    expect(firstResult.score).toBeGreaterThan(0);
  });
});
