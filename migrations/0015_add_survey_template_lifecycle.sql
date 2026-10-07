-- =========================================================
-- 0015_add_survey_template_lifecycle.sql
--
-- Menambahkan lifecycle template Survey:
--
-- DRAFT
--   Bisa diedit Admin.
--
-- PUBLISHED
--   Sudah siap digunakan.
--   Tidak diedit langsung.
--
-- ARCHIVED
--   Versi lama yang tidak digunakan untuk campaign baru.
--
-- Jika ingin mengubah template PUBLISHED,
-- sistem nantinya membuat versi DRAFT baru.
-- =========================================================


-- Status template
ALTER TABLE survey_templates
ADD COLUMN status TEXT NOT NULL DEFAULT 'DRAFT'
CHECK (
  status IN (
    'DRAFT',
    'PUBLISHED',
    'ARCHIVED'
  )
);


-- Waktu template dipublikasikan.
ALTER TABLE survey_templates
ADD COLUMN published_at TEXT;


-- Menyimpan asal template jika versi baru
-- merupakan salinan dari versi sebelumnya.
--
-- Contoh:
--
-- V1 -> source_template_id = NULL
-- V2 -> source_template_id = V1.id
-- V3 -> source_template_id = V2.id
ALTER TABLE survey_templates
ADD COLUMN source_template_id TEXT
REFERENCES survey_templates(id)
ON DELETE SET NULL;


-- Mempercepat pencarian template berdasarkan lifecycle.
CREATE INDEX idx_survey_templates_status
ON survey_templates(status, is_active);


-- Mempermudah tracking hubungan antar versi.
CREATE INDEX idx_survey_templates_source
ON survey_templates(source_template_id);
