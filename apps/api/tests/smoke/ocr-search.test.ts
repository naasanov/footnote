// Must be hoisted before any import that transitively loads @clerk/backend
vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn().mockResolvedValue({ sub: "smoke_ocr_search_user" }),
}));

import type { FastifyInstance } from "fastify";
import { Db, MongoClient, ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { NoteRepository } from "../../src/repositories/note.repository.js";
import { NotebookRepository } from "../../src/repositories/notebook.repository.js";
import { OcrResultRepository } from "../../src/repositories/ocr-result.repository.js";

const TEST_USER_ID = "smoke_ocr_search_user";
const TEST_TOKEN = "Bearer smoke-test-token";

describe("OCR search route smoke tests", () => {
  let app: FastifyInstance;
  let mongoClient: MongoClient;
  let db: Db;
  let testNoteId: ObjectId;

  beforeAll(async () => {
    mongoClient = new MongoClient(env.MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(env.MONGODB_DB_NAME);

    app = await buildApp({ logger: false });
    await app.ready();

    // Create a real notebook and note so the service ownership check passes
    const notebookRepo = new NotebookRepository(db);
    const noteRepo = new NoteRepository(db);
    const ocrRepo = new OcrResultRepository(db);

    await notebookRepo.ensureIndexes();
    await noteRepo.ensureIndexes();
    await ocrRepo.ensureIndexes();

    const notebook = await notebookRepo.create({
      userId: TEST_USER_ID,
      title: "OCR Search Test Notebook",
    });

    const note = await noteRepo.create({
      notebookId: notebook._id,
      userId: TEST_USER_ID,
      title: "OCR Search Test Note",
      activeSourceIds: [],
    });
    testNoteId = note._id;

    // Insert two OCR results so text search has something to find
    await ocrRepo.upsert({
      noteId: testNoteId,
      userId: TEST_USER_ID,
      snapshotKey: "shape:aaa",
      text: "photosynthesis converts sunlight into energy",
      bbox: { x: 0, y: 0, w: 200, h: 50 },
    });

    await ocrRepo.upsert({
      noteId: testNoteId,
      userId: TEST_USER_ID,
      snapshotKey: "shape:bbb",
      text: "mitosis cell division phases",
      bbox: { x: 0, y: 100, w: 200, h: 50 },
    });
  });

  afterAll(async () => {
    if (db) {
      await db
        .collection("ocr_results")
        .deleteMany({ userId: TEST_USER_ID });
      await db.collection("notes").deleteMany({ userId: TEST_USER_ID });
      await db.collection("notebooks").deleteMany({ userId: TEST_USER_ID });
    }
    await app?.close();
    await mongoClient?.close();
  });

  it("returns matching OCR results for a valid query", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/notes/${testNoteId.toHexString()}/ocr-search?q=photosynthesis`,
      headers: { Authorization: TEST_TOKEN },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ text: string; bbox: object }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toMatchObject({
      text: expect.any(String),
      bbox: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    });
  });

  it("returns empty array when no results match", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/notes/${testNoteId.toHexString()}/ocr-search?q=xyznonexistentterm987`,
      headers: { Authorization: TEST_TOKEN },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it("returns 400 when query param q is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/notes/${testNoteId.toHexString()}/ocr-search`,
      headers: { Authorization: TEST_TOKEN },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when note id is invalid", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/notes/not-a-valid-id/ocr-search?q=photosynthesis",
      headers: { Authorization: TEST_TOKEN },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when note does not exist", async () => {
    const missingId = new ObjectId().toHexString();
    const res = await app.inject({
      method: "GET",
      url: `/notes/${missingId}/ocr-search?q=photosynthesis`,
      headers: { Authorization: TEST_TOKEN },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 401 when no auth token is provided", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/notes/${testNoteId.toHexString()}/ocr-search?q=photosynthesis`,
    });

    expect(res.statusCode).toBe(401);
  });
});
