import { describe, expect, it } from "vitest";
import { parseQuestionBlocks, type DocxBlock } from "../src/features/docx-import/parser-core";

const block = (text: string, images: DocxBlock["images"] = []): DocxBlock => ({ text, images });

describe("DOCX question parser", () => {
  it("membaca soal valid dengan tepat empat opsi dan satu kunci", () => {
    const result = parseQuestionBlocks([
      block("SOAL 1"),
      block("PERTANYAAN:"),
      block("Apa fungsi forklift?"),
      block("A. Mengangkat material"),
      block("B. Mengukur suhu"),
      block("C. Mengelas"),
      block("D. Memotong"),
      block("KUNCI: A"),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sourceNumber: 1,
      questionText: "Apa fungsi forklift?",
      optionA: "Mengangkat material",
      correctOptionKey: "A",
      errors: [],
    });
  });

  it("mendeteksi pilihan dan kunci yang hilang", () => {
    const [question] = parseQuestionBlocks([
      block("SOAL 2"),
      block("PERTANYAAN:"),
      block("Pertanyaan tidak lengkap"),
      block("A. Satu"),
      block("B. Dua"),
      block("D. Empat"),
    ]);

    expect(question?.errors).toContain("Pilihan C tidak ditemukan.");
    expect(question?.errors).toContain("Kunci jawaban kosong atau bukan A-D.");
  });

  it("menolak gambar yang diletakkan pada jawaban", () => {
    const [question] = parseQuestionBlocks([
      block("SOAL 3"),
      block("PERTANYAAN:"),
      block("Pertanyaan"),
      block("A. Satu"),
      block("", [{ dataUrl: "data:image/png;base64,AA==", mimeType: "image/png" }]),
      block("B. Dua"),
      block("C. Tiga"),
      block("D. Empat"),
      block("KUNCI: B"),
    ]);

    expect(question?.errors).toContain("Gambar hanya boleh berada pada bagian pertanyaan.");
  });

  it("mendeteksi nomor soal duplikat", () => {
    const result = parseQuestionBlocks([
      block("SOAL 1"), block("PERTANYAAN:"), block("Satu"),
      block("A. A"), block("B. B"), block("C. C"), block("D. D"), block("KUNCI: A"),
      block("SOAL 1"), block("PERTANYAAN:"), block("Dua"),
      block("A. A"), block("B. B"), block("C. C"), block("D. D"), block("KUNCI: B"),
    ]);

    expect(result[1]?.errors).toContain("Nomor soal 1 digunakan lebih dari sekali.");
  });
});
