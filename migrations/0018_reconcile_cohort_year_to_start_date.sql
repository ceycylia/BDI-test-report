-- Rekonsiliasi forward-only untuk database yang pernah menjalankan versi awal
-- 0011_allow_repeating_cohorts_by_year.sql, ketika index tahun masih memakai
-- training_cohorts.created_at.
--
-- Pada database baru, migration 0011 sudah memakai start_date. Menjalankan
-- migration ini tetap aman karena index yang sama hanya dibuat ulang dengan
-- definisi authoritative yang konsisten dengan fitur Tahun Aktif.

DROP INDEX IF EXISTS uq_training_cohorts_name_year;
DROP INDEX IF EXISTS idx_training_cohorts_year;

CREATE UNIQUE INDEX uq_training_cohorts_name_year
ON training_cohorts (
  training_id,
  name,
  substr(start_date, 1, 4)
);

CREATE INDEX idx_training_cohorts_year
ON training_cohorts (
  substr(start_date, 1, 4)
);
