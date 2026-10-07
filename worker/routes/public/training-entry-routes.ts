import { Hono } from "hono";
import { z } from "zod";
import { normalizeParticipantName } from "../../domain/participants/normalize-name";
import { normalizeNik } from "../../domain/participants/normalize-nik";
import { isTestOpen } from "../../domain/scheduling/test-availability";
import { isEvaluationOpen } from "../../domain/surveys/evaluation";
import { HttpError } from "../../http/errors";
import { findOrCreateExamParticipant, findRegisteredProfile, findPublicTraining, listParticipantAttempts, listPublicBatches } from "../../repositories/participant-repository";
import type { AppEnvironment } from "../../types";

const identifySchema = z.object({
  name: z.string().trim().min(2, "Nama lengkap wajib diisi.").max(150),
  nik: z.string().trim().min(3, "NIK wajib diisi.").max(40, "NIK maksimal 40 karakter.").regex(/^\d+$/u, "NIK hanya boleh berisi angka."),
  batchId: z.string().uuid("Angkatan tidak valid."),
});

export const trainingEntryRoutes = new Hono<AppEnvironment>();

function schedules(session: NonNullable<Awaited<ReturnType<typeof findPublicTraining>>>) {
  return {
    preOpen: session.status === "ACTIVE" && isTestOpen({ mode: session.pre_mode, manualOpen: session.pre_manual_open === 1, startAt: session.pre_start_at, endAt: session.pre_end_at }),
    postOpen: session.status === "ACTIVE" && isTestOpen({ mode: session.post_mode, manualOpen: session.post_manual_open === 1, startAt: session.post_start_at, endAt: session.post_end_at }),
  };
}

trainingEntryRoutes.get("/", async (context) => {
  const [result, evaluationResult] = await Promise.all([context.env.DB.prepare(
    `SELECT sessions.id, sessions.name, sessions.slug, sessions.question_count, sessions.duration_minutes,
            sessions.passing_score, sessions.training_start_date, sessions.training_end_date, sessions.status,
            sessions.pre_mode, sessions.pre_start_at, sessions.pre_end_at, sessions.pre_manual_open,
            sessions.post_mode, sessions.post_start_at, sessions.post_end_at, sessions.post_manual_open,
            sessions.training_id, sessions.material_id, materials.name AS material_name,
            trainings.name AS training_name, batches.id AS batch_id, batches.batch_name
       FROM training_sessions AS sessions
       JOIN batches ON batches.training_session_id = sessions.id
       LEFT JOIN training_materials AS materials ON materials.id = sessions.material_id
       LEFT JOIN trainings ON trainings.id = sessions.training_id
      WHERE sessions.status = 'ACTIVE'
      ORDER BY sessions.training_start_date DESC, sessions.name COLLATE NOCASE ASC`,
  ).all<NonNullable<Awaited<ReturnType<typeof findPublicTraining>>> & { batch_id: string; batch_name: string }>(),
  context.env.DB.prepare(
    `SELECT campaigns.id, campaigns.slug, campaigns.mode, campaigns.opens_at,
            campaigns.closes_at, campaigns.opened_manually_at, campaigns.manual_open,
            campaigns.closed_at, templates.name AS evaluation_name,
            trainings.name AS training_name,
            GROUP_CONCAT(cohorts.name, ' · ') AS cohort_names
       FROM survey_campaigns campaigns
       JOIN survey_templates templates ON templates.id = campaigns.survey_template_id
       JOIN survey_campaign_cohorts links ON links.survey_campaign_id = campaigns.id
       JOIN training_cohorts cohorts ON cohorts.id = links.cohort_id
       JOIN trainings ON trainings.id = cohorts.training_id
      WHERE templates.status IN ('PUBLISHED', 'ARCHIVED')
      GROUP BY campaigns.id
      ORDER BY campaigns.created_at DESC`,
  ).all<{
    id: string; slug: string; mode: "MANUAL" | "SCHEDULED"; opens_at: string | null;
    closes_at: string | null; opened_manually_at: string | null; manual_open: number;
    closed_at: string | null; evaluation_name: string; training_name: string; cohort_names: string;
  }>()]);
  const tests = result.results
    .map((session) => ({ session, availability: schedules(session) }))
    .filter(({ availability }) => availability.preOpen || availability.postOpen)
    .flatMap(({ session, availability }) => ([
      ...(availability.preOpen ? [{ id: `${session.id}-${session.batch_id}-PRE`, sessionId: session.id, slug: session.slug, trainingName: session.training_name ?? session.name, materialName: session.material_name ?? session.name, cohortName: session.batch_name, stage: "PRE" as const, closeAt: session.pre_end_at }] : []),
      ...(availability.postOpen ? [{ id: `${session.id}-${session.batch_id}-POST`, sessionId: session.id, slug: session.slug, trainingName: session.training_name ?? session.name, materialName: session.material_name ?? session.name, cohortName: session.batch_name, stage: "POST" as const, closeAt: session.post_end_at }] : []),
    ]));
  const evaluations = evaluationResult.results
    .filter((evaluation) => isEvaluationOpen({
      mode: evaluation.mode,
      manualOpen: evaluation.manual_open === 1,
      opensAt: evaluation.opens_at,
      closesAt: evaluation.closes_at,
      openedManuallyAt: evaluation.opened_manually_at,
      closedAt: evaluation.closed_at,
    }))
    .map((evaluation) => ({
      id: evaluation.id,
      slug: evaluation.slug,
      name: evaluation.evaluation_name,
      trainingName: evaluation.training_name,
      cohortNames: evaluation.cohort_names.split(" · "),
      closeAt: evaluation.mode === "SCHEDULED" ? evaluation.closes_at : null,
    }));
  return context.json({ tests, evaluations });
});

trainingEntryRoutes.get("/:slug", async (context) => {
  const session = await findPublicTraining(context.env.DB, context.req.param("slug"));
  if (!session) throw new HttpError(404, "TRAINING_NOT_FOUND", "Link pelatihan tidak ditemukan.");
  const batches = await listPublicBatches(context.env.DB, session.id);
  return context.json({
    training: { id: session.id, name: session.material_name ?? session.name, slug: session.slug, questionCount: session.question_count, durationMinutes: 15, startDate: session.training_start_date, endDate: session.training_end_date, status: session.status, ...schedules(session) },
    batches: batches.map((batch) => ({ id: batch.id, number: batch.batch_number, name: batch.batch_name })),
  });
});

trainingEntryRoutes.post("/:slug/identify", async (context) => {
  const parsed = identifySchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "PARTICIPANT_INVALID", parsed.error.issues[0]?.message ?? "Data peserta tidak valid.");
  const session = await findPublicTraining(context.env.DB, context.req.param("slug"));
  if (!session) throw new HttpError(404, "TRAINING_NOT_FOUND", "Link pelatihan tidak ditemukan.");
  if (session.status !== "ACTIVE") throw new HttpError(409, "TRAINING_UNAVAILABLE", "Pelatihan belum tersedia.");
  const batch = (await listPublicBatches(context.env.DB, session.id)).find((item) => item.id === parsed.data.batchId);
  if (!batch) throw new HttpError(422, "BATCH_INVALID", "Angkatan tidak ditemukan pada pelatihan ini.");

  const availability = schedules(session);
  const normalizedName = normalizeParticipantName(parsed.data.name);
  if(!session.training_id||!batch.cohort_id) throw new HttpError(409,"REGISTRATION_NOT_CONFIGURED","Data master pelatihan atau angkatan belum terhubung.");
  const profile=await findRegisteredProfile(context.env.DB,{trainingId:session.training_id,cohortId:batch.cohort_id,normalizedName,nik:normalizeNik(parsed.data.nik)});
  if(!profile) throw new HttpError(404,"PARTICIPANT_NOT_FOUND","Data peserta tidak ditemukan. Pastikan Nama Lengkap dan NIK sesuai dengan data yang didaftarkan panitia.");
  const participant=await findOrCreateExamParticipant(context.env.DB,{profileId:profile.id,batchId:batch.id,name:profile.name,normalizedName:profile.normalized_name});
  const attempts = await listParticipantAttempts(context.env.DB, participant.id);
  return context.json({
    participant: { id: participant.id, name: participant.name },
    batch: { id: batch.id, name: batch.batch_name },
    training: { id: session.id, name: session.material_name ?? session.name, questionCount: session.question_count, durationMinutes: 15, passingScore: session.passing_score },
    availability: { ...availability, attempts },
  });
});
