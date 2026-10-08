import { describe, expect, it } from "vitest";
import { surveyTemplateDeletionPolicy } from "../worker/domain/surveys/template-deletion";

describe("penghapusan Template Evaluasi", () => {
  it("mengizinkan template dengan status apa pun yang belum pernah digunakan", () => {
    expect(surveyTemplateDeletionPolicy({ campaignCount: 0 })).toEqual({
      canDelete: true,
      reason: null,
    });
  });

  it("melarang template yang memiliki riwayat Pelaksanaan Evaluasi", () => {
    const result = surveyTemplateDeletionPolicy({ campaignCount: 1 });
    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain("riwayat Pelaksanaan Evaluasi");
  });

  it("memprioritaskan perlindungan riwayat respons peserta", () => {
    const result = surveyTemplateDeletionPolicy({ campaignCount: 1, responseCount: 3 });
    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain("riwayat respons peserta");
  });
});
