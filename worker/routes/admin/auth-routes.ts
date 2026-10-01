import { Hono } from "hono";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { requireAdmin, requireCsrf, requireSameOrigin, revokeCurrentSession } from "../../middleware/admin-auth";
import {
  createAdminSession,
  findAdminById,
  findAdminByUsername,
  updateAdminPassword,
  updateOwnProfile,
} from "../../repositories/admin-repository";
import {
  ADMIN_SESSION_SECONDS,
  clearAdminCookies,
  setAdminCookies,
} from "../../security/admin-session";
import { randomToken, sha256 } from "../../security/encoding";
import { hashPassword, verifyPassword } from "../../security/password";
import type { AppEnvironment } from "../../types";

const loginSchema = z.object({
  username: z.string().trim().min(3).max(80).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

const accountSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
  username: z.string().trim().min(3, "Username minimal 3 karakter.").max(80)
    .regex(/^[a-zA-Z0-9._-]+$/u, "Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.")
    .transform((value) => value.toLowerCase()),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi.").max(128),
  newPassword: z.string().min(12, "Password baru minimal 12 karakter.").max(128),
});

export const authRoutes = new Hono<AppEnvironment>();

authRoutes.post("/login", requireSameOrigin, async (context) => {
  const parsed = loginSchema.safeParse(await context.req.json().catch(() => null));

  if (!parsed.success) {
    throw new HttpError(422, "LOGIN_INVALID", "Username dan password wajib diisi.");
  }

  const admin = await findAdminByUsername(context.env.DB, parsed.data.username);
  const validPassword = admin
    ? await verifyPassword(parsed.data.password, {
        hash: admin.password_hash,
        salt: admin.password_salt,
        iterations: admin.password_iterations,
      })
    : false;

  if (!admin || admin.is_active !== 1 || !validPassword) {
    throw new HttpError(401, "LOGIN_FAILED", "Username atau password tidak sesuai.");
  }

  const sessionToken = randomToken();
  const csrfToken = randomToken();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_SECONDS * 1000).toISOString();

  await createAdminSession(context.env.DB, {
    id: crypto.randomUUID(),
    adminId: admin.id,
    tokenHash: await sha256(sessionToken),
    csrfTokenHash: await sha256(csrfToken),
    expiresAt,
  });
  setAdminCookies(context, sessionToken, csrfToken);
  context.header("Cache-Control", "no-store");

  return context.json({
    admin: {
      id: admin.id,
      name: admin.name,
      username: admin.username,
      role: admin.role,
      isActive: admin.is_active === 1,
    },
  });
});

authRoutes.patch("/account", requireAdmin, requireSameOrigin, requireCsrf, async (context) => {
  const parsed = accountSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) {
    throw new HttpError(422, "ACCOUNT_INVALID", parsed.error.issues[0]?.message ?? "Data akun tidak valid.");
  }
  const duplicate = await findAdminByUsername(context.env.DB, parsed.data.username);
  if (duplicate && duplicate.id !== context.get("admin").id) {
    throw new HttpError(409, "ADMIN_USERNAME_EXISTS", "Username sudah digunakan.");
  }
  await updateOwnProfile(context.env.DB, { id: context.get("admin").id, ...parsed.data });
  return context.json({ admin: { ...context.get("admin"), ...parsed.data } });
});

authRoutes.patch("/account/password", requireAdmin, requireSameOrigin, requireCsrf, async (context) => {
  const parsed = passwordSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) {
    throw new HttpError(422, "PASSWORD_INVALID", parsed.error.issues[0]?.message ?? "Password tidak valid.");
  }
  const admin = await findAdminById(context.env.DB, context.get("admin").id);
  if (!admin || !(await verifyPassword(parsed.data.currentPassword, {
    hash: admin.password_hash,
    salt: admin.password_salt,
    iterations: admin.password_iterations,
  }))) {
    throw new HttpError(403, "CURRENT_PASSWORD_INVALID", "Password saat ini tidak sesuai.");
  }
  const password = await hashPassword(parsed.data.newPassword);
  await updateAdminPassword(context.env.DB, {
    id: admin.id,
    hash: password.hash,
    salt: password.salt,
    iterations: password.iterations,
  });
  return context.json({ success: true });
});

authRoutes.get("/me", requireAdmin, (context) => {
  context.header("Cache-Control", "no-store");
  return context.json({ admin: context.get("admin") });
});

authRoutes.post(
  "/logout",
  requireAdmin,
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    await revokeCurrentSession(context.env.DB, context.get("adminSession").id);
    clearAdminCookies(context);
    context.header("Cache-Control", "no-store");
    return context.json({ success: true });
  },
);
