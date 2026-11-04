import { describe, expect, it } from "vitest";
import { dashboardStageCards, type DashboardTest } from "../src/features/participant-entry/dashboard-stages";
import registrationMigration from "../migrations/0024_participant_registration_links.sql?raw";
import portalRoutes from "../worker/routes/public/participant-portal-routes.ts?raw";
import adminRoutes from "../worker/routes/admin/participant-link-routes.ts?raw";

const base: DashboardTest = {
  sessionId: "s", slug: "test", materialName: "Materi", participantId: "p", batchId: "b",
  questionCount: 10, durationMinutes: 30, passingScore: 70, attempts: [],
  preOpen: false, postOpen: false, postMode: "MANUAL", postStartAt: null,
};
const submitted = (stage: "PRE" | "POST" | "REMEDIAL_1" | "REMEDIAL_2", score: number) => ({ stage, status: "SUBMITTED", score });

describe("dashboard tahap tes peserta", () => {
  it("menampilkan Pre-Test yang belum buka dan tidak menampilkan Post-Test lebih awal", () => {
    expect(dashboardStageCards(base)).toEqual([{ stage: "PRE", state: "upcoming", label: "Akan datang" }]);
    expect(dashboardStageCards({ ...base, preOpen: true })).toEqual([{ stage: "PRE", state: "ready", label: "Harus dikerjakan" }]);
  });
  it("menampilkan Post-Test sesuai jadwal setelah Pre-Test selesai", () => {
    const test = { ...base, attempts: [submitted("PRE", 70)] };
    expect(dashboardStageCards(test).map((card) => card.state)).toEqual(["done", "upcoming"]);
    expect(dashboardStageCards({ ...test, postOpen: true }).map((card) => card.state)).toEqual(["done", "ready"]);
  });
  it("menampilkan remedial hanya bila nilai POST belum lulus", () => {
    const attempts = [submitted("PRE", 80), submitted("POST", 55)];
    expect(dashboardStageCards({ ...base, postOpen: true, attempts }).map((card) => card.state)).toEqual(["done", "done", "remedial"]);
    expect(dashboardStageCards({ ...base, postOpen: true, attempts: [submitted("PRE", 80), submitted("POST", 80)] }).map((card) => card.state)).toEqual(["done", "done"]);
    expect(dashboardStageCards({ ...base, postOpen: true, attempts: [...attempts, submitted("REMEDIAL_1", 55)] }).map((card) => card.state)).toEqual(["done", "done", "done", "remedial"]);
  });
});

describe("batas data link peserta", () => {
  it("memiliki satu link aktif per angkatan dan token yang unik", () => {
    expect(registrationMigration).toContain("ON participant_registration_links(cohort_id) WHERE revoked_at IS NULL");
    expect(registrationMigration).toContain("token TEXT NOT NULL UNIQUE");
    expect(adminRoutes).toContain("crypto.randomUUID()");
    expect(adminRoutes).toContain("links.revoked_at IS NULL");
  });
  it("mengikat pendaftaran ke angkatan dan NIK tanpa menimpa data admin", () => {
    expect(portalRoutes).toContain("ON CONFLICT(cohort_id,nik) DO UPDATE SET");
    expect(portalRoutes).toContain("CASE WHEN participant_profiles.birth_place='' THEN excluded.birth_place ELSE participant_profiles.birth_place END");
    expect(portalRoutes).toContain("links.revoked_at IS NULL AND cohorts.id=?");
    expect(portalRoutes).toContain("profiles.cohort_id=? AND profiles.nik=?");
  });
});
