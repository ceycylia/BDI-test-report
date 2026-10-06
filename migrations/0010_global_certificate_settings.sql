CREATE TABLE global_certificate_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  certificate_prefix TEXT NOT NULL DEFAULT '',
  signer_name TEXT NOT NULL DEFAULT '',
  signer_title TEXT NOT NULL DEFAULT '',
  signer_nip TEXT NOT NULL DEFAULT '',
  issue_place TEXT NOT NULL DEFAULT '',
  issue_date TEXT NOT NULL DEFAULT '',
  offset_x_mm REAL NOT NULL DEFAULT 0,
  offset_y_mm REAL NOT NULL DEFAULT 0,
  signature_key TEXT,
  stamp_key TEXT,
  front_template_key TEXT,
  back_template_key TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

INSERT INTO global_certificate_settings (
  id,
  certificate_prefix,
  signer_name,
  signer_title,
  signer_nip,
  issue_place,
  issue_date,
  offset_x_mm,
  offset_y_mm,
  signature_key,
  stamp_key,
  front_template_key,
  back_template_key,
  updated_at
)
SELECT
  1,
  certificate_prefix,
  signer_name,
  signer_title,
  signer_nip,
  issue_place,
  issue_date,
  offset_x_mm,
  offset_y_mm,
  signature_key,
  stamp_key,
  front_template_key,
  back_template_key,
  updated_at
FROM certificate_settings
ORDER BY updated_at DESC
LIMIT 1;

INSERT OR IGNORE INTO global_certificate_settings (id) VALUES (1);
