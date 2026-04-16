import { describe, expect, it, vi } from "vitest";
import { ClaudeOcrService } from "../../src/adapters/ocr/ClaudeOcrService.js";

describe("ClaudeOcrService", () => {
  it("retries with backoff after a 429 and eventually returns text", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            type: "error",
            error: {
              type: "rate_limit_error",
              message: "Rate limited",
            },
          }),
          { status: 429 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [{ type: "text", text: "Recovered transcription" }],
          }),
          { status: 200 },
        ),
      );

    const service = new ClaudeOcrService("test-key", { fetchImpl, sleep });

    const result = await service.transcribe("aGVsbG8=", "image/png");

    expect(result).toBe("Recovered transcription");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(750);
  });

  it("does not retry non-retryable 400 errors", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("Bad request", { status: 400 }),
    );

    const service = new ClaudeOcrService("test-key", { fetchImpl, sleep });

    await expect(
      service.transcribe("aGVsbG8=", "image/png"),
    ).rejects.toThrow("Claude OCR request failed: 400 Bad request");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("returns an empty string when Claude says no handwriting was detected", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: "(empty string) There is no handwritten text in this image.",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const service = new ClaudeOcrService("test-key", { fetchImpl });

    const result = await service.transcribe("aGVsbG8=", "image/png");

    expect(result).toBe("");
  });

  it("returns an empty string when Claude returns the no-handwriting sentinel", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: "NO_HANDWRITING_DETECTED",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const service = new ClaudeOcrService("test-key", { fetchImpl });

    const result = await service.transcribe("aGVsbG8=", "image/png");

    expect(result).toBe("");
  });

  it("strips Claude markdown emphasis from OCR text", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: "**Photosynthesis** happens in the __chloroplast__.",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const service = new ClaudeOcrService("test-key", { fetchImpl });

    const result = await service.transcribe("aGVsbG8=", "image/png");

    expect(result).toBe("Photosynthesis happens in the chloroplast.");
  });
});
