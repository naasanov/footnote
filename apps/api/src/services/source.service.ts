import type { ObjectId } from "mongodb";
import type { Readable } from "stream";
import { NotFoundError } from "../domain/errors.js";
import type { Source, SourceScope } from "../domain/schemas.js";
import type { ChunkRepository } from "../repositories/chunk.repository.js";
import type { GridFsRepository } from "../repositories/gridfs.repository.js";
import type { NoteRepository } from "../repositories/note.repository.js";
import type { SourceRepository } from "../repositories/source.repository.js";

const SOURCE_COLORS = [
  "#E63946",
  "#457B9D",
  "#2D6A4F",
  "#E9C46A",
  "#9B5DE5",
  "#F4A261",
];

export class SourceService {
  constructor(
    private sourceRepo: SourceRepository,
    private noteRepo: NoteRepository,
    private chunkRepo: ChunkRepository,
    private gridfsRepo: GridFsRepository,
    // Fire-and-forget ingest function — Ticket 3 updates the container to inject the real one
    private runIngest: (sourceId: ObjectId) => Promise<void>,
  ) {}

  async listByScope(
    scopeType: "note" | "notebook",
    scopeId: ObjectId,
    userId: string,
  ): Promise<Source[]> {
    return this.sourceRepo.findByScope(scopeId, scopeType, userId);
  }

  async upload(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    scope: SourceScope,
    userId: string,
  ): Promise<Source> {
    // Store file in GridFS
    const gridfsFileId = await this.gridfsRepo.upload(
      fileBuffer,
      filename,
      mimeType,
    );

    // Assign color based on existing source count for this scope
    const count = await this.sourceRepo.countByScope(scope.id, scope.type);
    const color = SOURCE_COLORS[count % SOURCE_COLORS.length];

    // Create source document with status: processing
    const source = await this.sourceRepo.create({
      userId,
      scope,
      filename,
      mimeType,
      gridfsFileId,
      color,
    });

    await this.activateSourceForScope(source._id, source.scope);

    // Fire-and-forget ingest
    this.runIngest(source._id).catch(() => {
      // Errors are caught and handled within runIngest (Ticket 3)
    });

    return source;
  }

  async streamFile(
    id: ObjectId,
    userId: string,
  ): Promise<{ stream: Readable; mimeType: string; filename: string }> {
    const source = await this.sourceRepo.findById(id, userId);
    if (!source) throw new NotFoundError("Source not found");
    const [stream, mimeType] = await Promise.all([
      this.gridfsRepo.download(source.gridfsFileId),
      this.gridfsRepo.getMimeType(source.gridfsFileId),
    ]);
    return { stream, mimeType, filename: source.filename };
  }

  async rename(
    id: ObjectId,
    userId: string,
    filename: string,
  ): Promise<Source> {
    const source = await this.sourceRepo.update(id, userId, { filename });
    if (!source) throw new NotFoundError("Source not found");
    return source;
  }

  async delete(id: ObjectId, userId: string): Promise<void> {
    const source = await this.sourceRepo.findById(id, userId);
    if (!source) throw new NotFoundError("Source not found");

    // Delete chunks
    await this.chunkRepo.deleteBySourceId(source._id);

    // Delete GridFS file
    try {
      await this.gridfsRepo.delete(source.gridfsFileId);
    } catch {
      // ignore
    }

    // Delete source document
    await this.sourceRepo.delete(source._id, userId);

    // Remove this sourceId from all notes' activeSourceIds
    await this.noteRepo.removeActiveSourceIdFromAllNotes(source._id);
  }

  // Called by the ingest pipeline (Ticket 3) after a source reaches 'ready' status.
  // Adds the sourceId to activeSourceIds on all affected notes.
  async onSourceReady(sourceId: ObjectId): Promise<void> {
    const source = await this.sourceRepo.findByIdInternal(sourceId);
    if (!source) return;

    await this.activateSourceForScope(sourceId, source.scope);
  }

  async onSourceError(sourceId: ObjectId): Promise<void> {
    await this.noteRepo.removeActiveSourceIdFromAllNotes(sourceId);
  }

  private async activateSourceForScope(
    sourceId: ObjectId,
    scope: SourceScope,
  ): Promise<void> {
    if (scope.type === "notebook") {
      await this.noteRepo.addActiveSourceIdToNotebookNotes(
        scope.id,
        sourceId,
      );
    } else {
      await this.noteRepo.addActiveSourceIdToNote(scope.id, sourceId);
    }
  }
}
