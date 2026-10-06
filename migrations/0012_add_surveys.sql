-- =========================================================
-- 0011_add_surveys.sql
--
-- Fondasi modul Evaluasi / Survey Pelatihan.
--
-- Survey berlaku per cohort / angkatan.
-- Tahun tidak disimpan secara terpisah.
-- Tahun diperoleh dari training_cohorts.created_at.
--
-- Status survey tidak disimpan sebagai kolom.
--
-- BELUM TERSEDIA:
--   campaign belum ada
--   atau opens_at NULL
--   atau opens_at > waktu sekarang
--
-- TERSEDIA:
--   opens_at <= waktu sekarang
--   dan response belum submitted
--
-- SUDAH DIISI:
--   survey_responses.submitted_at IS NOT NULL
-- =========================================================


-- =========================================================
-- 1. TEMPLATE SURVEY
-- =========================================================

CREATE TABLE survey_templates (
  id TEXT PRIMARY KEY,

  name TEXT NOT NULL
    CHECK (length(trim(name)) > 0),

  version INTEGER NOT NULL DEFAULT 1
    CHECK (version > 0),

  is_active INTEGER NOT NULL DEFAULT 1
    CHECK (is_active IN (0, 1)),

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (name, version)
) STRICT;


-- =========================================================
-- 2. SECTION SURVEY
--
-- Contoh:
-- A. Pendaftaran Pelatihan
-- B. Program Pelatihan
-- C. Instruktur
-- D. Penyelenggaraan Pelatihan
-- =========================================================

CREATE TABLE survey_sections (
  id TEXT PRIMARY KEY,

  survey_template_id TEXT NOT NULL,

  section_code TEXT NOT NULL
    CHECK (length(trim(section_code)) > 0),

  title TEXT NOT NULL
    CHECK (length(trim(title)) > 0),

  sort_order INTEGER NOT NULL
    CHECK (sort_order > 0),

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (survey_template_id, section_code),
  UNIQUE (survey_template_id, sort_order),

  FOREIGN KEY (survey_template_id)
    REFERENCES survey_templates(id)
    ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_survey_sections_template
  ON survey_sections(survey_template_id, sort_order);


-- =========================================================
-- 3. PERTANYAAN SURVEY
--
-- Tipe yang dibutuhkan questionnaire client:
--
-- SINGLE_CHOICE
-- SCALE
-- LONG_TEXT
-- =========================================================

CREATE TABLE survey_questions (
  id TEXT PRIMARY KEY,

  survey_section_id TEXT NOT NULL,

  question_text TEXT NOT NULL
    CHECK (length(trim(question_text)) > 0),

  question_type TEXT NOT NULL
    CHECK (
      question_type IN (
        'SINGLE_CHOICE',
        'SCALE',
        'LONG_TEXT'
      )
    ),

  is_required INTEGER NOT NULL DEFAULT 1
    CHECK (is_required IN (0, 1)),

  sort_order INTEGER NOT NULL
    CHECK (sort_order > 0),

  -- Hanya digunakan untuk SCALE
  scale_min INTEGER,
  scale_max INTEGER,
  scale_min_label TEXT,
  scale_max_label TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Jika tipe SCALE, min/max wajib tersedia.
  CHECK (
    question_type <> 'SCALE'
    OR (
      scale_min IS NOT NULL
      AND scale_max IS NOT NULL
      AND scale_max > scale_min
    )
  ),

  -- Selain SCALE tidak boleh mempunyai min/max.
  CHECK (
    question_type = 'SCALE'
    OR (
      scale_min IS NULL
      AND scale_max IS NULL
      AND scale_min_label IS NULL
      AND scale_max_label IS NULL
    )
  ),

  UNIQUE (survey_section_id, sort_order),

  FOREIGN KEY (survey_section_id)
    REFERENCES survey_sections(id)
    ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_survey_questions_section
  ON survey_questions(survey_section_id, sort_order);


-- =========================================================
-- 4. PILIHAN JAWABAN
--
-- Digunakan untuk SINGLE_CHOICE.
--
-- allows_other_text = 1
-- digunakan pada pilihan "Yang lain".
-- =========================================================

CREATE TABLE survey_question_options (
  id TEXT PRIMARY KEY,

  survey_question_id TEXT NOT NULL,

  option_value TEXT NOT NULL
    CHECK (length(trim(option_value)) > 0),

  option_label TEXT NOT NULL
    CHECK (length(trim(option_label)) > 0),

  allows_other_text INTEGER NOT NULL DEFAULT 0
    CHECK (allows_other_text IN (0, 1)),

  sort_order INTEGER NOT NULL
    CHECK (sort_order > 0),

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (survey_question_id, option_value),
  UNIQUE (survey_question_id, sort_order),

  FOREIGN KEY (survey_question_id)
    REFERENCES survey_questions(id)
    ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_survey_question_options_question
  ON survey_question_options(
    survey_question_id,
    sort_order
  );


-- =========================================================
-- 5. PELAKSANAAN SURVEY / CAMPAIGN
--
-- Satu cohort hanya mempunyai satu Survey Evaluasi.
--
-- Tidak menyimpan:
-- - training_id
-- - tahun
--
-- Keduanya bisa diperoleh melalui training_cohorts.
--
-- opens_at NULL
-- = belum tersedia / belum dijadwalkan
--
-- opens_at masa depan
-- = sudah dijadwalkan tetapi belum tersedia
--
-- opens_at <= sekarang
-- = tersedia
--
-- opened_manually_at diisi jika admin menekan
-- tombol "Buka Sekarang".
-- =========================================================

CREATE TABLE survey_campaigns (
  id TEXT PRIMARY KEY,

  survey_template_id TEXT NOT NULL,
  cohort_id TEXT NOT NULL,

  opens_at TEXT,
  opened_manually_at TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Satu survey evaluasi per cohort.
  UNIQUE (cohort_id),

  FOREIGN KEY (survey_template_id)
    REFERENCES survey_templates(id)
    ON DELETE RESTRICT,

  FOREIGN KEY (cohort_id)
    REFERENCES training_cohorts(id)
    ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_survey_campaigns_template
  ON survey_campaigns(survey_template_id);

CREATE INDEX idx_survey_campaigns_opens
  ON survey_campaigns(opens_at);


-- =========================================================
-- 6. RESPONSE PESERTA
--
-- Survey terikat ke participant_profiles,
-- bukan participants.
--
-- participant_profiles merupakan identitas peserta
-- pada Pelatihan + Angkatan.
--
-- Satu peserta hanya memiliki satu response
-- pada satu campaign.
-- =========================================================

CREATE TABLE survey_responses (
  id TEXT PRIMARY KEY,

  survey_campaign_id TEXT NOT NULL,
  participant_profile_id TEXT NOT NULL,

  started_at TEXT,
  submitted_at TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (
    survey_campaign_id,
    participant_profile_id
  ),

  FOREIGN KEY (survey_campaign_id)
    REFERENCES survey_campaigns(id)
    ON DELETE RESTRICT,

  FOREIGN KEY (participant_profile_id)
    REFERENCES participant_profiles(id)
    ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_survey_responses_campaign
  ON survey_responses(
    survey_campaign_id,
    submitted_at
  );

CREATE INDEX idx_survey_responses_participant
  ON survey_responses(participant_profile_id);


-- =========================================================
-- 7. JAWABAN PESERTA
--
-- SINGLE_CHOICE:
--   option_id
--   other_text jika memilih "Yang lain"
--
-- SCALE:
--   numeric_value
--
-- LONG_TEXT:
--   text_value
--
-- Validasi bahwa jawaban sesuai tipe pertanyaan
-- nantinya dilakukan juga di backend.
-- =========================================================

CREATE TABLE survey_answers (
  id TEXT PRIMARY KEY,

  survey_response_id TEXT NOT NULL,
  survey_question_id TEXT NOT NULL,

  option_id TEXT,
  other_text TEXT,

  numeric_value INTEGER,

  text_value TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Minimal harus mempunyai satu bentuk jawaban.
  CHECK (
    option_id IS NOT NULL
    OR numeric_value IS NOT NULL
    OR text_value IS NOT NULL
  ),

  UNIQUE (
    survey_response_id,
    survey_question_id
  ),

  FOREIGN KEY (survey_response_id)
    REFERENCES survey_responses(id)
    ON DELETE CASCADE,

  FOREIGN KEY (survey_question_id)
    REFERENCES survey_questions(id)
    ON DELETE RESTRICT,

  FOREIGN KEY (option_id)
    REFERENCES survey_question_options(id)
    ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_survey_answers_response
  ON survey_answers(survey_response_id);

CREATE INDEX idx_survey_answers_question
  ON survey_answers(
    survey_question_id,
    numeric_value
  );