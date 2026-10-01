import { mkdir, writeFile } from "node:fs/promises";
import { Document, ImageRun, Packer, Paragraph } from "docx";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const document = new Document({
  sections: [
    {
      children: [
        new Paragraph("SOAL 1"),
        new Paragraph("PERTANYAAN:"),
        new Paragraph("Apa fungsi utama forklift?"),
        new Paragraph({
          children: [
            new ImageRun({
              type: "png",
              data: onePixelPng,
              transformation: { width: 40, height: 40 },
            }),
          ],
        }),
        new Paragraph("A. Mengangkat dan memindahkan material"),
        new Paragraph("B. Mengukur suhu"),
        new Paragraph("C. Mengelas logam"),
        new Paragraph("D. Memotong kayu"),
        new Paragraph("KUNCI: A"),
        new Paragraph("SOAL 2"),
        new Paragraph("PERTANYAAN:"),
        new Paragraph("Apa yang diperiksa sebelum forklift digunakan?"),
        new Paragraph("A. Warna gedung"),
        new Paragraph("B. Kondisi alat dan area kerja"),
        new Paragraph("C. Jam istirahat"),
        new Paragraph("D. Jumlah kursi"),
        new Paragraph("KUNCI: B"),
      ],
    },
  ],
});

await mkdir(".wrangler", { recursive: true });
await writeFile(".wrangler/qa-import-valid.docx", await Packer.toBuffer(document));

const invalidDocument = new Document({
  sections: [
    {
      children: [
        new Paragraph("SOAL 1"),
        new Paragraph("PERTANYAAN:"),
        new Paragraph("Soal ini sengaja tidak lengkap."),
        new Paragraph("A. Satu"),
        new Paragraph("B. Dua"),
        new Paragraph("D. Empat"),
        new Paragraph("KUNCI: Z"),
      ],
    },
  ],
});
await writeFile(".wrangler/qa-import-invalid.docx", await Packer.toBuffer(invalidDocument));
process.stdout.write(".wrangler/qa-import-valid.docx\n.wrangler/qa-import-invalid.docx\n");
