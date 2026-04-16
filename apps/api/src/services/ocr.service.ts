import { ObjectId } from "mongodb";
import type { FastifyBaseLogger } from "fastify";
import type { OcrService as OcrAdapter } from "../adapters/ocr/OcrService.js";
import type { OcrResultRepository } from "../repositories/ocr-result.repository.js";

export class OcrPipelineService {
  constructor(
    private ocrAdapter: OcrAdapter,
    private ocrResultRepo: OcrResultRepository,
    private logger?: FastifyBaseLogger,
    private timingEnabled = false,
  ) {}

  async transcribeAndSave(params: {
    imageBase64: string;
    mimeType: string;
    noteId: ObjectId;
    userId: string;
    snapshotKey: string;
    bbox: { x: number; y: number; w: number; h: number };
    pipelineId?: string;
  }): Promise<string> {
    const totalStartedAt = performance.now();
    const transcribeStartedAt = performance.now();
    const text = await this.ocrAdapter.transcribe(
      params.imageBase64,
      params.mimeType,
    );
    const transcribeDurationMs = performance.now() - transcribeStartedAt;

    const persistStartedAt = performance.now();
    await this.ocrResultRepo.upsert({
      noteId: params.noteId,
      userId: params.userId,
      snapshotKey: params.snapshotKey,
      text,
      bbox: params.bbox,
    });
    const persistDurationMs = performance.now() - persistStartedAt;

    if (this.timingEnabled && this.logger) {
      this.logger.info(
        {
          pipelineId: params.pipelineId ?? null,
          totalDurationMs: Math.round(performance.now() - totalStartedAt),
          transcribeDurationMs: Math.round(transcribeDurationMs),
          persistDurationMs: Math.round(persistDurationMs),
          textLength: text.length,
        },
        "ocr pipeline timings",
      );
    }

    return text;
  }
}
