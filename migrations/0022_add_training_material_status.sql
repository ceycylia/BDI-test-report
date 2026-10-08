-- Mata diklat lama tetap aktif; status hanya memengaruhi persyaratan penyelesaian.
ALTER TABLE training_materials
  ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_training_materials_training_active_sort
  ON training_materials(training_id, is_active, sort_order);
