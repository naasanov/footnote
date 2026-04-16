import type { FastifyPluginAsync } from "fastify";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { env } from "../config/env.js";
import { ValidationError } from "../domain/errors.js";

const ragQuerySchema = z.object({
  text: z.string(),
  sourceIds: z.array(z.string().regex(/^[a-f0-9]{24}$/, "Invalid sourceId")),
  pipelineId: z.string().min(1).optional(),
});

const ragRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/rag/query",
    { preHandler: [fastify.requireAuth] },
    async (req, reply) => {
      const startedAt = performance.now();
      const parsed = ragQuerySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors[0]!.message);
      }

      const { text, sourceIds, pipelineId } = parsed.data;

      const chunks = await fastify.ragService.query(
        text,
        sourceIds.map((id) => new ObjectId(id)),
        req.userId,
      );
      const summaryRequestId =
        chunks.length > 0
          ? fastify.ragSummaryJobService.createJob(req.userId, pipelineId, () =>
              fastify.ragService.summarize(text, chunks),
            )
          : null;

      if (env.RAG_DEBUG_TIMING) {
        req.log.info(
          {
            endpointDurationMs: Math.round(performance.now() - startedAt),
            resultCount: chunks.length,
            sourceCount: sourceIds.length,
            summaryRequestId,
            pipelineId: pipelineId ?? null,
            textLength: text.length,
          },
          "rag query endpoint timing",
        );
      }

      return reply.send({ chunks, summaryRequestId });
    },
  );

  fastify.get(
    "/rag/summaries/:id",
    { preHandler: [fastify.requireAuth] },
    async (req, reply) => {
      const parsed = z
        .object({ id: z.string().uuid() })
        .safeParse(req.params);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors[0]!.message);
      }

      const job = fastify.ragSummaryJobService.getJob(parsed.data.id, req.userId);
      if (!job) {
        return reply.status(404).send({
          error: "NotFound",
          message: "Summary job not found",
        });
      }

      if (env.RAG_DEBUG_TIMING) {
        req.log.info(
          {
            summaryRequestId: parsed.data.id,
            pipelineId: job.pipelineId ?? null,
            status: job.status,
            summaryCount: job.summaries.length,
          },
          "rag summary poll",
        );
      }

      return reply.send(job);
    },
  );
};

export default ragRoute;
