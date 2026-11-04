CREATE TABLE participant_registration_links (
  id TEXT PRIMARY KEY,
  cohort_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  FOREIGN KEY (cohort_id) REFERENCES training_cohorts(id) ON DELETE CASCADE
) STRICT;

CREATE UNIQUE INDEX uq_active_participant_registration_link
  ON participant_registration_links(cohort_id) WHERE revoked_at IS NULL;

CREATE INDEX idx_participant_registration_links_cohort
  ON participant_registration_links(cohort_id, created_at);
