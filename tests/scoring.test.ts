import { describe, expect, it } from "vitest";
import { calculateScore } from "../worker/domain/scoring/calculate-score";
import { isPassing } from "../worker/domain/scoring/outcome";

describe("scoring server", () => {
  it("menghitung persentase dan membulatkan maksimal dua desimal", () => {
    expect(calculateScore(1, 3)).toBe(33.33);
    expect(calculateScore(3, 3)).toBe(100);
  });

  it("menganggap nilai tepat pada passing grade sebagai lulus", () => {
    expect(isPassing(75, 75)).toBe(true);
    expect(isPassing(74.99, 75)).toBe(false);
  });
});
