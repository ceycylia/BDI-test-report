ALTER TABLE participant_profiles ADD COLUMN address TEXT;

CREATE TABLE completion_letters (
  id TEXT PRIMARY KEY,
  participant_profile_id TEXT NOT NULL UNIQUE,
  training_id TEXT NOT NULL,
  cohort_id TEXT NOT NULL,
  completion_letter_number TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (participant_profile_id) REFERENCES participant_profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE RESTRICT,
  FOREIGN KEY (cohort_id) REFERENCES training_cohorts(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX completion_letters_training_cohort
  ON completion_letters(training_id, cohort_id);
