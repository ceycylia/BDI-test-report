import { describe, expect, it } from "vitest";
import {
  readRememberedParticipant,
  rememberParticipant,
  rememberedBatchId,
} from "../src/features/participant-entry/remembered-participant";
import { participantTestStatus } from "../src/features/participant-entry/test-entry-status";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const submittedPre = { stage: "PRE" as const, status: "SUBMITTED", score: 80 };
const base = {
  passingScore: 75,
  preOpen: true,
  postOpen: false,
  postMode: "MANUAL" as const,
  postStartAt: null,
};

describe("status peserta ketika link tes dibuka kembali", () => {
  it("menawarkan mulai Pre-Test hanya ketika belum ada attempt", () => {
    expect(participantTestStatus({ ...base, attempts: [] })).toEqual({ kind: "PRE_START", stage: "PRE" });
  });

  it("melanjutkan attempt Pre-Test yang masih berjalan", () => {
    expect(participantTestStatus({ ...base, attempts: [{ stage: "PRE", status: "IN_PROGRESS", score: null }] }))
      .toEqual({ kind: "PRE_CONTINUE", stage: "PRE" });
  });

  it("menampilkan jadwal Post-Test setelah Pre-Test selesai", () => {
    expect(participantTestStatus({
      ...base,
      attempts: [submittedPre],
      postMode: "SCHEDULED",
      postStartAt: "2026-10-20T06:00:00.000Z",
      now: new Date("2026-10-19T06:00:00.000Z"),
    })).toEqual({ kind: "POST_SCHEDULED", stage: "POST" });
  });

  it("menampilkan Post-Test belum dibuka untuk kontrol manual", () => {
    expect(participantTestStatus({ ...base, attempts: [submittedPre] }))
      .toEqual({ kind: "POST_NOT_OPEN", stage: "POST" });
  });

  it("menawarkan mulai Post-Test ketika jadwalnya terbuka", () => {
    expect(participantTestStatus({ ...base, attempts: [submittedPre], postOpen: true }))
      .toEqual({ kind: "STAGE_START", stage: "POST" });
  });

  it("melanjutkan Post-Test yang masih berlangsung tanpa membuat tahap baru", () => {
    expect(participantTestStatus({
      ...base,
      attempts: [submittedPre, { stage: "POST", status: "IN_PROGRESS", score: null }],
    })).toEqual({ kind: "STAGE_CONTINUE", stage: "POST" });
  });

  it("mengakhiri alur ketika peserta sudah lulus", () => {
    expect(participantTestStatus({
      ...base,
      attempts: [submittedPre, { stage: "POST", status: "SUBMITTED", score: 80 }],
    })).toEqual({ kind: "PASSED", stage: null });
  });

  it("mengikuti tahap remedial yang sudah berlaku", () => {
    expect(participantTestStatus({
      ...base,
      postOpen: true,
      attempts: [submittedPre, { stage: "POST", status: "SUBMITTED", score: 60 }],
    })).toEqual({ kind: "STAGE_START", stage: "REMEDIAL_1" });
    expect(participantTestStatus({
      ...base,
      attempts: [
        submittedPre,
        { stage: "POST", status: "SUBMITTED", score: 60 },
        { stage: "REMEDIAL_1", status: "IN_PROGRESS", score: null },
      ],
    })).toEqual({ kind: "STAGE_CONTINUE", stage: "REMEDIAL_1" });
    expect(participantTestStatus({
      ...base,
      attempts: [
        submittedPre,
        { stage: "POST", status: "SUBMITTED", score: 60 },
        { stage: "REMEDIAL_1", status: "SUBMITTED", score: 65 },
        { stage: "REMEDIAL_2", status: "IN_PROGRESS", score: null },
      ],
    })).toEqual({ kind: "STAGE_CONTINUE", stage: "REMEDIAL_2" });
  });

  it("menampilkan tidak lulus setelah seluruh kesempatan selesai", () => {
    expect(participantTestStatus({
      ...base,
      attempts: [
        submittedPre,
        { stage: "POST", status: "SUBMITTED", score: 60 },
        { stage: "REMEDIAL_1", status: "SUBMITTED", score: 65 },
        { stage: "REMEDIAL_2", status: "SUBMITTED", score: 70 },
      ],
    })).toEqual({ kind: "FAILED", stage: null });
  });
});

describe("identitas peserta yang diingat browser", () => {
  it("tidak mengisi apa pun pada browser yang belum memiliki data", () => {
    expect(readRememberedParticipant(new MemoryStorage())).toBeNull();
  });

  it("menyimpan nama resmi, NIK, dan cohort setelah verifikasi berhasil", () => {
    const storage = new MemoryStorage();
    expect(rememberParticipant(storage, {
      name: "Cici Resmi",
      nik: "2171 1282 8282 8001",
      cohortId: "cohort-a",
    })).toBe(true);
    expect(readRememberedParticipant(storage)).toEqual({
      name: "Cici Resmi",
      nik: "2171128282828001",
      cohortId: "cohort-a",
    });
  });

  it("memetakan cohort yang sama ke batch berbeda pada link mata diklat berikutnya", () => {
    const remembered = { name: "Cici", nik: "2171128282828001", cohortId: "cohort-a" };
    expect(rememberedBatchId([
      { id: "batch-materi-b", cohortId: "cohort-a" },
      { id: "batch-lain", cohortId: "cohort-b" },
    ], remembered)).toBe("batch-materi-b");
    expect(rememberedBatchId([{ id: "batch-lain", cohortId: "cohort-b" }], remembered)).toBeNull();
  });

  it("mengganti identitas hanya dengan data baru yang valid", () => {
    const storage = new MemoryStorage();
    rememberParticipant(storage, { name: "Peserta Lama", nik: "1111111111111111", cohortId: "cohort-a" });
    expect(rememberParticipant(storage, { name: "", nik: "salah", cohortId: "" })).toBe(false);
    expect(readRememberedParticipant(storage)?.name).toBe("Peserta Lama");
    expect(rememberParticipant(storage, { name: "Peserta Baru", nik: "2222222222222222", cohortId: "cohort-b" })).toBe(true);
    expect(readRememberedParticipant(storage)?.name).toBe("Peserta Baru");
  });
});
