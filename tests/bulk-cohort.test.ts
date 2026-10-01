import { describe, expect, it } from "vitest";
import { generateCohorts } from "../src/features/cohorts/bulk-cohort";

describe("generateCohorts", () => {
  it("groups cohorts into shared periods and handles month boundaries", () => {
    const rows = generateCohorts({
      startNumber: 1,
      count: 8,
      cohortsPerPeriod: 2,
      firstStartDate: "2026-10-10",
      durationDays: 7,
    });

    expect(rows.map(({ name, startDate, endDate }) => ({ name, startDate, endDate }))).toEqual([
      { name: "Angkatan 1", startDate: "2026-10-10", endDate: "2026-10-16" },
      { name: "Angkatan 2", startDate: "2026-10-10", endDate: "2026-10-16" },
      { name: "Angkatan 3", startDate: "2026-10-17", endDate: "2026-10-23" },
      { name: "Angkatan 4", startDate: "2026-10-17", endDate: "2026-10-23" },
      { name: "Angkatan 5", startDate: "2026-10-24", endDate: "2026-10-30" },
      { name: "Angkatan 6", startDate: "2026-10-24", endDate: "2026-10-30" },
      { name: "Angkatan 7", startDate: "2026-10-31", endDate: "2026-11-06" },
      { name: "Angkatan 8", startDate: "2026-10-31", endDate: "2026-11-06" },
    ]);
  });
});
