import { Hono } from "hono";
import { z } from "zod";
import { cleanParticipantName, normalizeParticipantName } from "../../domain/participants/normalize-name";
import { normalizeNik } from "../../domain/participants/normalize-nik";
import { isTestOpen } from "../../domain/scheduling/test-availability";
import { HttpError } from "../../http/errors";
import { requireSameOrigin } from "../../middleware/admin-auth";
import type { AppEnvironment } from "../../types";

export const participantPortalRoutes = new Hono<AppEnvironment>();

const identitySchema = z.object({
  name: z.string().trim().min(2).max(150),
  nik: z.string().trim().min(3).max(40).regex(/^\d+$/u),
});
const registrationSchema = z.object({
  name: z.string().trim().min(2).max(150),
  nik: z.string().trim().min(3).max(40).regex(/^\d+$/u),
  birthPlace: z.string().trim().max(120).default(""),
  birthDate: z.union([z.literal(""), z.string().date()]).default(""),
  address: z.string().trim().max(500).default(""),
});

type RegistrationContext = {
  cohort_id: string; cohort_name: string; training_id: string; training_name: string;
};

async function registrationContext(database: D1Database, token: string) {
  const row = await database.prepare(
    `SELECT cohorts.id AS cohort_id, cohorts.name AS cohort_name,
            trainings.id AS training_id, trainings.name AS training_name
     FROM participant_registration_links links
     JOIN training_cohorts cohorts ON cohorts.id=links.cohort_id
     JOIN trainings ON trainings.id=cohorts.training_id
     WHERE links.token=? AND links.revoked_at IS NULL AND trainings.is_deleted=0 LIMIT 1`,
  ).bind(token).first<RegistrationContext>();
  if (!row) throw new HttpError(404, "REGISTRATION_LINK_INACTIVE", "Link pendaftaran tidak ditemukan atau sudah tidak berlaku.");
  return row;
}

participantPortalRoutes.get("/catalog", async (context) => {
  const cohorts = await context.env.DB.prepare(
    `SELECT cohorts.id, cohorts.training_id, cohorts.name, cohorts.funding_source,
            trainings.name AS training_name
     FROM training_cohorts cohorts JOIN trainings ON trainings.id=cohorts.training_id
     WHERE trainings.is_deleted=0
     ORDER BY trainings.name COLLATE NOCASE, cohorts.start_date DESC, cohorts.name COLLATE NOCASE`,
  ).all<{ id: string; training_id: string; name: string; funding_source: string; training_name: string }>();
  return context.json({ cohorts: cohorts.results });
});

participantPortalRoutes.get("/registrations", async (context) => {
  const links = await context.env.DB.prepare(
    `SELECT links.id, links.token, trainings.name AS training_name, cohorts.name AS cohort_name
     FROM participant_registration_links links
     JOIN training_cohorts cohorts ON cohorts.id=links.cohort_id
     JOIN trainings ON trainings.id=cohorts.training_id
     WHERE links.revoked_at IS NULL AND trainings.is_deleted=0
     ORDER BY trainings.name COLLATE NOCASE, cohorts.name COLLATE NOCASE`,
  ).all<{ id: string; token: string; training_name: string; cohort_name: string }>();
  return context.json({ registrations: links.results });
});

participantPortalRoutes.get("/registration/:token", async (context) => {
  return context.json({ registration: await registrationContext(context.env.DB, context.req.param("token")) });
});

participantPortalRoutes.post("/registration/:token", requireSameOrigin, async (context) => {
  const form = await context.req.formData();
  const parsed = registrationSchema.safeParse({
    name: form.get("name"), nik: form.get("nik"), birthPlace: form.get("birthPlace") ?? "",
    birthDate: form.get("birthDate") ?? "", address: form.get("address") ?? "",
  });
  if (!parsed.success) throw new HttpError(422, "PARTICIPANT_INVALID", parsed.error.issues[0]?.message ?? "Data peserta tidak valid.");
  const photo = form.get("photo");
  const photoTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  if (photo instanceof File && photo.size && (!photoTypes[photo.type] || photo.size > 5_000_000)) {
    throw new HttpError(422, "PHOTO_INVALID", "Foto harus berupa JPG, PNG, atau WebP maksimal 5 MB.");
  }
  const registration = await registrationContext(context.env.DB, context.req.param("token"));
  const data = parsed.data;
  const nik = normalizeNik(data.nik);
  // The token is checked again in the mutation itself, so revocation before
  // this statement cannot enroll a new participant.
  const result = await context.env.DB.prepare(
    `INSERT INTO participant_profiles
       (id,training_id,cohort_id,name,normalized_name,nik,birth_place,birth_date,address,is_active)
     SELECT ?,cohorts.training_id,cohorts.id,?,?,?,?,?,?,1
     FROM participant_registration_links links
     JOIN training_cohorts cohorts ON cohorts.id=links.cohort_id
     WHERE links.token=? AND links.revoked_at IS NULL AND cohorts.id=?
     ON CONFLICT(cohort_id,nik) DO UPDATE SET
       birth_place=CASE WHEN participant_profiles.birth_place='' THEN excluded.birth_place ELSE participant_profiles.birth_place END,
       birth_date=CASE WHEN participant_profiles.birth_date='' THEN excluded.birth_date ELSE participant_profiles.birth_date END,
       address=CASE WHEN COALESCE(participant_profiles.address,'')='' THEN excluded.address ELSE participant_profiles.address END,
       updated_at=CURRENT_TIMESTAMP
     WHERE participant_profiles.is_active=1`,
  ).bind(
    crypto.randomUUID(), cleanParticipantName(data.name), normalizeParticipantName(data.name), nik,
    data.birthPlace, data.birthDate, data.address, context.req.param("token"), registration.cohort_id,
  ).run();
  if (!result.meta.changes) throw new HttpError(409, "REGISTRATION_UNAVAILABLE", "Pendaftaran tidak tersedia untuk NIK ini atau link sudah tidak berlaku.");
  const profile = await context.env.DB.prepare(
    `SELECT id,name,photo_key FROM participant_profiles WHERE cohort_id=? AND nik=? AND is_active=1 LIMIT 1`,
  ).bind(registration.cohort_id, nik).first<{ id: string; name: string; photo_key: string | null }>();
  if (!profile) throw new HttpError(500, "REGISTRATION_FAILED", "Data peserta tidak dapat dimuat setelah pendaftaran.");
  if (photo instanceof File && photo.size && !profile.photo_key) {
    const key = `participants/${profile.id}/${crypto.randomUUID()}.${photoTypes[photo.type]}`;
    await context.env.QUESTION_IMAGES.put(key, await photo.arrayBuffer(), { httpMetadata: { contentType: photo.type } });
    const updated = await context.env.DB.prepare(
      `UPDATE participant_profiles SET photo_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND photo_key IS NULL`,
    ).bind(key, profile.id).run();
    if (!updated.meta.changes) await context.env.QUESTION_IMAGES.delete(key);
  }
  return context.json({ participant: { id: profile.id, name: profile.name, nik }, registration });
});

type DashboardRow = {
  profile_id: string; profile_name: string; nik: string;
  training_id: string; training_name: string; cohort_id: string; cohort_name: string;
  session_id: string | null; slug: string | null; session_name: string | null;
  material_name: string | null; batch_id: string | null; participant_id: string | null;
  question_count: number | null; duration_minutes: number | null; passing_score: number | null; status: string | null;
  pre_mode: "MANUAL" | "SCHEDULED"; pre_start_at: string | null; pre_end_at: string | null; pre_manual_open: number;
  post_mode: "MANUAL" | "SCHEDULED"; post_start_at: string | null; post_end_at: string | null; post_manual_open: number;
  attempt_stage: string | null;
  attempt_status: string | null; attempt_score: number | null;
};

type DashboardTestPayload = {
  sessionId: string; slug: string; materialName: string; profileId: string;
  participantId: string | null; batchId: string; questionCount: number;
  durationMinutes: number; passingScore: number;
  attempts: Array<{ stage: "PRE" | "POST" | "REMEDIAL_1" | "REMEDIAL_2"; status: string; score: number | null }>;
  preOpen: boolean; postOpen: boolean; postMode: "MANUAL" | "SCHEDULED"; postStartAt: string | null;
};

type DashboardGroupPayload = {
  profileId: string; participantName: string;
  training: { id: string; name: string }; cohort: { id: string; name: string };
  tests: DashboardTestPayload[];
};

participantPortalRoutes.post("/dashboard", requireSameOrigin, async (context) => {
  const parsed = identitySchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "PARTICIPANT_INVALID", "Isi Nama Lengkap dan NIK yang valid.");
  const rows = await context.env.DB.prepare(
    `SELECT profiles.id AS profile_id, profiles.name AS profile_name, profiles.nik,
            profiles.training_id, trainings.name AS training_name,
            profiles.cohort_id, cohorts.name AS cohort_name,
            sessions.id AS session_id, sessions.slug, sessions.name AS session_name,
            materials.name AS material_name, batches.id AS batch_id,
            participants.id AS participant_id,
            sessions.question_count, sessions.duration_minutes, sessions.passing_score, sessions.status,
            sessions.pre_mode, sessions.pre_start_at, sessions.pre_end_at, sessions.pre_manual_open,
            sessions.post_mode, sessions.post_start_at, sessions.post_end_at, sessions.post_manual_open,
            attempts.stage AS attempt_stage, attempts.status AS attempt_status, attempts.score AS attempt_score
     FROM participant_profiles profiles
     JOIN training_cohorts cohorts ON cohorts.id=profiles.cohort_id
     JOIN trainings ON trainings.id=cohorts.training_id
     LEFT JOIN batches ON batches.cohort_id=profiles.cohort_id
     LEFT JOIN training_sessions sessions
       ON sessions.id=batches.training_session_id AND sessions.training_id=profiles.training_id
     LEFT JOIN training_materials materials ON materials.id=sessions.material_id
     LEFT JOIN participants
       ON participants.profile_id=profiles.id AND participants.batch_id=batches.id
     LEFT JOIN attempts
       ON attempts.participant_id=participants.id AND attempts.status<>'RESET'
     WHERE profiles.nik=? AND profiles.is_active=1 AND trainings.is_deleted=0
     ORDER BY trainings.name COLLATE NOCASE, cohorts.start_date DESC, cohorts.name COLLATE NOCASE,
              materials.sort_order, sessions.name COLLATE NOCASE, attempts.created_at`,
  ).bind(normalizeNik(parsed.data.nik)).all<DashboardRow>();
  if (!rows.results.length) {
    throw new HttpError(404, "PARTICIPANT_NOT_FOUND", "NIK tidak terdaftar atau data peserta sudah tidak aktif.");
  }

  const groupMap = new Map<string, DashboardGroupPayload>();
  const testMaps = new Map<string, Map<string, DashboardTestPayload>>();
  const refreshCandidates = new Set<string>();
  const now = Date.now();

  for (const row of rows.results) {
    let group = groupMap.get(row.profile_id);
    if (!group) {
      group = {
        profileId: row.profile_id,
        participantName: row.profile_name,
        training: { id: row.training_id, name: row.training_name },
        cohort: { id: row.cohort_id, name: row.cohort_name },
        tests: [],
      };
      groupMap.set(row.profile_id, group);
      testMaps.set(row.profile_id, new Map());
    }
    if (!row.session_id || !row.slug || !row.batch_id || row.question_count === null
      || row.duration_minutes === null || row.passing_score === null || !row.status) continue;

    const tests = testMaps.get(row.profile_id)!;
    let test = tests.get(row.session_id);
    if (!test) {
      test = {
        sessionId: row.session_id,
        slug: row.slug,
        materialName: row.material_name ?? row.session_name ?? "Mata Diklat",
        profileId: row.profile_id,
        participantId: row.participant_id,
        batchId: row.batch_id,
        questionCount: row.question_count,
        durationMinutes: row.duration_minutes,
        passingScore: row.passing_score,
        attempts: [],
        preOpen: row.status === "ACTIVE" && isTestOpen({
          mode: row.pre_mode, manualOpen: row.pre_manual_open === 1,
          startAt: row.pre_start_at, endAt: row.pre_end_at,
        }),
        postOpen: row.status === "ACTIVE" && isTestOpen({
          mode: row.post_mode, manualOpen: row.post_manual_open === 1,
          startAt: row.post_start_at, endAt: row.post_end_at,
        }),
        postMode: row.post_mode,
        postStartAt: row.post_start_at,
      };
      tests.set(row.session_id, test);
      group.tests.push(test);
      if (row.status === "ACTIVE") {
        for (const boundary of [row.pre_start_at, row.pre_end_at, row.post_start_at, row.post_end_at]) {
          if (boundary && Date.parse(boundary) > now) refreshCandidates.add(boundary);
        }
      }
    }
    const attemptStage = row.attempt_stage;
    if (attemptStage && ["PRE", "POST", "REMEDIAL_1", "REMEDIAL_2"].includes(attemptStage)
      && row.attempt_status
      && !test.attempts.some((attempt) => attempt.stage === row.attempt_stage && attempt.status === row.attempt_status)) {
      test.attempts.push({
        stage: attemptStage as DashboardTestPayload["attempts"][number]["stage"],
        status: row.attempt_status,
        score: row.attempt_score,
      });
    }
  }

  const groups = [...groupMap.values()];
  const nextRefreshAt = [...refreshCandidates]
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null;
  return context.json({
    participant: { name: groups[0]!.participantName, nik: rows.results[0]!.nik },
    groups,
    nextRefreshAt,
  });
});
