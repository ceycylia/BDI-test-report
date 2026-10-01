export async function downloadQuestionTemplate(): Promise<void> {
  const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "TEMPLATE IMPORT SOAL BDI",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Gunakan tepat empat pilihan A-D. Jika soal mempunyai gambar, letakkan gambar inline setelah teks pertanyaan dan sebelum pilihan A.",
                italics: true,
              }),
            ],
          }),
          new Paragraph({ text: "SOAL 1", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: "PERTANYAAN:" }),
          new Paragraph({ text: "Tuliskan pertanyaan pertama di sini." }),
          new Paragraph({ text: "A. Pilihan jawaban pertama" }),
          new Paragraph({ text: "B. Pilihan jawaban kedua" }),
          new Paragraph({ text: "C. Pilihan jawaban ketiga" }),
          new Paragraph({ text: "D. Pilihan jawaban keempat" }),
          new Paragraph({ text: "KUNCI: B" }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "SOAL 2", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: "PERTANYAAN:" }),
          new Paragraph({ text: "Tuliskan pertanyaan kedua di sini." }),
          new Paragraph({ text: "A. Pilihan jawaban pertama" }),
          new Paragraph({ text: "B. Pilihan jawaban kedua" }),
          new Paragraph({ text: "C. Pilihan jawaban ketiga" }),
          new Paragraph({ text: "D. Pilihan jawaban keempat" }),
          new Paragraph({ text: "KUNCI: C" }),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(document);
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = "Template-Import-Soal-BDI.docx";
  link.click();
  URL.revokeObjectURL(url);
}
