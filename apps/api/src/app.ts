import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { env } from "./config/env.js";
import { AppError } from "./domain/errors.js";
import authPlugin from "./plugins/auth.js";
import containerPlugin from "./plugins/container.js";
import dbPlugin from "./plugins/db.js";
import notebooksRoute from "./routes/notebooks.js";
import notesRoute from "./routes/notes.js";
import ocrRoute from "./routes/ocr.js";
import ragRoute from "./routes/rag.js";
import sourcesRoute from "./routes/sources.js";

const usePrettyDevLogs =
  process.env.NODE_ENV !== "production" && process.env.VITEST !== "true";

function buildLoggerConfig(enabled: boolean | undefined) {
  if (enabled === false) {
    return false;
  }

  if (!usePrettyDevLogs) {
    return enabled ?? true;
  }

  return {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
        singleLine: true,
      },
    },
  };
}

export async function buildApp(opts: { logger?: boolean } = {}) {
  const useCompactRequestLogs = opts.logger !== false && usePrettyDevLogs;
  const fastify = Fastify({
    logger: buildLoggerConfig(opts.logger),
    pluginTimeout: 60_000,
    disableRequestLogging: useCompactRequestLogs,
  });

  if (useCompactRequestLogs) {
    fastify.addHook("onResponse", async (request, reply) => {
      request.log.info(
        {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          responseTime: `${reply.elapsedTime.toFixed(1)}ms`,
        },
        "request completed",
      );
    });
  }

  // Error handler — maps AppError subclasses to structured JSON responses
  fastify.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.name,
        message: error.message,
      });
    }

    if (typeof (error as { statusCode?: unknown }).statusCode === "number") {
      return reply.status((error as { statusCode: number }).statusCode).send({
        error: error.name,
        message: error.message,
      });
    }

    fastify.log.error(error);
    return reply.status(500).send({
      error: "InternalServerError",
      message: "An unexpected error occurred",
    });
  });

  // Plugins
  await fastify.register(cors, { origin: env.FRONTEND_URL });
  // 100 MB file size limit
  await fastify.register(multipart, {
    limits: { fileSize: 100 * 1024 * 1024 },
  });
  await fastify.register(dbPlugin);
  await fastify.register(authPlugin);
  await fastify.register(containerPlugin);

  // Routes
  fastify.get("/health", async () => ({ status: "ok" }));
  await fastify.register(notebooksRoute);
  await fastify.register(notesRoute);
  await fastify.register(sourcesRoute);
  await fastify.register(ocrRoute);
  await fastify.register(ragRoute);

  return fastify;
}
