export type AdminRecord = {
  id: string;
  name: string;
  username: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  is_active: number;
  role: "SUPERADMIN" | "ADMIN";
  created_at: string;
};

type SessionWithAdminRecord = {
  session_id: string;
  csrf_token_hash: string;
  expires_at: string;
  admin_id: string;
  admin_name: string;
  admin_username: string;
  admin_role: "SUPERADMIN" | "ADMIN";
  admin_is_active: number;
};

export async function findAdminByUsername(
  database: D1Database,
  username: string,
): Promise<AdminRecord | null> {
  return database
    .prepare(
      `SELECT id, name, username, password_hash, password_salt,
              password_iterations, is_active, role, created_at
         FROM admins
        WHERE username = ? COLLATE NOCASE
        LIMIT 1`,
    )
    .bind(username)
    .first<AdminRecord>();
}

export async function findAdminById(
  database: D1Database,
  id: string,
): Promise<AdminRecord | null> {
  return database.prepare(
    `SELECT id, name, username, password_hash, password_salt,
            password_iterations, is_active, role, created_at
       FROM admins WHERE id = ? LIMIT 1`,
  ).bind(id).first<AdminRecord>();
}

export async function createAdmin(
  database: D1Database,
  input: {
    id: string;
    name: string;
    username: string;
    passwordHash: string;
    passwordSalt: string;
    passwordIterations: number;
    role?: "SUPERADMIN" | "ADMIN";
  },
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO admins (
         id, name, username, password_hash, password_salt, password_iterations, role
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.name,
      input.username,
      input.passwordHash,
      input.passwordSalt,
      input.passwordIterations,
      input.role ?? "ADMIN",
    )
    .run();
}

export async function listAdmins(database: D1Database): Promise<AdminRecord[]> {
  const result = await database
    .prepare(
      `SELECT id, name, username, password_hash, password_salt,
              password_iterations, is_active, role, created_at
         FROM admins
        ORDER BY created_at DESC, rowid DESC`,
    )
    .all<AdminRecord>();

  return result.results;
}

export async function createAdminSession(
  database: D1Database,
  input: {
    id: string;
    adminId: string;
    tokenHash: string;
    csrfTokenHash: string;
    expiresAt: string;
  },
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO admin_sessions (
         id, admin_id, token_hash, csrf_token_hash, expires_at
       ) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.adminId,
      input.tokenHash,
      input.csrfTokenHash,
      input.expiresAt,
    )
    .run();
}

export async function findAdminSession(
  database: D1Database,
  tokenHash: string,
): Promise<SessionWithAdminRecord | null> {
  return database
    .prepare(
      `SELECT sessions.id AS session_id,
              sessions.csrf_token_hash,
              sessions.expires_at,
              admins.id AS admin_id,
              admins.name AS admin_name,
              admins.username AS admin_username
              ,admins.role AS admin_role
              ,admins.is_active AS admin_is_active
         FROM admin_sessions AS sessions
         JOIN admins ON admins.id = sessions.admin_id
        WHERE sessions.token_hash = ?
          AND sessions.expires_at > CURRENT_TIMESTAMP
          AND admins.is_active = 1
        LIMIT 1`,
    )
    .bind(tokenHash)
    .first<SessionWithAdminRecord>();
}

export async function updateOwnProfile(
  database: D1Database,
  input: { id: string; name: string; username: string },
): Promise<void> {
  await database.prepare(
    `UPDATE admins SET name = ?, username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).bind(input.name, input.username, input.id).run();
}

export async function updateAdminPassword(
  database: D1Database,
  input: { id: string; hash: string; salt: string; iterations: number },
): Promise<void> {
  await database.prepare(
    `UPDATE admins
        SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
  ).bind(input.hash, input.salt, input.iterations, input.id).run();
}

export async function updateManagedAdmin(
  database: D1Database,
  input: {
    id: string;
    name: string;
    username: string;
    role: "SUPERADMIN" | "ADMIN";
    isActive: boolean;
  },
): Promise<void> {
  await database.prepare(
    `UPDATE admins
        SET name = ?, username = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
  ).bind(input.name, input.username, input.role, input.isActive ? 1 : 0, input.id).run();
}

export async function countActiveSuperadmins(database: D1Database): Promise<number> {
  const row = await database.prepare(
    `SELECT COUNT(*) AS count FROM admins WHERE role = 'SUPERADMIN' AND is_active = 1`,
  ).first<{ count: number }>();
  return row?.count ?? 0;
}

export async function touchAdminSession(
  database: D1Database,
  sessionId: string,
): Promise<void> {
  await database
    .prepare(
      `UPDATE admin_sessions
          SET last_seen_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
    )
    .bind(sessionId)
    .run();
}

export async function deleteAdminSession(
  database: D1Database,
  sessionId: string,
): Promise<void> {
  await database
    .prepare("DELETE FROM admin_sessions WHERE id = ?")
    .bind(sessionId)
    .run();
}
