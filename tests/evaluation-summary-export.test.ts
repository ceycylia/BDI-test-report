import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { read } from "xlsx";
import { createXlsx, type WorkbookSheet } from "../worker/export/xlsx";
import { buildEvaluationSummarySheet } from "../worker/routes/admin/survey-campaign-routes";

describe("export Ringkasan evaluasi", () => {
  it("mengikuti kelompok, nilai, dan distribusi pada tabel web tanpa mengubah sheet Responden", () => {
    const respondentSheet: WorkbookSheet = {
      name: "Responden", rows: [["Nama", "Pertanyaan"], ["Aminah", 4]],
      variant: "test-results-reference", rowStyles: { 0: "header", 1: "data" }, autoFilter: false,
    };
    const summary = buildEvaluationSummarySheet("Hasil Evaluasi Angkatan 1", [
      { sectionCode: "A", sectionTitle: "PENDAFTARAN PELATIHAN", indicator: "Pertanyaan pertama?", value: 85.83, distribution: [{ value: 1, count: 2 }, { value: 2, count: 2 }, { value: 3, count: 7 }, { value: 4, count: 19 }] },
      { sectionCode: "A", sectionTitle: "PENDAFTARAN PELATIHAN", indicator: "Pertanyaan kedua?", value: 90, distribution: [{ value: 1, count: 0 }, { value: 2, count: 2 }, { value: 3, count: 8 }, { value: 4, count: 20 }] },
      { sectionCode: "B", sectionTitle: "PROGRAM PELATIHAN", indicator: "Pertanyaan ketiga?", value: null, distribution: [] },
    ]);
    const files = unzipSync(createXlsx([respondentSheet, summary]));
    const respondentOnly = unzipSync(createXlsx([respondentSheet]));
    const sheet = strFromU8(files["xl/worksheets/sheet2.xml"]!);
    const styles = strFromU8(files["xl/styles.xml"]!);

    expect(strFromU8(files["xl/worksheets/sheet1.xml"]!)).toBe(strFromU8(respondentOnly["xl/worksheets/sheet1.xml"]!));
    expect(summary.rows).toEqual([
      ["Hasil Evaluasi Angkatan 1", null, null, null, null, null], [null],
      ["Indikator Penilaian", "Nilai", "Distribusi", null, null, null], [null, null, 1, 2, 3, 4],
      ["A. PENDAFTARAN PELATIHAN", null, null, null, null, null],
      ["Pertanyaan pertama?", 0.8583, 2, 2, 7, 19],
      ["Pertanyaan kedua?", 0.9, 0, 2, 8, 20],
      ["B. PROGRAM PELATIHAN", null, null, null, null, null],
      ["Pertanyaan ketiga?", "-", 0, 0, 0, 0],
    ]);
    expect(sheet).toContain('<mergeCell ref="A3:A4"/>');
    expect(sheet).toContain('<mergeCell ref="C3:F3"/>');
    expect(sheet).toContain('<mergeCell ref="A5:F5"/>');
    expect(sheet).toContain('<mergeCell ref="A8:F8"/>');
    expect(sheet).toContain('<c r="B6" s="21"><v>0.8583</v></c>');
    expect(styles).toContain('formatCode="0.00%"');
    expect(styles).toContain('fgColor rgb="FFE8F3FA"');
    expect(styles).toContain('fgColor rgb="FFF3EAF8"');
  });

  it("menambahkan semua tabel pilihan di bawah indikator dengan satu baris pemisah", () => {
    const summary = buildEvaluationSummarySheet("Ringkasan", [
      { sectionCode: "A", sectionTitle: "PENDAFTARAN PELATIHAN", indicator: "Pertanyaan skala?", value: 80, distribution: [] },
    ], [
      { sectionTitle: "PENDAFTARAN PELATIHAN", question: "Dari mana Anda mendapatkan informasi tentang pelatihan ini?", options: [
        { label: "Iklan", count: 4, percentage: 10, otherTexts: [] },
        { label: "Yang lain", count: 2, percentage: 20, otherTexts: ["Dari atasan", "  ", "Dari perusahaan"] },
      ] },
      { sectionTitle: "PROGRAM PELATIHAN", question: "Pilihan lain?", options: [
        { label: "Pilihan A", count: 1, percentage: 50, otherTexts: [] },
      ] },
    ]);
    expect(summary.rows).toEqual([
      ["Ringkasan", null, null, null, null, null], [null],
      ["Indikator Penilaian", "Nilai", "Distribusi", null, null, null], [null, null, 1, 2, 3, 4],
      ["A. PENDAFTARAN PELATIHAN", null, null, null, null, null], ["Pertanyaan skala?", 0.8, 0, 0, 0, 0],
      [null],
      ["PENDAFTARAN PELATIHAN", null, null, null, null, null],
      ["Dari mana Anda mendapatkan informasi tentang pelatihan ini?", null, null, null, null, null],
      ["Pilihan", null, null, null, "Jumlah", "Persentase"],
      ["Iklan", null, null, null, 4, 0.1],
      ["Yang lain", null, null, null, 2, 0.2],
      ["•  Dari atasan", null, null, null, null, null],
      ["•  Dari perusahaan", null, null, null, null, null],
      [null],
      ["PROGRAM PELATIHAN", null, null, null, null, null],
      ["Pilihan lain?", null, null, null, null, null],
      ["Pilihan", null, null, null, "Jumlah", "Persentase"],
      ["Pilihan A", null, null, null, 1, 0.5],
    ]);
    const files = unzipSync(createXlsx([summary]));
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
    const styles = strFromU8(files["xl/styles.xml"]!);
    expect(sheet).toContain('<mergeCell ref="A10:D10"/>');
    expect(sheet).toContain('<c r="E12" s="20"><v>2</v></c>');
    expect(sheet).toContain('<c r="F12" s="22"><v>0.2</v></c>');
    expect(sheet).toContain("Dari atasan");
    expect(sheet).toContain("Dari perusahaan");
    expect(sheet).not.toContain("•    </t>");
    expect(styles).toContain('numFmtId="166" formatCode="0.0%"');
    const workbook = read(createXlsx([summary]), { type: "array" });
    expect(workbook.Sheets.Ringkasan?.E12?.v).toBe(2);
    expect(workbook.Sheets.Ringkasan?.F12?.v).toBe(0.2);
    expect(workbook.Sheets.Ringkasan?.F12?.w).toBe("20.0%");
  });
});
