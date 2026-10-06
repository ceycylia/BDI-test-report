-- =========================================================
-- 0014_seed_training_evaluation_survey.sql
--
-- Template awal:
-- Evaluasi Penyelenggaraan Pelatihan Vokasi
--
-- Sumber: Google Form client.
--
-- Catatan:
-- - Pertanyaan "Pilih angkatan" TIDAK dimasukkan.
-- - Angkatan diperoleh dari participant_profiles.cohort_id.
-- - Template awal langsung PUBLISHED.
-- - Perubahan berikutnya dilakukan melalui versioning/template
--   management pada Admin, bukan mengubah migration ini.
--
-- Total:
-- 1 template
-- 4 section
-- 21 pertanyaan
-- 10 pilihan jawaban
-- =========================================================


-- =========================================================
-- 1. TEMPLATE
-- =========================================================

INSERT INTO survey_templates (
  id,
  name,
  version,
  is_active,
  description,
  status,
  published_at,
  source_template_id
)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Evaluasi Penyelenggaraan Pelatihan Vokasi',
  1,
  1,
  'Silakan isi sesuai dengan penilaian Anda sebagai Peserta Pelatihan.',
  'PUBLISHED',
  CURRENT_TIMESTAMP,
  NULL
);


-- =========================================================
-- 2. SECTIONS
-- =========================================================

INSERT INTO survey_sections (
  id,
  survey_template_id,
  section_code,
  title,
  sort_order,
  description
)
VALUES
(
  'a1000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'A',
  'PENDAFTARAN PELATIHAN',
  1,
  'Pilih jawaban yang paling tepat, kemudian beri nilai pada skala 1–4.'
),
(
  'a1000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000001',
  'B',
  'PROGRAM PELATIHAN',
  2,
  'Beri penilaian pada skala 1–4.'
),
(
  'a1000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000001',
  'C',
  'INSTRUKTUR',
  3,
  'Beri penilaian pada skala 1–4.'
),
(
  'a1000000-0000-4000-8000-000000000004',
  'a0000000-0000-4000-8000-000000000001',
  'D',
  'PENYELENGGARAAN PELATIHAN',
  4,
  'Beri penilaian pada skala 1–4.'
);


-- =========================================================
-- SECTION A
-- PENDAFTARAN PELATIHAN
-- =========================================================


-- A1
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order
)
VALUES (
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'Dari mana Anda mendapatkan informasi tentang pelatihan ini?',
  'SINGLE_CHOICE',
  1,
  1
);


INSERT INTO survey_question_options (
  id,
  survey_question_id,
  option_value,
  option_label,
  allows_other_text,
  sort_order
)
VALUES
(
  'a3000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'NEWSPAPER_BROCHURE',
  'Iklan di koran/majalah atau brosur',
  0,
  1
),
(
  'a3000000-0000-4000-8000-000000000002',
  'a2000000-0000-4000-8000-000000000001',
  'BILLBOARD',
  'Billboard/spanduk',
  0,
  2
),
(
  'a3000000-0000-4000-8000-000000000003',
  'a2000000-0000-4000-8000-000000000001',
  'INTERNET_ONLINE_EMAIL',
  'Internet/iklan online/surat elektronik',
  0,
  3
),
(
  'a3000000-0000-4000-8000-000000000004',
  'a2000000-0000-4000-8000-000000000001',
  'GOVERNMENT_AGENCY',
  'Dinas tenaga kerja/Instansi lainnya',
  0,
  4
),
(
  'a3000000-0000-4000-8000-000000000005',
  'a2000000-0000-4000-8000-000000000001',
  'TRAINING_INSTITUTION',
  'Lembaga pelatihan',
  0,
  5
),
(
  'a3000000-0000-4000-8000-000000000006',
  'a2000000-0000-4000-8000-000000000001',
  'RELATION',
  'Relasi (misalnya instruktur, orang tua, saudara, teman, dan lain-lain)',
  0,
  6
),
(
  'a3000000-0000-4000-8000-000000000007',
  'a2000000-0000-4000-8000-000000000001',
  'SIAPKERJA',
  'Aplikasi SIAPKerja',
  0,
  7
),
(
  'a3000000-0000-4000-8000-000000000008',
  'a2000000-0000-4000-8000-000000000001',
  'KEMNAKER_OFFICIAL',
  'Situs resmi KEMNAKER',
  0,
  8
),
(
  'a3000000-0000-4000-8000-000000000009',
  'a2000000-0000-4000-8000-000000000001',
  'TRAINING_OFFICIAL_SITE',
  'Situs resmi lembaga pelatihan',
  0,
  9
),
(
  'a3000000-0000-4000-8000-000000000010',
  'a2000000-0000-4000-8000-000000000001',
  'OTHER',
  'Yang lain',
  1,
  10
);


-- A2
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label
)
VALUES (
  'a2000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000001',
  'Apakah informasi pelatihan mudah untuk didapatkan?',
  'SCALE',
  1,
  2,
  1,
  4,
  'Sangat sulit',
  'Sangat mudah'
);


-- A3
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label
)
VALUES (
  'a2000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000001',
  'Apakah pendaftaran dan tahapannya mudah untuk dilakukan?',
  'SCALE',
  1,
  3,
  1,
  4,
  'Sangat sulit',
  'Sangat mudah'
);


-- A4
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label
)
VALUES (
  'a2000000-0000-4000-8000-000000000004',
  'a1000000-0000-4000-8000-000000000001',
  'Apakah petunjuk tata cara pendaftaran jelas dan mudah dipahami?',
  'SCALE',
  1,
  4,
  1,
  4,
  'Sangat kurang jelas dan sulit dipahami',
  'Sangat jelas dan mudah dipahami'
);


-- =========================================================
-- SECTION B
-- PROGRAM PELATIHAN
-- =========================================================


-- B1
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label
)
VALUES (
  'a2000000-0000-4000-8000-000000000005',
  'a1000000-0000-4000-8000-000000000002',
  'Apakah program pelatihan jelas dan mudah dipahami?',
  'SCALE',
  1,
  1,
  1,
  4,
  'Sangat kurang jelas dan sulit dipahami',
  'Sangat jelas dan mudah dipahami'
);


-- B2
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label
)
VALUES (
  'a2000000-0000-4000-8000-000000000006',
  'a1000000-0000-4000-8000-000000000002',
  'Apakah program pelatihan menarik?',
  'SCALE',
  1,
  2,
  1,
  4,
  'Sangat kurang menarik',
  'Sangat menarik'
);


-- B3
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label
)
VALUES (
  'a2000000-0000-4000-8000-000000000007',
  'a1000000-0000-4000-8000-000000000002',
  'Apakah program pelatihan bermanfaat?',
  'SCALE',
  1,
  3,
  1,
  4,
  'Sangat kurang bermanfaat',
  'Sangat bermanfaat'
);


-- B4
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label
)
VALUES (
  'a2000000-0000-4000-8000-000000000008',
  'a1000000-0000-4000-8000-000000000002',
  'Apakah program pelatihan berhasil meningkatkan kompetensi Anda?',
  'SCALE',
  1,
  4,
  1,
  4,
  'Sangat kurang berhasil',
  'Sangat berhasil'
);


-- B5
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label
)
VALUES (
  'a2000000-0000-4000-8000-000000000009',
  'a1000000-0000-4000-8000-000000000002',
  'Apakah durasi untuk menyelesaikan pelatihan sudah sesuai?',
  'SCALE',
  1,
  5,
  1,
  4,
  'Sangat tidak sesuai',
  'Sangat sesuai'
);


-- B6
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order
)
VALUES (
  'a2000000-0000-4000-8000-000000000010',
  'a1000000-0000-4000-8000-000000000002',
  'Komentar dan saran Anda terhadap program pelatihan',
  'LONG_TEXT',
  1,
  6
);


-- =========================================================
-- SECTION C
-- INSTRUKTUR
-- =========================================================


-- C1
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label
)
VALUES (
  'a2000000-0000-4000-8000-000000000011',
  'a1000000-0000-4000-8000-000000000003',
  'Apakah instruktur menguasai program pelatihan yang disampaikan?',
  'SCALE',
  1,
  1,
  1,
  4,
  'Sangat kurang menguasai',
  'Sangat menguasai'
);


-- C2
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label
)
VALUES (
  'a2000000-0000-4000-8000-000000000012',
  'a1000000-0000-4000-8000-000000000003',
  'Bagaimana kemampuan instruktur dalam menyampaikan program pelatihan?',
  'SCALE',
  1,
  2,
  1,
  4,
  'Sangat kurang baik',
  'Sangat baik'
);


-- C3
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label
)
VALUES (
  'a2000000-0000-4000-8000-000000000013',
  'a1000000-0000-4000-8000-000000000003',
  'Bagaimana kemampuan instruktur dalam mengelola Peserta Pelatihan?',
  'SCALE',
  1,
  3,
  1,
  4,
  'Sangat kurang baik',
  'Sangat baik'
);


-- C4
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label
)
VALUES (
  'a2000000-0000-4000-8000-000000000014',
  'a1000000-0000-4000-8000-000000000003',
  'Bagaimana sikap, disiplin, penampilan, dan keteladanan instruktur selama pelatihan?',
  'SCALE',
  1,
  4,
  1,
  4,
  'Sangat kurang baik',
  'Sangat baik'
);


-- C5
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order
)
VALUES (
  'a2000000-0000-4000-8000-000000000015',
  'a1000000-0000-4000-8000-000000000003',
  'Komentar dan saran Anda terhadap instruktur',
  'LONG_TEXT',
  1,
  5
);


-- =========================================================
-- SECTION D
-- PENYELENGGARAAN PELATIHAN
-- =========================================================


-- D1
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label
)
VALUES (
  'a2000000-0000-4000-8000-000000000016',
  'a1000000-0000-4000-8000-000000000004',
  'Bagaimana pelayanan petugas terhadap Peserta Pelatihan?',
  'SCALE',
  1,
  1,
  1,
  4,
  'Sangat kurang baik',
  'Sangat baik'
);


-- D2
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label
)
VALUES (
  'a2000000-0000-4000-8000-000000000017',
  'a1000000-0000-4000-8000-000000000004',
  'Apakah pelaksanaan jadwal pelatihan sudah sesuai dengan rencana?',
  'SCALE',
  1,
  2,
  1,
  4,
  'Sangat kurang sesuai',
  'Sangat sesuai'
);


-- D3
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label,
  helper_text
)
VALUES (
  'a2000000-0000-4000-8000-000000000018',
  'a1000000-0000-4000-8000-000000000004',
  'Apakah perlengkapan Peserta Pelatihan (training material) diberikan tepat waktu?',
  'SCALE',
  1,
  3,
  1,
  4,
  'Sangat tidak tepat',
  'Sangat tepat',
  'Contoh: atribut pelatihan/seragam, Alat Pelindung Diri, modul, materi, ATK, bahan, konten, dan lain-lain.'
);


-- D4
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label,
  helper_text
)
VALUES (
  'a2000000-0000-4000-8000-000000000019',
  'a1000000-0000-4000-8000-000000000004',
  'Apakah sarana/prasarana/fasilitas pelatihan sudah memadai?',
  'SCALE',
  1,
  4,
  1,
  4,
  'Sangat kurang memadai',
  'Sangat memadai',
  'Contoh: kelas, workshop, mesin, alat, website sistem manajemen pembelajaran, dan lain-lain.'
);


-- D5
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order,
  scale_min,
  scale_max,
  scale_min_label,
  scale_max_label,
  helper_text
)
VALUES (
  'a2000000-0000-4000-8000-000000000020',
  'a1000000-0000-4000-8000-000000000004',
  'Apakah sarana/prasarana/fasilitas penunjang pelatihan sudah memadai?',
  'SCALE',
  1,
  5,
  1,
  4,
  'Sangat kurang memadai',
  'Sangat memadai',
  'Contoh: asrama, tempat ibadah, kantin, toilet, perpustakaan, website lembaga pelatihan, dan lain-lain.'
);


-- D6
INSERT INTO survey_questions (
  id,
  survey_section_id,
  question_text,
  question_type,
  is_required,
  sort_order
)
VALUES (
  'a2000000-0000-4000-8000-000000000021',
  'a1000000-0000-4000-8000-000000000004',
  'Komentar dan saran Anda terhadap penyelenggaraan pelatihan',
  'LONG_TEXT',
  1,
  6
);