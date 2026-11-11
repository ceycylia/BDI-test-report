import { PDFDocument } from "pdf-lib";
import { zipSync } from "fflate";

export async function combinePdfDocuments(documents: Uint8Array[]) {
  const combined = await PDFDocument.create();
  for (const bytes of documents) {
    const source = await PDFDocument.load(bytes);
    const pages = await combined.copyPages(source, source.getPageIndices());
    pages.forEach((page) => combined.addPage(page));
  }
  return combined.save();
}

export async function buildCertificatePrintArchive(
  frontParts: Uint8Array[],
  back: Uint8Array,
) {
  const fronts = await combinePdfDocuments(frontParts);
  return new Blob([
    zipSync({
      "Sertifikat Depan.pdf": fronts,
      "Sertifikat Belakang.pdf": back,
    }, { level: 6 }),
  ], { type: "application/zip" });
}

function safeParticipantName(value: string) {
  return value
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[. ]+$/gu, "")
    .slice(0, 120) || "PESERTA";
}

export function participantCertificateFileName(name: string, usedNames: Set<string>) {
  const base = safeParticipantName(name);
  let suffix = 1;
  let candidate = `${base}.pdf`;
  while (usedNames.has(candidate.toLocaleLowerCase("id-ID"))) {
    suffix += 1;
    candidate = `${base} (${suffix}).pdf`;
  }
  usedNames.add(candidate.toLocaleLowerCase("id-ID"));
  return candidate;
}
