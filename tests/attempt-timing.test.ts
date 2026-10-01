import { describe, expect, it } from "vitest";
import { attemptDeadlines, EXTRA_TEST_MINUTES, MAX_TEST_MINUTES, NORMAL_TEST_MINUTES } from "../worker/domain/attempts/timing";

describe("deadline attempt tetap", () => {
  it("memberikan 15 menit normal dan hard stop total 20 menit", () => {
    const deadlines = attemptDeadlines("2026-10-10T08:00:00.000Z");
    expect(NORMAL_TEST_MINUTES).toBe(15);
    expect(EXTRA_TEST_MINUTES).toBe(5);
    expect(MAX_TEST_MINUTES).toBe(20);
    expect(deadlines.normalDeadlineAt).toBe("2026-10-10T08:15:00.000Z");
    expect(deadlines.hardDeadlineAt).toBe("2026-10-10T08:20:00.000Z");
  });
});
