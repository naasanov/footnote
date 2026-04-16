import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";

export interface RagSummaryJobResult {
  chunkId: string;
  summary: string;
}

type RagSummaryJobStatus = "pending" | "completed" | "failed";

interface RagSummaryJob {
  userId: string;
  status: RagSummaryJobStatus;
  summaries: RagSummaryJobResult[];
  createdAt: number;
  pipelineId?: string;
  error?: string;
}

const JOB_TTL_MS = 5 * 60 * 1000;

export class RagSummaryJobService {
  constructor(
    private readonly logger?: FastifyBaseLogger,
    private readonly debugTiming = false,
  ) {}

  private jobs = new Map<string, RagSummaryJob>();

  createJob(
    userId: string,
    pipelineId: string | undefined,
    run: () => Promise<RagSummaryJobResult[]>,
  ): string {
    this.pruneExpiredJobs();

    const jobId = randomUUID();
    this.jobs.set(jobId, {
      userId,
      status: "pending",
      summaries: [],
      createdAt: Date.now(),
      pipelineId,
    });

    if (this.debugTiming && this.logger) {
      this.logger.info({ jobId, pipelineId: pipelineId ?? null }, "rag summary job created");
    }

    void run()
      .then((summaries) => {
        const job = this.jobs.get(jobId);
        if (!job) return;

        this.jobs.set(jobId, {
          ...job,
          status: "completed",
          summaries,
        });

        if (this.debugTiming && this.logger) {
          this.logger.info(
            { jobId, pipelineId: job.pipelineId ?? null, summaryCount: summaries.length },
            "rag summary job completed",
          );
        }
      })
      .catch((error) => {
        const job = this.jobs.get(jobId);
        if (!job) return;

        this.jobs.set(jobId, {
          ...job,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });

        if (this.debugTiming && this.logger) {
          this.logger.warn(
            {
              jobId,
              pipelineId: job.pipelineId ?? null,
              error: error instanceof Error ? error.message : String(error),
            },
            "rag summary job failed",
          );
        }
      });

    return jobId;
  }

  getJob(jobId: string, userId: string): {
    status: RagSummaryJobStatus;
    summaries: RagSummaryJobResult[];
    pipelineId?: string;
    error?: string;
  } | null {
    this.pruneExpiredJobs();

    const job = this.jobs.get(jobId);
    if (!job || job.userId !== userId) {
      return null;
    }

    return {
      status: job.status,
      summaries: job.summaries,
      pipelineId: job.pipelineId,
      error: job.error,
    };
  }

  private pruneExpiredJobs(): void {
    const cutoff = Date.now() - JOB_TTL_MS;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.createdAt < cutoff) {
        this.jobs.delete(jobId);

        if (this.debugTiming && this.logger) {
          this.logger.info({ jobId, pipelineId: job.pipelineId ?? null }, "rag summary job expired");
        }
      }
    }
  }
}
