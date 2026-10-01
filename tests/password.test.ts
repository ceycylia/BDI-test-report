import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../worker/security/password";

describe("password hashing", () => {
  it("memverifikasi password yang benar dan menolak password yang salah", async () => {
    const record = await hashPassword("password-yang-kuat", 1_000);

    await expect(verifyPassword("password-yang-kuat", record)).resolves.toBe(true);
    await expect(verifyPassword("password-yang-salah", record)).resolves.toBe(false);
    expect(record.hash).not.toContain("password-yang-kuat");
    expect(record.salt.length).toBeGreaterThan(10);
  });

  it("menghasilkan salt dan hash berbeda untuk password yang sama", async () => {
    const first = await hashPassword("password-yang-sama", 1_000);
    const second = await hashPassword("password-yang-sama", 1_000);

    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });
});
