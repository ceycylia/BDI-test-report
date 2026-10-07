-- =========================================================
-- 0014_add_survey_text_fields.sql
--
-- Menambahkan teks pendukung agar Survey dapat mengikuti
-- Google Form client dengan lebih lengkap.
-- =========================================================


-- Deskripsi utama survey.
-- Contoh:
-- "Silakan isi sesuai dengan penilaian Anda sebagai
-- Peserta Pelatihan."
ALTER TABLE survey_templates
ADD COLUMN description TEXT;


-- Deskripsi setiap section.
-- Contoh:
-- "Beri penilaian pada skala 1–4."
ALTER TABLE survey_sections
ADD COLUMN description TEXT;


-- Keterangan tambahan pada pertanyaan.
--
-- Contoh:
-- "Contoh: atribut pelatihan/seragam, Alat Pelindung Diri,
-- modul, materi, ATK, bahan, konten, dan lain-lain."
ALTER TABLE survey_questions
ADD COLUMN helper_text TEXT;
