import { Hono } from "hono";
import { z } from "zod";
import { activeFundingSource, requireCohortInFundingSource } from "../../domain/funding-source";
import { HttpError } from "../../http/errors";
import { requireAdmin, requireCsrf, requireSameOrigin } from "../../middleware/admin-auth";
import type { AppEnvironment } from "../../types";

export const participantLinkRoutes = new Hono<AppEnvironment>();
participantLinkRoutes.use("*", requireAdmin);

const createSchema = z.object({
  trainingId: z.string().uuid(),
  cohortId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
});

type LinkRow = {
  id: string; token: string; cohort_id: string; cohort_name: string;
  training_id: string; training_name: string; start_date: string;
};

const linkSelect = `SELECT links.id, links.token, cohorts.id AS cohort_id, cohorts.name AS cohort_name,
  trainings.id AS training_id, trainings.name AS training_name, cohorts.start_date
  FROM participant_registration_links links
  JOIN training_cohorts cohorts ON cohorts.id=links.cohort_id
  JOIN trainings ON trainings.id=cohorts.training_id`;

participantLinkRoutes.get("/", async (context) => {
  const year = context.req.query("year");
  if (!year || !/^\d{4}$/u.test(year)) throw new HttpError(422, "YEAR_INVALID", "Tahun aktif tidak valid.");
  const result = await context.env.DB.prepare(
    `${linkSelect} WHERE links.revoked_at IS NULL AND cohorts.funding_source=?
     AND SUBSTR(cohorts.start_date,1,4)=? ORDER BY trainings.name COLLATE NOCASE, cohorts.name COLLATE NOCASE`,
  ).bind(activeFundingSource(context), year).all<LinkRow>();
  return context.json({ links: result.results });
});

participantLinkRoutes.post("/", requireSameOrigin, requireCsrf, async (context) => {
  const parsed = createSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "LINK_INVALID", "Pilih satu pelatihan dan angkatan yang valid.");
  const { trainingId, cohortId, year } = parsed.data;
  const cohort = await requireCohortInFundingSource(context.env.DB, cohortId, activeFundingSource(context));
  if (cohort.training_id !== trainingId || cohort.start_date.slice(0, 4) !== String(year)) {
    throw new HttpError(422, "COHORT_INVALID", "Angkatan tidak sesuai dengan pelatihan dan tahun aktif.");
  }
  const existing = await context.env.DB.prepare(`${linkSelect} WHERE links.cohort_id=? AND links.revoked_at IS NULL LIMIT 1`)
    .bind(cohortId).first<LinkRow>();
  if (existing) return context.json({ link: existing, reused: true });
  try {
    await context.env.DB.prepare("INSERT INTO participant_registration_links(id,cohort_id,token) VALUES(?,?,?)")
      .bind(crypto.randomUUID(), cohortId, crypto.randomUUID()).run();
  } catch (error) {
    if (!String(error).includes("UNIQUE")) throw error;
  }
  const link = await context.env.DB.prepare(`${linkSelect} WHERE links.cohort_id=? AND links.revoked_at IS NULL LIMIT 1`)
    .bind(cohortId).first<LinkRow>();
  if (!link) throw new HttpError(500, "LINK_CREATE_FAILED", "Link peserta tidak dapat dibuat.");
  return context.json({ link, reused: false }, 201);
});

participantLinkRoutes.delete("/:id", requireSameOrigin, requireCsrf, async (context) => {
  const year = context.req.query("year");
  if (!year || !/^\d{4}$/u.test(year)) throw new HttpError(422, "YEAR_INVALID", "Tahun aktif tidak valid.");
  const result = await context.env.DB.prepare(
    `UPDATE participant_registration_links SET revoked_at=CURRENT_TIMESTAMP
     WHERE id=? AND revoked_at IS NULL AND cohort_id IN (
       SELECT id FROM training_cohorts WHERE funding_source=? AND SUBSTR(start_date,1,4)=?
     )`,
  ).bind(context.req.param("id"), activeFundingSource(context), year).run();
  if (!result.meta.changes) throw new HttpError(404, "LINK_NOT_FOUND", "Link peserta tidak ditemukan atau sudah dihapus.");
  return context.json({ ok: true });
});
