import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "D:/Belajar/BDI/BDI-test-report";
const SKILL_DIR = "C:/Users/ASUS/.codex/plugins/cache/openai-primary-runtime/presentations/26.921.10847/skills/presentations";
const RUNTIME_PYTHON = "C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
const sourcePath = path.join(workspaceDir, "input/Sistem-Tes-Pelatihan-BDI-Medan.pptx");
const buildDir = path.join(workspaceDir, ".build/ppt-template");
const previewDir = path.join(buildDir, "draft-previews");
const finalPath = path.join(workspaceDir, "output/Template-Canva-Alur-Sistem-BDI-Medan-v2.pptx");
const logoPath = path.join(buildDir, "source-unpacked/ppt/media/image2.jpeg");

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
await fs.mkdir(path.dirname(finalPath), { recursive: true });

const { finalizePresentation } = await import(pathToFileURL(
  path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs"),
).href);

const W = 1280;
const H = 720;
const C = {
  blue: "#1D3BE3",
  navy: "#0A1540",
  yellow: "#FFE83D",
  pale: "#F1F4FD",
  line: "#C9D3F2",
  muted: "#44507A",
  green: "#0A7F62",
  red: "#B93C0B",
  white: "#FFFFFF",
};
const F = {
  display: "Sofia Sans Extra Condensed Black",
  body: "Host Grotesk",
  bold: "Host Grotesk Bold",
  mono: "Red Hat Mono SemiBold",
};

const presentation = Presentation.create({ slideSize: { width: W, height: H } });
const logoBytes = await fs.readFile(logoPath);

function addShape(slide, { name, geometry = "rect", left, top, width, height, fill = "none", lineFill = "none", lineWidth = 0, radius = 0 }) {
  return slide.shapes.add({
    geometry,
    name,
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
    ...(radius ? { borderRadius: radius } : {}),
  });
}

function addText(slide, text, { name, left, top, width, height, font = F.body, size = 24, color = C.navy, bold = false, align = "left", valign = "top", insets = { left: 0, right: 0, top: 0, bottom: 0 }, autoFit = "shrink", lineSpacing = 1.05 }) {
  const box = addShape(slide, { name, geometry: "textbox", left, top, width, height });
  box.text = text;
  box.text.style = {
    typeface: font,
    fontSize: size,
    color,
    bold,
    alignment: align,
    verticalAlignment: valign,
    insets,
    autoFit,
    lineSpacing,
  };
  return box;
}

function addHeader(slide, section, title, page, { titleSize = 48, dark = false } = {}) {
  const base = dark ? C.white : C.navy;
  addText(slide, section.toUpperCase(), {
    name: `section-${page}`,
    left: 48, top: 42, width: 880, height: 28,
    font: F.mono, size: 18, color: dark ? C.yellow : C.muted,
  });
  addText(slide, title.toUpperCase(), {
    name: `title-${page}`,
    left: 48, top: 78, width: 1184, height: 72,
    font: F.display, size: titleSize, color: base,
    autoFit: "shrink",
  });
  addText(slide, `${String(page).padStart(2, "0")} / 10`, {
    name: `page-${page}`,
    left: 1140, top: 684, width: 92, height: 20,
    font: F.mono, size: 12, color: dark ? C.white : C.muted, align: "right",
  });
}

function addScreenshotPlaceholder(slide, { left, top, width, height, label, caption, dark = false, name = "screenshot-placeholder" }) {
  const fill = dark ? C.navy : C.pale;
  const stroke = dark ? C.white : C.line;
  const text = dark ? C.white : C.navy;
  addShape(slide, { name: `${name}-surface`, left, top, width, height, fill, lineFill: stroke, lineWidth: 1.2, radius: 10 });
  addShape(slide, { name: `${name}-inner`, left: left + 18, top: top + 18, width: width - 36, height: height - 36, fill: "none", lineFill: stroke, lineWidth: 1.2, radius: 8 });
  addText(slide, "SCREENSHOT", {
    name: `${name}-tag`, left: left + 28, top: top + 28, width: 180, height: 24,
    font: F.mono, size: 14, color: dark ? C.yellow : C.blue,
  });
  addText(slide, label, {
    name: `${name}-label`, left: left + 40, top: top + height * 0.36, width: width - 80, height: 58,
    font: F.bold, size: 25, color: text, align: "center", valign: "middle",
  });
  addText(slide, caption, {
    name: `${name}-caption`, left: left + 40, top: top + height * 0.58, width: width - 80, height: 72,
    font: F.body, size: 18, color: dark ? C.white : C.muted, align: "center", valign: "middle",
  });
}

function addModuleRail(slide, active) {
  const labels = ["Program", "Peserta", "Bank Soal", "Tes", "Nilai", "Evaluasi", "Dokumen"];
  const startX = 48;
  const y = 155;
  const gap = 169;
  for (let i = 0; i < labels.length; i += 1) {
    const x = startX + i * gap;
    if (i < labels.length - 1) {
      addShape(slide, { name: `rail-line-${active}-${i}`, geometry: "line", left: x + 24, top: y + 12, width: gap - 24, height: 0, lineFill: i < active ? C.blue : C.line, lineWidth: 2 });
    }
    const circle = addShape(slide, { name: `rail-node-${active}-${i}`, geometry: "ellipse", left: x, top: y, width: 24, height: 24, fill: i === active ? C.blue : C.white, lineFill: i <= active ? C.blue : C.line, lineWidth: 2 });
    circle.text = String(i + 1);
    circle.text.style = { typeface: F.bold, fontSize: 12, color: i === active ? C.white : C.muted, alignment: "center", verticalAlignment: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } };
    addText(slide, labels[i], { name: `rail-label-${active}-${i}`, left: x - 18, top: y + 31, width: 76, height: 20, font: F.body, size: 12, color: i === active ? C.blue : C.muted, align: "center" });
  }
}

function addFeatureRow(slide, { y, index, title, body, width = 640 }) {
  const num = addShape(slide, { name: `feature-num-${index}-${y}`, geometry: "ellipse", left: 48, top: y + 2, width: 34, height: 34, fill: C.blue });
  num.text = String(index).padStart(2, "0");
  num.text.style = { typeface: F.bold, fontSize: 13, color: C.white, alignment: "center", verticalAlignment: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } };
  addText(slide, title, { name: `feature-title-${index}-${y}`, left: 96, top: y, width: width - 48, height: 31, font: F.bold, size: 22, color: C.navy });
  addText(slide, body, { name: `feature-body-${index}-${y}`, left: 96, top: y + 38, width: width - 48, height: 56, font: F.body, size: 17, color: C.muted, lineSpacing: 1.12 });
}

function addNotes(slide, text) {
  slide.speakerNotes.textFrame.setText(text);
}

// 1. Cover
{
  const slide = presentation.slides.add();
  slide.background.fill = C.blue;
  addText(slide, "BALAI DIKLAT INDUSTRI MEDAN", { name: "cover-org", left: 72, top: 88, width: 680, height: 34, font: F.mono, size: 20, color: C.yellow });
  addText(slide, "SISTEM TES\nPELATIHAN BDI", { name: "cover-title", left: 72, top: 140, width: 700, height: 250, font: F.display, size: 86, color: C.white, lineSpacing: 0.9 });
  addText(slide, "Digitalisasi pengelolaan pelatihan, tes, evaluasi, dan sertifikasi", { name: "cover-subtitle", left: 72, top: 410, width: 660, height: 72, font: F.bold, size: 27, color: C.yellow });
  addText(slide, "TEMPLATE CANVA  •  GANTI TEKS DAN VISUAL SESUAI SISTEM", { name: "cover-template-tag", left: 72, top: 620, width: 650, height: 24, font: F.mono, size: 13, color: C.white });
  addShape(slide, { name: "cover-logo-surface", left: 792, top: 92, width: 416, height: 132, fill: C.white, radius: 10 });
  slide.images.add({ blob: logoBytes, contentType: "image/jpeg", alt: "Logo Balai Diklat Industri Medan", fit: "contain", position: { left: 812, top: 108, width: 376, height: 100 } });
  addScreenshotPlaceholder(slide, { left: 792, top: 254, width: 416, height: 330, label: "GANTI DENGAN FOTO UTAMA", caption: "Gunakan foto kegiatan atau tampilan sistem", dark: true, name: "cover-hero" });
  addText(slide, "01 / 10", { name: "page-1", left: 1140, top: 684, width: 92, height: 20, font: F.mono, size: 12, color: C.white, align: "right" });
  addNotes(slide, "Template sampul. Ganti nama sistem, subjudul, logo, dan foto utama. Elemen tetap editable setelah file diunggah ke Canva.");
}

// 2. System overview
{
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, "Gambaran Sistem", "Satu sistem menghubungkan proses dari awal hingga dokumen", 2, { titleSize: 40 });
  addShape(slide, { name: "problem-panel", left: 48, top: 180, width: 560, height: 190, fill: C.pale, radius: 8 });
  addText(slide, "MASALAH UTAMA", { name: "problem-label", left: 76, top: 208, width: 500, height: 28, font: F.mono, size: 16, color: C.red });
  addText(slide, "[Tuliskan proses manual, keterlambatan, atau data yang tersebar]", { name: "problem-copy", left: 76, top: 252, width: 500, height: 90, font: F.body, size: 22, color: C.navy, valign: "middle" });
  addShape(slide, { name: "solution-panel", left: 640, top: 180, width: 592, height: 190, fill: C.pale, radius: 8 });
  addText(slide, "SOLUSI SISTEM", { name: "solution-label", left: 668, top: 208, width: 530, height: 28, font: F.mono, size: 16, color: C.green });
  addText(slide, "[Jelaskan bagaimana sistem menyatukan proses dan data]", { name: "solution-copy", left: 668, top: 252, width: 530, height: 90, font: F.body, size: 22, color: C.navy, valign: "middle" });
  addText(slide, "ALUR SISTEM", { name: "flow-label", left: 48, top: 414, width: 300, height: 28, font: F.mono, size: 16, color: C.muted });
  const stages = ["Program", "Peserta", "Bank Soal", "Tes", "Nilai", "Evaluasi", "Dokumen"];
  const stageX = [48, 210, 372, 534, 696, 858, 1020];
  stages.forEach((label, i) => {
    const node = addShape(slide, { name: `flow-node-${i}`, geometry: "ellipse", left: stageX[i], top: 478, width: 44, height: 44, fill: i === 0 || i === 6 ? C.blue : C.white, lineFill: C.blue, lineWidth: 2 });
    node.text = String(i + 1).padStart(2, "0");
    node.text.style = { typeface: F.bold, fontSize: 14, color: i === 0 || i === 6 ? C.white : C.blue, alignment: "center", verticalAlignment: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } };
    if (i < stages.length - 1) addShape(slide, { name: `flow-link-${i}`, geometry: "line", left: stageX[i] + 44, top: 500, width: stageX[i + 1] - stageX[i] - 44, height: 0, lineFill: C.blue, lineWidth: 2 });
    addText(slide, label, { name: `flow-stage-${i}`, left: stageX[i] - 30, top: 536, width: 104, height: 24, font: F.bold, size: 15, color: C.navy, align: "center" });
    addText(slide, `[Isi tahap ${i + 1}]`, { name: `flow-help-${i}`, left: stageX[i] - 30, top: 570, width: 104, height: 38, font: F.body, size: 12, color: C.muted, align: "center" });
  });
  addNotes(slide, "Ringkasan sistem. Gunakan tujuh tahap ini sebagai kerangka cerita. Ubah nama tahap jika alur sistem berbeda.");
}

// 3. Program setup
{
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, "Tahap 1 • Program", "Pengelolaan program menjadi titik awal alur", 3, { titleSize: 46 });
  addModuleRail(slide, 0);
  addFeatureRow(slide, { y: 238, index: 1, title: "Data program", body: "[Nama program, materi, angkatan, jumlah jam pelajaran, dan unit kompetensi]" });
  addFeatureRow(slide, { y: 350, index: 2, title: "Jadwal kegiatan", body: "[Tanggal pelatihan, pre-test, post-test, serta batas pengerjaan]" });
  addFeatureRow(slide, { y: 462, index: 3, title: "Kontrol administrator", body: "[Peran admin, status program, dan indikator yang perlu dipantau]" });
  addScreenshotPlaceholder(slide, { left: 754, top: 225, width: 478, height: 416, label: "GANTI SCREENSHOT PROGRAM", caption: "Contoh: dashboard admin atau halaman pengaturan pelatihan", name: "program-shot" });
  addNotes(slide, "Tahap program. Isi tiga kelompok informasi inti dan masukkan satu screenshot utama. Hindari menampilkan data pribadi.");
}

// 4. Participant data
{
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, "Tahap 2 • Peserta", "Data peserta tersimpan dalam satu angkatan", 4, { titleSize: 46 });
  addModuleRail(slide, 1);
  addFeatureRow(slide, { y: 238, index: 1, title: "Input peserta", body: "[Jelaskan input manual, unggah massal, atau integrasi data]" });
  addFeatureRow(slide, { y: 350, index: 2, title: "Identitas dan status", body: "[Sebutkan data penting, validasi, serta status aktif atau nonaktif]" });
  addFeatureRow(slide, { y: 462, index: 3, title: "Pencarian dan filter", body: "[Tunjukkan cara admin menemukan peserta dan riwayatnya]" });
  addScreenshotPlaceholder(slide, { left: 754, top: 225, width: 478, height: 416, label: "GANTI SCREENSHOT PESERTA", caption: "Contoh: tabel peserta, filter angkatan, atau detail peserta", name: "participant-shot" });
  addNotes(slide, "Tahap peserta. Anonimkan nama, NIK, nomor telepon, dan data pribadi pada screenshot.");
}

// 5. Question bank
{
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, "Tahap 3 • Bank Soal", "Bank soal membentuk paket ujian yang konsisten", 5, { titleSize: 46 });
  addModuleRail(slide, 2);
  const cards = [
    ["01", "Struktur materi", "[Kelompokkan soal berdasarkan materi atau unit kompetensi]"],
    ["02", "Editor soal", "[Jelaskan format soal, gambar, dan cara impor]"],
    ["03", "Paket ujian", "[Atur jumlah soal, bobot, dan pengacakan]"],
    ["04", "Pratinjau", "[Tinjau paket sebelum tes dibuka]"],
  ];
  cards.forEach((item, i) => {
    const x = 48 + i * 166;
    const badge = addShape(slide, { name: `bank-badge-${i}`, geometry: "roundRect", left: x, top: 235, width: 54, height: 54, fill: C.blue, radius: 8 });
    badge.text = item[0];
    badge.text.style = { typeface: F.bold, fontSize: 15, color: C.white, alignment: "center", verticalAlignment: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } };
    addText(slide, item[1], { name: `bank-title-${i}`, left: x, top: 307, width: 145, height: 54, font: F.bold, size: 21, color: C.navy });
    addText(slide, item[2], { name: `bank-copy-${i}`, left: x, top: 375, width: 145, height: 180, font: F.body, size: 16, color: C.muted, lineSpacing: 1.08 });
  });
  addScreenshotPlaceholder(slide, { left: 738, top: 225, width: 494, height: 416, label: "GANTI SCREENSHOT BANK SOAL", caption: "Contoh: daftar soal atau konfigurasi paket ujian", name: "question-shot" });
  addNotes(slide, "Tahap bank soal. Empat blok dapat diganti dengan fitur sistem lain. Pertahankan urutan dari pengelompokan hingga pratinjau.");
}

// 6. Participant test flow
{
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, "Tahap 4 • Tes", "Peserta mengikuti tes melalui alur yang sederhana", 6, { titleSize: 46 });
  addModuleRail(slide, 3);
  addText(slide, "[Tulis satu kalimat yang menjelaskan cara peserta masuk dan mengerjakan tes]", { name: "test-intro", left: 48, top: 223, width: 1184, height: 40, font: F.body, size: 21, color: C.muted });
  const steps = ["Identitas", "Pre-test", "Materi", "Post-test", "Hasil"];
  steps.forEach((label, i) => {
    const x = 48 + i * 238;
    addText(slide, String(i + 1).padStart(2, "0"), { name: `test-number-${i}`, left: x, top: 287, width: 70, height: 30, font: F.mono, size: 19, color: C.blue });
    addShape(slide, { name: `test-line-${i}`, geometry: "line", left: x, top: 330, width: 205, height: 0, lineFill: C.blue, lineWidth: 2 });
    addText(slide, label, { name: `test-step-${i}`, left: x, top: 350, width: 205, height: 42, font: F.bold, size: 22, color: C.navy });
  });
  addScreenshotPlaceholder(slide, { left: 48, top: 430, width: 1184, height: 214, label: "GANTI SCREENSHOT ALUR PESERTA", caption: "Gunakan tampilan login, halaman soal, atau hasil tes. Pilih satu fokus utama.", name: "test-shot" });
  addNotes(slide, "Tahap tes peserta. Ubah lima label langkah jika alurnya berbeda. Gunakan satu screenshot lebar agar detail tetap terbaca.");
}

// 7. Results and remedial
{
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, "Tahap 5 • Nilai", "Aturan kelulusan dan remedial terlihat jelas", 7, { titleSize: 46 });
  addModuleRail(slide, 4);
  addText(slide, "LOGIKA KELULUSAN", { name: "result-logic-label", left: 48, top: 223, width: 420, height: 26, font: F.mono, size: 15, color: C.muted });
  const start = addShape(slide, { name: "result-start", geometry: "roundRect", left: 48, top: 272, width: 150, height: 66, fill: C.pale, lineFill: C.line, lineWidth: 1, radius: 8 });
  start.text = "POST-TEST";
  start.text.style = { typeface: F.bold, fontSize: 19, color: C.navy, alignment: "center", verticalAlignment: "middle" };
  const pass = addShape(slide, { name: "result-pass", geometry: "roundRect", left: 266, top: 245, width: 220, height: 66, fill: "#E8F7F1", lineFill: C.green, lineWidth: 1.4, radius: 8 });
  pass.text = "SKOR ≥ BATAS\nLULUS";
  pass.text.style = { typeface: F.bold, fontSize: 18, color: C.green, alignment: "center", verticalAlignment: "middle" };
  const remedial = addShape(slide, { name: "result-remedial", geometry: "roundRect", left: 266, top: 341, width: 220, height: 80, fill: "#FFF4EE", lineFill: C.red, lineWidth: 1.4, radius: 8 });
  remedial.text = "SKOR < BATAS\nREMEDIAL";
  remedial.text.style = { typeface: F.bold, fontSize: 18, color: C.red, alignment: "center", verticalAlignment: "middle" };
  slide.shapes.connect(start, pass, { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.green, width: 2 } });
  slide.shapes.connect(start, remedial, { kind: "elbow", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.red, width: 2 } });
  addText(slide, "[Sesuaikan jumlah remedial dan kondisi akhir tes]", { name: "result-helper", left: 48, top: 446, width: 438, height: 48, font: F.body, size: 16, color: C.muted });
  const table = slide.tables.add({
    rows: 3, columns: 2, left: 48, top: 512, width: 610, height: 132,
    columnWidths: [210, 400],
    values: [
      ["Batas kelulusan", "[Contoh: 70]"],
      ["Remedial maksimal", "[Contoh: 2 kali]"],
      ["Durasi tambahan", "[Contoh: 7 menit per remedial]"],
    ],
  });
  table.borders.assign({ style: "solid", fill: C.line, width: 1 });
  for (let r = 0; r < 3; r += 1) {
    table.getCell(r, 0).fill = C.pale;
    table.getCell(r, 0).text.style = { typeface: F.bold, fontSize: 15, color: C.navy };
    table.getCell(r, 1).text.style = { typeface: F.body, fontSize: 15, color: C.muted };
  }
  addScreenshotPlaceholder(slide, { left: 704, top: 225, width: 528, height: 419, label: "GANTI SCREENSHOT NILAI", caption: "Contoh: rekap nilai, status kelulusan, atau riwayat remedial", name: "result-shot" });
  addNotes(slide, "Tahap nilai. Ganti aturan contoh pada tabel dengan ketentuan resmi sistem. Diagram dan tabel tetap editable.");
}

// 8. Evaluation and audit
{
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, "Tahap 6 • Evaluasi", "Evaluasi dan koreksi nilai memiliki rekam jejak", 8, { titleSize: 46 });
  addModuleRail(slide, 5);
  addShape(slide, { name: "evaluation-panel", left: 48, top: 235, width: 316, height: 340, fill: C.pale, radius: 8 });
  addText(slide, "01", { name: "evaluation-number", left: 76, top: 264, width: 60, height: 30, font: F.mono, size: 18, color: C.blue });
  addText(slide, "Evaluasi mutu", { name: "evaluation-title", left: 76, top: 308, width: 260, height: 34, font: F.bold, size: 23, color: C.navy });
  addText(slide, "[Jelaskan kuesioner, jadwal evaluasi, dan indikator mutu yang dipantau]", { name: "evaluation-copy", left: 76, top: 364, width: 260, height: 150, font: F.body, size: 18, color: C.muted, lineSpacing: 1.1 });
  addShape(slide, { name: "audit-panel", left: 392, top: 235, width: 316, height: 340, fill: C.pale, radius: 8 });
  addText(slide, "02", { name: "audit-number", left: 420, top: 264, width: 60, height: 30, font: F.mono, size: 18, color: C.blue });
  addText(slide, "Koreksi dan audit", { name: "audit-title", left: 420, top: 308, width: 260, height: 34, font: F.bold, size: 23, color: C.navy });
  addText(slide, "[Jelaskan persetujuan, alasan koreksi, waktu perubahan, dan identitas editor]", { name: "audit-copy", left: 420, top: 364, width: 260, height: 150, font: F.body, size: 18, color: C.muted, lineSpacing: 1.1 });
  addScreenshotPlaceholder(slide, { left: 754, top: 225, width: 478, height: 419, label: "GANTI SCREENSHOT EVALUASI", caption: "Contoh: kuesioner, ringkasan respons, atau audit log", name: "evaluation-shot" });
  addNotes(slide, "Tahap evaluasi. Gunakan dua panel untuk membedakan penjaminan mutu dan kontrol perubahan data.");
}

// 9. Documents
{
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, "Tahap 7 • Dokumen", "Dokumen akhir terbit dengan format yang konsisten", 9, { titleSize: 46 });
  addModuleRail(slide, 6);
  const outputs = [
    "[Jenis dokumen yang dihasilkan]",
    "[Aturan penulisan nama dan tanggal]",
    "[Unit kompetensi atau informasi wajib]",
    "[Penomoran otomatis dan status penerbitan]",
  ];
  outputs.forEach((item, i) => {
    const y = 245 + i * 84;
    const mark = addShape(slide, { name: `document-mark-${i}`, geometry: "roundRect", left: 48, top: y, width: 46, height: 46, fill: C.blue, radius: 8 });
    mark.text = String(i + 1).padStart(2, "0");
    mark.text.style = { typeface: F.bold, fontSize: 13, color: C.white, alignment: "center", verticalAlignment: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } };
    addText(slide, item, { name: `document-copy-${i}`, left: 112, top: y + 3, width: 570, height: 42, font: F.body, size: 20, color: C.navy, valign: "middle" });
  });
  addScreenshotPlaceholder(slide, { left: 754, top: 225, width: 478, height: 419, label: "GANTI PREVIEW DOKUMEN", caption: "Contoh: sertifikat, surat keterangan, atau laporan hasil", name: "document-shot" });
  addNotes(slide, "Tahap dokumen. Masukkan contoh yang sudah dianonimkan. Pastikan nomor dokumen dan tanda tangan tidak menampilkan data sensitif.");
}

// 10. Impact and close
{
  const slide = presentation.slides.add();
  slide.background.fill = C.blue;
  addHeader(slide, "Ringkasan", "Dampak sistem bagi pengelolaan pelatihan", 10, { titleSize: 48, dark: true });
  const items = [
    ["Efisien", "[Proses yang menjadi lebih cepat]"],
    ["Akurat", "[Data atau keputusan yang lebih tepat]"],
    ["Transparan", "[Progres yang lebih mudah dipantau]"],
    ["Terdokumentasi", "[Arsip dan audit yang lebih rapi]"],
  ];
  items.forEach((item, i) => {
    const x = 48 + i * 296;
    addShape(slide, { name: `impact-panel-${i}`, left: x, top: 190, width: 264, height: 250, fill: "none", lineFill: C.line, lineWidth: 2, radius: 10 });
    addText(slide, item[0], { name: `impact-title-${i}`, left: x + 26, top: 222, width: 212, height: 34, font: F.bold, size: 23, color: C.yellow });
    addText(slide, item[1], { name: `impact-copy-${i}`, left: x + 26, top: 286, width: 212, height: 100, font: F.body, size: 19, color: C.white, lineSpacing: 1.1 });
  });
  addShape(slide, { name: "closing-panel", left: 48, top: 478, width: 1184, height: 154, fill: C.navy, radius: 8 });
  addText(slide, "[Tulis satu kalimat penutup tentang manfaat sistem dan langkah berikutnya]", { name: "closing-statement", left: 80, top: 510, width: 1120, height: 48, font: F.bold, size: 23, color: C.white, valign: "middle" });
  addText(slide, "NARAHUBUNG  •  [NAMA]  •  [EMAIL / NOMOR KONTAK]", { name: "closing-contact", left: 80, top: 584, width: 1120, height: 24, font: F.mono, size: 14, color: C.line });
  addNotes(slide, "Slide penutup. Ringkas empat dampak utama, tambahkan satu kalimat penutup, lalu isi narahubung.");
}

// Draft renders for visual review
for (let i = 0; i < presentation.slides.items.length; i += 1) {
  const slide = presentation.slides.getItem(i);
  const png = await slide.export({ format: "png", scale: 1.5 });
  await fs.writeFile(path.join(previewDir, `slide-${String(i + 1).padStart(2, "0")}.png`), new Uint8Array(await png.arrayBuffer()));
}
const montage = await presentation.export({ format: "png", montage: true, scale: 1 });
await fs.writeFile(path.join(previewDir, "montage.png"), new Uint8Array(await montage.arrayBuffer()));

const requirements = {
  explicitTotalSlideCount: 10,
  requiredNativeTableOwnerSlides: [7],
  requiredNativeChartOwnerSlides: [],
  verifyArtifactToolImport: true,
};
const fontPolicy = {
  basis: "reference",
  families: [F.display, F.body, F.bold, F.mono],
  referencePath: sourcePath,
  referenceSha256: "87e4b2175e953dd9dd897ebb9b9d116c81298ca300c7f6653228ceb27500934e",
};
const stagingDir = path.join(workspaceDir, ".codex-finalizer");
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, "template-canva-candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const result = await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "12192000,6858000",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
    "--require-native-table-slide", "7",
  ],
  requiredNativeTableOwnerSlides: [7],
  fontPolicy,
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "Template-Canva-Alur-Sistem-BDI-Medan-v2.validation.json"),
});

console.log(JSON.stringify({ finalPath, result }, null, 2));
