import type { OcrService } from "./OcrService.js";

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
}

interface ClaudeOcrServiceOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetryAttempts?: number;
  initialBackoffMs?: number;
}

const NO_HANDWRITING_SENTINEL = "NO_HANDWRITING_DETECTED";

const CLAUDE_EMPTY_TRANSCRIPTION_PATTERNS = [
  /\bno handwriting detected\b/i,
  /\bno handwritten text\b/i,
  /\bno handwriting\b/i,
  /\bno readable handwritten text\b/i,
  /\bno text (?:is )?visible\b/i,
  /\bno text detected\b/i,
  /\bempty string\b/i,
];

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripClaudeMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .trim();
}

function normalizeClaudeOcrText(text: string): string {
  const normalized = stripClaudeMarkdown(text);
  if (!normalized) {
    return "";
  }

  if (normalized === NO_HANDWRITING_SENTINEL) {
    console.info("Claude OCR returned no-handwriting sentinel", {
      responseText: normalized,
    });
    return "";
  }

  const normalizedForDetection = normalized
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const matchedEmptyPattern = CLAUDE_EMPTY_TRANSCRIPTION_PATTERNS.find(
    (pattern) => pattern.test(normalizedForDetection),
  );

  if (matchedEmptyPattern) {
    console.warn("Claude OCR returned non-sentinel empty transcription", {
      matchedPattern: matchedEmptyPattern.source,
      responseText: normalized,
    });
    return "";
  }

  return normalized;
}

export class ClaudeOcrService implements OcrService {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRetryAttempts: number;
  private readonly initialBackoffMs: number;

  constructor(
    private readonly apiKey: string,
    options: ClaudeOcrServiceOptions = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.maxRetryAttempts = options.maxRetryAttempts ?? 3;
    this.initialBackoffMs = options.initialBackoffMs ?? 750;
  }

  async transcribe(imageBase64: string, mimeType: string): Promise<string> {
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
              model: "claude-sonnet-4-6",
              max_tokens: 1024,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "image",
                      source: {
                        type: "base64",
                        media_type: mimeType,
                        data: imageBase64,
                      },
                    },
                    {
                      type: "text",
                      text: `Transcribe all handwritten text from this image exactly as written. Include every word, abbreviation, and symbol you can read. If no handwritten text is visible or readable, return exactly ${NO_HANDWRITING_SENTINEL}. Return only the transcription or exactly ${NO_HANDWRITING_SENTINEL}. Do not add any explanation, markdown, labels, or extra words.`,
                    },
                  ],
                },
              ],
            }),
          },
        );

        if (!response.ok) {
          const message = await response.text();
          // 400 "Could not process image" means the image has no processable content
          // (e.g. blank, too small, unsupported format) — treat as empty transcription
          if (
            response.status === 400 &&
            message.includes("Could not process image")
          ) {
            return "";
          }

          if (
            this.shouldRetry(response.status) &&
            attempt < this.maxRetryAttempts
          ) {
            await this.sleep(this.getBackoffMs(attempt));
            continue;
          }

          throw new Error(
            `Claude OCR request failed: ${response.status} ${message}`,
          );
        }

        const data = (await response.json()) as AnthropicResponse;
        const text = (data.content ?? [])
          .filter(
            (block) => block.type === "text" && typeof block.text === "string",
          )
          .map((block) => block.text!.trim())
          .filter(Boolean)
          .join("\n");

        return normalizeClaudeOcrText(text);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (
          !this.isRetryableError(lastError) ||
          attempt >= this.maxRetryAttempts
        ) {
          throw lastError;
        }

        await this.sleep(this.getBackoffMs(attempt));
      }
    }

    throw lastError ?? new Error("Claude OCR request failed");
  }

  private shouldRetry(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private isRetryableError(error: Error): boolean {
    return (
      !error.message.startsWith("Claude OCR request failed:") ||
      error.message.startsWith("Claude OCR request failed: 429") ||
      /^Claude OCR request failed: 5\d{2}/.test(error.message)
    );
  }

  private getBackoffMs(attempt: number): number {
    return this.initialBackoffMs * 2 ** (attempt - 1);
  }
}
