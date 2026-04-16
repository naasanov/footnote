import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Must be hoisted before any import that transitively loads @clerk/backend
vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn().mockRejectedValue(new Error("Invalid token")),
}));

import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";

describe("Auth smoke tests", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });

    // Register a test-only protected route to exercise the auth plugin
    app.get(
      "/test-protected",
      { preHandler: [app.requireAuth] },
      async (req) => ({ userId: req.userId }),
    );

    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("returns 401 when no Authorization header is provided", async () => {
    const res = await app.inject({ method: "GET", url: "/test-protected" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      error: "AppError",
      message: "No token provided",
    });
  });

  it("returns 401 when an invalid token is provided", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/test-protected",
      headers: { Authorization: "Bearer invalid.token.value" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      error: "AppError",
      message: "Invalid token",
    });
  });
});
