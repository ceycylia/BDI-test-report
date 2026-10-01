ALTER TABLE admins
ADD COLUMN role TEXT NOT NULL DEFAULT 'ADMIN'
CHECK (role IN ('SUPERADMIN', 'ADMIN'));

UPDATE admins
SET role = 'SUPERADMIN'
WHERE id = (
  SELECT id
  FROM admins
  ORDER BY created_at ASC, id ASC
  LIMIT 1
);

CREATE INDEX idx_admins_role_active ON admins(role, is_active);
