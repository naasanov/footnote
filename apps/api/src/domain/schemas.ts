import { ObjectId } from "mongodb";
import { z } from "zod";

// Reusable ObjectId schema — validates that a value is a MongoDB ObjectId instance
export const ObjectIdSchema = z.instanceof(ObjectId);

// ─── Notebook ────────────────────────────────────────────────────────────────

export const NotebookSchema = z.object({
  _id: ObjectIdSchema,
  userId: z.string(),
  title: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Notebook = z.infer<typeof NotebookSchema>;

// ─── Note ─────────────────────────────────────────────────────────────────────

export const NoteSchema = z.object({
  _id: ObjectIdSchema,
  notebookId: ObjectIdSchema,
  userId: z.string(),
  // Backward-compat for legacy corrupted rows where title may be null.
  title: z.preprocess((v) => v ?? "Untitled Note", z.string()),
  canvasState: z.preprocess((v) => v ?? {}, z.record(z.unknown())),
  canvasBackground: z.preprocess((v) => v ?? "none", z.enum(["none", "dotted", "ruled"])),
  activeSourceIds: z.preprocess((v) => v ?? [], z.array(ObjectIdSchema)),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Note = z.infer<typeof NoteSchema>;

// ─── Source ───────────────────────────────────────────────────────────────────

export const SourceScopeSchema = z.object({
  type: z.enum(["note", "notebook"]),
  id: ObjectIdSchema,
});

export const SourceSchema = z.object({
  _id: ObjectIdSchema,
  userId: z.string(),
  scope: SourceScopeSchema,
  filename: z.string(),
  mimeType: z.string().nullish(),
  gridfsFileId: ObjectIdSchema,
  status: z.enum(["processing", "ready", "error"]),
  color: z.string(),
  createdAt: z.date(),
});

export type Source = z.infer<typeof SourceSchema>;
export type SourceScope = z.infer<typeof SourceScopeSchema>;

// ─── DocumentChunk ────────────────────────────────────────────────────────────

export const DocumentChunkSchema = z.object({
  _id: ObjectIdSchema,
  sourceId: ObjectIdSchema,
  userId: z.string(),
  text: z.string(),
  locationLabel: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  embedding: z.array(z.number()),
  metadata: z.object({
    filename: z.string(),
    locationLabel: z.string(),
    sourceId: z.string(),
  }),
});

export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;

// ─── OcrResult ────────────────────────────────────────────────────────────────

export const OcrResultSchema = z.object({
  _id: ObjectIdSchema,
  noteId: ObjectIdSchema,
  userId: z.string(),
  text: z.string(),
  bbox: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
  snapshotKey: z.string(),
  createdAt: z.date(),
});

export type OcrResult = z.infer<typeof OcrResultSchema>;
