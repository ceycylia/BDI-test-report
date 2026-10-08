import { Hono } from "hono";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { requireAdmin, requireCsrf, requireSameOrigin } from "../../middleware/admin-auth";
import { allocateQuestionPackages } from "../../domain/allocation/generate-packages";
import { generateBatchLayouts, LAYOUT_STAGES } from "../../domain/allocation/generate-layouts";
import {
  activeQuestionCount,
  activateTrainingSession,
  createTrainingSession,
  findTrainingSession,
  getPackagePreview,
  listBatches,
  listActiveQuestionUsageForSession,
  listExistingPackageAssignments,
  paginateTrainingSessions,
  saveGeneratedPackages,
  setManualStageOpen,
  updateStageSchedule,
  getTrainingDeleteImpact,
  deleteTrainingSession,
} from "../../repositories/training-repository";
import { NORMAL_TEST_MINUTES } from "../../domain/attempts/timing";
import { getTestScheduleStatus } from "../../domain/scheduling/test-availability";
import type { AppEnvironment } from "../../types";
import { paginationMeta, parsePagination } from "../../http/pagination";

const createStageScheduleSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("SCHEDULED"),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
  }).refine((value) => Date.parse(value.endAt) > Date.parse(value.startAt), {
    message: "Waktu tutup harus setelah waktu buka.",
    path: ["endAt"],
  }),
  z.object({ status: z.literal("OPEN_NOW") }),
]);

const createTrainingSchema = z
  .object({
    trainingId: z.string().min(1),
    materialId: z.string().min(1),
    cohortId: z.string().min(1),
    activeYear: z.number().int().min(2000).max(2200).optional(),
    passingScore: z.number().min(0).max(100),
    pre: createStageScheduleSchema,
    post: createStageScheduleSchema,
  });

const stageScheduleSchema = z.discriminatedUnion("status", [
  z.object({ stage: z.enum(["PRE", "POST"]), status: z.literal("SCHEDULED"), startAt: z.string().datetime(), endAt: z.string().datetime() })
    .refine((value) => Date.parse(value.endAt) > Date.parse(value.startAt), { message: "Waktu tutup harus setelah waktu buka.", path: ["endAt"] }),
  z.object({ stage: z.enum(["PRE", "POST"]), status: z.literal("OPEN_NOW") }),
  z.object({ stage: z.enum(["PRE", "POST"]), status: z.literal("CLOSED") }),
]);

const overlappingTestMessage = "Test untuk pelatihan, materi, dan angkatan ini sudah tersedia pada periode yang sama atau bertumpang tindih.";

type ComparableStageSchedule = {
  mode: "MANUAL" | "SCHEDULED";
  startAt: string | null;
  endAt: string | null;
  manualOpen: boolean;
};

function scheduleWindow(schedule: ComparableStageSchedule, now: number) {
  if (schedule.mode === "MANUAL") {
    return schedule.manualOpen ? { start: now, end: Number.POSITIVE_INFINITY } : null;
  }
  const start = Date.parse(schedule.startAt ?? "");
  const end = Date.parse(schedule.endAt ?? "");
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

function schedulesOverlap(
  proposed: ComparableStageSchedule[],
  existing: ComparableStageSchedule[],
  now: number,
) {
  const proposedWindows = proposed.map((schedule) => scheduleWindow(schedule, now)).filter((window) => window !== null);
  const existingWindows = existing.map((schedule) => scheduleWindow(schedule, now)).filter((window) => window !== null);
  return proposedWindows.some((left) =>
    existingWindows.some((right) => left.start < right.end && left.end > right.start)
  );
}

async function assertNoOverlappingTest(
  database: D1Database,
  input: {
    trainingId: string;
    materialId: string;
    cohortId: string;
    excludeSessionId?: string;
    schedules: ComparableStageSchedule[];
  },
) {
  const rows = await database.prepare(
    `SELECT DISTINCT sessions.id,sessions.pre_mode,sessions.pre_start_at,sessions.pre_end_at,
            sessions.pre_manual_open,sessions.post_mode,sessions.post_start_at,sessions.post_end_at,
            sessions.post_manual_open
       FROM training_sessions sessions
       JOIN batches ON batches.training_session_id=sessions.id
      WHERE sessions.training_id=? AND sessions.material_id=? AND batches.cohort_id=?
        AND (? IS NULL OR sessions.id<>?)`
  ).bind(
    input.trainingId,
    input.materialId,
    input.cohortId,
    input.excludeSessionId ?? null,
    input.excludeSessionId ?? null,
  ).all<{
    id: string;
    pre_mode: "MANUAL" | "SCHEDULED";
    pre_start_at: string | null;
    pre_end_at: string | null;
    pre_manual_open: number;
    post_mode: "MANUAL" | "SCHEDULED";
    post_start_at: string | null;
    post_end_at: string | null;
    post_manual_open: number;
  }>();
  const now = Date.now();
  const duplicate = rows.results.some((row) => schedulesOverlap(input.schedules, [
    { mode: row.pre_mode, startAt: row.pre_start_at, endAt: row.pre_end_at, manualOpen: row.pre_manual_open === 1 },
    { mode: row.post_mode, startAt: row.post_start_at, endAt: row.post_end_at, manualOpen: row.post_manual_open === 1 },
  ], now));
  if (duplicate) throw new HttpError(409, "TEST_SCHEDULE_OVERLAP", overlappingTestMessage);
}

function createComparableSchedule(schedule: z.infer<typeof createStageScheduleSchema>): ComparableStageSchedule {
  return {
    mode: schedule.status === "SCHEDULED" ? "SCHEDULED" : "MANUAL",
    startAt: schedule.status === "SCHEDULED" ? schedule.startAt : null,
    endAt: schedule.status === "SCHEDULED" ? schedule.endAt : null,
    manualOpen: schedule.status === "OPEN_NOW",
  };
}

function editComparableSchedule(schedule: z.infer<typeof stageScheduleSchema>): ComparableStageSchedule {
  return {
    mode: schedule.status === "SCHEDULED" ? "SCHEDULED" : "MANUAL",
    startAt: schedule.status === "SCHEDULED" ? schedule.startAt : null,
    endAt: schedule.status === "SCHEDULED" ? schedule.endAt : null,
    manualOpen: schedule.status === "OPEN_NOW",
  };
}

export const trainingRoutes = new Hono<AppEnvironment>();
trainingRoutes.use("*", requireAdmin);

function activeYearInJakarta() {
  return Number(new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(new Date()));
}

function parseCohorts(value: string): Array<{ id: string; name: string }> {
  try {
    const parsed = JSON.parse(value) as Array<{ id?: unknown; name?: unknown }>;
    return parsed
      .filter((item) => typeof item.id === "string" && typeof item.name === "string")
      .map((item) => ({ id: item.id as string, name: item.name as string }));
  } catch {
    return [];
  }
}

function scheduleStatusFor(session: NonNullable<Awaited<ReturnType<typeof findTrainingSession>>>) {
  return getTestScheduleStatus(session.status, [
    {
      mode: session.pre_mode,
      startAt: session.pre_start_at,
      endAt: session.pre_end_at,
      manualOpen: session.pre_manual_open === 1,
    },
    {
      mode: session.post_mode,
      startAt: session.post_start_at,
      endAt: session.post_end_at,
      manualOpen: session.post_manual_open === 1,
    },
  ]);
}

trainingRoutes.get("/", async (context) => {
  const requestedYear = Number(context.req.query("year"));
  const activeYear = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2200
    ? requestedYear
    : activeYearInJakarta();
  const pagination = parsePagination({ page: context.req.query("page"), limit: context.req.query("limit"), pageSize: context.req.query("pageSize") });
  const result = await paginateTrainingSessions(context.env.DB, {
    year: activeYear, page: pagination.page, limit: pagination.limit,
    search: context.req.query("search"), trainingId: context.req.query("trainingId"), materialId: context.req.query("materialId"), cohortId: context.req.query("cohortId"), scheduleStatus: context.req.query("scheduleStatus"),
  });
  return context.json({
    activeYear,
    sessions: result.rows.map((session) => ({
      id: session.id,
      name: session.name,
      slug: session.slug,
      bankId: session.bank_id,
      bankName: session.bank_name,
      questionCount: session.question_count,
      durationMinutes: session.duration_minutes,
      passingScore: session.passing_score,
      trainingStartDate: session.training_start_date,
      trainingEndDate: session.training_end_date,
      status: session.status,
      scheduleStatus: scheduleStatusFor(session),
      trainingId: session.training_id ?? "",
      trainingName: session.training_name ?? "Pelatihan tidak tersedia",
      materialId: session.material_id ?? "",
      materialName: session.material_name ?? session.name,
      cohorts: parseCohorts(session.cohorts_json),
    })),
    pagination: paginationMeta(pagination, result.total),
  });
});

trainingRoutes.post("/", requireSameOrigin, requireCsrf, async (context) => {
  const parsed = createTrainingSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) {
    throw new HttpError(422, "TRAINING_INVALID", parsed.error.issues[0]?.message ?? "Data pelatihan tidak valid.");
  }
  const input = parsed.data;
  const selection = await context.env.DB.prepare(
    `SELECT trainings.name AS training_name, materials.name AS material_name,
            cohorts.name AS cohort_name, cohorts.start_date, cohorts.end_date,
            banks.id AS bank_id
       FROM trainings
       JOIN training_materials AS materials ON materials.training_id = trainings.id
       JOIN training_cohorts AS cohorts ON cohorts.training_id = trainings.id
       JOIN question_banks AS banks ON banks.material_id = materials.id
      WHERE trainings.id = ? AND trainings.is_active = 1 AND trainings.is_deleted = 0
        AND materials.id = ? AND cohorts.id = ? AND cohorts.status = 'ACTIVE'
      ORDER BY banks.is_active DESC, banks.created_at DESC
      LIMIT 1`,
  ).bind(input.trainingId, input.materialId, input.cohortId).first<{
    training_name: string; material_name: string; cohort_name: string;
    start_date: string; end_date: string; bank_id: string;
  }>();
  if (!selection) throw new HttpError(422, "TEST_SELECTION_INVALID", "Pelatihan, materi, angkatan, atau Bank Soal tidak tersedia.");
  if (input.activeYear && selection.start_date.slice(0, 4) !== String(input.activeYear)) {
    throw new HttpError(422, "YEAR_MISMATCH", `Tanggal pelaksanaan berada pada tahun ${selection.start_date.slice(0, 4)}, sedangkan Tahun Aktif adalah ${input.activeYear}. Ubah Tahun Aktif atau angkatan yang dipilih.`);
  }
  await assertNoOverlappingTest(context.env.DB, {
    trainingId: input.trainingId,
    materialId: input.materialId,
    cohortId: input.cohortId,
    schedules: [createComparableSchedule(input.pre), createComparableSchedule(input.post)],
  });
  const available = await activeQuestionCount(context.env.DB, selection.bank_id);
  if (available < 1) throw new HttpError(422, "BANK_EMPTY", "Materi ini belum memiliki soal.");

  const id = crypto.randomUUID();
  const slugBase = `${selection.material_name}-${selection.cohort_name}`.toLowerCase()
    .normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 130) || "test";
  await createTrainingSession(context.env.DB, {
    id,
    name: selection.material_name,
    slug: `${slugBase}-${id.slice(0, 8)}`,
    bankId: selection.bank_id,
    trainingId: input.trainingId,
    materialId: input.materialId,
    questionCount: available,
    durationMinutes: NORMAL_TEST_MINUTES,
    passingScore: input.passingScore,
    trainingStartDate: selection.start_date,
    trainingEndDate: selection.end_date,
    preMode: input.pre.status === "SCHEDULED" ? "SCHEDULED" : "MANUAL",
    preStartAt: input.pre.status === "SCHEDULED" ? input.pre.startAt : null,
    preEndAt: input.pre.status === "SCHEDULED" ? input.pre.endAt : null,
    preManualOpen: input.pre.status === "OPEN_NOW",
    postMode: input.post.status === "SCHEDULED" ? "SCHEDULED" : "MANUAL",
    postStartAt: input.post.status === "SCHEDULED" ? input.post.startAt : null,
    postEndAt: input.post.status === "SCHEDULED" ? input.post.endAt : null,
    postManualOpen: input.post.status === "OPEN_NOW",
    batches: [{
      id: crypto.randomUUID(),
      number: 1,
      name: selection.cohort_name,
      cohortId: input.cohortId,
    }],
  });

  return context.json({ session: { id } }, 201);
});

function countQuestionIds(items: Array<{ question_id: string }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.question_id, (counts.get(item.question_id) ?? 0) + 1);
  return counts;
}

function packageResponse(
  rows: Awaited<ReturnType<typeof getPackagePreview>>,
) {
  const packages = rows.map((row) => ({
    batchId: row.batch_id,
    batchNumber: row.batch_number,
    batchName: row.batch_name,
    questionIds: JSON.parse(row.question_ids_json) as string[],
    layoutCount: row.layout_count,
  }));
  const overlaps: Array<{ leftBatchId: string; rightBatchId: string; count: number }> = [];
  for (let left = 0; left < packages.length; left += 1) {
    for (let right = left + 1; right < packages.length; right += 1) {
      const rightIds = new Set(packages[right]?.questionIds ?? []);
      overlaps.push({
        leftBatchId: packages[left]?.batchId ?? "",
        rightBatchId: packages[right]?.batchId ?? "",
        count: (packages[left]?.questionIds ?? []).filter((id) => rightIds.has(id)).length,
      });
    }
  }
  return { packages, overlaps };
}

trainingRoutes.post("/:sessionId/generate-packages", requireSameOrigin, requireCsrf, async (context) => {
  const parsed = z.object({ questionCount: z.number().int().min(1) })
    .safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) {
    throw new HttpError(422, "QUESTION_COUNT_INVALID", "Jumlah soal per paket minimal 1.");
  }
  const session = await findTrainingSession(context.env.DB, context.req.param("sessionId"));
  if (!session) throw new HttpError(404, "TRAINING_NOT_FOUND", "Pelatihan tidak ditemukan.");
  if (session.status === "COMPLETED") {
    throw new HttpError(409, "TRAINING_COMPLETED", "Paket tidak dapat dibuat ulang setelah pelaksanaan selesai permanen.");
  }

  const [batches, questionRows, previousAssignments] = await Promise.all([
    listBatches(context.env.DB, session.id),
    listActiveQuestionUsageForSession(context.env.DB, session.id),
    listExistingPackageAssignments(context.env.DB, session.id),
  ]);
  if (questionRows.length < parsed.data.questionCount) {
    throw new HttpError(422, "QUESTION_COUNT_EXCEEDS_BANK", `Jumlah soal per paket maksimal ${questionRows.length} sesuai soal yang tersedia.`);
  }

  const oldCountMap = countQuestionIds(previousAssignments);
  const packages = allocateQuestionPackages(
    questionRows.map((question) => ({
      id: question.id,
      timesAssigned: Math.max(0, question.times_assigned - (oldCountMap.get(question.id) ?? 0)),
    })),
    batches.map((batch) => batch.id),
    parsed.data.questionCount,
  );
  const assignments = packages.flatMap((item) =>
    item.questionIds.map((questionId) => ({ batchId: item.batchId, questionId })),
  );
  const newCountMap = new Map<string, number>();
  for (const item of assignments) {
    newCountMap.set(item.questionId, (newCountMap.get(item.questionId) ?? 0) + 1);
  }
  const layouts = packages.flatMap((item) =>
    generateBatchLayouts(item.questionIds).map((layout) => ({
      id: crypto.randomUUID(),
      batchId: item.batchId,
      stage: layout.stage,
      questionOrderJson: JSON.stringify(layout.questionOrder),
      optionOrdersJson: JSON.stringify(layout.optionOrders),
    })),
  );

  await saveGeneratedPackages(context.env.DB, session.id, {
    questionCount: parsed.data.questionCount,
    oldCounts: [...oldCountMap].map(([questionId, count]) => ({ questionId, count })),
    assignments,
    newCounts: [...newCountMap].map(([questionId, count]) => ({ questionId, count })),
    layouts,
  });
  return context.json({
    ...packageResponse(await getPackagePreview(context.env.DB, session.id)),
    status: "ACTIVE",
  });
});

trainingRoutes.get("/:sessionId/packages/:batchId/questions", async (context) => {
  const session = await findTrainingSession(context.env.DB, context.req.param("sessionId"));
  if (!session) throw new HttpError(404, "TRAINING_NOT_FOUND", "Pelatihan tidak ditemukan.");
  const rows = await context.env.DB.prepare(
    `SELECT questions.id,questions.question_text,questions.image_key,
            questions.option_a,questions.option_b,questions.option_c,questions.option_d,
            questions.correct_option_key
       FROM batch_questions
       JOIN batches ON batches.id=batch_questions.batch_id
       JOIN questions ON questions.id=batch_questions.question_id
      WHERE batches.id=? AND batches.training_session_id=?
      ORDER BY batch_questions.created_at,questions.created_at`
  ).bind(context.req.param("batchId"), session.id).all();
  return context.json({ questions: rows.results });
});

trainingRoutes.post("/:sessionId/activate", requireSameOrigin, requireCsrf, async (context) => {
  const session = await findTrainingSession(context.env.DB, context.req.param("sessionId"));
  if (!session) throw new HttpError(404, "TRAINING_NOT_FOUND", "Pelatihan tidak ditemukan.");
  if (session.status !== "DRAFT") {
    throw new HttpError(409, "TRAINING_ALREADY_ACTIVE", "Pelatihan sudah diaktifkan.");
  }
  const packages = await getPackagePreview(context.env.DB, session.id);
  const complete = packages.length > 0 && packages.every(
    (item) => (JSON.parse(item.question_ids_json) as string[]).length === session.question_count
      && item.layout_count === LAYOUT_STAGES.length,
  );
  if (!complete) {
    throw new HttpError(422, "PACKAGES_INCOMPLETE", "Generate seluruh paket soal sebelum mengaktifkan pelatihan.");
  }
  await activateTrainingSession(context.env.DB, session.id);
  return context.json({ session: { id: session.id, status: "ACTIVE" } });
});

trainingRoutes.post("/:sessionId/manual-stage", requireSameOrigin, requireCsrf, async (context) => {
  const parsed = z.object({ stage: z.enum(["PRE", "POST"]), open: z.boolean() })
    .safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "SCHEDULE_INVALID", "Pengaturan tes tidak valid.");
  const session = await findTrainingSession(context.env.DB, context.req.param("sessionId"));
  if (!session) throw new HttpError(404, "TRAINING_NOT_FOUND", "Pelatihan tidak ditemukan.");
  if (session.status !== "ACTIVE") throw new HttpError(409, "TRAINING_NOT_ACTIVE", "Aktifkan pelatihan terlebih dahulu.");
  const mode = parsed.data.stage === "PRE" ? session.pre_mode : session.post_mode;
  if (mode !== "MANUAL") throw new HttpError(409, "SCHEDULE_IS_AUTOMATIC", "Tes ini menggunakan jadwal otomatis.");
  await setManualStageOpen(context.env.DB, session.id, parsed.data.stage, parsed.data.open);
  return context.json({ stage: parsed.data.stage, open: parsed.data.open });
});

trainingRoutes.put("/:sessionId/schedule", requireSameOrigin, requireCsrf, async (context) => {
  const parsed = stageScheduleSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "SCHEDULE_INVALID", parsed.error.issues[0]?.message ?? "Jadwal Test tidak valid.");
  const session = await findTrainingSession(context.env.DB, context.req.param("sessionId"));
  if (!session) throw new HttpError(404, "TRAINING_NOT_FOUND", "Pelatihan tidak ditemukan.");

  const input = parsed.data;
  const identity = await context.env.DB.prepare(
    `SELECT sessions.training_id,sessions.material_id,batches.cohort_id
       FROM training_sessions sessions
       JOIN batches ON batches.training_session_id=sessions.id
      WHERE sessions.id=?
      LIMIT 1`
  ).bind(session.id).first<{
    training_id: string | null;
    material_id: string | null;
    cohort_id: string | null;
  }>();
  if (identity?.training_id && identity.material_id && identity.cohort_id) {
    await assertNoOverlappingTest(context.env.DB, {
      trainingId: identity.training_id,
      materialId: identity.material_id,
      cohortId: identity.cohort_id,
      excludeSessionId: session.id,
      schedules: [editComparableSchedule(input)],
    });
  }
  await updateStageSchedule(context.env.DB, {
    sessionId: session.id,
    stage: input.stage,
    mode: input.status === "SCHEDULED" ? "SCHEDULED" : "MANUAL",
    manualOpen: input.status === "OPEN_NOW",
    startAt: input.status === "SCHEDULED" ? input.startAt : null,
    endAt: input.status === "SCHEDULED" ? input.endAt : null,
  });
  return context.json({ stage: input.stage, status: input.status });
});

trainingRoutes.get("/:sessionId/delete-preview", async (context) => {
  const impact = await getTrainingDeleteImpact(context.env.DB, context.req.param("sessionId"));
  if (!impact) throw new HttpError(404, "TRAINING_NOT_FOUND", "Pelatihan tidak ditemukan.");
  return context.json({ impact: {
    id: impact.id, name: impact.name, status: impact.status, batchCount: impact.batch_count,
    participantCount: impact.participant_count, attemptCount: impact.attempt_count, answerCount: impact.answer_count,
  } });
});

trainingRoutes.delete("/:sessionId", requireSameOrigin, requireCsrf, async (context) => {
  const parsed = z.object({ confirmationName: z.string() }).safeParse(await context.req.json().catch(() => null));
  const impact = await getTrainingDeleteImpact(context.env.DB, context.req.param("sessionId"));
  if (!impact) throw new HttpError(404, "TRAINING_NOT_FOUND", "Pelatihan tidak ditemukan.");
  if (!parsed.success || parsed.data.confirmationName !== impact.name) {
    throw new HttpError(422, "DELETE_CONFIRMATION_MISMATCH", "Ketik nama pelatihan secara tepat untuk menghapus data.");
  }
  await deleteTrainingSession(context.env.DB, {
    sessionId: impact.id, adminId: context.get("admin").id,
    metadata: { name: impact.name, participants: impact.participant_count, attempts: impact.attempt_count, answers: impact.answer_count },
  });
  return context.json({ success: true });
});

trainingRoutes.get("/:sessionId", async (context) => {
  const session = await findTrainingSession(context.env.DB, context.req.param("sessionId"));
  const year = Number(context.req.query("year"));
  if (!session || (Number.isInteger(year) && String(year) !== session.training_start_date.slice(0, 4))) throw new HttpError(404, "TRAINING_NOT_FOUND", "Pelatihan tidak ditemukan pada Tahun Aktif ini.");
  const [batches, packageRows, availableQuestionCount] = await Promise.all([
    listBatches(context.env.DB, session.id),
    getPackagePreview(context.env.DB, session.id),
    activeQuestionCount(context.env.DB, session.bank_id),
  ]);
  const packagePreview = packageResponse(packageRows);
  return context.json({
    session: {
      id: session.id,
      name: session.name,
      slug: session.slug,
      bankId: session.bank_id,
      bankName: session.bank_name,
      questionCount: session.question_count,
      availableQuestionCount,
      durationMinutes: session.duration_minutes,
      passingScore: session.passing_score,
      trainingStartDate: session.training_start_date,
      trainingEndDate: session.training_end_date,
      status: session.status,
      scheduleStatus: scheduleStatusFor(session),
      trainingId: session.training_id ?? "",
      trainingName: session.training_name ?? "Pelatihan tidak tersedia",
      materialId: session.material_id ?? "",
      materialName: session.material_name ?? session.name,
      cohorts: parseCohorts(session.cohorts_json),
      pre: {
        mode: session.pre_mode,
        startAt: session.pre_start_at,
        endAt: session.pre_end_at,
        manualOpen: session.pre_manual_open === 1,
      },
      post: {
        mode: session.post_mode,
        startAt: session.post_start_at,
        endAt: session.post_end_at,
        manualOpen: session.post_manual_open === 1,
      },
    },
    batches: batches.map((batch) => ({
      id: batch.id,
      number: batch.batch_number,
      name: batch.batch_name,
      questionCount: batch.question_count,
    })),
    ...packagePreview,
  });
});
