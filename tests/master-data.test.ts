import { describe, expect, it } from "vitest";
import { normalizeNik, maskNik, participantIdentityMatches } from "../worker/domain/participants/normalize-nik";
import { duplicateNiks, parseImportedNik } from "../worker/domain/participants/import-validation";
import { isCertificateEligible, totalTrainingJp } from "../worker/domain/certificates/eligibility";
import { createXlsx } from "../worker/export/xlsx";
import { strFromU8, unzipSync } from "fflate";

describe("registrasi peserta", () => {
  it("mencocokkan NIK sebagai string tanpa spasi dan mempertahankan digit", () => {
    expect(normalizeNik(" 0123 4567 8901 2345 ")).toBe("0123456789012345");
    expect(maskNik("1271051234567802")).toBe("127105********02");
  });

  it("mensyaratkan nama ternormalisasi dan NIK yang sama", () => {
    const registered = { normalizedName: "siti aminah", nik: "0123456789012345" };
    expect(participantIdentityMatches(registered, { normalizedName: "siti aminah", nik: "0123 456789012345" })).toBe(true);
    expect(participantIdentityMatches(registered, { normalizedName: "siti aminah", nik: "0123456789012346" })).toBe(false);
    expect(participantIdentityMatches(registered, { normalizedName: "siti amina", nik: "0123456789012345" })).toBe(false);
  });

  it("mendeteksi duplikat dari database dan di dalam file import", () => {
    expect([...duplicateNiks(["222", "333", "333"], ["111", "222"])]).toEqual(["222", "333"]);
  });

  it("menolak NIK numerik atau notasi ilmiah yang dapat dirusak Excel", () => {
    expect(parseImportedNik(1271051234567890).error).toContain("Teks");
    expect(parseImportedNik("1.27105123456789E+15").error).toContain("notasi ilmiah");
    expect(parseImportedNik("'0123456789012345")).toEqual({ nik: "0123456789012345" });
    expect(parseImportedNik("12710541A2860002").error).toContain("angka");
  });

  it("membuat kolom NIK sebagai teks Excel tanpa apostrof", () => {
    const workbook = createXlsx([{ name: "Data Peserta", rows: [["No", "Nama", "NIK"], [1, "Ade", "1271054102860002"]], textColumns: [2], columnWidths: [8, 28, 22] }]);
    const files = unzipSync(workbook);
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
    const styles = strFromU8(files["xl/styles.xml"]!);
    expect(sheet).toContain('<c r="C2" t="inlineStr" s="2"><is><t xml:space="preserve">1271054102860002</t>');
    expect(sheet).not.toContain("'1271054102860002");
    expect(sheet).toContain('<col min="3" max="3" width="22" customWidth="1" style="2"/>');
    expect(styles).toContain('numFmtId="49"');
  });

  it("membuat chart bar horizontal native dan format persen pada laporan Evaluasi", () => {
    const workbook = createXlsx([{
      name: "Ringkasan Evaluasi",
      rows: [["Bagian", "Nilai (%)", "Nilai grafik"], ["Program Pelatihan", 0.9816, 98.16], ["Instruktur", 0.9868, 98.68]],
      percentageColumns: [1], hiddenColumns: [2], tableStartRow: 0, tableEndRow: 2,
      charts: [{ type: "bar", title: "Hasil Evaluasi Penyelenggaraan Pelatihan Vokasi Angkatan 3 dan 4", categoryColumn: 0, valueColumn: 2, startRow: 1, endRow: 2, from: { row: 1, col: 3 }, to: { row: 12, col: 10 }, axisMin: 90, axisMax: 100, majorUnit: 2, axisTitle: "Nilai (%)", dataLabelFormat: "0.00\\%", caption: "Gambar 1. Hasil Evaluasi Penyelenggaraan Pelatihan Vokasi" }],
    }]);
    const files = unzipSync(workbook);
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
    const chart = strFromU8(files["xl/charts/chart1.xml"]!);
    const relationships = strFromU8(files["xl/drawings/_rels/drawing1.xml.rels"]!);
    expect(sheet).toContain('<drawing r:id="rId1"/>');
    expect(chart).toContain('<c:barDir val="bar"/>');
    expect(chart).toContain("Hasil Evaluasi Penyelenggaraan Pelatihan Vokasi Angkatan 3 dan 4");
    expect(chart).toContain("'Ringkasan Evaluasi'!$A$2:$A$3");
    expect(chart).toContain("'Ringkasan Evaluasi'!$C$2:$C$3");
    expect(chart).toContain('<c:min val="90"/>');
    expect(chart).toContain('<c:max val="100"/>');
    expect(chart).toContain('<c:majorUnit val="2"/>');
    expect(chart).toContain('formatCode="0.00\\%"');
    expect(chart).toContain("Nilai (%)");
    expect(sheet).toContain('<col min="3" max="3" width="20" customWidth="1" hidden="1"');
    expect(strFromU8(files["xl/drawings/drawing1.xml"]!)).toContain("Gambar 1. Hasil Evaluasi Penyelenggaraan Pelatihan Vokasi");
    expect(relationships).toContain("../charts/chart1.xml");
  });
});

describe("sertifikat", () => {
  it("menghitung total JP dari master materi", () => {
    expect(totalTrainingJp([{ jp: 8 }, { jp: 4 }, { jp: 4 }, { jp: 8 }])).toBe(24);
  });

  it("hanya mengizinkan peserta yang mencapai passing grade", () => {
    expect(isCertificateEligible(75, 75)).toBe(true);
    expect(isCertificateEligible(74.99, 75)).toBe(false);
    expect(isCertificateEligible(null, 75)).toBe(false);
  });
});
