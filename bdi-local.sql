-- Reordered D1/SQLite dump generated from the original bdi-local.sql.;

-- Schema and data are preserved; only statement order was changed.;

PRAGMA foreign_keys=OFF;

PRAGMA defer_foreign_keys=TRUE;

CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL CHECK (password_iterations > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, role TEXT NOT NULL DEFAULT 'ADMIN'
CHECK (role IN ('SUPERADMIN', 'ADMIN')),
  UNIQUE (username)
) STRICT;

CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE trainings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1))) STRICT;

CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) STRICT;

CREATE TABLE certificate_settings (
  training_id TEXT PRIMARY KEY,
  certificate_prefix TEXT NOT NULL DEFAULT 'SERT/BDI',
  signer_name TEXT NOT NULL DEFAULT '',
  signer_title TEXT NOT NULL DEFAULT '',
  signer_nip TEXT NOT NULL DEFAULT '',
  logo_key TEXT,
  signature_key TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, issue_place TEXT NOT NULL DEFAULT '', offset_x_mm REAL NOT NULL DEFAULT 0, offset_y_mm REAL NOT NULL DEFAULT 0, front_template_key TEXT, back_template_key TEXT, stamp_key TEXT, issue_date TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE
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

CREATE TABLE question_banks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, material_id TEXT REFERENCES training_materials(id) ON DELETE RESTRICT) STRICT;

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
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, back_pdf_key TEXT,
  UNIQUE (participant_profile_id, training_id, cohort_id),
  FOREIGN KEY (participant_profile_id) REFERENCES participant_profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE RESTRICT,
  FOREIGN KEY (cohort_id) REFERENCES training_cohorts(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  bank_id TEXT NOT NULL,
  question_text TEXT NOT NULL CHECK (length(trim(question_text)) > 0),
  image_key TEXT,
  option_a TEXT NOT NULL CHECK (length(trim(option_a)) > 0),
  option_b TEXT NOT NULL CHECK (length(trim(option_b)) > 0),
  option_c TEXT NOT NULL CHECK (length(trim(option_c)) > 0),
  option_d TEXT NOT NULL CHECK (length(trim(option_d)) > 0),
  correct_option_key TEXT NOT NULL CHECK (correct_option_key IN ('A', 'B', 'C', 'D')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  times_assigned INTEGER NOT NULL DEFAULT 0 CHECK (times_assigned >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE training_sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL COLLATE NOCASE,
  bank_id TEXT NOT NULL,
  question_count INTEGER NOT NULL CHECK (question_count > 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  passing_score REAL NOT NULL CHECK (passing_score >= 0 AND passing_score <= 100),
  training_start_date TEXT NOT NULL,
  training_end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED')),
  pre_mode TEXT NOT NULL DEFAULT 'MANUAL' CHECK (pre_mode IN ('MANUAL', 'SCHEDULED')),
  pre_start_at TEXT,
  pre_end_at TEXT,
  pre_manual_open INTEGER NOT NULL DEFAULT 0 CHECK (pre_manual_open IN (0, 1)),
  post_mode TEXT NOT NULL DEFAULT 'MANUAL' CHECK (post_mode IN ('MANUAL', 'SCHEDULED')),
  post_start_at TEXT,
  post_end_at TEXT,
  post_manual_open INTEGER NOT NULL DEFAULT 0 CHECK (post_manual_open IN (0, 1)),
  activated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, training_id TEXT REFERENCES trainings(id) ON DELETE RESTRICT, material_id TEXT REFERENCES training_materials(id) ON DELETE RESTRICT,
  CHECK (training_end_date >= training_start_date),
  CHECK (
    pre_mode = 'MANUAL'
    OR (pre_start_at IS NOT NULL AND pre_end_at IS NOT NULL AND pre_end_at > pre_start_at)
  ),
  CHECK (
    post_mode = 'MANUAL'
    OR (post_start_at IS NOT NULL AND post_end_at IS NOT NULL AND post_end_at > post_start_at)
  ),
  UNIQUE (slug),
  FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE batches (
  id TEXT PRIMARY KEY,
  training_session_id TEXT NOT NULL,
  batch_number INTEGER NOT NULL CHECK (batch_number > 0),
  batch_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, cohort_id TEXT REFERENCES training_cohorts(id) ON DELETE RESTRICT,
  UNIQUE (training_session_id, batch_number),
  UNIQUE (training_session_id, batch_name),
  FOREIGN KEY (training_session_id) REFERENCES training_sessions(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE batch_layouts (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('PRE', 'POST', 'REMEDIAL_1', 'REMEDIAL_2', 'REMEDIAL_3')),
  question_order_json TEXT NOT NULL CHECK (json_valid(question_order_json)),
  option_orders_json TEXT NOT NULL CHECK (json_valid(option_orders_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (batch_id, stage),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE batch_questions (
  batch_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (batch_id, question_id),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS "participants" (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  normalized_name TEXT NOT NULL CHECK (length(trim(normalized_name)) > 0),
  profile_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (profile_id, batch_id),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES participant_profiles(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS "attempts" (
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

CREATE TABLE attempt_answers (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_original_option_key TEXT NOT NULL CHECK (
    selected_original_option_key IN ('A', 'B', 'C', 'D')
  ),
  correct_original_option_key TEXT NOT NULL CHECK (
    correct_original_option_key IN ('A', 'B', 'C', 'D')
  ),
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (attempt_id, question_id),
  FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE attempt_question_snapshots (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  question_text TEXT NOT NULL,
  image_key TEXT,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option_key TEXT NOT NULL CHECK (correct_option_key IN ('A', 'B', 'C', 'D')),
  display_position INTEGER NOT NULL CHECK (display_position > 0),
  display_option_order_json TEXT NOT NULL CHECK (json_valid(display_option_order_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (attempt_id, question_id),
  UNIQUE (attempt_id, display_position),
  FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT
) STRICT;

INSERT INTO "admins" ("id","name","username","password_hash","password_salt","password_iterations","is_active","created_at","updated_at","role") VALUES('5114ac1f-82c7-44b5-8b41-7c821f1056b1','admin','admin','eg1GH2x2VzvEiwmnj-xtiIGRWdGCMdD1OOAzZMDwpXw','6NMp3BRJfkrZXjS8uUgAfA',100000,1,'2026-10-01 11:26:09','2026-10-01 11:26:09','SUPERADMIN');

INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_initial.sql','2026-10-01 11:25:13');

INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'0002_admin_roles.sql','2026-10-01 11:25:14');

INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'0003_training_participants_certificates.sql','2026-10-01 11:25:15');

INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(4,'0004_participant_exam_identity.sql','2026-10-01 11:25:16');

INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(5,'0005_soft_delete_trainings.sql','2026-10-01 11:25:17');

INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(6,'0006_certificate_print_overlay.sql','2026-10-01 11:25:18');

INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(7,'0007_certificate_stamp_asset.sql','2026-10-01 11:25:19');

INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(8,'0008_certificate_issue_date.sql','2026-10-01 11:25:20');

INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(9,'0009_remove_training_description.sql','2026-10-01 11:44:12');

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('118efb5d-dffb-4d1f-9f4f-71f26c226a65','pelatihan 1',0,'2026-10-01 11:45:48','2026-10-01 11:46:04',1);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('7c50adc1-de75-4cc8-a857-dd79a6636155','pelatihan 1',0,'2026-10-01 11:45:51','2026-10-01 11:46:01',1);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('a136fba7-d2df-41b6-9f3c-a64a353af4a6','Politeknik Linux Community',0,'2026-10-01 11:47:12','2026-10-01 11:51:47',1);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('50e4a22c-0c0d-4918-b492-6de986f96918','pelatihan 1',0,'2026-10-01 11:51:56','2026-10-02 01:32:06',1);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','pelatihan 2',0,'2026-10-01 12:15:32','2026-10-02 01:32:04',1);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('b4d660c1-6d1d-4eff-8150-7334074c3628','Operator Backhoe Loader',1,'2026-10-02 01:32:51','2026-10-02 01:32:51',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('e7824acf-da25-4b8a-9244-8268e51c3d20','Pengoperasian Mesin Peralatan Boiler Kelapa Sawit',1,'2026-10-02 01:36:04','2026-10-02 01:36:04',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('4a6edf40-b67f-425f-92ba-51cf9bfe60f8','Pengoperasian Mesin Peralatan Clarification Kelapa Sawit',1,'2026-10-02 01:39:28','2026-10-02 01:39:28',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('cdfd39d6-5e4a-4aa3-bc88-88c95e5fdf42','Operator Dump Truck',1,'2026-10-02 01:44:23','2026-10-02 01:44:23',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('f6f9868f-27df-4892-bafc-638f8938a815','Pengoperasian Mesin Peralatan Effluent Treatment Plant Kelapa Sawit',1,'2026-10-02 01:48:28','2026-10-02 01:48:28',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('7a6808cc-532d-4723-a63c-1ec1ae2a56c1','Pengoperasian Mesin Peralatan Kernel Recovery Kelapa Sawit',1,'2026-10-02 01:50:35','2026-10-02 01:50:35',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('80585f2c-ae38-4af7-aa1a-18472545161d','Pengoperasian Mesin Peralatan Loading Ramp Kelapa Sawit',1,'2026-10-02 01:53:39','2026-10-02 01:53:39',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('709a8f9a-563a-4464-9532-5388e06aef3e','Pengoperasian Mesin Peralatan Lorry Filling Kelapa Sawit',1,'2026-10-02 03:30:52','2026-10-02 03:30:52',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('a422891b-cfad-4ba1-9ff3-157251e7f5c9','Pengoperasian Mesin Peralatan Lorry Filling Kelapa Sawit',0,'2026-10-02 03:31:09','2026-10-02 03:31:54',1);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('b03857eb-c749-475a-9dbe-07947ec9e31a','PEMROSESAN MAKANAN KERING DI INDUSTRI',1,'2026-10-02 03:38:35','2026-10-02 03:38:35',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('d650778a-2b01-48f4-8328-b8754055affd','Penimbangan Barang Kelapa Sawit',1,'2026-10-02 03:42:46','2026-10-02 03:42:46',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('eca6e4d4-e64f-4110-bb85-224a1d4ca8a1','Perencanaan Pengendalian Produksi Pabrik Minyak Kelapa Sawit',1,'2026-10-02 03:46:03','2026-10-02 03:46:03',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('de409591-9311-4bf9-ab55-f0ceee35689b','Plate Welding',1,'2026-10-02 03:47:41','2026-10-02 03:47:41',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('631f1b7e-caab-48c7-8dae-7c922cfe2e51','Penanggung Jawab Operasional Pengolahan Air Limbah',1,'2026-10-02 03:50:54','2026-10-02 03:50:54',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('4dd4b810-ecbf-4170-b2d9-9ef32bab8bec','Penanggung Jawab Operasional Instalasi Pengendalian Pencemaran Udara',1,'2026-10-02 03:55:49','2026-10-02 03:55:49',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('e2aed2c8-c8f8-4e97-8350-f17dcf79e438','Pengoperasian Mesin Peralatan Power Plant Kelapa Sawit',1,'2026-10-02 04:06:52','2026-10-02 04:06:52',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('87e8d887-e626-42c0-80e9-263c452f132d','Penanggung Jawab Pengendalian Pencemaran Air',1,'2026-10-02 04:12:36','2026-10-02 04:12:36',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('e94f11be-229c-4f19-9be5-3e701445f9fe','Penanggung Jawab Pengendalian Pencemaran Udara',1,'2026-10-02 04:15:44','2026-10-02 04:15:44',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('d3b67877-86c0-49b4-adc7-b3af86891524','Pengoperasian Mesin Peralatan Press Kelapa Sawit',1,'2026-10-02 04:18:53','2026-10-02 04:18:53',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('ac60027f-d544-4547-a984-440a298054b6','Pengoperasian Mesin Peralatan Sterilizer Kelapa Sawit',1,'2026-10-02 04:23:01','2026-10-02 04:23:01',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('a768abbb-72ac-4dc9-8da5-b3de375485bd','Pengoperasian Mesin Peralatan Tippler Kelapa Sawit',1,'2026-10-02 04:24:51','2026-10-02 04:24:51',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('76df0953-c211-4223-8742-0de0bd78757d','Pengoperasian Mesin Peralatan Transfer Carriage Kelapa Sawit',1,'2026-10-02 04:27:37','2026-10-02 04:27:37',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('105f060e-5a6a-4433-9a52-1fb36726d795','Welding Inspector Basic',1,'2026-10-02 04:30:49','2026-10-02 04:30:49',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('a8db6ba7-0559-4b8f-be49-64ba36179bd4','Pengoperasian Mesin Peralatan Water Treatment Plant Kelapa Sawit',1,'2026-10-02 06:34:53','2026-10-02 06:34:53',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('83978a8c-d1e0-4c7e-9d10-240d325b76e3','Pembuatan Minuman Berbahan Dasar Kopi',1,'2026-10-02 06:38:19','2026-10-02 06:38:19',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('6e0075b4-587c-493e-97bc-b8b77c86874f','Pengambilan Sampel Uji Laboratorium',1,'2026-10-02 06:52:34','2026-10-02 06:52:34',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('ac7912f9-b145-4eae-982b-de18085e2dc2','Pengoperasian Boiler',1,'2026-10-02 06:55:19','2026-10-02 06:55:19',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('e7810825-64c7-4073-ae60-79fd4ea2259c','Pengoperasian Forklift',1,'2026-10-02 07:03:28','2026-10-02 07:03:28',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('6c4f161e-45f9-4723-a814-50d8757b3282','Pengoperasian Mesin Produksi Industri Pangan',1,'2026-10-02 07:06:06','2026-10-02 07:06:06',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('ebb6a535-6775-4494-a1ad-1f611a4b3bc0','Pengoperasian Proses Basah Industri Crumb Rubber',1,'2026-10-02 07:08:18','2026-10-02 07:08:18',0);

INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('912a3c82-030a-498a-94e7-1a1844b346bd','Pengoperasian Proses Kering Industri Crumb Rubber',1,'2026-10-02 07:12:04','2026-10-02 07:12:04',0);

INSERT INTO "admin_sessions" ("id","admin_id","token_hash","csrf_token_hash","expires_at","last_seen_at","created_at") VALUES('6fe03e4d-4931-4537-a1ab-534ca144acdf','5114ac1f-82c7-44b5-8b41-7c821f1056b1','1Xh7xyKkhidOsIkXvOvkL3c4RDW4--OUEQsUDtsPZe0','wBpB5r4Ww-za_b4N3dQidnRCRFXSIeJl1Fpd5d-w40k','2026-10-01T19:27:49.318Z','2026-10-01 12:38:33','2026-10-01 11:27:49');

INSERT INTO "admin_sessions" ("id","admin_id","token_hash","csrf_token_hash","expires_at","last_seen_at","created_at") VALUES('5a29eb80-2fe7-4d42-9c39-fdf9d590caeb','5114ac1f-82c7-44b5-8b41-7c821f1056b1','DOLzgxHNnp92TLExwaE59_ifyzbqRQvEtB9Che8VYaM','mwJUsf4btyM7XTBixXcSPvW-oal7IjgK6m_CBGcDYEI','2026-10-02T06:58:26.058Z','2026-10-02 06:56:13','2026-10-01 22:58:26');

INSERT INTO "admin_sessions" ("id","admin_id","token_hash","csrf_token_hash","expires_at","last_seen_at","created_at") VALUES('3de4695f-46db-4b77-8f95-49fa624bde29','5114ac1f-82c7-44b5-8b41-7c821f1056b1','j6NfZIiqgHG0e2SiSiMbcRxF86ib8LukGJJQFz3Ochg','7ujNuvFI2Ysl2bPc6Y1ernnNEo4NwLOoOaOyIDyrOKs','2026-10-02T15:03:15.553Z','2026-10-02 07:58:09','2026-10-02 07:03:15');

INSERT INTO "admin_sessions" ("id","admin_id","token_hash","csrf_token_hash","expires_at","last_seen_at","created_at") VALUES('e319f290-40e7-443e-81ff-3ab8760b364f','5114ac1f-82c7-44b5-8b41-7c821f1056b1','t10v5rKxyJPY8SP3KM6y0_IK2rrzCArzaegifjvtKbQ','zQVQoiGE2VnzNyC1BPXVyI_y0fNNhkbySRQ0v2DUzvc','2026-10-05T10:13:08.312Z','2026-10-05 06:32:54','2026-10-05 02:13:08');

INSERT INTO "training_cohorts" ("id","training_id","name","start_date","end_date","status","created_at","updated_at") VALUES('8a4616fe-c244-4db5-bb99-b51507363187','50e4a22c-0c0d-4918-b492-6de986f96918','Angkatan 1','2026-10-01','2026-10-07','ACTIVE','2026-10-01 12:26:40','2026-10-01 12:26:40');

INSERT INTO "training_cohorts" ("id","training_id","name","start_date","end_date","status","created_at","updated_at") VALUES('748cd294-ab93-46d2-a8fe-3502d3f4e893','50e4a22c-0c0d-4918-b492-6de986f96918','Angkatan 2','2026-10-01','2026-10-07','ACTIVE','2026-10-01 12:26:40','2026-10-01 12:26:40');

INSERT INTO "training_cohorts" ("id","training_id","name","start_date","end_date","status","created_at","updated_at") VALUES('efe7ebe5-7bad-4673-bce5-04082d394fc7','b4d660c1-6d1d-4eff-8150-7334074c3628','Angkatan 1','2026-10-02','2026-10-08','ACTIVE','2026-10-02 07:30:42','2026-10-02 07:30:42');

INSERT INTO "training_cohorts" ("id","training_id","name","start_date","end_date","status","created_at","updated_at") VALUES('00db3c38-5269-4312-b479-5935c9565136','b4d660c1-6d1d-4eff-8150-7334074c3628','Angkatan 2','2026-10-09','2026-10-15','ACTIVE','2026-10-02 07:30:42','2026-10-02 07:30:42');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('5eefcd9c-3ff0-4e1b-bfcb-7fff8048e477','50e4a22c-0c0d-4918-b492-6de986f96918','Mengikuti Prosedur Kerja Menjaga Praktik Pengolahan yang Baik (GMP)',2,3,'2026-10-01 12:14:39','2026-10-01 12:14:39');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('398d281e-fb74-4a13-9a6b-41f77d3cfc7c','50e4a22c-0c0d-4918-b492-6de986f96918','Menerapkan Program dan Prosedur Keamanan Pangan',1,4,'2026-10-01 12:14:39','2026-10-01 12:14:39');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('73a96e1a-e4b5-4a48-84a2-b4237dd5b1d6','50e4a22c-0c0d-4918-b492-6de986f96918','Mengoperasikan Alat Timbang',5,5,'2026-10-01 12:14:39','2026-10-01 12:14:39');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('33c71b45-9512-47ce-bdea-fc8c9b9d82fc','50e4a22c-0c0d-4918-b492-6de986f96918','Mengoperasikan Mesin Pengaduk (Mixer)',7,6,'2026-10-01 12:14:39','2026-10-01 12:14:39');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('74545f30-adad-48ad-bfd4-cd97cde796f1','50e4a22c-0c0d-4918-b492-6de986f96918','Mengoperasikan Mesin Pencetak Adonan (Molder)',6,7,'2026-10-01 12:14:39','2026-10-01 12:14:39');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('6817f7b6-e7d5-4a79-b901-7df8d5ddd30f','50e4a22c-0c0d-4918-b492-6de986f96918','Mengoperasikan Mesin Pengeringan (Dryer)',8,8,'2026-10-01 12:14:39','2026-10-01 12:14:39');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('86d2b0b7-a2d0-43f9-a84b-513decd5c8bb','50e4a22c-0c0d-4918-b492-6de986f96918','Mengoperasikan Proses Pengemasan',4,9,'2026-10-01 12:14:39','2026-10-01 12:14:39');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('2d381a90-d9c6-4136-8c67-e86c92ecea21','50e4a22c-0c0d-4918-b492-6de986f96918','Mengoperasikan Proses Penyimpanan',4,10,'2026-10-01 12:14:39','2026-10-01 12:14:39');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('e332ced8-c459-4910-a3d3-54b52fc812e6','5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','Mengikuti Prosedur Kerja Menjaga Praktik Pengolahan yang Baik (GMP)',2,3,'2026-10-01 12:15:52','2026-10-01 12:15:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('7fd23c93-e30e-4650-b253-f251ff33ea6f','5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','Menerapkan Program dan Prosedur Keamanan Pangan',1,4,'2026-10-01 12:15:52','2026-10-01 12:15:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('4c983d36-4cdc-4f22-8395-ac2ef0bbb146','5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','Mengoperasikan Alat Timbang',5,5,'2026-10-01 12:15:52','2026-10-01 12:15:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('52d070eb-03f0-4336-8c7e-b40f3955c1e9','5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','Mengoperasikan Mesin Pengaduk (Mixer)',7,6,'2026-10-01 12:15:52','2026-10-01 12:15:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('d0240d6e-4a03-44fe-96d6-bfcb05d5c5ed','5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','Mengoperasikan Mesin Pencetak Adonan (Molder)',6,7,'2026-10-01 12:15:52','2026-10-01 12:15:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('d1d187df-4c41-468a-bda9-02060b2993a3','5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','Mengoperasikan Mesin Pengeringan (Dryer)',8,8,'2026-10-01 12:15:52','2026-10-01 12:15:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('be5f8ca8-53fb-48ad-b0a7-e74f14606951','5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','Mengoperasikan Proses Pengemasan',4,9,'2026-10-01 12:15:52','2026-10-01 12:15:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('406c0442-28b4-43ff-93c4-a80f836c677d','5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','Mengoperasikan Proses Penyimpanan',4,10,'2026-10-01 12:15:52','2026-10-01 12:15:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('96b8d543-7a58-4d68-be7d-abc9575d20dc','b4d660c1-6d1d-4eff-8150-7334074c3628','Menerapkan Ketentuan Keselamatan dan Kesehatan Kerja (K3) dan Lingkungan Hidup di tempat kerja',1,1,'2026-10-02 01:34:23','2026-10-02 01:34:23');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('b61e1dba-b9d5-43e6-af6c-afbf2e8b39d2','b4d660c1-6d1d-4eff-8150-7334074c3628','Melakukan komunikasi dan kerjasama di tempat kerja',1,2,'2026-10-02 01:34:23','2026-10-02 01:34:23');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('ef24cf9f-b353-417a-823c-b7b67d00989a','b4d660c1-6d1d-4eff-8150-7334074c3628','Melakukan pemeliharaan harian backhoe loader sebelum operasi',1,3,'2026-10-02 01:34:23','2026-10-02 01:34:23');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('03b17c03-7df0-4d6b-9342-0744078f6d5b','b4d660c1-6d1d-4eff-8150-7334074c3628','Mengoperasikan attachment loader pada unit backhoe loader',1,4,'2026-10-02 01:34:23','2026-10-02 01:34:23');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('405bc7e8-30c5-49f2-b41c-e835cad8ba8d','b4d660c1-6d1d-4eff-8150-7334074c3628','Mengoperasikan attachment backhoe pada unit backhoe loader',1,5,'2026-10-02 01:34:23','2026-10-02 01:34:23');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('029a0b9c-dd58-46f8-9b36-4273dc47731b','b4d660c1-6d1d-4eff-8150-7334074c3628','Menaikkan dan menurunkan unit backhoe loader ke / dari atas truk trailer',1,6,'2026-10-02 01:34:23','2026-10-02 01:34:23');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('3e929e71-5255-4e5d-81a1-3c7d5bf65922','b4d660c1-6d1d-4eff-8150-7334074c3628','Melaksanakan pemeliharaan harian backhoe loader setelah operasi',1,7,'2026-10-02 01:34:23','2026-10-02 01:34:23');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('1f321a3b-cd04-45d4-b804-5f526fab0e87','b4d660c1-6d1d-4eff-8150-7334074c3628','Membuat Laporan Harian Operasi',1,8,'2026-10-02 01:34:23','2026-10-02 01:34:23');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('7d5d5a0f-6dff-4424-9c6c-146ccb48389d','e7824acf-da25-4b8a-9244-8268e51c3d20','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 01:37:36','2026-10-02 01:37:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('753be19d-09ba-4804-a8da-21bb3a61cc7f','e7824acf-da25-4b8a-9244-8268e51c3d20','Mengoperasikan Mesin dan Peralatan di Stasiun Boiler',1,2,'2026-10-02 01:37:36','2026-10-02 01:37:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('8939e1db-818d-4935-a648-519ff31efbb4','4a6edf40-b67f-425f-92ba-51cf9bfe60f8','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 01:41:58','2026-10-02 01:41:58');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('3bc7a761-aa9f-4e3f-92f3-3259b00f8455','4a6edf40-b67f-425f-92ba-51cf9bfe60f8','Mengoperasikan Mesin dan Peralatan di Stasiun Klarifikasi',1,2,'2026-10-02 01:41:58','2026-10-02 01:41:58');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('41316a71-9272-47a7-bb2a-75bee91e4cda','cdfd39d6-5e4a-4aa3-bc88-88c95e5fdf42','Menerapkan Ketentuan Keselamatan dan Kesehatan Kerja serta Lingkungan dalam Pengoperasian Dump Truck',1,1,'2026-10-02 01:45:29','2026-10-02 01:45:29');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('f053e57f-36de-4852-b5a5-8ceeb1cb1115','cdfd39d6-5e4a-4aa3-bc88-88c95e5fdf42','Melakukan Komunikasi dan Kerjasama di Tempat Kerja',1,2,'2026-10-02 01:45:29','2026-10-02 01:45:29');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('f35a289e-7c2e-4465-b147-430df3ec0d13','cdfd39d6-5e4a-4aa3-bc88-88c95e5fdf42','Melakukan Pemeliharaan Harian Dump Truck',1,3,'2026-10-02 01:45:29','2026-10-02 01:45:29');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('6af84878-ddf2-42e7-8ee6-7863eb759d56','cdfd39d6-5e4a-4aa3-bc88-88c95e5fdf42','Melakukan Persiapan Pengoperasian Dump Truck',1,4,'2026-10-02 01:45:29','2026-10-02 01:45:29');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('600be252-0c73-40bf-b286-7dcdb43e94ee','cdfd39d6-5e4a-4aa3-bc88-88c95e5fdf42','Mengoperasikan Dump Truck Sesuai dengan Prosedur',1,5,'2026-10-02 01:45:29','2026-10-02 01:45:29');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('0c4d0662-fa15-4b9f-a25e-72841188eec3','cdfd39d6-5e4a-4aa3-bc88-88c95e5fdf42','Melakukan Pemeliharaan setelah Selesai Pengoperasian Dump Truck',1,6,'2026-10-02 01:45:29','2026-10-02 01:45:29');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('c9107a00-5ae1-4515-825b-1c8b9eeeb623','f6f9868f-27df-4892-bafc-638f8938a815','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 01:48:52','2026-10-02 01:48:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('c9541431-d781-4932-b6bb-22426c50804e','f6f9868f-27df-4892-bafc-638f8938a815','Mengoperasikan Mesin dan Peralatan di Stasiun Effluent Treatment Plant',1,2,'2026-10-02 01:48:52','2026-10-02 01:48:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('597a25d1-398f-4196-a083-c874001719b8','7a6808cc-532d-4723-a63c-1ec1ae2a56c1','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 01:51:22','2026-10-02 01:51:22');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('dfc79be7-774a-4106-a305-f0c23b93168e','7a6808cc-532d-4723-a63c-1ec1ae2a56c1','Mengoperasikan Mesin dan Peralatan di Stasiun Kernel Recovery',1,2,'2026-10-02 01:51:22','2026-10-02 01:51:22');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('d2bdc6f8-d09a-4e52-9679-126434f4221b','80585f2c-ae38-4af7-aa1a-18472545161d','Menerapkan Prinsip-prinsip K3 di Tempat Kerja',1,1,'2026-10-02 03:26:22','2026-10-02 03:26:22');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('b2080eb1-ebd6-43e8-9af8-b09fd12c6107','80585f2c-ae38-4af7-aa1a-18472545161d','Mengoperasikan Mesin dan Peralatan Loading Ramp',1,2,'2026-10-02 03:26:22','2026-10-02 03:26:22');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('a988ce62-ed9c-47ef-a39c-306d7426891c','709a8f9a-563a-4464-9532-5388e06aef3e','Menerapkan Prinsip-prinsip K3 di Tempat Kerja',1,1,'2026-10-02 03:33:09','2026-10-02 03:33:09');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('a98b9c13-bb21-4342-bb06-62f2423dbc32','709a8f9a-563a-4464-9532-5388e06aef3e','Mengoperasikan Mesin dan Peralatan di Area Pengisian Lori',1,2,'2026-10-02 03:33:09','2026-10-02 03:33:09');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('46804960-508d-4fa6-97ee-e093819ef814','b03857eb-c749-475a-9dbe-07947ec9e31a','Mengkomunikasikan Informasi Tempat Kerja',1,1,'2026-10-02 03:39:52','2026-10-02 03:39:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('a365f5f0-7d19-4dd4-9f30-f66067692bf1','b03857eb-c749-475a-9dbe-07947ec9e31a','Mengikuti Prosedur Kerja dan Menjaga Praktik Pengolahan Yang baik (GMP)',2,2,'2026-10-02 03:39:52','2026-10-02 03:39:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('33f44889-957e-469a-b925-da13604453bb','b03857eb-c749-475a-9dbe-07947ec9e31a','Menerapkan Sistem dan Prosedur Keselamatan Dan Kesehatan (K3)',3,3,'2026-10-02 03:39:52','2026-10-02 03:39:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('14bc669d-dfb3-43a5-b198-fb079161f8c7','b03857eb-c749-475a-9dbe-07947ec9e31a','Mengikuti Prosedur Kerja Menjaga Kemanan Pangan',4,4,'2026-10-02 03:39:52','2026-10-02 03:39:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('f6e809c6-e372-4600-95b2-dc81189543e0','b03857eb-c749-475a-9dbe-07947ec9e31a','Menerapkan Program dan Prosedur Keamanan Pangan',5,5,'2026-10-02 03:39:52','2026-10-02 03:39:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('efac6dce-f024-4f87-b3bf-079ca8019989','b03857eb-c749-475a-9dbe-07947ec9e31a','Mengidentifikasikan Bahan/Komuditas Non Curai',6,6,'2026-10-02 03:39:52','2026-10-02 03:39:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('82641abd-244a-4417-9321-5fa9018a9f3d','b03857eb-c749-475a-9dbe-07947ec9e31a','Mengemas dan Menyimpan Bahan',7,7,'2026-10-02 03:39:52','2026-10-02 03:39:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('753d4cff-9827-471b-adff-a90e993addd5','b03857eb-c749-475a-9dbe-07947ec9e31a','Mengoperasikan Proses Pengeringan',8,8,'2026-10-02 03:39:52','2026-10-02 03:39:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('9268b22f-ded1-47cf-ac5a-860c6220f9d3','b03857eb-c749-475a-9dbe-07947ec9e31a','Mencampur Bahan Kering',9,9,'2026-10-02 03:39:52','2026-10-02 03:39:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('07f1b40c-a1b1-44b5-a86f-dada0a52bf00','b03857eb-c749-475a-9dbe-07947ec9e31a','Memilih Bahan, Cara dan Peralatan Pencampuran.',10,10,'2026-10-02 03:39:52','2026-10-02 03:39:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('4acf84d8-fa3e-49d8-9d14-a52d0ce831ba','b03857eb-c749-475a-9dbe-07947ec9e31a','Mengoperasikan Proses Penyimpanan',11,11,'2026-10-02 03:39:52','2026-10-02 03:39:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('874967c7-c3d5-4e4b-8df9-77d57ae5d144','d650778a-2b01-48f4-8328-b8754055affd','Menerapkan Prinsip-prinsip K3 di Tempat Kerja',1,1,'2026-10-02 03:43:43','2026-10-02 03:43:43');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('059f7f7f-a415-493f-9e24-aba264c7e84a','d650778a-2b01-48f4-8328-b8754055affd','Melakukan Penimbangan Barang',2,2,'2026-10-02 03:43:43','2026-10-02 03:43:43');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('4bf1d16e-6377-4d43-bf22-3887ee28c9e1','d650778a-2b01-48f4-8328-b8754055affd','Melakukan Penyusunan Data Hasil Penimbangan Barang',3,3,'2026-10-02 03:43:43','2026-10-02 03:43:43');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('86b47836-6b73-4863-a873-3e699b02215e','eca6e4d4-e64f-4110-bb85-224a1d4ca8a1','Menyusun draft estimasi biaya proses',1,1,'2026-10-02 03:46:41','2026-10-02 03:46:41');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('4ed90bed-e595-4099-9f5f-a5c1e8d73bd3','eca6e4d4-e64f-4110-bb85-224a1d4ca8a1','Menyusun rencana kerja di pabrik',2,2,'2026-10-02 03:46:41','2026-10-02 03:46:41');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('670ac3fc-65e0-45a3-ac54-a1118d527c07','eca6e4d4-e64f-4110-bb85-224a1d4ca8a1','Melakukan Pengaturan Pekerjaan Process Foreman dan/atau Operator',3,3,'2026-10-02 03:46:41','2026-10-02 03:46:41');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('213bb4b5-7382-47d3-b96f-92facfa09fb1','eca6e4d4-e64f-4110-bb85-224a1d4ca8a1','Merencanakan Pengaturan Kerja Lembur Operator',4,4,'2026-10-02 03:46:41','2026-10-02 03:46:41');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('ea7b3df3-ad68-4d21-aea6-f6bdbfbe903e','eca6e4d4-e64f-4110-bb85-224a1d4ca8a1','Mengawasi losses dan mutu produk',5,5,'2026-10-02 03:46:41','2026-10-02 03:46:41');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('10af830e-0dc3-4d7a-a703-ab8071462d6c','eca6e4d4-e64f-4110-bb85-224a1d4ca8a1','Mengendalikan kinerja (biaya produksi dan biaya-biaya lain yang berkaitan dengan) proses produksi',6,6,'2026-10-02 03:46:41','2026-10-02 03:46:41');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('6267b71d-a98c-4492-a973-0fc1f7e3cfd6','eca6e4d4-e64f-4110-bb85-224a1d4ca8a1','Melakukan troubleshooting atas masalah yang mengganggu kelancaran proses',7,7,'2026-10-02 03:46:41','2026-10-02 03:46:41');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('b2c4db66-9176-46dd-a9bc-a1365753641b','de409591-9311-4bf9-ab55-f0ceee35689b','Melaksanakan persiapan tempat kerja',1,1,'2026-10-02 03:48:48','2026-10-02 03:48:48');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('4235c6df-33f5-4ce2-8768-9c7cabea5fb7','de409591-9311-4bf9-ab55-f0ceee35689b','Memperbaiki hasil pengelasan',2,2,'2026-10-02 03:48:48','2026-10-02 03:48:48');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('c8e95258-6d2e-44a2-bc11-cb86ec5cc546','de409591-9311-4bf9-ab55-f0ceee35689b','Membuat sambungan las kampuh (groove) sesuai wps untuk pengelasan pelat ke pelat dan sesuai dengan proses las yang digunakan',3,3,'2026-10-02 03:48:48','2026-10-02 03:48:48');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('96d974f5-3387-4e4f-a77d-b997d77193a3','631f1b7e-caab-48c7-8dae-7c922cfe2e51','Mengoperasikan Instalasi Pengolahan Air Limbah (IPAL)',1,1,'2026-10-02 03:51:49','2026-10-02 03:51:49');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('4e4fdbf4-38a8-467c-9d17-42cf447e49ef','631f1b7e-caab-48c7-8dae-7c922cfe2e51','Menilai Tingkat Pencemaran Air Limbah',2,2,'2026-10-02 03:51:49','2026-10-02 03:51:49');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('5a824feb-0f56-41f7-9ae7-a8210f342b93','631f1b7e-caab-48c7-8dae-7c922cfe2e51','Melakukan Perawatan Instalasi Pengolahan Air Limbah (IPAL)',3,3,'2026-10-02 03:51:49','2026-10-02 03:51:49');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('b65a6287-9b11-4189-85f0-6da7a332043e','631f1b7e-caab-48c7-8dae-7c922cfe2e51','Mengidentifikasi Bahaya Dalam Pengolahan Air Limbah',4,4,'2026-10-02 03:51:49','2026-10-02 03:51:49');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('ba11b2df-117c-41df-94d1-4d01ca8c9954','631f1b7e-caab-48c7-8dae-7c922cfe2e51','Melakukan Tindakan Keselamatan Dan Kesehatan Kerja (K3) Terhadap Bahaya Dalam Pengolahan Air Limbah',5,5,'2026-10-02 03:51:49','2026-10-02 03:51:49');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('92c1d6bc-fd76-42a0-829a-9e9563c1e92f','4dd4b810-ecbf-4170-b2d9-9ef32bab8bec','Mengoperasikan Alat Pengendali Pencemaran Udara dari Emisi',1,1,'2026-10-02 03:57:28','2026-10-02 03:57:28');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('43518268-597a-4f9e-8f59-a7dc0c66a608','4dd4b810-ecbf-4170-b2d9-9ef32bab8bec','Melakukan Perawatan Peralatan Pengendali Pencemaran Udara',2,2,'2026-10-02 03:57:28','2026-10-02 03:57:28');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('7a251456-6168-4918-a384-643c078185e5','4dd4b810-ecbf-4170-b2d9-9ef32bab8bec','Menilai Tingkat Pencemaran Udara dari Emisi',3,3,'2026-10-02 03:57:28','2026-10-02 03:57:28');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('cee8eb6b-360a-4897-99ff-6349952cfecf','4dd4b810-ecbf-4170-b2d9-9ef32bab8bec','Mengidentifikasi Bahaya Dalam Pengendalian Pencemaran Udara dari Emisi',4,4,'2026-10-02 03:57:28','2026-10-02 03:57:28');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('22888147-1792-4099-af06-705d03cd86f7','4dd4b810-ecbf-4170-b2d9-9ef32bab8bec','Melakukan Tindakan K3 Terhadap Bahaya dalam Pengendalian Pencemaran Udara dari Emisi',5,5,'2026-10-02 03:57:28','2026-10-02 03:57:28');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('355342ea-751e-4c03-bc39-b5908d69df11','e2aed2c8-c8f8-4e97-8350-f17dcf79e438','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 04:08:47','2026-10-02 04:08:47');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('8d6d7a3c-0217-4dbb-a4d9-afc8b6318755','e2aed2c8-c8f8-4e97-8350-f17dcf79e438','Mengoperasikan Mesin dan Peralatan di Stasiun Power Plant',2,2,'2026-10-02 04:08:47','2026-10-02 04:08:47');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('16b7737c-24e5-4ee7-bbe5-2baa5de80ae8','87e8d887-e626-42c0-80e9-263c452f132d','Mengidentifikasi Sumber Pencemaran Air Limbah',1,1,'2026-10-02 04:13:36','2026-10-02 04:13:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('00f06ef8-4c4c-4ada-bfef-ab95dd32f062','87e8d887-e626-42c0-80e9-263c452f132d','Menentukan Karakteristik Sumber Pencemaran Air Limbah',2,2,'2026-10-02 04:13:36','2026-10-02 04:13:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('03cbef26-423b-46f4-8dd2-8a6a89f38240','87e8d887-e626-42c0-80e9-263c452f132d','Menilai Tingkat Pencemaran Air Limbah',3,3,'2026-10-02 04:13:36','2026-10-02 04:13:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('e202d714-e71b-4bbf-a8c0-93dc34a0b7f6','87e8d887-e626-42c0-80e9-263c452f132d','Menentukan Peralatan Instalasi Pengolahan Air Limbah (IPAL)',4,4,'2026-10-02 04:13:36','2026-10-02 04:13:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('0bc4f187-9cf4-4c85-b25b-c960718f1bb4','87e8d887-e626-42c0-80e9-263c452f132d','Mengoperasikan Instalasi Pengolahan Air Limbah (IPAL)',5,5,'2026-10-02 04:13:36','2026-10-02 04:13:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('2bfd1749-9f93-451e-8310-5d10c7ab1adf','87e8d887-e626-42c0-80e9-263c452f132d','Melaksanakan Daur Ulang Olahan Air Limbah',6,6,'2026-10-02 04:13:36','2026-10-02 04:13:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('e947191e-fecb-452a-b8a9-c4b35120f7c9','87e8d887-e626-42c0-80e9-263c452f132d','Menyusun Rencana Pemantauan Kualitas Air Limbah',7,7,'2026-10-02 04:13:36','2026-10-02 04:13:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('2a977ca8-6442-4411-879f-c10d8e90d005','87e8d887-e626-42c0-80e9-263c452f132d','Melaksanakan Pemantauan Kualitas Air Limbah',8,8,'2026-10-02 04:13:36','2026-10-02 04:13:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('21646518-da29-4d9f-85c3-2d7cffde539e','87e8d887-e626-42c0-80e9-263c452f132d','Mengidentifikasi Bahaya Dalam Pengolahan Air Limbah',9,9,'2026-10-02 04:13:36','2026-10-02 04:13:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('bbda473e-1d96-4033-9579-3dffb78587a5','87e8d887-e626-42c0-80e9-263c452f132d','Melakukan Tindakan Keselamatan Dan Kesehatan Kerja (K3) Terhadap Bahaya Dalam Pengolahan Air Limbah',10,10,'2026-10-02 04:13:36','2026-10-02 04:13:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('e5a54597-b9ff-48a7-878c-f70c37e6d846','e94f11be-229c-4f19-9be5-3e701445f9fe','Mengidentifikasi sumber pencemar udara dari emisi',1,1,'2026-10-02 04:16:43','2026-10-02 04:16:43');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('1fc8f63a-6ff7-4be2-8511-cd4575d70d3e','e94f11be-229c-4f19-9be5-3e701445f9fe','Menentukan karakteristik sumber pencemar udara dari emisi',2,2,'2026-10-02 04:16:43','2026-10-02 04:16:43');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('6c7d3227-f6bc-4a06-9aa5-6515f9af85ab','e94f11be-229c-4f19-9be5-3e701445f9fe','Menilai tingkat pencemaran udara dari emisi',3,3,'2026-10-02 04:16:43','2026-10-02 04:16:43');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('ea925b62-c6bb-4464-b9f5-48a187ae2344','e94f11be-229c-4f19-9be5-3e701445f9fe','Melaksanakan pengendalian pencemaran udara dari emisi',4,4,'2026-10-02 04:16:43','2026-10-02 04:16:43');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('4df94ed1-738e-4ea4-ad56-1746ceaad7f7','e94f11be-229c-4f19-9be5-3e701445f9fe','Menentukan peralatan pengendali pencemaran udara dari emisi',5,5,'2026-10-02 04:16:43','2026-10-02 04:16:43');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('ec3ce988-6762-46ea-8cde-5aa886a324c0','e94f11be-229c-4f19-9be5-3e701445f9fe','Mengoperasikan alat pengendali pencemaran udara dari emisi',6,6,'2026-10-02 04:16:43','2026-10-02 04:16:43');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('016d6076-7d03-427a-8b69-535bd16e3569','e94f11be-229c-4f19-9be5-3e701445f9fe','Menyusun rencana pemantauan pencemaran udara dari emisi',7,7,'2026-10-02 04:16:43','2026-10-02 04:16:43');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('52ee8870-01a4-4d2b-9f05-2486bdf964c2','e94f11be-229c-4f19-9be5-3e701445f9fe','Melaksanakan pemantauan pencemaran udara dari emisi',8,8,'2026-10-02 04:16:43','2026-10-02 04:16:43');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('93788ccd-277d-40d7-be82-b6077e423611','e94f11be-229c-4f19-9be5-3e701445f9fe','Mengidentifikasi bahaya dalam pengendalian pencemaran udara dari emisi',9,9,'2026-10-02 04:16:43','2026-10-02 04:16:43');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('27dc8c5a-b478-4286-a386-4269983b1538','e94f11be-229c-4f19-9be5-3e701445f9fe','Melakukan tindakan K3 terhadap bahaya dalam pengendalian pencemaran udara dari emisi',10,10,'2026-10-02 04:16:43','2026-10-02 04:16:43');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('1707fe35-187c-468b-b447-6e6afa804535','d3b67877-86c0-49b4-adc7-b3af86891524','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 04:19:52','2026-10-02 04:19:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('6c4fbd76-c054-4403-bb39-e41c7d39df4a','d3b67877-86c0-49b4-adc7-b3af86891524','Mengoperasikan Mesin dan Peralatan di Stasiun Press',2,2,'2026-10-02 04:19:52','2026-10-02 04:19:52');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('691e4477-5b30-4d1a-b12b-35cd6d426bec','ac60027f-d544-4547-a984-440a298054b6','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 04:23:39','2026-10-02 04:23:39');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('58e51bc8-78b2-4e40-9851-c85f57196db8','ac60027f-d544-4547-a984-440a298054b6','Mengoperasikan Mesin dan Peralatan di Stasiun Sterilizer',2,2,'2026-10-02 04:23:39','2026-10-02 04:23:39');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('5c8f53ea-2ef8-43a2-b72f-621238ee231b','a768abbb-72ac-4dc9-8da5-b3de375485bd','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 04:26:01','2026-10-02 04:26:01');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('b36d5e03-3c46-479a-883e-df780254dc14','a768abbb-72ac-4dc9-8da5-b3de375485bd','Mengoperasikan Mesin dan Peralatan di Area Tippler',2,2,'2026-10-02 04:26:01','2026-10-02 04:26:01');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('749966d9-4fde-49e1-8a29-5a8ee68b957a','76df0953-c211-4223-8742-0de0bd78757d','Menerapkan Prinsip-prinsip K3 di Tempat Kerja',1,1,'2026-10-02 04:28:23','2026-10-02 04:28:23');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('1867244b-3886-428a-8124-a82007090160','76df0953-c211-4223-8742-0de0bd78757d','Mengoperasikan Mesin dan Peralatan Transfer Carriage',2,2,'2026-10-02 04:28:23','2026-10-02 04:28:23');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('ce35a978-83d1-4639-b776-f3357998787b','105f060e-5a6a-4433-9a52-1fb36726d795','Melaksanakan persiapan tempat kerja',1,1,'2026-10-02 04:31:59','2026-10-02 04:31:59');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('5a882aac-3463-47a5-b141-d62e28c5ea01','105f060e-5a6a-4433-9a52-1fb36726d795','Melakukan peran serta (contribute) pada sistem mutu',2,2,'2026-10-02 04:31:59','2026-10-02 04:31:59');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('a8fd457a-6249-46bb-b03a-5c6c1a66191a','105f060e-5a6a-4433-9a52-1fb36726d795','Melakukan inspeksi visual pengelasan',3,3,'2026-10-02 04:31:59','2026-10-02 04:31:59');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('cc30cb65-f20b-4518-a09e-64c08f2e82d9','105f060e-5a6a-4433-9a52-1fb36726d795','Melakukan penetrant test (PT)',4,4,'2026-10-02 04:31:59','2026-10-02 04:31:59');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('e6c9eee2-9242-4540-bbee-92aff9b0ae8d','105f060e-5a6a-4433-9a52-1fb36726d795','Melakukan magnetic particle test (MT)',5,5,'2026-10-02 04:31:59','2026-10-02 04:31:59');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('96b6c006-f257-4836-85e7-72c485bd5539','a8db6ba7-0559-4b8f-be49-64ba36179bd4','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 06:36:00','2026-10-02 06:36:00');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('703f58c0-6695-4d0f-a0aa-b3b59222be65','a8db6ba7-0559-4b8f-be49-64ba36179bd4','Mengoperasikan Mesin dan Peralatan di Stasiun Water Treatment Plant',2,2,'2026-10-02 06:36:00','2026-10-02 06:36:00');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('de1f3105-7be9-4e76-8083-f72a2bbc3d94','83978a8c-d1e0-4c7e-9d10-240d325b76e3','Menyiapkan Bahan Baku Minuman Berbahan Dasar Kopi',1,1,'2026-10-02 06:40:37','2026-10-02 06:40:37');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('d1f26f8c-3137-4949-a44e-b44a96a6c8b8','83978a8c-d1e0-4c7e-9d10-240d325b76e3','Menyiapkan Peralatan dan Perlengkapan Pembuatan Minuman Berbahan Dasar Kopi',2,2,'2026-10-02 06:40:37','2026-10-02 06:40:37');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('33b088fa-c508-47bf-8cab-47fd68366bc8','83978a8c-d1e0-4c7e-9d10-240d325b76e3','Menyiapkan Area Pelayanan',3,3,'2026-10-02 06:40:37','2026-10-02 06:40:37');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('ca3efcc3-3099-43f6-8d13-cbd0942f5b4b','83978a8c-d1e0-4c7e-9d10-240d325b76e3','Melayani Pelanggan',4,4,'2026-10-02 06:40:37','2026-10-02 06:40:37');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('cabc6e85-96ca-404e-9c0d-5b9af92a4ecc','83978a8c-d1e0-4c7e-9d10-240d325b76e3','Membuat Minuman Kopi Menggunakan Mesin',5,5,'2026-10-02 06:40:37','2026-10-02 06:40:37');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('669d09f2-e9b5-4018-a1b4-20605c17c18f','83978a8c-d1e0-4c7e-9d10-240d325b76e3','Membuat Minuman Kopi Menggunakan Peralatan Manual',6,6,'2026-10-02 06:40:37','2026-10-02 06:40:37');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('2ed5288b-ca0c-4a39-93c3-d8972d64f336','83978a8c-d1e0-4c7e-9d10-240d325b76e3','Memutakhirkan Pengetahuan tentang Produk Minuman dan Pelayanan',7,7,'2026-10-02 06:40:37','2026-10-02 06:40:37');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('24917a1b-3e74-4eb6-9c31-88e2910f7e62','6e0075b4-587c-493e-97bc-b8b77c86874f','Bekerja dalam suatu laboratorium/lingkungan kerja (pengenalan)',1,1,'2026-10-02 06:53:17','2026-10-02 06:53:17');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('9c4c47db-75e0-49cc-9263-0e20507039fc','6e0075b4-587c-493e-97bc-b8b77c86874f','Berkomunikasi dengan orang lain',2,2,'2026-10-02 06:53:17','2026-10-02 06:53:17');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('d80480f4-fbe2-486c-8c51-022f2c421ef2','6e0075b4-587c-493e-97bc-b8b77c86874f','Merekam dan menyajikan data',3,3,'2026-10-02 06:53:17','2026-10-02 06:53:17');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('9694ecbc-f6d9-47ed-9488-56dba8c23c60','6e0075b4-587c-493e-97bc-b8b77c86874f','Berpartisipasi dalam keselamatan kerja di laboratorium/ lingkungan kerja',4,4,'2026-10-02 06:53:17','2026-10-02 06:53:17');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('666562f7-bfcd-45a4-81da-64c31f7528bd','6e0075b4-587c-493e-97bc-b8b77c86874f','Mengambil contoh di lokasi secara rutin',5,5,'2026-10-02 06:53:17','2026-10-02 06:53:17');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('a0a201b4-cd36-4de8-88d8-5f7af7fd21b1','6e0075b4-587c-493e-97bc-b8b77c86874f','Menangani dan mengangkut contoh atau peralatan',6,6,'2026-10-02 06:53:17','2026-10-02 06:53:17');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('06e741ef-9ba4-4fee-bc45-af9aa7e2a848','6e0075b4-587c-493e-97bc-b8b77c86874f','Melakukan pengukuran rutin di lokasi',7,7,'2026-10-02 06:53:17','2026-10-02 06:53:17');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('c2fa4ba1-cb87-44c2-ba47-61923bc6d7f0','ac7912f9-b145-4eae-982b-de18085e2dc2','Menyiapkan Operasi Boiler',1,1,'2026-10-02 06:56:13','2026-10-02 06:56:13');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('c59c25d4-ed3b-4411-8a4c-ab9a68e123ca','ac7912f9-b145-4eae-982b-de18085e2dc2','Mengoperasikan Boiler',2,2,'2026-10-02 06:56:13','2026-10-02 06:56:13');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('941be3fc-652c-42af-84a1-de6c17993f47','ac7912f9-b145-4eae-982b-de18085e2dc2','Mengawasi Operasi Boiler',3,3,'2026-10-02 06:56:13','2026-10-02 06:56:13');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('694e0b91-d7d5-4027-b12e-7fadd68da040','ac7912f9-b145-4eae-982b-de18085e2dc2','Melakukan Pengawasan Kegiatan Operasional Boiler',4,4,'2026-10-02 06:56:13','2026-10-02 06:56:13');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('97e42413-e8d4-45b9-96eb-3294bad211d6','ac7912f9-b145-4eae-982b-de18085e2dc2','Menanggulangi Gangguan Operasi Boiler',5,5,'2026-10-02 06:56:13','2026-10-02 06:56:13');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('49717676-b378-401b-845c-927b103841ec','ac7912f9-b145-4eae-982b-de18085e2dc2','Melakukan Evaluasi Operasi Boiler',6,6,'2026-10-02 06:56:13','2026-10-02 06:56:13');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('b589ff18-dcfd-4ea1-8886-5b332912c8e4','e7810825-64c7-4073-ae60-79fd4ea2259c','Menerapkan Keselamatan Kerja di Tempat Kerja',1,1,'2026-10-02 07:04:36','2026-10-02 07:04:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('ffa2b2f4-7358-405b-b619-ee4904fc58c4','e7810825-64c7-4073-ae60-79fd4ea2259c','Mempersiapkan Operasi Forklift',2,2,'2026-10-02 07:04:36','2026-10-02 07:04:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('e93ca093-7d1c-4425-ae20-4c1126cc06de','e7810825-64c7-4073-ae60-79fd4ea2259c','Mengoperasikan Forklift',3,3,'2026-10-02 07:04:36','2026-10-02 07:04:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('fb027100-cd30-49e3-8bf9-ba211bf705da','e7810825-64c7-4073-ae60-79fd4ea2259c','Mengendalikan Beban',4,4,'2026-10-02 07:04:36','2026-10-02 07:04:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('18170434-e960-4797-bd43-728ab7dec99b','e7810825-64c7-4073-ae60-79fd4ea2259c','Membuat Laporan Operasi Forklift',5,5,'2026-10-02 07:04:36','2026-10-02 07:04:36');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('d7fded8d-c846-4bb5-bdfc-04117e16ac9c','6c4f161e-45f9-4723-a814-50d8757b3282','Mengkomunikasikan Informasi Tempat Kerja',1,1,'2026-10-02 07:06:47','2026-10-02 07:06:47');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('96acb6bf-c70b-4b08-8809-6d3067445525','6c4f161e-45f9-4723-a814-50d8757b3282','Mengikuti Prosedur Menjaga Kesehatan dan Keselamatan Kerja (K3)',2,2,'2026-10-02 07:06:47','2026-10-02 07:06:47');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('a34d874d-6448-45ff-adb6-94ec8b209dd0','6c4f161e-45f9-4723-a814-50d8757b3282','Mengikuti Prosedur Kerja Menjaga Praktik Pengolahan yang Baik (GMP)',3,3,'2026-10-02 07:06:47','2026-10-02 07:06:47');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('2dea7a6c-f535-452d-b98c-2f5ec9685902','6c4f161e-45f9-4723-a814-50d8757b3282','Menerapkan Program dan Prosedur Keamanan Pangan',4,4,'2026-10-02 07:06:47','2026-10-02 07:06:47');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('1d1d994e-0cdf-4105-8ec3-cc442f8bba5b','6c4f161e-45f9-4723-a814-50d8757b3282','Mengoperasikan Alat Timbang',5,5,'2026-10-02 07:06:47','2026-10-02 07:06:47');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('6c652d51-46cb-47f6-84e3-eb987b3fadbe','6c4f161e-45f9-4723-a814-50d8757b3282','Mengoperasikan Mesin Pengaduk (Mixer)',6,6,'2026-10-02 07:06:47','2026-10-02 07:06:47');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('4f1cc387-ccc7-4a98-ace2-539464f34a20','6c4f161e-45f9-4723-a814-50d8757b3282','Mengoperasikan Mesin Pencetak Adonan (Molder)',7,7,'2026-10-02 07:06:47','2026-10-02 07:06:47');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('6dd41756-6e8b-43ee-a345-5e4bd48275df','6c4f161e-45f9-4723-a814-50d8757b3282','Mengoperasikan Mesin Pengeringan (Dryer)',8,8,'2026-10-02 07:06:47','2026-10-02 07:06:47');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('8630a05f-f0e2-4d9e-bbd1-7929d590f413','6c4f161e-45f9-4723-a814-50d8757b3282','Mengoperasikan Proses Pengemasan',9,9,'2026-10-02 07:06:47','2026-10-02 07:06:47');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('3bafe707-5e46-42fb-bfb2-8a3a168636ce','6c4f161e-45f9-4723-a814-50d8757b3282','Mengoperasikan Proses Penyimpanan',10,10,'2026-10-02 07:06:47','2026-10-02 07:06:47');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('51cede42-6bfa-461b-95a3-9eb5c05b4a70','ebb6a535-6775-4494-a1ad-1f611a4b3bc0','Menentukan Kadar Karet Kering (KKK)/DRC',1,1,'2026-10-02 07:10:21','2026-10-02 07:10:21');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('80351fea-fa43-4e1d-9763-e6a4cc1f156a','ebb6a535-6775-4494-a1ad-1f611a4b3bc0','Mengoperasikan Mesin Creper/Mangle',2,2,'2026-10-02 07:10:21','2026-10-02 07:10:21');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('92a64b0a-f980-4ae2-b480-f1ac836ffc9b','ebb6a535-6775-4494-a1ad-1f611a4b3bc0','Mengoperasikan Mesin Shredder',3,3,'2026-10-02 07:10:21','2026-10-02 07:10:21');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('1ec66453-00f4-4f9a-93ff-c980c135c09c','912a3c82-030a-498a-94e7-1a1844b346bd','Mengoperasikan Unit Dryer',1,1,'2026-10-02 07:13:01','2026-10-02 07:13:01');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('3eafc746-5185-4814-9835-240f20ff5bde','912a3c82-030a-498a-94e7-1a1844b346bd','Mengoperasikan Timbangan Bandela',2,2,'2026-10-02 07:13:01','2026-10-02 07:13:01');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('7f395637-567e-49d3-b6d1-382f87447220','912a3c82-030a-498a-94e7-1a1844b346bd','Mengoperasikan Mesin Press Bandela',3,3,'2026-10-02 07:13:01','2026-10-02 07:13:01');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('1b0e0e5f-1ceb-49f6-9c03-7cb3a79dfb65','912a3c82-030a-498a-94e7-1a1844b346bd','Mengoperasikan Mesin Metal Detector',4,4,'2026-10-02 07:13:01','2026-10-02 07:13:01');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('d4b00115-6426-4286-9b2b-22e7e45f85cf','912a3c82-030a-498a-94e7-1a1844b346bd','Mengatur Penyusunan Bandela Dalam Pallet/Box',5,5,'2026-10-02 07:13:01','2026-10-02 07:13:01');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('09486ec9-6133-48fa-b718-a678bef5acd1','912a3c82-030a-498a-94e7-1a1844b346bd','Memberikan Labelling Pada Pallet',6,6,'2026-10-02 07:13:01','2026-10-02 07:13:01');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('8a34387c-b7ce-4e9e-81b2-ce92b083c95d','912a3c82-030a-498a-94e7-1a1844b346bd','Mengoperasikan Alat Strapping',7,7,'2026-10-02 07:13:01','2026-10-02 07:13:01');

INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at") VALUES('5824eeb6-ecdb-4a35-862c-002f3c981043','912a3c82-030a-498a-94e7-1a1844b346bd','Mengoperasikan Alat Shrink Fast/Gun',8,8,'2026-10-02 07:13:01','2026-10-02 07:13:01');

INSERT INTO "participant_profiles" ("id","training_id","cohort_id","name","normalized_name","nik","birth_place","birth_date","photo_key","is_active","created_at","updated_at") VALUES('ac55236d-68ba-4388-bc5f-ce9746ebcef2','b4d660c1-6d1d-4eff-8150-7334074c3628','efe7ebe5-7bad-4673-bce5-04082d394fc7','Ade Febriyanti','ade febriyanti','1271054102860002','Medan','1986-02-01',NULL,1,'2026-10-02 07:31:04','2026-10-02 07:31:04');

INSERT INTO "participant_profiles" ("id","training_id","cohort_id","name","normalized_name","nik","birth_place","birth_date","photo_key","is_active","created_at","updated_at") VALUES('fff112a6-61a6-4087-9ea6-e4b13e2ca3ec','b4d660c1-6d1d-4eff-8150-7334074c3628','efe7ebe5-7bad-4673-bce5-04082d394fc7','Budi Santoso','budi santoso','1271051206880001','Medan','1988-06-12',NULL,1,'2026-10-02 07:31:04','2026-10-02 07:31:04');

INSERT INTO "participant_profiles" ("id","training_id","cohort_id","name","normalized_name","nik","birth_place","birth_date","photo_key","is_active","created_at","updated_at") VALUES('02396434-3480-4aa9-a17c-3dd990dcc4ca','b4d660c1-6d1d-4eff-8150-7334074c3628','efe7ebe5-7bad-4673-bce5-04082d394fc7','Citra Lestari','citra lestari','1271055501950003','Binjai','1995-01-15',NULL,1,'2026-10-02 07:31:04','2026-10-02 07:31:04');

INSERT INTO "participant_profiles" ("id","training_id","cohort_id","name","normalized_name","nik","birth_place","birth_date","photo_key","is_active","created_at","updated_at") VALUES('1f63d670-92a8-4540-a8fb-d9c3e2760003','b4d660c1-6d1d-4eff-8150-7334074c3628','efe7ebe5-7bad-4673-bce5-04082d394fc7','Dedi Irawan','dedi irawan','1271051205800004','Deli Serdang','1980-05-12',NULL,1,'2026-10-02 07:31:04','2026-10-02 07:31:04');

INSERT INTO "participant_profiles" ("id","training_id","cohort_id","name","normalized_name","nik","birth_place","birth_date","photo_key","is_active","created_at","updated_at") VALUES('dc1ac85c-e277-49fd-b630-53367a9c9916','b4d660c1-6d1d-4eff-8150-7334074c3628','efe7ebe5-7bad-4673-bce5-04082d394fc7','Eka Putri','eka putri','1271054001970005','Medan','1997-01-01',NULL,1,'2026-10-02 07:31:04','2026-10-02 07:31:04');

INSERT INTO "participant_profiles" ("id","training_id","cohort_id","name","normalized_name","nik","birth_place","birth_date","photo_key","is_active","created_at","updated_at") VALUES('9481a9ea-e8db-46ad-b5cb-87941e2a1463','b4d660c1-6d1d-4eff-8150-7334074c3628','00db3c38-5269-4312-b479-5935c9565136','sk','sk','123','123','2026-10-01',NULL,1,'2026-10-02 07:31:30','2026-10-02 07:31:30');

INSERT INTO "question_banks" ("id","name","description","is_active","created_at","updated_at","material_id") VALUES('99775b28-6e53-4988-bcc6-1c0361f66cab','Kelapa sawit',NULL,1,'2026-10-01 22:59:03','2026-10-05 04:13:26','5eefcd9c-3ff0-4e1b-bfcb-7fff8048e477');

DELETE FROM sqlite_sequence;

INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',9);

CREATE INDEX idx_admin_sessions_admin_expiry
  ON admin_sessions(admin_id, expires_at);

CREATE INDEX idx_questions_bank_active_usage
  ON questions(bank_id, is_active, times_assigned);

CREATE INDEX idx_training_sessions_bank_status
  ON training_sessions(bank_id, status);

CREATE INDEX idx_training_sessions_dates
  ON training_sessions(training_start_date, training_end_date);

CREATE INDEX idx_batches_training_session
  ON batches(training_session_id);

CREATE INDEX idx_batch_questions_question
  ON batch_questions(question_id);

CREATE INDEX idx_attempt_answers_attempt
  ON attempt_answers(attempt_id);

CREATE INDEX idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id, created_at);

CREATE INDEX idx_audit_logs_admin
  ON audit_logs(admin_id, created_at);

CREATE INDEX idx_admins_role_active ON admins(role, is_active);

CREATE UNIQUE INDEX one_active_bank_per_material
  ON question_banks(material_id) WHERE is_active = 1 AND material_id IS NOT NULL;

CREATE INDEX participant_profiles_lookup
  ON participant_profiles(cohort_id, normalized_name, nik, is_active);

CREATE INDEX attempts_participant_stage ON attempts(participant_id, stage, status);

CREATE INDEX idx_participants_normalized_name
  ON participants(normalized_name);

CREATE INDEX idx_participants_profile_batch
  ON participants(profile_id, batch_id);

CREATE INDEX idx_trainings_visible
  ON trainings(is_deleted, is_active, name);

PRAGMA foreign_keys=ON;
