import { describe, expect, it } from "vitest";
import { nextPostStage } from "../worker/domain/attempts/progression";

describe("progresi remedial", () => {
  it("membuka remedial berikutnya setelah nilai belum lulus", () => {
    expect(nextPostStage([{ stage: "POST", status: "SUBMITTED", score: 60 }], 75)).toBe("REMEDIAL_1");
    expect(nextPostStage([
      { stage: "POST", status: "SUBMITTED", score: 60 },
      { stage: "REMEDIAL_1", status: "SUBMITTED", score: 70 },
    ], 75)).toBe("REMEDIAL_2");
  });

  it("menghentikan remedial segera setelah lulus", () => {
    expect(nextPostStage([
      { stage: "POST", status: "SUBMITTED", score: 60 },
      { stage: "REMEDIAL_1", status: "SUBMITTED", score: 80 },
    ], 75)).toBeNull();
  });

  it("membatasi remedial maksimal tiga kali", () => {
    expect(nextPostStage([
      { stage: "POST", status: "SUBMITTED", score: 10 },
      { stage: "REMEDIAL_1", status: "SUBMITTED", score: 20 },
      { stage: "REMEDIAL_2", status: "SUBMITTED", score: 30 },
      { stage: "REMEDIAL_3", status: "SUBMITTED", score: 40 },
    ], 75)).toBeNull();
  });
});
