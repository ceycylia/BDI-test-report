PRAGMA foreign_keys = OFF;

-- A registered profile may join more than one material/test session in the same
-- training. The exam participant identity is therefore unique per profile and
-- generated batch, not globally per profile and not by the participant name.
CREATE TABLE participants_new (
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

INSERT INTO participants_new (
  id, batch_id, name, normalized_name, profile_id, created_at, updated_at
)
SELECT id, batch_id, name, normalized_name, profile_id, created_at, updated_at
FROM participants;

DROP TABLE participants;
ALTER TABLE participants_new RENAME TO participants;

CREATE INDEX idx_participants_normalized_name
  ON participants(normalized_name);
CREATE INDEX idx_participants_profile_batch
  ON participants(profile_id, batch_id);

PRAGMA foreign_keys = ON;
