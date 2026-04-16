import type { FastifyPluginAsync } from "fastify";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { env } from "../config/env.js";
import { ValidationError } from "../domain/errors.js";

const ocrBodySchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
  noteId: z.string().regex(/^[a-f0-9]{24}$/, "Invalid noteId"),
  snapshotKey: z.string().min(1),
  bbox: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
  pipelineId: z.string().min(1).optional(),
});

const ocrRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/ocr",
    { preHandler: [fastify.requireAuth] },
    async (req, reply) => {
      const startedAt = performance.now();
      const parsed = ocrBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors[0]!.message);
      }

      const { imageBase64, mimeType, noteId, snapshotKey, bbox, pipelineId } = parsed.data;

      const text = await fastify.ocrPipelineService.transcribeAndSave({
        imageBase64,
        mimeType,
        noteId: new ObjectId(noteId),
        userId: req.userId,
        snapshotKey,
        bbox,
        pipelineId,
      });

      if (env.RAG_DEBUG_TIMING) {
        req.log.info(
          {
            pipelineId: pipelineId ?? null,
            endpointDurationMs: Math.round(performance.now() - startedAt),
            textLength: text.length,
          },
          "ocr endpoint timing",
        );
      }

      return reply.send({ text });
    },
  );
};

export default ocrRoute;
