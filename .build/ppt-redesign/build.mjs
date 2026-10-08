import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "D:/Belajar/BDI/BDI-test-report";
const SKILL_DIR = "C:/Users/ASUS/.codex/plugins/cache/openai-primary-runtime/presentations/26.921.10847/skills/presentations";
const RUNTIME_PYTHON = "C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
const sourcePath = path.join(workspaceDir, "input/Sistem-Tes-Pelatihan-BDI-Medan.pptx");
const buildDir = path.join(workspaceDir, ".build/ppt-redesign");
const previewDir = path.join(buildDir, "draft-previews");
const finalPath = path.join(workspaceDir, "output/Redesign-Modern-Sistem-Tes-Pelatihan-BDI-Medan-v2.pptx");
const logoPath = path.join(workspaceDir, ".build/ppt-template/source-unpacked/ppt/media/image2.jpeg");

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
await fs.mkdir(path.dirname(finalPath), { recursive: true });

const { finalizePresentation } = await import(pathToFileURL(
  path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs"),
).href);

const W = 1280;
const H = 720;
const C = {
  ink: "#071B4A",
  blue: "#2348E8",
  blueDark: "#102A86",
  yellow: "#FFE83D",
  white: "#FFFFFF",
  canvas: "#F7F8FC",
  pale: "#EDF1FF",
  line: "#CAD4F6",
  muted: "#526087",
  green: "#0B8B6D",
  red: "#C94713",
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

function addText(slide, text, { name, left, top, width, height, font = F.body, size = 24, color = C.ink, bold = false, align = "left", valign = "top", autoFit = "shrink", lineSpacing = 1.06, insets = { left: 0, right: 0, top: 0, bottom: 0 } }) {
  const box = addShape(slide, { name, geometry: "textbox", left, top, width, height });
  box.text = text;
  box.text.style = {
    typeface: font,
    fontSize: size,
    color,
    bold,
    alignment: align,
    verticalAlignment: valign,
    autoFit,
    lineSpacing,
    insets,
  };
  return box;
}

function addBase(slide, section, title, page, { dark = false, titleSize = 46 } = {}) {
  slide.background.fill = dark ? C.blue : C.canvas;
  if (!dark) addShape(slide, { name: `top-rule-${page}`, left: 0, top: 0, width: W, height: 8, fill: C.blue });
  addText(slide, section, {
    name: `section-${page}`,
    left: 64, top: 42, width: 830, height: 28,
    font: F.mono, size: 17, color: dark ? C.yellow : C.blue,
  });
  addText(slide, title, {
    name: `title-${page}`,
    left: 64, top: 82, width: 1100, height: 72,
    font: F.display, size: titleSize, color: dark ? C.white : C.ink,
  });
  addShape(slide, { name: `title-accent-${page}`, left: 64, top: 158, width: 88, height: 5, fill: C.yellow });
  addText(slide, String(page).padStart(2, "0"), {
    name: `page-${page}`,
    left: 1180, top: 665, width: 48, height: 24,
    font: F.mono, size: 15, color: dark ? C.white : C.muted, align: "right",
  });
}

function addScreenshotFrame(slide, { left, top, width, height, label, caption, note, dark = false, name }) {
  const outerFill = dark ? C.ink : C.white;
  const innerFill = dark ? C.blueDark : C.pale;
  const border = dark ? "#7890F6" : C.line;
  addShape(slide, { name: `${name}-shadow`, left: left + 8, top: top + 10, width, height, fill: dark ? C.blueDark : "#DDE4FA", radius: 14 });
  addShape(slide, { name: `${name}-frame`, left, top, width, height, fill: outerFill, lineFill: border, lineWidth: 1.2, radius: 14 });
  addShape(slide, { name: `${name}-toolbar`, left, top, width, height: 38, fill: dark ? C.blueDark : C.ink, radius: 14 });
  for (let i = 0; i < 3; i += 1) {
    addShape(slide, { name: `${name}-dot-${i}`, geometry: "ellipse", left: left + 18 + i * 18, top: top + 13, width: 10, height: 10, fill: [C.red, C.yellow, C.green][i] });
  }
  addShape(slide, { name: `${name}-drop-zone`, left: left + 18, top: top + 56, width: width - 36, height: height - 132, fill: innerFill, lineFill: border, lineWidth: 1.2, radius: 10 });
  addText(slide, label, {
    name: `${name}-label`, left: left + 46, top: top + height * 0.38, width: width - 92, height: 56,
    font: F.bold, size: 24, color: dark ? C.white : C.ink, align: "center", valign: "middle",
  });
  addText(slide, caption, {
    name: `${name}-caption`, left: left + 28, top: top + height - 62, width: width - 56, height: 38,
    font: F.body, size: 16, color: dark ? C.white : C.muted, align: "center", valign: "middle",
  });
  if (note) {
    addText(slide, note, {
      name: `${name}-note`, left, top: top + height + 14, width, height: 44,
      font: F.body, size: 13, color: dark ? C.white : C.muted, align: "center",
    });
  }
}

function addNumberRow(slide, { index, y, title, body, left = 64, width = 590 }) {
  addText(slide, String(index).padStart(2, "0"), { name: `row-num-${index}-${y}`, left, top: y, width: 46, height: 30, font: F.mono, size: 18, color: C.blue });
  addText(slide, title, { name: `row-title-${index}-${y}`, left: left + 64, top: y - 2, width: width - 64, height: 32, font: F.bold, size: 21, color: C.ink });
  addText(slide, body, { name: `row-body-${index}-${y}`, left: left + 64, top: y + 38, width: width - 64, height: 58, font: F.body, size: 17, color: C.muted, lineSpacing: 1.1 });
  addShape(slide, { name: `row-rule-${index}-${y}`, left: left + 64, top: y + 105, width: width - 64, height: 1, fill: C.line });
}

function addNotes(slide, text) {
  slide.speakerNotes.textFrame.setText(text);
}

// 1 — Cover
{
  const slide = presentation.slides.add();
  slide.background.fill = C.blue;
  addShape(slide, { name: "cover-navy-field", left: 0, top: 0, width: 760, height: H, fill: C.ink });
  addShape(slide, { name: "cover-yellow-rule", left: 64, top: 84, width: 96, height: 6, fill: C.yellow });
  addText(slide, "BALAI DIKLAT INDUSTRI MEDAN", { name: "cover-org", left: 64, top: 108, width: 620, height: 32, font: F.mono, size: 18, color: C.yellow });
  addText(slide, "SISTEM TES\nPELATIHAN BDI", { name: "cover-title", left: 64, top: 168, width: 640, height: 220, font: F.display, size: 82, color: C.white, lineSpacing: 0.88 });
  addText(slide, "Digitalisasi Pengelolaan Pelatihan, Tes, Evaluasi, dan Sertifikasi", { name: "cover-subtitle", left: 64, top: 432, width: 620, height: 72, font: F.bold, size: 25, color: C.white });
  addText(slide, "[Catatan: Tambahkan logo BDI dan foto kegiatan pelatihan; hapus catatan ini setelah selesai.]", { name: "cover-note", left: 64, top: 592, width: 620, height: 48, font: F.body, size: 15, color: C.line });
  addShape(slide, { name: "cover-logo-box", left: 816, top: 64, width: 400, height: 120, fill: C.white, radius: 14 });
  slide.images.add({ blob: logoBytes, contentType: "image/jpeg", alt: "Logo Balai Diklat Industri Medan", fit: "contain", position: { left: 840, top: 80, width: 352, height: 88 } });
  addScreenshotFrame(slide, { left: 816, top: 224, width: 400, height: 374, label: "[Masukkan Foto Kegiatan]", caption: "Foto kegiatan pelatihan", note: "", dark: true, name: "cover-photo" });
  addText(slide, "01", { name: "page-1", left: 1180, top: 665, width: 48, height: 24, font: F.mono, size: 15, color: C.white, align: "right" });
  addNotes(slide, "Selamat datang. Presentasi ini memaparkan rancangan Sistem Tes Pelatihan BDI Medan untuk mendigitalkan seluruh siklus evaluasi dan sertifikasi.");
}

// 2 — Transformation overview
{
  const slide = presentation.slides.add();
  addBase(slide, "TRANSFORMASI DIGITAL", "SATU SISTEM MENGHUBUNGKAN PROSES PELATIHAN DARI AWAL HINGGA SERTIFIKAT", 2, { titleSize: 34 });
  addShape(slide, { name: "problem-band", left: 64, top: 200, width: 542, height: 214, fill: C.ink, radius: 12 });
  addText(slide, "Masalah Operasional", { name: "problem-title", left: 94, top: 230, width: 480, height: 34, font: F.bold, size: 24, color: C.yellow });
  addText(slide, "Administrasi peserta masih manual; hasil tes sulit dipantau; remedial belum terstruktur; sertifikat membutuhkan waktu.", { name: "problem-copy", left: 94, top: 292, width: 470, height: 92, font: F.body, size: 20, color: C.white, lineSpacing: 1.12 });
  addShape(slide, { name: "solution-band", left: 634, top: 200, width: 582, height: 214, fill: C.blue, radius: 12 });
  addText(slide, "Solusi Terpadu", { name: "solution-title", left: 664, top: 230, width: 522, height: 34, font: F.bold, size: 24, color: C.yellow });
  addText(slide, "Satu sistem terintegrasi mengelola seluruh proses dengan lebih tertib dan terdokumentasi.", { name: "solution-copy", left: 664, top: 292, width: 512, height: 92, font: F.body, size: 20, color: C.white, lineSpacing: 1.12 });
  addText(slide, "ALUR KERJA TERPADU END-TO-END", { name: "flow-label", left: 64, top: 474, width: 500, height: 24, font: F.mono, size: 15, color: C.blue });
  addShape(slide, { name: "flow-surface", left: 64, top: 520, width: 1152, height: 94, fill: C.white, lineFill: C.line, lineWidth: 1, radius: 12 });
  addText(slide, "Pelatihan → Peserta → Bank Soal → Tes → Hasil → Evaluasi → Sertifikat", { name: "flow-copy", left: 94, top: 544, width: 1092, height: 46, font: F.bold, size: 24, color: C.ink, align: "center", valign: "middle" });
  addNotes(slide, "Bagan ini merangkum pergeseran dari proses konvensional yang manual menuju pipeline digital utuh dari pendaftaran hingga penerbitan sertifikat.");
}

// 3 — Administrator
{
  const slide = presentation.slides.add();
  addBase(slide, "MODUL ADMINISTRATOR", "DASHBOARD ADMIN MENJADI PUSAT KENDALI PELATIHAN", 3, { titleSize: 43 });
  addNumberRow(slide, { index: 1, y: 220, title: "Program & materi:", body: "Membuat pelatihan, materi, angkatan, jumlah JPL, dan kode unit kompetensi." });
  addNumberRow(slide, { index: 2, y: 344, title: "Jadwal:", body: "Mengatur jadwal Pre-Test dan Post-Test." });
  addNumberRow(slide, { index: 3, y: 468, title: "Monitoring:", body: "Memantau pelatihan aktif dan aktivitas sistem." });
  addScreenshotFrame(slide, { left: 720, top: 206, width: 496, height: 392, label: "[Masukkan Screenshot Sistem]", caption: "Tampilan Dashboard Admin & Setup Diklat", note: "[Catatan: Pilih screenshot Dashboard atau Pelatihan & Materi; hapus catatan setelah selesai.]", name: "admin-shot" });
  addNotes(slide, "");
}

// 4 — Participants
{
  const slide = presentation.slides.add();
  addBase(slide, "MANAJEMEN PESERTA", "DATA PESERTA DAN ANGKATAN TERSIMPAN TERPUSAT", 4, { titleSize: 43 });
  addNumberRow(slide, { index: 1, y: 220, title: "Input Fleksibel & Massal", body: "Tambah peserta secara manual atau melalui upload." });
  addNumberRow(slide, { index: 2, y: 344, title: "Identitas Lengkap & Status Angkatan", body: "Kelola nama, NIK, foto, pelatihan, angkatan, dan status aktif/nonaktif." });
  addNumberRow(slide, { index: 3, y: 468, title: "Pencarian & Filter Terarah", body: "Gunakan pencarian, filter, pagination, dan detail peserta." });
  addScreenshotFrame(slide, { left: 720, top: 206, width: 496, height: 392, label: "[Masukkan Screenshot Sistem]", caption: "Tabel Manajemen Peserta & Filter Angkatan", note: "[Catatan: Gunakan contoh data yang sudah dianonimkan; hapus catatan setelah selesai.]", name: "participant-shot" });
  addNotes(slide, "Data peserta dikunci ke angkatan masing-masing dengan validasi NIK sehingga data riwayat ujian dan sertifikasi selalu valid.");
}

// 5 — Question bank
{
  const slide = presentation.slides.add();
  addBase(slide, "EVALUASI KOMPETENSI", "BANK SOAL MEMBENTUK PAKET UJIAN SECARA FLEKSIBEL", 5, { titleSize: 43 });
  const features = [
    ["01", "Struktur Berbasis Materi", "Penyimpanan butir soal dikelompokkan menurut unit kompetensi dan materi ajar spesifik."],
    ["02", "Editor Lengkap & Gambar", "Kemudahan tambah, edit, hapus, import massal, serta dukungan penyisipan gambar teknis pada butir soal."],
    ["03", "Generate Paket Acak", "Sistem merakit paket ujian secara otomatis dan acak sesuai proporsi bobot materi yang ditentukan."],
    ["04", "Preview & Unduh Dokumen", "Pratinjau naskah soal dan opsi cetak/unduh arsip paket tes untuk dokumentasi arsip BDI."],
  ];
  features.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 64 + col * 316;
    const y = 210 + row * 216;
    addText(slide, item[0], { name: `bank-num-${i}`, left: x, top: y, width: 52, height: 28, font: F.mono, size: 17, color: C.blue });
    addText(slide, item[1], { name: `bank-title-${i}`, left: x, top: y + 38, width: 280, height: 54, font: F.bold, size: 21, color: C.ink });
    addText(slide, item[2], { name: `bank-copy-${i}`, left: x, top: y + 98, width: 280, height: 100, font: F.body, size: 16, color: C.muted, lineSpacing: 1.08 });
    addShape(slide, { name: `bank-rule-${i}`, left: x, top: y + 199, width: 280, height: 1, fill: C.line });
  });
  addScreenshotFrame(slide, { left: 720, top: 206, width: 496, height: 424, label: "[Masukkan Screenshot Sistem]", caption: "Halaman Bank Soal & Konfigurasi Paket Ujian", note: "", name: "bank-shot" });
  addNotes(slide, "Pengacakan soal menjamin integritas pengujian antar peserta tanpa menambah beban administrasi bagi instruktur.");
}

// 6 — Participant journey
{
  const slide = presentation.slides.add();
  addBase(slide, "PENGALAMAN PESERTA", "PESERTA MENGIKUTI ALUR TES YANG SEDERHANA", 6, { titleSize: 45 });
  addText(slide, "Peserta mengerjakan tes melalui tautan pelatihan secara mandiri.", { name: "journey-intro", left: 64, top: 194, width: 1100, height: 34, font: F.body, size: 21, color: C.muted });
  const steps = [["01", "Isi Nama dan NIK"], ["02", "Pre-Test"], ["03", "Materi Pelatihan"], ["04", "Post-Test"], ["05", "Hasil"]];
  steps.forEach((item, i) => {
    const x = 64 + i * 230;
    addText(slide, item[0], { name: `journey-num-${i}`, left: x, top: 252, width: 52, height: 28, font: F.mono, size: 18, color: C.blue });
    addShape(slide, { name: `journey-rule-${i}`, left: x, top: 294, width: 196, height: 3, fill: i === 4 ? C.yellow : C.blue });
    addText(slide, item[1], { name: `journey-step-${i}`, left: x, top: 316, width: 196, height: 48, font: F.bold, size: 20, color: C.ink });
  });
  addScreenshotFrame(slide, { left: 64, top: 398, width: 1152, height: 218, label: "[Masukkan Screenshot Sistem]", caption: "Halaman Ujian Peserta", note: "[Catatan: Tambahkan screenshot halaman peserta atau halaman soal; hapus catatan setelah selesai.]", name: "journey-shot" });
  addNotes(slide, "Alur dibuat seringkas mungkin agar peserta dari berbagai latar belakang dapat langsung mengerjakan ujian tanpa kendala teknis.");
}

// 7 — Graduation and remedial
{
  const slide = presentation.slides.add();
  addBase(slide, "STANDAR KELULUSAN & REMEDIAL", "NILAI, REMEDIAL, DAN MONITORING HASIL BERJALAN DALAM SATU ALUR", 7, { titleSize: 34 });
  addText(slide, "LOGIKA KELULUSAN & REMEDIAL", { name: "logic-label", left: 64, top: 196, width: 540, height: 24, font: F.mono, size: 15, color: C.blue });
  addShape(slide, { name: "pass-block", left: 64, top: 240, width: 598, height: 82, fill: "#E5F6F1", lineFill: "#A2DCCA", lineWidth: 1, radius: 10 });
  addText(slide, "Jalur Kelulusan Langsung: Post-Test → Skor ≥ Passing Grade → Lulus (Selesai)", { name: "pass-copy", left: 88, top: 258, width: 550, height: 46, font: F.bold, size: 18, color: C.green, valign: "middle" });
  addShape(slide, { name: "remedial-block", left: 64, top: 338, width: 598, height: 94, fill: "#FFF0E8", lineFill: "#F3B49A", lineWidth: 1, radius: 10 });
  addText(slide, "Jalur Remedial Bertahap: Post-Test (< Passing Grade) → Remedial 1 → Remedial 2 → Tes Diakhiri", { name: "remedial-copy", left: 88, top: 356, width: 550, height: 58, font: F.bold, size: 18, color: C.red, valign: "middle" });
  const table = slide.tables.add({
    rows: 3, columns: 2, left: 64, top: 468, width: 598, height: 150,
    columnWidths: [224, 374],
    values: [
      ["Aturan Waktu", "Awal 7 menit; tiap remedial menambah 7 menit"],
      ["Batas Remedial", "Maksimal 2 kali pengulangan tes"],
      ["Passing Grade", "Dapat dikonfigurasi per jenis pelatihan"],
    ],
  });
  table.borders.assign({ style: "solid", fill: C.line, width: 1 });
  for (let r = 0; r < 3; r += 1) {
    table.getCell(r, 0).fill = C.ink;
    table.getCell(r, 0).text.style = { typeface: F.bold, fontSize: 15, color: C.white };
    table.getCell(r, 1).fill = C.white;
    table.getCell(r, 1).text.style = { typeface: F.body, fontSize: 15, color: C.ink };
  }
  addScreenshotFrame(slide, { left: 710, top: 206, width: 506, height: 414, label: "[Masukkan Screenshot Sistem]", caption: "Monitoring Nilai: Pre, Post, Remedial 1, Remedial 2, dan Nilai Akhir", note: "", name: "score-shot" });
  addNotes(slide, "Penambahan durasi 7 menit tiap remedial memberi kesempatan adil bagi peserta tanpa membuka celah pengulangan tanpa batas.");
}

// 8 — Quality assurance
{
  const slide = presentation.slides.add();
  addBase(slide, "AKUNTABILITAS & PENJAMINAN MUTU", "EVALUASI DAN KOREKSI NILAI TETAP TERDOKUMENTASI", 8, { titleSize: 43 });
  addText(slide, "01", { name: "quality-num", left: 64, top: 220, width: 52, height: 28, font: F.mono, size: 18, color: C.blue });
  addText(slide, "Evaluasi & Monitoring Respons", { name: "quality-title", left: 64, top: 262, width: 292, height: 62, font: F.bold, size: 22, color: C.ink });
  addText(slide, "Buat template dan jadwal evaluasi instruktur, kurikulum, serta fasilitas. Pantau respons peserta secara transparan sebelum sertifikat diterbitkan.", { name: "quality-copy", left: 64, top: 344, width: 292, height: 164, font: F.body, size: 18, color: C.muted, lineSpacing: 1.12 });
  addShape(slide, { name: "quality-divider", left: 380, top: 220, width: 2, height: 308, fill: C.line });
  addText(slide, "02", { name: "audit-num", left: 410, top: 220, width: 52, height: 28, font: F.mono, size: 18, color: C.blue });
  addText(slide, "Koreksi Nilai & Audit Log", { name: "audit-title", left: 410, top: 262, width: 292, height: 62, font: F.bold, size: 22, color: C.ink });
  addText(slide, "Koreksi skor untuk force majeure atau ujian susulan dengan persetujuan pimpinan. Log tidak terhapus; tiap perubahan mencatat identitas editor, waktu, dan alasan.", { name: "audit-copy", left: 410, top: 344, width: 292, height: 188, font: F.body, size: 18, color: C.muted, lineSpacing: 1.12 });
  addScreenshotFrame(slide, { left: 742, top: 206, width: 474, height: 392, label: "[Masukkan Screenshot Sistem]", caption: "Tampilan Kuesioner & Modal Audit Log Koreksi Nilai", note: "[Catatan: Tambahkan screenshot Evaluasi atau modal koreksi nilai; hapus catatan setelah selesai.]", name: "audit-shot" });
  addNotes(slide, "Audit log mencegah kecurangan nilai dan memastikan evaluasi mutu diklat memiliki rekam jejak formal yang siap diaudit.");
}

// 9 — Documents
{
  const slide = presentation.slides.add();
  addBase(slide, "OUTPUT DOKUMEN", "SERTIFIKAT DAN SURAT KETERANGAN TERBIT LEBIH KONSISTEN", 9, { titleSize: 42 });
  const items = [
    "Generate sertifikat dan surat keterangan.",
    "Nama peserta ditulis dalam huruf kapital.",
    "Tanggal penerbitan mengikuti tanggal terakhir pelatihan.",
    "Tampilkan unit kompetensi dan kode unit kompetensi.",
    "Nomor sertifikat dan surat diterapkan otomatis secara berurutan.",
  ];
  items.forEach((item, i) => {
    const y = 218 + i * 72;
    addShape(slide, { name: `doc-marker-${i}`, left: 64, top: y + 4, width: 12, height: 38, fill: i === 4 ? C.yellow : C.blue, radius: 4 });
    addText(slide, item, { name: `doc-item-${i}`, left: 98, top: y, width: 566, height: 48, font: F.body, size: 19, color: C.ink, valign: "middle" });
  });
  addText(slide, "[Catatan: Tambahkan contoh desain sertifikat atau surat; hapus catatan setelah selesai.]", { name: "doc-note", left: 98, top: 594, width: 566, height: 42, font: F.body, size: 14, color: C.muted });
  addScreenshotFrame(slide, { left: 710, top: 206, width: 506, height: 424, label: "[Masukkan Screenshot Sistem]", caption: "Preview Cetak Sertifikat & Surat Keterangan Resmi", note: "", name: "document-shot" });
  addNotes(slide, "Standarisasi otomatis menghapus kesalahan ketik nama, ketidaksesuaian nomor surat, dan penundaan pencetakan sertifikat.");
}

// 10 — Closing
{
  const slide = presentation.slides.add();
  addBase(slide, "KESIMPULAN & DAMPAK", "LEBIH EFISIEN, AKURAT, TRANSPARAN, DAN TERDOKUMENTASI", 10, { dark: true, titleSize: 43 });
  const impacts = [
    ["Efisien", "Proses administrasi lebih cepat."],
    ["Akurat", "Nilai dan status peserta terukur."],
    ["Transparan", "Progres peserta mudah dipantau."],
    ["Terdokumentasi", "Hasil, evaluasi, sertifikat, dan surat tersimpan rapi."],
  ];
  impacts.forEach((item, i) => {
    const x = 64 + i * 292;
    addText(slide, String(i + 1).padStart(2, "0"), { name: `impact-num-${i}`, left: x, top: 218, width: 48, height: 28, font: F.mono, size: 17, color: C.yellow });
    addText(slide, item[0], { name: `impact-title-${i}`, left: x, top: 268, width: 252, height: 34, font: F.bold, size: 24, color: C.white });
    addText(slide, item[1], { name: `impact-copy-${i}`, left: x, top: 330, width: 252, height: 104, font: F.body, size: 19, color: C.white, lineSpacing: 1.1 });
    if (i < 3) addShape(slide, { name: `impact-divider-${i}`, left: x + 270, top: 218, width: 1, height: 228, fill: "#5069D7" });
  });
  addShape(slide, { name: "closing-surface", left: 64, top: 492, width: 1152, height: 136, fill: C.ink, lineFill: "#5069D7", lineWidth: 1, radius: 12 });
  addText(slide, "Sistem Tes Pelatihan BDI Medan mendukung pelaksanaan pelatihan yang terstruktur, objektif, terdokumentasi, dan siap dikembangkan.", { name: "closing-copy", left: 92, top: 520, width: 1096, height: 46, font: F.bold, size: 21, color: C.white, valign: "middle" });
  addText(slide, "[Catatan: Tambahkan logo, nama narahubung, email, atau nomor kontak; hapus catatan setelah selesai.]", { name: "closing-note", left: 92, top: 584, width: 1096, height: 26, font: F.body, size: 14, color: C.line });
  addNotes(slide, "Penutup menegaskan nilai strategis digitalisasi sistem pengujian BDI Medan menuju standar mutu pelatihan industri yang modern.");
}

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
const candidatePath = path.join(stagingDir, "redesign-modern-candidate.pptx");
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
  receiptPath: path.join(stagingDir, "Redesign-Modern-Sistem-Tes-Pelatihan-BDI-Medan-v2.validation.json"),
});

console.log(JSON.stringify({ finalPath, result }, null, 2));
