PRAGMA defer_foreign_keys = ON;

-- =========================================================
-- Memungkinkan nama angkatan yang sama digunakan kembali
-- pada tahun berikutnya.
--
-- Contoh:
-- 2026 -> Angkatan 1
-- 2027 -> Angkatan 1
--
-- Tahun diambil dari start_date, tidak disimpan pada
-- kolom khusus.
-- =========================================================


-- 1. Buat ulang tabel training_cohorts tanpa
--    UNIQUE (training_id, name)
CREATE TABLE training_cohorts_new (
  id TEXT PRIMARY KEY,
  training_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (
      status IN ('ACTIVE', 'INACTIVE', 'COMPLETED')
    ),

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CHECK (end_date >= start_date),

  FOREIGN KEY (training_id)
    REFERENCES trainings(id)
    ON DELETE RESTRICT
) STRICT;


-- 2. Pindahkan seluruh data angkatan lama.
--    ID tetap dipertahankan.
INSERT INTO training_cohorts_new (
  id,
  training_id,
  name,
  start_date,
  end_date,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  training_id,
  name,
  start_date,
  end_date,
  status,
  created_at,
  updated_at
FROM training_cohorts;


-- 3. Ganti tabel lama
DROP TABLE training_cohorts;

ALTER TABLE training_cohorts_new
RENAME TO training_cohorts;


-- 4. Angkatan harus unik dalam:
--    Pelatihan + Nama Angkatan + Tahun
CREATE UNIQUE INDEX uq_training_cohorts_name_year
ON training_cohorts (
  training_id,
  name,
  substr(start_date, 1, 4)
);


-- 5. Index pencarian berdasarkan pelatihan
CREATE INDEX idx_training_cohorts_training
ON training_cohorts(training_id);


-- 6. Index filter tahun
CREATE INDEX idx_training_cohorts_year
ON training_cohorts(
  substr(start_date, 1, 4)
);


PRAGMA defer_foreign_keys = OFF;
