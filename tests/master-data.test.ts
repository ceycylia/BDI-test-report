import { describe, expect, it } from "vitest";
import { normalizeNik, maskNik, participantIdentityMatches } from "../worker/domain/participants/normalize-nik";
import { duplicateNiks, parseImportedNik } from "../worker/domain/participants/import-validation";
import { isCertificateEligible, totalTrainingJp } from "../worker/domain/certificates/eligibility";
import { createXlsx } from "../worker/export/xlsx";
import { createEvaluationIndicatorReportDocx } from "../worker/export/evaluation-report-docx";
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

  it("membuat Word laporan yang hanya berisi tabel 17 indikator", async () => {
    const indicators = Array.from({ length: 17 }, (_, index) => ({
      no: index + 1,
      indicator: `Indikator Penilaian ${index + 1}`,
      value: 96 + index / 10,
    }));
    const report = await createEvaluationIndicatorReportDocx({
      title: "Tabel. Rincian Nilai Per Indikator pada Penyelenggaraan Diklat Operator Angkatan 3 dan 4",
      rows: indicators,
    });
    const files = unzipSync(new Uint8Array(await report.arrayBuffer()));
    const document = strFromU8(files["word/document.xml"]!);

    expect(document).toContain("Tabel. Rincian Nilai Per Indikator pada Penyelenggaraan Diklat Operator Angkatan 3 dan 4");
    expect(document).toContain("No.");
    expect(document).toContain("Indikator Penilaian");
    expect(document).toContain("Nilai");
    expect(document.match(/<w:tr\b/g)).toHaveLength(18);
    expect(document).toContain("Indikator Penilaian 17");
    expect(document).toContain("96,00%");
    expect(document).toContain('w:w="11906"');
    expect(document).toContain('w:h="16838"');
    expect(document).not.toContain("NIK");
    expect(document).not.toContain("Distribusi");
    expect(document).not.toContain("Waktu Submit");
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
