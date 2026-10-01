import { describe, expect, it } from "vitest";
import { evaluateSubmission, fillMissingAnswers } from "../worker/domain/attempts/submission-rules";

describe("aturan pengiriman jawaban", () => {
  const deadline = "2026-09-29T03:00:00.000Z";
  const beforeDeadline = new Date("2026-09-29T02:00:00.000Z");

  it("menolak submit normal jika masih ada soal kosong", () => {
    const decision = evaluateSubmission(["q1", "q2", "q3"], { q1: "A" }, deadline, "NORMAL", beforeDeadline);
    expect(decision.allowed).toBe(false);
    expect(decision.missingQuestionIds).toEqual(["q2", "q3"]);
  });

  it("menerima submit normal jika seluruh soal terjawab", () => {
    const decision = evaluateSubmission(["q1", "q2"], { q1: "A", q2: "D" }, deadline, "NORMAL", beforeDeadline);
    expect(decision.allowed).toBe(true);
  });

  it("mengizinkan submit otomatis setelah hard deadline dengan jawaban kosong", () => {
    const decision = evaluateSubmission(["q1", "q2"], {}, deadline, "NORMAL", new Date("2026-09-29T03:00:01.000Z"));
    expect(decision.timedOut).toBe(true);
    expect(decision.allowed).toBe(true);
  });

  it("menolak permintaan timeout palsu sebelum hard deadline", () => {
    const decision = evaluateSubmission(["q1", "q2"], {}, deadline, "TIMEOUT", beforeDeadline);
    expect(decision.allowed).toBe(false);
    expect(decision.timedOut).toBe(false);
  });

  it("mengisi setiap jawaban kosong dengan pilihan asli C saat hard stop", () => {
    expect(fillMissingAnswers(["q1", "q2", "q3"], { q1: "A", q3: "D" })).toEqual({ q1: "A", q2: "C", q3: "D" });
  });
});
