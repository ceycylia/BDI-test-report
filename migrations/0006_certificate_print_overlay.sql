ALTER TABLE certificate_settings ADD COLUMN issue_place TEXT NOT NULL DEFAULT '';
ALTER TABLE certificate_settings ADD COLUMN offset_x_mm REAL NOT NULL DEFAULT 0;
ALTER TABLE certificate_settings ADD COLUMN offset_y_mm REAL NOT NULL DEFAULT 0;
ALTER TABLE certificate_settings ADD COLUMN front_template_key TEXT;
ALTER TABLE certificate_settings ADD COLUMN back_template_key TEXT;

ALTER TABLE certificates ADD COLUMN back_pdf_key TEXT;
