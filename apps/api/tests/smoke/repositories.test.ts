import type { Db } from "mongodb";
import { MongoClient, ObjectId } from "mongodb";
import { Readable } from "stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "../../src/config/env.js";
import { ChunkRepository } from "../../src/repositories/chunk.repository.js";
import { GridFsRepository } from "../../src/repositories/gridfs.repository.js";
import { NoteRepository } from "../../src/repositories/note.repository.js";
import { NotebookRepository } from "../../src/repositories/notebook.repository.js";
import { OcrResultRepository } from "../../src/repositories/ocr-result.repository.js";
import { SourceRepository } from "../../src/repositories/source.repository.js";

// Unique userId so test data can be bulk-cleaned up without touching real data
const TEST_USER_ID = `smoke_test_${new ObjectId().toHexString()}`;

let client: MongoClient;
let db: Db;

beforeAll(async () => {
  client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  db = client.db(env.MONGODB_DB_NAME);

  // Ensure all indexes are created before running tests
  await new NotebookRepository(db).ensureIndexes();
  await new NoteRepository(db).ensureIndexes();
  await new SourceRepository(db).ensureIndexes();
  await new ChunkRepository(db).ensureIndexes();
  await new OcrResultRepository(db).ensureIndexes();
});

afterAll(async () => {
  if (!db || !client) return;
  await db.collection("notebooks").deleteMany({ userId: TEST_USER_ID });
  await db.collection("notes").deleteMany({ userId: TEST_USER_ID });
  await db.collection("sources").deleteMany({ userId: TEST_USER_ID });
  await db.collection("document_chunks").deleteMany({ userId: TEST_USER_ID });
  await db.collection("ocr_results").deleteMany({ userId: TEST_USER_ID });
  await client.close();
});

// ─── Helper ──────────────────────────────────────────────────────────────────

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

// ─── Notebook CRUD ───────────────────────────────────────────────────────────

describe("NotebookRepository", () => {
  it("create, read, update, delete", async () => {
    const repo = new NotebookRepository(db);

    // Create
    const created = await repo.create({
      userId: TEST_USER_ID,
      title: "Test Notebook",
    });
    expect(created._id).toBeInstanceOf(ObjectId);
    expect(created.userId).toBe(TEST_USER_ID);
    expect(created.title).toBe("Test Notebook");
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);

    // Read by ID
    const found = await repo.findById(created._id, TEST_USER_ID);
    expect(found).not.toBeNull();
    expect(found!._id.toHexString()).toBe(created._id.toHexString());

    // Read all by userId
    const all = await repo.findAllByUserId(TEST_USER_ID);
    expect(
      all.some((n) => n._id.toHexString() === created._id.toHexString()),
    ).toBe(true);

    // Update
    const updated = await repo.update(created._id, TEST_USER_ID, {
      title: "Renamed",
    });
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe("Renamed");
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(
      created.updatedAt.getTime(),
    );

    // Delete
    const deleted = await repo.delete(created._id, TEST_USER_ID);
    expect(deleted).toBe(true);

    const gone = await repo.findById(created._id, TEST_USER_ID);
    expect(gone).toBeNull();
  });
});

// ─── Note CRUD ───────────────────────────────────────────────────────────────

describe("NoteRepository", () => {
  it("create with activeSourceIds: [], update canvas state, verify persistence", async () => {
    const repo = new NoteRepository(db);
    const notebookId = new ObjectId();

    // Create with empty activeSourceIds
    const note = await repo.create({
      notebookId,
      userId: TEST_USER_ID,
      title: "Lecture 1",
      activeSourceIds: [],
    });
    expect(note._id).toBeInstanceOf(ObjectId);
    expect(note.activeSourceIds).toEqual([]);
    expect(note.canvasState).toEqual({});
    expect(note.canvasBackground).toBe("none");

    // Update canvas state
    const canvas = { shapes: [{ id: "shape:1", type: "draw" }] };
    const withCanvas = await repo.updateCanvasState(
      note._id,
      TEST_USER_ID,
      canvas,
    );
    expect(withCanvas).not.toBeNull();
    expect(withCanvas!.canvasState).toEqual(canvas);

    // Verify persistence — read back from DB
    const reloaded = await repo.findById(note._id, TEST_USER_ID);
    expect(reloaded!.canvasState).toEqual(canvas);

    const withBackground = await repo.patch(note._id, TEST_USER_ID, {
      canvasBackground: "dotted",
    });
    expect(withBackground!.canvasBackground).toBe("dotted");

    // Update activeSourceIds
    const sourceId = new ObjectId();
    const withSources = await repo.updateActiveSourceIds(
      note._id,
      TEST_USER_ID,
      [sourceId],
    );
    expect(withSources!.activeSourceIds).toHaveLength(1);
    expect(withSources!.activeSourceIds[0].toHexString()).toBe(
      sourceId.toHexString(),
    );

    // Basic update (title)
    const renamed = await repo.update(note._id, TEST_USER_ID, {
      title: "Lecture 1 – Updated",
    });
    expect(renamed!.title).toBe("Lecture 1 – Updated");

    // Delete
    const deleted = await repo.delete(note._id, TEST_USER_ID);
    expect(deleted).toBe(true);
    expect(await repo.findById(note._id, TEST_USER_ID)).toBeNull();
  });

  it("adds and removes active source ids for note and notebook scopes", async () => {
    const repo = new NoteRepository(db);
    const notebookId = new ObjectId();
    const noteOne = await repo.create({
      notebookId,
      userId: TEST_USER_ID,
      title: "Lecture A",
      activeSourceIds: [],
    });
    const noteTwo = await repo.create({
      notebookId,
      userId: TEST_USER_ID,
      title: "Lecture B",
      activeSourceIds: [],
    });

    const notebookSourceId = new ObjectId();
    const noteSourceId = new ObjectId();

    await repo.addActiveSourceIdToNotebookNotes(notebookId, notebookSourceId);
    await repo.addActiveSourceIdToNote(noteOne._id, noteSourceId);

    const updatedNoteOne = await repo.findById(noteOne._id, TEST_USER_ID);
    const updatedNoteTwo = await repo.findById(noteTwo._id, TEST_USER_ID);

    expect(updatedNoteOne?.activeSourceIds.map((id) => id.toHexString())).toEqual([
      notebookSourceId.toHexString(),
      noteSourceId.toHexString(),
    ]);
    expect(updatedNoteTwo?.activeSourceIds.map((id) => id.toHexString())).toEqual([
      notebookSourceId.toHexString(),
    ]);

    await repo.removeActiveSourceIdFromAllNotes(notebookSourceId);
    await repo.removeActiveSourceIdFromAllNotes(noteSourceId);

    const cleanedNoteOne = await repo.findById(noteOne._id, TEST_USER_ID);
    const cleanedNoteTwo = await repo.findById(noteTwo._id, TEST_USER_ID);

    expect(cleanedNoteOne?.activeSourceIds).toEqual([]);
    expect(cleanedNoteTwo?.activeSourceIds).toEqual([]);
  });
});

// ─── Source CRUD ─────────────────────────────────────────────────────────────

describe("SourceRepository", () => {
  it("create with status processing, update to ready, read back", async () => {
    const repo = new SourceRepository(db);
    const notebookId = new ObjectId();
    const fakeFileId = new ObjectId();

    const source = await repo.create({
      userId: TEST_USER_ID,
      scope: { type: "notebook", id: notebookId },
      filename: "lecture.pdf",
      gridfsFileId: fakeFileId,
      color: "#2D5016",
    });
    expect(source._id).toBeInstanceOf(ObjectId);
    expect(source.status).toBe("processing");

    // Update to ready
    const ready = await repo.updateStatus(source._id, "ready");
    expect(ready).not.toBeNull();
    expect(ready!.status).toBe("ready");

    // Read back by scope
    const list = await repo.findByScope(notebookId, "notebook", TEST_USER_ID);
    expect(
      list.some((s) => s._id.toHexString() === source._id.toHexString()),
    ).toBe(true);
    expect(
      list.find((s) => s._id.toHexString() === source._id.toHexString())!
        .status,
    ).toBe("ready");

    // Delete
    const deleted = await repo.delete(source._id, TEST_USER_ID);
    expect(deleted).toBe(true);
    expect(await repo.findById(source._id, TEST_USER_ID)).toBeNull();
  });
});

// ─── Chunk bulk insert + delete ──────────────────────────────────────────────

describe("ChunkRepository", () => {
  it("bulk insert 5 chunks, delete by sourceId, verify all removed", async () => {
    const repo = new ChunkRepository(db);
    const sourceId = new ObjectId();

    const chunks = Array.from({ length: 5 }, (_, i) => ({
      sourceId,
      userId: TEST_USER_ID,
      text: `Chunk text ${i}`,
      locationLabel: `Page ${i + 1}`,
      chunkIndex: i,
      embedding: Array.from({ length: 1536 }, () => Math.random()),
      metadata: {
        filename: "lecture.pdf",
        locationLabel: `Page ${i + 1}`,
        sourceId: sourceId.toHexString(),
      },
    }));

    const ids = await repo.bulkInsert(chunks);
    expect(ids).toHaveLength(5);
    ids.forEach((id) => expect(id).toBeInstanceOf(ObjectId));

    // Verify they exist
    const count = await db
      .collection("document_chunks")
      .countDocuments({ sourceId });
    expect(count).toBe(5);

    // Delete by sourceId
    const deleted = await repo.deleteBySourceId(sourceId);
    expect(deleted).toBe(5);

    const remaining = await db
      .collection("document_chunks")
      .countDocuments({ sourceId });
    expect(remaining).toBe(0);
  });
});

// ─── GridFS upload / download / delete ───────────────────────────────────────

describe("GridFsRepository", () => {
  it("upload a buffer, download it back, compare bytes, delete", async () => {
    const repo = new GridFsRepository(db);

    const original = Buffer.from("Hello, GridFS smoke test!");
    const fileId = await repo.upload(original, "test.txt", "text/plain");
    expect(fileId).toBeInstanceOf(ObjectId);

    const stream = await repo.download(fileId);
    const downloaded = await streamToBuffer(stream);
    expect(downloaded.equals(original)).toBe(true);

    await repo.delete(fileId);

    // Confirm deletion — downloading should throw
    await expect(streamToBuffer(await repo.download(fileId))).rejects.toThrow();
  });
});

// ─── OcrResult upsert idempotency ────────────────────────────────────────────

describe("OcrResultRepository", () => {
  it("upsert same snapshotKey twice — verify only one document exists", async () => {
    const repo = new OcrResultRepository(db);
    const noteId = new ObjectId();
    const snapshotKey = "shape:abc,shape:def";

    const first = await repo.upsert({
      noteId,
      userId: TEST_USER_ID,
      snapshotKey,
      text: "Initial OCR text",
      bbox: { x: 0, y: 0, w: 100, h: 50 },
    });
    expect(first._id).toBeInstanceOf(ObjectId);
    expect(first.text).toBe("Initial OCR text");

    // Upsert again with updated text
    const second = await repo.upsert({
      noteId,
      userId: TEST_USER_ID,
      snapshotKey,
      text: "Updated OCR text",
      bbox: { x: 0, y: 0, w: 100, h: 50 },
    });
    expect(second._id.toHexString()).toBe(first._id.toHexString());
    expect(second.text).toBe("Updated OCR text");

    // Only one document should exist for this (noteId, snapshotKey) pair
    const count = await db
      .collection("ocr_results")
      .countDocuments({ noteId, snapshotKey });
    expect(count).toBe(1);

    // Cleanup
    await db.collection("ocr_results").deleteMany({ noteId });
  });
});
