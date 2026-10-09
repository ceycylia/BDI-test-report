import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { createXlsx } from "../worker/export/xlsx";
import { buildMaterialAnswerSheets, type ExportRow } from "../worker/routes/admin/result-routes";

describe("export hasil tes per materi", () => {
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
