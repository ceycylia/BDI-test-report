import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { HttpError } from "../http/errors";
import {
  deleteAdminSession,
  findAdminSession,
  touchAdminSession,
} from "../repositories/admin-repository";
import {
  ADMIN_CSRF_COOKIE,
  readAdminSessionToken,
} from "../security/admin-session";
import { constantTimeEqual, sha256 } from "../security/encoding";
import type { AppEnvironment } from "../types";

export const requireAdmin: MiddlewareHandler<AppEnvironment> = async (
  context,
  next,
) => {
  const rawToken = readAdminSessionToken(context);

  if (!rawToken) {
    throw new HttpError(401, "ADMIN_AUTH_REQUIRED", "Silakan masuk sebagai admin.");
  }

  const session = await findAdminSession(context.env.DB, await sha256(rawToken));

  if (!session) {
    throw new HttpError(401, "ADMIN_SESSION_INVALID", "Sesi admin tidak valid atau sudah berakhir.");
  }

  context.set("admin", {
    id: session.admin_id,
    name: session.admin_name,
    username: session.admin_username,
    role: session.admin_role,
    isActive: session.admin_is_active === 1,
  });
  context.set("adminSession", {
    id: session.session_id,
    csrfTokenHash: session.csrf_token_hash,
    expiresAt: session.expires_at,
  });

  await touchAdminSession(context.env.DB, session.session_id);
  await next();
};

export const requireSuperadmin: MiddlewareHandler<AppEnvironment> = async (
  context,
  next,
) => {
  if (context.get("admin").role !== "SUPERADMIN") {
    throw new HttpError(403, "SUPERADMIN_REQUIRED", "Akses ini hanya tersedia untuk Superadmin.");
  }
  await next();
};

export const requireSameOrigin: MiddlewareHandler<AppEnvironment> = async (
  context,
  next,
) => {
  const origin = context.req.header("Origin");
  const requestOrigin = new URL(context.req.url).origin;

  if (!origin || origin !== requestOrigin) {
    throw new HttpError(403, "ORIGIN_REJECTED", "Permintaan ditolak karena sumber tidak valid.");
  }

  await next();
};

export const requireCsrf: MiddlewareHandler<AppEnvironment> = async (
  context,
  next,
) => {
  const csrfHeader = context.req.header("X-CSRF-Token");
  const csrfCookie = getCookie(context, ADMIN_CSRF_COOKIE);
  const session = context.get("adminSession");

  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    throw new HttpError(403, "CSRF_REJECTED", "Token keamanan tidak valid.");
  }

  const actualHash = await sha256(csrfHeader);
  const expectedBytes = new TextEncoder().encode(session.csrfTokenHash);
  const actualBytes = new TextEncoder().encode(actualHash);

  if (!constantTimeEqual(actualBytes, expectedBytes)) {
    throw new HttpError(403, "CSRF_REJECTED", "Token keamanan tidak valid.");
  }

  await next();
};

export async function revokeCurrentSession(
  database: D1Database,
  sessionId: string,
): Promise<void> {
  await deleteAdminSession(database, sessionId);
}
