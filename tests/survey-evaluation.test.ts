import { describe, expect, it } from "vitest";
import { evaluationStatus, indicatorPercentage, sectionPercentage } from "../worker/domain/surveys/evaluation";

describe("status pelaksanaan evaluasi", () => {
  const now = Date.parse("2026-10-07T05:00:00.000Z");

  it("menghitung status manual dari kontrol buka/tutup yang nyata", () => {
    expect(evaluationStatus({ mode: "MANUAL", manualOpen: true, opensAt: null, closesAt: null }, now)).toBe("OPEN");
    expect(evaluationStatus({ mode: "MANUAL", manualOpen: false, opensAt: null, closesAt: null }, now)).toBe("NOT_OPEN");
    expect(evaluationStatus({ mode: "MANUAL", manualOpen: false, opensAt: null, closesAt: null, closedAt: "2026-10-07T04:00:00.000Z" }, now)).toBe("FINISHED");
  });

  it("menghitung status jadwal dari waktu buka dan tutup", () => {
    expect(evaluationStatus({ mode: "SCHEDULED", manualOpen: false, opensAt: "2026-10-07T06:00:00.000Z", closesAt: "2026-10-07T08:00:00.000Z" }, now)).toBe("NOT_OPEN");
    expect(evaluationStatus({ mode: "SCHEDULED", manualOpen: false, opensAt: "2026-10-07T04:00:00.000Z", closesAt: "2026-10-07T08:00:00.000Z" }, now)).toBe("OPEN");
    expect(evaluationStatus({ mode: "SCHEDULED", manualOpen: false, opensAt: "2026-10-07T01:00:00.000Z", closesAt: "2026-10-07T04:00:00.000Z" }, now)).toBe("FINISHED");
  });
});

describe("perhitungan hasil evaluasi", () => {
  it("menghitung nilai indikator terhadap skala maksimum", () => {
    expect(indicatorPercentage(138, 35, 4)).toBeCloseTo(98.5714, 4);
    expect(indicatorPercentage(0, 0, 4)).toBeNull();
  });

  it("menghitung nilai section hanya dari indikator yang memiliki jawaban", () => {
    expect(sectionPercentage([97.81, 98.16, null, 98.68])).toBeCloseTo(98.2166, 3);
    expect(sectionPercentage([null])).toBeNull();
  });

  it("menghitung nilai keseluruhan sebagai rata-rata seluruh indikator valid", () => {
    expect(sectionPercentage([96.05, 98.68, 100, null])).toBeCloseTo(98.2433, 3);
  });
});
