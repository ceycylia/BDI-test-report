ALTER TABLE trainings ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1));

CREATE INDEX idx_trainings_visible
  ON trainings(is_deleted, is_active, name);
