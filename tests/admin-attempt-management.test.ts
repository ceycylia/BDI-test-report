import { describe, expect, it } from "vitest";
import { isManualScoreWithoutAnswers, manualScoreFields, resetStagesForAttempt } from "../worker/domain/attempts/admin-attempt-management";

const attempt = (
  stage: "PRE" | "POST" | "REMEDIAL_1" | "REMEDIAL_2",
  score: number | null,
  status = "SUBMITTED",
) => ({ stage, score, status });

describe("rencana input nilai panitia", () => {
  it("menampilkan PRE dan POST saat keduanya belum ada", () => {
    expect(manualScoreFields([])).toEqual([
      { stage: "PRE", label: "Nilai Pre-Test", score: null },
      { stage: "POST", label: "Nilai Post-Test", score: null },
    ]);
  });

  it("tetap menampilkan PRE dan POST ketika hanya salah satunya ada", () => {
    expect(manualScoreFields([attempt("PRE", 70)]).map((field) => [field.stage, field.score])).toEqual([
      ["PRE", 70], ["POST", null],
    ]);
    expect(manualScoreFields([attempt("POST", 80)]).map((field) => [field.stage, field.score])).toEqual([
      ["PRE", null], ["POST", 80],
    ]);
  });

  it("menampilkan PRE dan POST ketika keduanya sudah ada", () => {
    expect(manualScoreFields([attempt("PRE", 75), attempt("POST", 85)]).map((field) => [field.stage, field.score])).toEqual([
      ["PRE", 75], ["POST", 85],
    ]);
  });

  it("hanya menambahkan field remedial yang attempt-nya sudah ada", () => {
    expect(manualScoreFields([
      attempt("PRE", 70), attempt("POST", 60), attempt("REMEDIAL_1", 68),
    ]).map((field) => field.stage)).toEqual(["PRE", "POST", "REMEDIAL_1"]);
    expect(manualScoreFields([
      attempt("PRE", 70), attempt("POST", 60), attempt("REMEDIAL_1", 68), attempt("REMEDIAL_2", 72),
    ]).map((field) => field.stage)).toEqual(["PRE", "POST", "REMEDIAL_1", "REMEDIAL_2"]);
  });

  it("mengabaikan remedial yang sudah direset", () => {
    expect(manualScoreFields([
      attempt("PRE", 70), attempt("POST", 60), attempt("REMEDIAL_1", 68, "RESET"),
    ]).map((field) => field.stage)).toEqual(["PRE", "POST"]);
  });
});

describe("cakupan reset attempt", () => {
  it("reset PRE hanya mencakup PRE", () => {
    expect(resetStagesForAttempt("PRE")).toEqual(["PRE"]);
  });

  it("reset POST mencakup POST dan seluruh remedial", () => {
    expect(resetStagesForAttempt("POST")).toEqual(["POST", "REMEDIAL_1", "REMEDIAL_2"]);
  });

  it("reset remedial hanya mencakup tahap yang dipilih", () => {
    expect(resetStagesForAttempt("REMEDIAL_1")).toEqual(["REMEDIAL_1"]);
    expect(resetStagesForAttempt("REMEDIAL_2")).toEqual(["REMEDIAL_2"]);
  });
});

describe("rincian nilai manual dan jawaban peserta", () => {
  it("menandai nilai manual tanpa jawaban agar tidak ditampilkan sebagai 0 benar dan 0 salah", () => {
    expect(isManualScoreWithoutAnswers({ status: "SUBMITTED", correctCount: null, wrongCount: null }, false)).toBe(true);
  });

  it("tetap menampilkan rincian attempt yang dikerjakan peserta", () => {
    expect(isManualScoreWithoutAnswers({ status: "SUBMITTED", correctCount: 0, wrongCount: 10 }, true)).toBe(false);
    expect(isManualScoreWithoutAnswers({ status: "SUBMITTED", correctCount: null, wrongCount: null }, true)).toBe(false);
  });
});
