-- =========================================================
-- 0015_fix_survey_question_text.sql
--
-- Memperbaiki spasi pada beberapa pertanyaan template
-- Evaluasi Penyelenggaraan Pelatihan Vokasi V1.
-- =========================================================


-- B5
UPDATE survey_questions
SET
  question_text = 'Apakah durasi untuk menyelesaikan pelatihan sudah sesuai?',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'a2000000-0000-4000-8000-000000000009';


-- C2
UPDATE survey_questions
SET
  question_text = 'Bagaimana kemampuan instruktur dalam menyampaikan program pelatihan?',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'a2000000-0000-4000-8000-000000000012';


-- C3
UPDATE survey_questions
SET
  question_text = 'Bagaimana kemampuan instruktur dalam mengelola Peserta Pelatihan?',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'a2000000-0000-4000-8000-000000000013';


-- D1
UPDATE survey_questions
SET
  question_text = 'Bagaimana pelayanan petugas terhadap Peserta Pelatihan?',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'a2000000-0000-4000-8000-000000000016';


-- D3
UPDATE survey_questions
SET
  question_text = 'Apakah perlengkapan Peserta Pelatihan (training material) diberikan tepat waktu?',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'a2000000-0000-4000-8000-000000000018';