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
  listTrainingSessions,
  saveGeneratedPackages,
  setManualStageOpen,
  updateStageSchedule,
  getTrainingDeleteImpact,
  deleteTrainingSession,
} from "../../repositories/training-repository";
import { NORMAL_TEST_MINUTES } from "../../domain/attempts/timing";
import type { AppEnvironment } from "../../types";

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

export const trainingRoutes = new Hono<AppEnvironment>();
trainingRoutes.use("*", requireAdmin);

trainingRoutes.get("/", async (context) => {
  const sessions = await listTrainingSessions(context.env.DB);
  return context.json({
    sessions: sessions.map((session) => ({
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
    })),
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
       JOIN question_banks AS banks ON banks.material_id = materials.id AND banks.is_active = 1
      WHERE trainings.id = ? AND trainings.is_active = 1 AND trainings.is_deleted = 0
        AND materials.id = ? AND cohorts.id = ? AND cohorts.status = 'ACTIVE'
      LIMIT 1`,
  ).bind(input.trainingId, input.materialId, input.cohortId).first<{
    training_name: string; material_name: string; cohort_name: string;
    start_date: string; end_date: string; bank_id: string;
  }>();
  if (!selection) throw new HttpError(422, "TEST_SELECTION_INVALID", "Pelatihan, materi, angkatan, atau Bank Soal tidak tersedia.");
  const available = await activeQuestionCount(context.env.DB, selection.bank_id);
  if (available < 1) throw new HttpError(422, "BANK_EMPTY", "Materi ini belum memiliki soal aktif.");

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
  if (session.status !== "DRAFT") {
    throw new HttpError(409, "TRAINING_ALREADY_ACTIVE", "Paket tidak dapat diubah setelah pelatihan aktif.");
  }

  const [batches, questionRows, previousAssignments] = await Promise.all([
    listBatches(context.env.DB, session.id),
    listActiveQuestionUsageForSession(context.env.DB, session.id),
    listExistingPackageAssignments(context.env.DB, session.id),
  ]);
  if (questionRows.length < parsed.data.questionCount) {
    throw new HttpError(422, "QUESTION_COUNT_EXCEEDS_BANK", `Jumlah soal per paket maksimal ${questionRows.length} sesuai soal aktif yang tersedia.`);
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
  return context.json(packageResponse(await getPackagePreview(context.env.DB, session.id)));
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
  if (!session) throw new HttpError(404, "TRAINING_NOT_FOUND", "Pelatihan tidak ditemukan.");
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
