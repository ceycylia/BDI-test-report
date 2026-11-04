-- Sumber pembiayaan disimpan satu kali pada Angkatan. Seluruh data
-- operasional mengikuti Angkatan melalui relasi yang sudah ada.
ALTER TABLE training_cohorts
ADD COLUMN funding_source TEXT NOT NULL DEFAULT 'RUPIAH_MURNI'
  CHECK (funding_source IN ('RUPIAH_MURNI', 'PNBP'));

-- Data lama otomatis menjadi Rupiah Murni melalui DEFAULT di atas.
UPDATE training_cohorts
SET funding_source = 'RUPIAH_MURNI'
WHERE funding_source IS NULL OR funding_source NOT IN ('RUPIAH_MURNI', 'PNBP');

DROP INDEX IF EXISTS uq_training_cohorts_name_year;

-- Nama Angkatan boleh sama pada pelatihan dan tahun yang sama selama
-- sumber pembiayaannya berbeda.
CREATE UNIQUE INDEX uq_training_cohorts_name_year_funding
ON training_cohorts (
  training_id,
  name,
  substr(start_date, 1, 4),
  funding_source
);

CREATE INDEX idx_training_cohorts_funding_year
ON training_cohorts (
  funding_source,
  substr(start_date, 1, 4),
  training_id
);
