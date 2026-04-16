import { Collection, Db, ObjectId } from "mongodb";
import { Source, SourceSchema, SourceScope } from "../domain/schemas.js";

export class SourceRepository {
  private collection: Collection;

  constructor(db: Db) {
    this.collection = db.collection("sources");
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ "scope.id": 1, "scope.type": 1 });
  }

  async findByScope(
    scopeId: ObjectId,
    scopeType: "note" | "notebook",
    userId: string,
  ): Promise<Source[]> {
    const docs = await this.collection
      .find({ "scope.id": scopeId, "scope.type": scopeType, userId })
      .toArray();
    return docs.map((doc) => SourceSchema.parse(doc));
  }

  async findById(id: ObjectId, userId: string): Promise<Source | null> {
    const doc = await this.collection.findOne({ _id: id, userId });
    if (!doc) return null;
    return SourceSchema.parse(doc);
  }

  async findByIds(ids: ObjectId[], userId: string): Promise<Source[]> {
    if (ids.length === 0) return [];
    const docs = await this.collection
      .find({ _id: { $in: ids }, userId })
      .toArray();
    return docs.map((doc) => SourceSchema.parse(doc));
  }

  async create(data: {
    userId: string;
    scope: SourceScope;
    filename: string;
    mimeType?: string;
    gridfsFileId: ObjectId;
    color: string;
  }): Promise<Source> {
    const now = new Date();
    const doc = {
      userId: data.userId,
      scope: data.scope,
      filename: data.filename,
      mimeType: data.mimeType,
      gridfsFileId: data.gridfsFileId,
      status: "processing" as const,
      color: data.color,
      createdAt: now,
    };
    const result = await this.collection.insertOne(doc);
    return SourceSchema.parse({ _id: result.insertedId, ...doc });
  }

  async updateStatus(
    id: ObjectId,
    status: "processing" | "ready" | "error",
  ): Promise<Source | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $set: { status } },
      { returnDocument: "after" },
    );
    if (!result) return null;
    return SourceSchema.parse(result);
  }

  async update(
    id: ObjectId,
    userId: string,
    updates: { filename?: string },
  ): Promise<Source | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { returnDocument: "after" },
    );
    if (!result) return null;
    return SourceSchema.parse(result);
  }

  async delete(id: ObjectId, userId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id, userId });
    return result.deletedCount === 1;
  }

  // Internal: find source without userId check (used by ingest pipeline and cascade deletes)
  async findByIdInternal(id: ObjectId): Promise<Source | null> {
    const doc = await this.collection.findOne({ _id: id });
    if (!doc) return null;
    return SourceSchema.parse(doc);
  }

  // Internal: find all sources for a scope without userId check (used for cascade deletes)
  async findByScopeInternal(
    scopeId: ObjectId,
    scopeType: "note" | "notebook",
  ): Promise<Source[]> {
    const docs = await this.collection
      .find({ "scope.id": scopeId, "scope.type": scopeType })
      .toArray();
    return docs.map((doc) => SourceSchema.parse(doc));
  }

  // Internal: find ready sources for a scope (used to initialize note activeSourceIds)
  async findReadyByScope(
    scopeId: ObjectId,
    scopeType: "note" | "notebook",
  ): Promise<Source[]> {
    const docs = await this.collection
      .find({ "scope.id": scopeId, "scope.type": scopeType, status: "ready" })
      .toArray();
    return docs.map((doc) => SourceSchema.parse(doc));
  }

  // Internal: count sources for color assignment
  async countByScope(
    scopeId: ObjectId,
    scopeType: "note" | "notebook",
  ): Promise<number> {
    return this.collection.countDocuments({
      "scope.id": scopeId,
      "scope.type": scopeType,
    });
  }

  // Internal: delete multiple sources by ID (used for cascade deletes)
  async deleteByIds(ids: ObjectId[]): Promise<void> {
    if (ids.length === 0) return;
    await this.collection.deleteMany({ _id: { $in: ids } });
  }
}
