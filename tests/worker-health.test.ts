import { describe, expect, it } from "vitest";
import { app } from "../worker/index";

describe("GET /api/health", () => {
  it("mengembalikan status layanan tanpa membuka detail internal", async () => {
    const response = await app.request("/api/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(body).toMatchObject({
      status: "ok",
      service: "bdi-test-report",
    });
  });
});

describe("API fallback", () => {
  it("mengembalikan pesan terstruktur untuk endpoint yang tidak ada", async () => {
    const response = await app.request("/api/tidak-ada");
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Endpoint tidak ditemukan.",
      },
    });
  });
});
