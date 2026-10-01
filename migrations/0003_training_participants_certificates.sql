PRAGMA foreign_keys = OFF;

CREATE TABLE trainings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE training_materials (
  id TEXT PRIMARY KEY,
  training_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  jp INTEGER NOT NULL CHECK (jp > 0),
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (training_id, name),
  UNIQUE (training_id, sort_order),
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE training_cohorts (
  id TEXT PRIMARY KEY,
  training_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'COMPLETED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date),
  UNIQUE (training_id, name),
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE participant_profiles (
  id TEXT PRIMARY KEY,
  training_id TEXT NOT NULL,
  cohort_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  normalized_name TEXT NOT NULL CHECK (length(trim(normalized_name)) > 0),
  nik TEXT NOT NULL CHECK (length(trim(nik)) > 0),
  birth_place TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  photo_key TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (cohort_id, nik),
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE RESTRICT,
  FOREIGN KEY (cohort_id) REFERENCES training_cohorts(id) ON DELETE RESTRICT
) STRICT;

ALTER TABLE question_banks ADD COLUMN material_id TEXT REFERENCES training_materials(id) ON DELETE RESTRICT;
ALTER TABLE training_sessions ADD COLUMN training_id TEXT REFERENCES trainings(id) ON DELETE RESTRICT;
ALTER TABLE training_sessions ADD COLUMN material_id TEXT REFERENCES training_materials(id) ON DELETE RESTRICT;
ALTER TABLE batches ADD COLUMN cohort_id TEXT REFERENCES training_cohorts(id) ON DELETE RESTRICT;
ALTER TABLE participants ADD COLUMN profile_id TEXT REFERENCES participant_profiles(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX one_active_bank_per_material
  ON question_banks(material_id) WHERE is_active = 1 AND material_id IS NOT NULL;
CREATE UNIQUE INDEX one_exam_participant_per_profile
  ON participants(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX participant_profiles_lookup
  ON participant_profiles(cohort_id, normalized_name, nik, is_active);

INSERT INTO trainings (id, name, description, is_active, created_at, updated_at)
SELECT id, name, 'Data pelatihan yang dimigrasikan dari pelaksanaan tes.',
       CASE WHEN status = 'COMPLETED' THEN 0 ELSE 1 END, created_at, updated_at
FROM training_sessions;

INSERT INTO training_materials (id, training_id, name, jp, sort_order, created_at, updated_at)
SELECT banks.id, MIN(sessions.id), banks.name, 1, 1, banks.created_at, banks.updated_at
FROM question_banks banks
LEFT JOIN training_sessions sessions ON sessions.bank_id = banks.id
WHERE sessions.id IS NOT NULL
GROUP BY banks.id;

UPDATE question_banks SET material_id = id WHERE id IN (SELECT id FROM training_materials);
UPDATE training_sessions SET training_id = id, material_id = bank_id;

INSERT INTO training_cohorts (id, training_id, name, start_date, end_date, status, created_at)
SELECT batches.id, sessions.id, batches.batch_name, sessions.training_start_date,
       sessions.training_end_date,
       CASE WHEN sessions.status = 'COMPLETED' THEN 'COMPLETED' ELSE 'ACTIVE' END,
       batches.created_at
FROM batches JOIN training_sessions sessions ON sessions.id = batches.training_session_id;
UPDATE batches SET cohort_id = id;

INSERT INTO participant_profiles (
  id, training_id, cohort_id, name, normalized_name, nik, birth_place, birth_date, is_active,
  created_at, updated_at
)
SELECT participants.id, sessions.id, batches.id, participants.name, participants.normalized_name,
       'LEGACY-' || substr(participants.id, 1, 18), '', '1900-01-01', 0,
       participants.created_at, participants.updated_at
FROM participants
JOIN batches ON batches.id = participants.batch_id
JOIN training_sessions sessions ON sessions.id = batches.training_session_id;
UPDATE participants SET profile_id = id;

CREATE TABLE attempts_new (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  training_session_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('PRE', 'POST', 'REMEDIAL_1', 'REMEDIAL_2', 'REMEDIAL_3')),
  attempt_number INTEGER NOT NULL CHECK (attempt_number BETWEEN 1 AND 4),
  reset_sequence INTEGER NOT NULL DEFAULT 0 CHECK (reset_sequence >= 0),
  started_at TEXT NOT NULL,
  deadline_at TEXT NOT NULL,
  submitted_at TEXT,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'RESET')),
  score REAL CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  total_questions INTEGER CHECK (total_questions IS NULL OR total_questions > 0),
  correct_count INTEGER CHECK (correct_count IS NULL OR correct_count >= 0),
  wrong_count INTEGER CHECK (wrong_count IS NULL OR wrong_count >= 0),
  draft_answers_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(draft_answers_json)),
  draft_revision INTEGER NOT NULL DEFAULT 0 CHECK (draft_revision >= 0),
  reset_by_admin_id TEXT,
  reset_at TEXT,
  reset_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (deadline_at > started_at),
  CHECK ((status = 'SUBMITTED' AND submitted_at IS NOT NULL AND score IS NOT NULL) OR status <> 'SUBMITTED'),
  CHECK ((status = 'RESET' AND reset_by_admin_id IS NOT NULL AND reset_at IS NOT NULL) OR status <> 'RESET'),
  UNIQUE (participant_id, stage, reset_sequence),
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  FOREIGN KEY (training_session_id) REFERENCES training_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (reset_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL
) STRICT;

INSERT INTO attempts_new (
  id, participant_id, batch_id, training_session_id, stage, attempt_number, started_at, deadline_at,
  submitted_at, status, score, total_questions, correct_count, wrong_count, draft_answers_json,
  draft_revision, reset_by_admin_id, reset_at, created_at, updated_at
)
SELECT id, participant_id, batch_id, training_session_id, stage, attempt_number, started_at, deadline_at,
       submitted_at, status, score, total_questions, correct_count, wrong_count, draft_answers_json,
       draft_revision, reset_by_admin_id, reset_at, created_at, updated_at
FROM attempts;
DROP TABLE attempts;
ALTER TABLE attempts_new RENAME TO attempts;
CREATE INDEX attempts_participant_stage ON attempts(participant_id, stage, status);

CREATE TABLE certificate_settings (
  training_id TEXT PRIMARY KEY,
  certificate_prefix TEXT NOT NULL DEFAULT 'SERT/BDI',
  signer_name TEXT NOT NULL DEFAULT '',
  signer_title TEXT NOT NULL DEFAULT '',
  signer_nip TEXT NOT NULL DEFAULT '',
  logo_key TEXT,
  signature_key TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE certificates (
  id TEXT PRIMARY KEY,
  participant_profile_id TEXT NOT NULL,
  training_id TEXT NOT NULL,
  cohort_id TEXT NOT NULL,
  certificate_number TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL,
  pdf_key TEXT,
  status TEXT NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('GENERATED', 'REVOKED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (participant_profile_id, training_id, cohort_id),
  FOREIGN KEY (participant_profile_id) REFERENCES participant_profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE RESTRICT,
  FOREIGN KEY (cohort_id) REFERENCES training_cohorts(id) ON DELETE RESTRICT
) STRICT;

PRAGMA foreign_keys = ON;
