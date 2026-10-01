import { Hono } from "hono";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { requireAdmin, requireCsrf, requireSameOrigin, requireSuperadmin } from "../../middleware/admin-auth";
import {
  createAdmin,
  countActiveSuperadmins,
  findAdminById,
  findAdminByUsername,
  listAdmins,
  updateAdminPassword,
  updateManagedAdmin,
} from "../../repositories/admin-repository";
import { hashPassword } from "../../security/password";
import type { AppEnvironment } from "../../types";

const createAdminSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(80)
    .regex(/^[a-zA-Z0-9._-]+$/u, "Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(12, "Password minimal 12 karakter.")
    .max(128),
  role: z.enum(["SUPERADMIN", "ADMIN"]).default("ADMIN"),
});

const updateAdminSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(80)
    .regex(/^[a-zA-Z0-9._-]+$/u, "Username tidak valid.")
    .transform((value) => value.toLowerCase()),
  role: z.enum(["SUPERADMIN", "ADMIN"]),
  isActive: z.boolean(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(12, "Password minimal 12 karakter.").max(128),
});

export const adminRoutes = new Hono<AppEnvironment>();

adminRoutes.use("*", requireAdmin);
adminRoutes.use("*", requireSuperadmin);

adminRoutes.get("/", async (context) => {
  const admins = await listAdmins(context.env.DB);
  context.header("Cache-Control", "no-store");
  return context.json({
    admins: admins.map((admin) => ({
      id: admin.id,
      name: admin.name,
      username: admin.username,
      isActive: admin.is_active === 1,
      role: admin.role,
      createdAt: admin.created_at,
    })),
  });
});

adminRoutes.post("/", requireSameOrigin, requireCsrf, async (context) => {
  const parsed = createAdminSchema.safeParse(await context.req.json().catch(() => null));

  if (!parsed.success) {
    throw new HttpError(
      422,
      "ADMIN_INVALID",
      parsed.error.issues[0]?.message ?? "Data admin tidak valid.",
    );
  }

  if (await findAdminByUsername(context.env.DB, parsed.data.username)) {
    throw new HttpError(409, "ADMIN_USERNAME_EXISTS", "Username sudah digunakan.");
  }

  const password = await hashPassword(parsed.data.password);
  const adminId = crypto.randomUUID();

  await createAdmin(context.env.DB, {
    id: adminId,
    name: parsed.data.name,
    username: parsed.data.username,
    passwordHash: password.hash,
    passwordSalt: password.salt,
    passwordIterations: password.iterations,
    role: parsed.data.role,
  });

  return context.json(
    {
      admin: {
        id: adminId,
        name: parsed.data.name,
        username: parsed.data.username,
        isActive: true,
        role: parsed.data.role,
      },
    },
    201,
  );
});

adminRoutes.patch("/:adminId", requireSameOrigin, requireCsrf, async (context) => {
  const parsed = updateAdminSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "ADMIN_INVALID", parsed.error.issues[0]?.message ?? "Data admin tidak valid.");
  const target = await findAdminById(context.env.DB, context.req.param("adminId"));
  if (!target) throw new HttpError(404, "ADMIN_NOT_FOUND", "Admin tidak ditemukan.");
  const duplicate = await findAdminByUsername(context.env.DB, parsed.data.username);
  if (duplicate && duplicate.id !== target.id) throw new HttpError(409, "ADMIN_USERNAME_EXISTS", "Username sudah digunakan.");
  if (target.id === context.get("admin").id && !parsed.data.isActive) {
    throw new HttpError(409, "ADMIN_SELF_DISABLE", "Akun yang sedang digunakan tidak dapat dinonaktifkan.");
  }
  if (target.role === "SUPERADMIN" && target.is_active === 1 && (parsed.data.role !== "SUPERADMIN" || !parsed.data.isActive) && await countActiveSuperadmins(context.env.DB) <= 1) {
    throw new HttpError(409, "LAST_SUPERADMIN", "Minimal satu Superadmin aktif harus dipertahankan.");
  }
  await updateManagedAdmin(context.env.DB, { id: target.id, ...parsed.data });
  return context.json({ admin: { id: target.id, ...parsed.data } });
});

adminRoutes.patch("/:adminId/password", requireSameOrigin, requireCsrf, async (context) => {
  const parsed = resetPasswordSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "PASSWORD_INVALID", parsed.error.issues[0]?.message ?? "Password tidak valid.");
  const target = await findAdminById(context.env.DB, context.req.param("adminId"));
  if (!target) throw new HttpError(404, "ADMIN_NOT_FOUND", "Admin tidak ditemukan.");
  const password = await hashPassword(parsed.data.password);
  await updateAdminPassword(context.env.DB, { id: target.id, hash: password.hash, salt: password.salt, iterations: password.iterations });
  return context.json({ success: true });
});
