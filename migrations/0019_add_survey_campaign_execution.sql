-- Pelaksanaan Evaluasi: multi-angkatan, link publik stabil, dan lifecycle buka/tutup.
-- Kolom cohort_id lama tetap dipertahankan sebagai angkatan utama untuk
-- kompatibilitas data yang sudah ada. Seluruh angkatan authoritative disimpan
-- pada survey_campaign_cohorts.

ALTER TABLE survey_campaigns ADD COLUMN slug TEXT;
ALTER TABLE survey_campaigns ADD COLUMN mode TEXT NOT NULL DEFAULT 'SCHEDULED'
  CHECK (mode IN ('MANUAL', 'SCHEDULED'));
ALTER TABLE survey_campaigns ADD COLUMN closes_at TEXT;
ALTER TABLE survey_campaigns ADD COLUMN manual_open INTEGER NOT NULL DEFAULT 0
  CHECK (manual_open IN (0, 1));
ALTER TABLE survey_campaigns ADD COLUMN closed_at TEXT;

UPDATE survey_campaigns
SET slug = 'evaluasi-' || lower(hex(randomblob(12)))
WHERE slug IS NULL;

UPDATE survey_campaigns
SET mode = 'MANUAL', manual_open = 1
WHERE opened_manually_at IS NOT NULL;

CREATE UNIQUE INDEX uq_survey_campaigns_slug
  ON survey_campaigns(slug);

CREATE TABLE survey_campaign_cohorts (
  survey_campaign_id TEXT NOT NULL,
  cohort_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (survey_campaign_id, cohort_id),
  UNIQUE (cohort_id),
  FOREIGN KEY (survey_campaign_id) REFERENCES survey_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (cohort_id) REFERENCES training_cohorts(id) ON DELETE RESTRICT
) STRICT;

INSERT INTO survey_campaign_cohorts (survey_campaign_id, cohort_id)
SELECT id, cohort_id
FROM survey_campaigns;

CREATE INDEX idx_survey_campaign_cohorts_campaign
  ON survey_campaign_cohorts(survey_campaign_id);

CREATE INDEX idx_survey_campaign_cohorts_cohort
  ON survey_campaign_cohorts(cohort_id);

CREATE INDEX idx_survey_campaign_schedule
  ON survey_campaigns(mode, manual_open, opens_at, closes_at);
