import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  combinePdfDocuments,
  participantCertificateFileName,
} from "../worker/domain/certificates/download";

async function onePagePdf(width: number, height: number) {
  const document = await PDFDocument.create();
  document.addPage([width, height]);
  return document.save();
}

describe("download semua sertifikat", () => {
  it("menggabungkan bagian depan dan belakang menjadi satu PDF dua halaman", async () => {
    const front = await onePagePdf(842, 595);
    const back = await onePagePdf(841, 594);
    const combined = await combinePdfDocuments([front, back]);
    const result = await PDFDocument.load(combined);

    expect(result.getPageCount()).toBe(2);
    expect(result.getPage(0).getSize()).toEqual({ width: 842, height: 595 });
    expect(result.getPage(1).getSize()).toEqual({ width: 841, height: 594 });
  });

  it("memakai nama peserta langsung dan mencegah file bernama sama tertimpa", () => {
    const usedNames = new Set<string>();

    expect(participantCertificateFileName("Syahli Kurniawan", usedNames)).toBe("Syahli Kurniawan.pdf");
    expect(participantCertificateFileName("Syahli Kurniawan", usedNames)).toBe("Syahli Kurniawan (2).pdf");
    expect(participantCertificateFileName("Nama: Peserta/Baru", usedNames)).toBe("Nama Peserta Baru.pdf");
  });
});
