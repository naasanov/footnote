import { describe, expect, it, vi } from "vitest";
import { ClaudeCitationService } from "../../src/adapters/citation/ClaudeCitationService.js";

describe("ClaudeCitationService", () => {
  it("retries with backoff after a 429 and eventually returns batch summaries", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            type: "error",
            error: { type: "rate_limit_error", message: "Rate limited" },
          }),
          { status: 429 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: '{"results":[{"chunkId":"chunk-1","summary":"This passage supports the query."}]}',
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const service = new ClaudeCitationService("test-key", { fetchImpl, sleep });

    const result = await service.summarizeBatch("mitosis", [
      {
        chunkId: "chunk-1",
        text: "Cells divide during mitosis.",
        locationLabel: "Page 2",
        filename: "bio.pdf",
      },
    ]);

    expect(result).toEqual([
      { chunkId: "chunk-1", summary: "Supports the query" },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(750);
  });

  it("does not retry non-retryable 400 errors", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("Bad request", { status: 400 }));

    const service = new ClaudeCitationService("test-key", { fetchImpl, sleep });

    await expect(
      service.summarizeBatch("mitosis", [
        {
          chunkId: "chunk-1",
          text: "Cells divide during mitosis.",
          locationLabel: "Page 2",
          filename: "bio.pdf",
        },
      ]),
    ).rejects.toThrow("Claude citation request failed: 400 Bad request");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
