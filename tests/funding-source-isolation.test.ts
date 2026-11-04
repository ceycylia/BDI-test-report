import { describe, expect, it } from "vitest";
import participantRoutes from "../worker/routes/admin/participant-admin-routes.ts?raw";
import trainingRepository from "../worker/repositories/training-repository.ts?raw";
import resultRepository from "../worker/repositories/result-repository.ts?raw";
import surveyRepository from "../worker/repositories/survey-campaign-repository.ts?raw";
import dashboardRoutes from "../worker/routes/admin/dashboard-routes.ts?raw";

describe("isolasi data operasional berdasarkan sumber Angkatan", () => {
  it("menerapkan sumber pada daftar Angkatan, peserta, dokumen, tes, hasil, evaluasi, dan Dashboard", () => {
    expect(participantRoutes).toContain("cohorts.funding_source=?");
    expect(participantRoutes).toContain("funding_source = ?");
    expect(trainingRepository).toContain("source_cohorts.funding_source=?");
    expect(resultRepository).toContain("funding_source = ?");
    expect(surveyRepository).toContain("year_cohorts.funding_source = ?");
    expect(dashboardRoutes).toContain("cohorts.funding_source = ?");
  });

  it("menjaga master bersama dengan tidak memberi sumber pada tabel master", () => {
    expect(participantRoutes).not.toMatch(/INSERT INTO trainings[^;]+funding_source/iu);
    expect(participantRoutes).not.toMatch(/INSERT INTO training_materials[^;]+funding_source/iu);
  });
});
