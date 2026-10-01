PRAGMA foreign_keys = ON;

CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL CHECK (password_iterations > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (username)
) STRICT;

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

CREATE TABLE question_banks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (training_session_id, batch_number),
  UNIQUE (training_session_id, batch_name),
  FOREIGN KEY (training_session_id) REFERENCES training_sessions(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE batch_questions (
  batch_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (batch_id, question_id),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT
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

CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  normalized_name TEXT NOT NULL CHECK (length(trim(normalized_name)) > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (batch_id, normalized_name),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  training_session_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('PRE', 'POST', 'REMEDIAL_1', 'REMEDIAL_2', 'REMEDIAL_3')),
  attempt_number INTEGER NOT NULL CHECK (attempt_number BETWEEN 1 AND 4),
  started_at TEXT NOT NULL,
  deadline_at TEXT NOT NULL,
  submitted_at TEXT,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (
    status IN ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'RESET')
  ),
  score REAL CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  total_questions INTEGER CHECK (total_questions IS NULL OR total_questions > 0),
  correct_count INTEGER CHECK (correct_count IS NULL OR correct_count >= 0),
  wrong_count INTEGER CHECK (wrong_count IS NULL OR wrong_count >= 0),
  draft_answers_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(draft_answers_json)),
  draft_revision INTEGER NOT NULL DEFAULT 0 CHECK (draft_revision >= 0),
  reset_by_admin_id TEXT,
  reset_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (deadline_at > started_at),
  CHECK (
    (status = 'SUBMITTED' AND submitted_at IS NOT NULL AND score IS NOT NULL)
    OR status <> 'SUBMITTED'
  ),
  CHECK (
    (status = 'RESET' AND reset_by_admin_id IS NOT NULL AND reset_at IS NOT NULL)
    OR status <> 'RESET'
  ),
  UNIQUE (participant_id, stage, attempt_number),
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  FOREIGN KEY (training_session_id) REFERENCES training_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (reset_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL
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
CREATE INDEX idx_participants_normalized_name
  ON participants(normalized_name);
CREATE INDEX idx_attempts_participant_status
  ON attempts(participant_id, status);
CREATE INDEX idx_attempts_session_stage
  ON attempts(training_session_id, stage, status);
CREATE INDEX idx_attempts_deadline
  ON attempts(status, deadline_at);
CREATE INDEX idx_attempt_answers_attempt
  ON attempt_answers(attempt_id);
CREATE INDEX idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id, created_at);
CREATE INDEX idx_audit_logs_admin
  ON audit_logs(admin_id, created_at);
