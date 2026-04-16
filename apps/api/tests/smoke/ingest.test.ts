import type { Db } from "mongodb";
import { MongoClient, ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ParserRegistry } from "../../src/adapters/parsers/ParserRegistry.js";
import type { SourceParser } from "../../src/adapters/parsers/SourceParser.js";
import { env } from "../../src/config/env.js";
import { ChunkRepository } from "../../src/repositories/chunk.repository.js";
import { GridFsRepository } from "../../src/repositories/gridfs.repository.js";
import { SourceRepository } from "../../src/repositories/source.repository.js";
import { IngestService } from "../../src/services/ingest.service.js";

describe("IngestService smoke tests", () => {
  const TEST_USER_ID = `smoke_ingest_${new ObjectId().toHexString()}`;
  let client: MongoClient;
  let db: Db;
  let sourceRepo: SourceRepository;
  let chunkRepo: ChunkRepository;
  let gridfsRepo: GridFsRepository;
  const uploadedFileIds: ObjectId[] = [];

  class SuccessParser implements SourceParser {
    readonly supportedMimeTypes = ["application/test-success"];

    async parse(
      _buffer: Buffer,
      _filename: string,
    ): Promise<
      Array<{ text: string; locationLabel: string; chunkIndex: number }>
    > {
      return [
        { text: "Chunk one", locationLabel: "Page 1", chunkIndex: 0 },
        { text: "Chunk two", locationLabel: "Page 1", chunkIndex: 1 },
      ];
    }
  }

  class FailureParser implements SourceParser {
    readonly supportedMimeTypes = ["application/test-failure"];

    async parse(
      _buffer: Buffer,
      _filename: string,
    ): Promise<
      Array<{ text: string; locationLabel: string; chunkIndex: number }>
    > {
      return [
        {
          text: "This will fail in embedding",
          locationLabel: "Page 1",
          chunkIndex: 0,
        },
      ];
    }
  }

  beforeAll(async () => {
    client = new MongoClient(env.MONGODB_URI);
    await client.connect();
    db = client.db(env.MONGODB_DB_NAME);

    sourceRepo = new SourceRepository(db);
    chunkRepo = new ChunkRepository(db);
    gridfsRepo = new GridFsRepository(db);

    await Promise.all([sourceRepo.ensureIndexes(), chunkRepo.ensureIndexes()]);
  });

  afterAll(async () => {
    if (!db || !client) return;
    for (const fileId of uploadedFileIds) {
      try {
        await gridfsRepo.delete(fileId);
      } catch {
        // ignore
      }
    }
    await db.collection("document_chunks").deleteMany({ userId: TEST_USER_ID });
    await db.collection("sources").deleteMany({ userId: TEST_USER_ID });
    await client.close();
  });

  it("run() stores embedded chunks and marks source ready", async () => {
    const parserRegistry = new ParserRegistry();
    parserRegistry.register(new SuccessParser());

    const embeddingService = {
      embed: vi.fn(),
      embedBatch: vi.fn().mockResolvedValue([
        [0.1, 0.2],
        [0.3, 0.4],
      ]),
    };

    const ingestService = new IngestService(
      sourceRepo,
      chunkRepo,
      gridfsRepo,
      parserRegistry,
      embeddingService,
    );

    const gridfsFileId = await gridfsRepo.upload(
      Buffer.from("ingest success fixture"),
      "success.pdf",
      "application/test-success",
    );
    uploadedFileIds.push(gridfsFileId);

    const source = await sourceRepo.create({
      userId: TEST_USER_ID,
      scope: { type: "note", id: new ObjectId() },
      filename: "success.pdf",
      mimeType: "application/test-success",
      gridfsFileId,
      color: "#457B9D",
    });

    await ingestService.run(source._id);

    const storedChunks = await db
      .collection("document_chunks")
      .find({ sourceId: source._id })
      .toArray();
    expect(storedChunks).toHaveLength(2);
    expect(storedChunks[0]?.embedding).toEqual([0.1, 0.2]);
    expect(storedChunks[1]?.embedding).toEqual([0.3, 0.4]);

    const updatedSource = await sourceRepo.findByIdInternal(source._id);
    expect(updatedSource?.status).toBe("ready");
  });

  it("run() marks source error and removes partial chunks on embedding failure", async () => {
    const parserRegistry = new ParserRegistry();
    parserRegistry.register(new FailureParser());

    const embeddingService = {
      embed: vi.fn(),
      embedBatch: vi.fn().mockRejectedValue(new Error("embedding failed")),
    };

    const ingestService = new IngestService(
      sourceRepo,
      chunkRepo,
      gridfsRepo,
      parserRegistry,
      embeddingService,
    );

    const gridfsFileId = await gridfsRepo.upload(
      Buffer.from("ingest failure fixture"),
      "failure.pdf",
      "application/test-failure",
    );
    uploadedFileIds.push(gridfsFileId);

    const source = await sourceRepo.create({
      userId: TEST_USER_ID,
      scope: { type: "note", id: new ObjectId() },
      filename: "failure.pdf",
      mimeType: "application/test-failure",
      gridfsFileId,
      color: "#457B9D",
    });

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await ingestService.run(source._id);

    const updatedSource = await sourceRepo.findByIdInternal(source._id);
    expect(updatedSource?.status).toBe("error");

    const remainingChunks = await db
      .collection("document_chunks")
      .countDocuments({ sourceId: source._id });
    expect(remainingChunks).toBe(0);

    errSpy.mockRestore();
  });
});
