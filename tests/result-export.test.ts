import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { createXlsx } from "../worker/export/xlsx";
import { buildMaterialAnswerSheets, buildSummarySheet, type ExportRow } from "../worker/routes/admin/result-routes";

describe("export hasil tes per materi", () => {
  it("merangkum nilai Pre dan nilai kelulusan Post sesuai jumlah materi", () => {
    const summaries: ExportRow[] = [
      {
        profile_id: "profile-1", cohort_id: "cohort-1", name: "Daniel", nik: "1271041901070002",
        material_id: "material-1", material_sort_order: 1, pre_score: 60, post_score: 80,
        remedial_1_score: null, remedial_2_score: null, passing_score: 75,
      },
      {
        profile_id: "profile-1", cohort_id: "cohort-1", name: "Daniel", nik: "1271041901070002",
        material_id: "material-2", material_sort_order: 2, pre_score: 70, post_score: 60,
        remedial_1_score: 85, remedial_2_score: null, passing_score: 75,
      },
      {
        profile_id: "profile-1", cohort_id: "cohort-1", name: "Daniel", nik: "1271041901070002",
        material_id: "material-3", material_sort_order: 3, pre_score: 80, post_score: 50,
        remedial_1_score: 60, remedial_2_score: 95, passing_score: 75,
      },
    ];

    const sheet = buildSummarySheet("Pelatihan Contoh", summaries);

    expect(sheet.name).toBe("Rangkuman Hasil");
    expect(sheet.rows[2]).toEqual(["No", "NIK", "Nama Peserta", "Nilai Pre Test", "Nilai Post Test", "Keterangan"]);
    expect(sheet.rows[3]).toEqual([1, "1271041901070002", "Daniel", 70, 86.67, "Meningkat"]);
  });

  it("membuat sheet per materi dan hanya membawa peserta hasil filter", () => {
    const summaries: ExportRow[] = [
      { participant_id: "participant-filtered", material_id: "material-1", material_name: "Materi: Keselamatan/Dasar?", material_sort_order: 1 },
      { participant_id: "participant-filtered", material_id: "material-2", material_name: "Data Lengkap", material_sort_order: 2 },
    ];
    const answers: ExportRow[] = [
      {
        participant_id: "participant-filtered", material_id: "material-1", attempt_id: "attempt-1",
        name: "Peserta Filter", cohort_name: "Angkatan 1", stage: "POST", score: 80,
        submitted_at: "2026-10-09T01:00:00.000Z", question_id: "question-1", display_position: 1,
        question_text: "1. Pertanyaan pertama", selected_original_option_key: "A", option_a: "Jawaban peserta",
      },
      {
        participant_id: "participant-lain", material_id: "material-1", attempt_id: "attempt-2",
        name: "Peserta Lain", cohort_name: "Angkatan 1", stage: "POST", score: 100,
        submitted_at: "2026-10-09T01:00:00.000Z", question_id: "question-1", display_position: 1,
        question_text: "1. Pertanyaan pertama", selected_original_option_key: "B", option_b: "Tidak boleh masuk",
      },
    ];

    const sheets = buildMaterialAnswerSheets(summaries, answers);
    expect(sheets).toHaveLength(2);
    expect(sheets[0]?.name).toBe("Materi Keselamatan Dasar");
    expect(sheets[1]?.name).toBe("Data Lengkap (2)");
    expect(sheets[0]?.rows.flat()).toContain("Peserta Filter");
    expect(sheets[0]?.rows.flat()).toContain("Jawaban peserta");
    expect(sheets[0]?.rows.flat()).not.toContain("Peserta Lain");

    const workbook = createXlsx(sheets);
    const files = unzipSync(workbook);
    const workbookXml = strFromU8(files["xl/workbook.xml"]!);
    const firstSheetXml = strFromU8(files["xl/worksheets/sheet1.xml"]!);
    expect(workbookXml).toContain('sheet name="Materi Keselamatan Dasar"');
    expect(workbookXml).toContain('sheet name="Data Lengkap (2)"');
    expect(firstSheetXml).toContain("Pertanyaan pertama");
    expect(firstSheetXml).toContain("Jawaban peserta");
  });
});
