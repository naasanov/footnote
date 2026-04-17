import type {
  CitationChunkInput,
  CitationService,
  CitationSummaryResult,
} from "./CitationService.js";

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
}

interface ClaudeCitationServiceOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetryAttempts?: number;
  initialBackoffMs?: number;
  model?: string;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSummary(summary: string): string {
  const trimmed = summary.trim();
  if (!trimmed) {
    return "";
  }

  const withoutGenericPrefix = trimmed.replace(
    /^(?:this|the)\s+passage\s+(?:is\s+)?/i,
    "",
  );

  const normalized = withoutGenericPrefix.trim();
  if (!normalized) {
    return trimmed;
  }

  const singleSentence = normalized
    .split(/(?<=[.!?])\s+/)
    .find((sentence) => sentence.trim().length > 0)
    ?.trim() ?? normalized;

  const withoutTrailingPunctuation = singleSentence.replace(/[.!?]+$/, "");

  return withoutTrailingPunctuation.charAt(0).toUpperCase() + withoutTrailingPunctuation.slice(1);
}

export class ClaudeCitationService implements CitationService {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRetryAttempts: number;
  private readonly initialBackoffMs: number;
  private readonly model: string;

  constructor(
    private readonly apiKey: string,
    options: ClaudeCitationServiceOptions = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.maxRetryAttempts = options.maxRetryAttempts ?? 3;
    this.initialBackoffMs = options.initialBackoffMs ?? 750;
    this.model = options.model ?? "claude-sonnet-4-6";
  }

  async summarize(
    query: string,
    chunk: Omit<CitationChunkInput, "chunkId">,
  ): Promise<string> {
    const [result] = await this.summarizeBatch(query, [
      { chunkId: "chunk-0", ...chunk },
    ]);

    return result?.summary ?? "";
  }

  async summarizeBatch(
    query: string,
    chunks: CitationChunkInput[],
  ): Promise<CitationSummaryResult[]> {
    const normalizedChunks = chunks.map((chunk) => ({
      ...chunk,
      text: chunk.text.slice(0, 1200),
    }));

    const prompt = `You are helping a student understand why a passage matched their writing.

The student is writing about: "${query}"

You will receive a JSON array of retrieved passage excerpts. For each excerpt, write one very short explanation of why it matched the student's writing.

Return JSON only, with this exact shape:
{"results":[{"chunkId":"string","summary":"string"}]}

Rules:
- Keep the same chunkId values you receive.
- Include one result for every input chunk.
- Keep each summary to a single short sentence fragment or a very short sentence.
- Prefer 6 to 14 words.
- Explain the relevance, not the excerpt overall.
- Start directly with the matching concept, event, definition, claim, mechanism, or overlap.
- Do not use filler like "This passage", "The excerpt", "It explains", "It describes", or "Matches because".
- Avoid repeating the excerpt. Write the shortest useful reason the student would care.
- Do not include markdown fences or any text outside the JSON.

Excerpts:
${JSON.stringify(normalizedChunks)}`;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxRetryAttempts; attempt += 1) {
      try {
        const response = await this.fetchImpl(
          "https://api.anthropic.com/v1/messages",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": this.apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: this.model,
              max_tokens: 220,
              messages: [{ role: "user", content: prompt }],
            }),
          },
        );

        if (!response.ok) {
          const message = await response.text();
          if (this.shouldRetry(response.status) && attempt < this.maxRetryAttempts) {
            await this.sleep(this.getBackoffMs(attempt));
            continue;
          }

          throw new Error(
            `Claude citation request failed: ${response.status} ${message}`,
          );
        }

        const data = (await response.json()) as AnthropicResponse;
        const text = (data.content ?? [])
          .filter(
            (block) => block.type === "text" && typeof block.text === "string",
          )
          .map((block) => block.text!.trim())
          .filter(Boolean)
          .join(" ");

        return this.parseBatchResponse(text, normalizedChunks);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!this.isRetryableError(lastError) || attempt >= this.maxRetryAttempts) {
          throw lastError;
        }

        await this.sleep(this.getBackoffMs(attempt));
      }
    }

    throw lastError ?? new Error("Claude citation request failed");
  }

  private shouldRetry(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private isRetryableError(error: Error): boolean {
    return (
      !error.message.startsWith("Claude citation request failed:") ||
      error.message.startsWith("Claude citation request failed: 429") ||
      /^Claude citation request failed: 5\d{2}/.test(error.message)
    );
  }

  private getBackoffMs(attempt: number): number {
    return this.initialBackoffMs * 2 ** (attempt - 1);
  }

  private parseBatchResponse(
    text: string,
    chunks: CitationChunkInput[],
  ): CitationSummaryResult[] {
    const normalized = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(normalized) as {
      results?: Array<{ chunkId?: string; summary?: string }>;
    };

    if (!Array.isArray(parsed.results)) {
      throw new Error("Claude citation request failed: invalid JSON payload");
    }

    const summaryMap = new Map<string, string>();
    for (const entry of parsed.results) {
      if (
        typeof entry?.chunkId === "string" &&
        typeof entry?.summary === "string"
      ) {
        summaryMap.set(entry.chunkId, normalizeSummary(entry.summary));
      }
    }

    return chunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      summary: summaryMap.get(chunk.chunkId) ?? "",
    }));
  }
}
