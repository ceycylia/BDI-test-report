import { describe, expect, it } from "vitest";
import { app } from "../worker/index";

describe("admin route protection", () => {
  it("memblokir daftar admin tanpa session", async () => {
    const response = await app.request("/api/admin/admins");
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: "ADMIN_AUTH_REQUIRED",
        message: "Silakan masuk sebagai admin.",
      },
    });
  });

  it("memblokir login mutation tanpa Origin yang sesuai", async () => {
    const response = await app.request("http://localhost/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "password" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ORIGIN_REJECTED" },
    });
  });
});
