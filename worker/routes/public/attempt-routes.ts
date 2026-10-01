import { Hono } from "hono";
import { z } from "zod";
import { calculateScore } from "../../domain/scoring/calculate-score";
import { isPassing } from "../../domain/scoring/outcome";
import { evaluateSubmission, fillMissingAnswers } from "../../domain/attempts/submission-rules";
import { personalizeQuestionOrder } from "../../domain/attempts/personalize-questions";
import { attemptNumberForStage, nextPostStage } from "../../domain/attempts/progression";
import { attemptDeadlines } from "../../domain/attempts/timing";
import { isTestOpen } from "../../domain/scheduling/test-availability";
import { HttpError } from "../../http/errors";
import { requireSameOrigin } from "../../middleware/admin-auth";
import {
  createAttemptWithSnapshots, findAttempt, findAttemptById, findParticipantContext,
  getLayoutQuestions, listAttemptSnapshots, nextResetSequence, saveAttemptDraft, submitAttempt,
  type AttemptRecord, type AttemptStage, type OriginalOptionKey, type SnapshotRecord,
} from "../../repositories/attempt-repository";
import { findPublicTraining } from "../../repositories/participant-repository";
import type { AppEnvironment } from "../../types";

const optionKeySchema = z.enum(["A", "B", "C", "D"]);
const answersSchema = z.record(z.string().uuid(), optionKeySchema);
const startSchema = z.object({ participantId: z.string().uuid(), batchId: z.string().uuid(), stage: z.enum(["PRE", "POST", "REMEDIAL_1", "REMEDIAL_2", "REMEDIAL_3"]) });
const draftSchema = z.object({ participantId: z.string().uuid(), revision: z.number().int().positive(), answers: answersSchema });
const submitSchema = z.object({ participantId: z.string().uuid(), mode: z.enum(["NORMAL", "TIMEOUT"]), answers: answersSchema });

export const attemptRoutes = new Hono<AppEnvironment>();

function stageIsOpen(session: NonNullable<Awaited<ReturnType<typeof findPublicTraining>>>, stage: AttemptStage) {
  const isPre = stage === "PRE";
  return session.status === "ACTIVE" && isTestOpen({
    mode: isPre ? session.pre_mode : session.post_mode,
    manualOpen: (isPre ? session.pre_manual_open : session.post_manual_open) === 1,
    startAt: isPre ? session.pre_start_at : session.post_start_at,
    endAt: isPre ? session.pre_end_at : session.post_end_at,
  });
}

function validateAnswerQuestionIds(answers: Record<string, OriginalOptionKey>, snapshots: SnapshotRecord[]) {
  const allowed = new Set(snapshots.map((item) => item.question_id));
  if (Object.keys(answers).some((id) => !allowed.has(id))) {
    throw new HttpError(422, "ANSWER_QUESTION_INVALID", "Jawaban memuat soal yang tidak ada pada tes ini.");
  }
}

function publicAttempt(attempt: AttemptRecord, snapshots: SnapshotRecord[], serverNow: string, passingScore: number, slug: string) {
  const draft = JSON.parse(attempt.draft_answers_json) as Record<string, OriginalOptionKey>;
  // `deadline_at` is written by the server when an attempt starts.  Keep using
  // that persisted value so a later rule/configuration change can never grant
  // extra time to an attempt that is already in progress.
  const normalDeadlineAt = attemptDeadlines(attempt.started_at).normalDeadlineAt;
  return {
    attempt: {
      id: attempt.id, stage: attempt.stage, status: attempt.status, startedAt: attempt.started_at,
      deadlineAt: attempt.deadline_at, normalDeadlineAt,
      serverNow, revision: attempt.draft_revision, answers: draft,
      score: attempt.score, passingScore,
    },
    questions: snapshots.map((snapshot) => {
      const texts: Record<OriginalOptionKey, string> = {
        A: snapshot.option_a, B: snapshot.option_b, C: snapshot.option_c, D: snapshot.option_d,
      };
      const order = ["A", "B", "C", "D"] as const;
      return {
        id: snapshot.question_id, position: snapshot.display_position, text: snapshot.question_text,
        imageUrl: snapshot.image_key ? `/api/public/training/${encodeURIComponent(slug)}/attempts/${attempt.id}/image?participantId=${encodeURIComponent(attempt.participant_id)}&key=${encodeURIComponent(snapshot.image_key)}` : null,
        options: order.map((originalKey, index) => ({
          displayKey: (["A", "B", "C", "D"] as const)[index], originalKey, text: texts[originalKey],
        })),
      };
    }),
  };
}

async function loadOwnedAttempt(database: D1Database, attemptId: string, participantId: string) {
  const attempt = await findAttemptById(database, attemptId, participantId);
  if (!attempt || attempt.status === "RESET") throw new HttpError(404, "ATTEMPT_NOT_FOUND", "Tes tidak ditemukan.");
  return attempt;
}

async function finalizeExpiredAttempt(database: D1Database, attempt: AttemptRecord) {
  if (attempt.status !== "IN_PROGRESS" || Date.now() < Date.parse(attempt.deadline_at)) return attempt;
  const snapshots = await listAttemptSnapshots(database, attempt.id);
  const draft = JSON.parse(attempt.draft_answers_json) as Record<string, OriginalOptionKey>;
  const answers = fillMissingAnswers(snapshots.map((item) => item.question_id), draft, "C");
  const correctCount = snapshots.filter((item) => answers[item.question_id] === item.correct_option_key).length;
  await submitAttempt(database, {
    attempt, snapshots, answers, correctCount,
    score: calculateScore(correctCount, snapshots.length), submittedAt: new Date().toISOString(),
  });
  return (await findAttemptById(database, attempt.id, attempt.participant_id)) ?? attempt;
}

attemptRoutes.post("/start", requireSameOrigin, async (context) => {
  const parsed = startSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "ATTEMPT_START_INVALID", "Data untuk memulai tes tidak valid.");
  const session = await findPublicTraining(context.env.DB, context.req.param("slug") ?? "");
  if (!session) throw new HttpError(404, "TRAINING_NOT_FOUND", "Link pelatihan tidak ditemukan.");
  if (!(await findParticipantContext(context.env.DB, parsed.data.participantId, parsed.data.batchId, session.id))) {
    throw new HttpError(404, "PARTICIPANT_NOT_FOUND", "Data peserta tidak ditemukan pada angkatan ini.");
  }
  let attempt = await findAttempt(context.env.DB, parsed.data.participantId, parsed.data.stage);
  if (attempt?.status === "SUBMITTED") throw new HttpError(409, "STAGE_ALREADY_COMPLETED", `${parsed.data.stage === "PRE" ? "Pre-Test" : "Post-Test"} sudah pernah diselesaikan.`);
  if (!attempt) {
    if (!stageIsOpen(session, parsed.data.stage)) throw new HttpError(409, "TEST_CLOSED", `${parsed.data.stage === "PRE" ? "Pre-Test" : "Post-Test"} belum dibuka atau sudah ditutup.`);
    if (parsed.data.stage !== "PRE") {
      const preAttempt = await findAttempt(context.env.DB, parsed.data.participantId, "PRE");
      if (preAttempt?.status !== "SUBMITTED") throw new HttpError(409, "PRE_REQUIRED", "Selesaikan Pre-Test terlebih dahulu.");
      const postAttempts = (await Promise.all(
        (["POST", "REMEDIAL_1", "REMEDIAL_2", "REMEDIAL_3"] as const)
          .map((stage) => findAttempt(context.env.DB, parsed.data.participantId, stage)),
      )).filter((item): item is AttemptRecord => item !== null);
      const expected = nextPostStage(postAttempts, session.passing_score);
      if (expected !== parsed.data.stage) {
        throw new HttpError(409, "STAGE_NOT_AVAILABLE", expected ? "Selesaikan tahap tes yang tersedia terlebih dahulu." : "Tidak ada remedial yang tersedia.");
      }
    }
    const layoutQuestions = await getLayoutQuestions(context.env.DB, parsed.data.batchId, parsed.data.stage);
    if (!layoutQuestions?.length) throw new HttpError(409, "LAYOUT_NOT_READY", "Paket soal belum siap. Hubungi admin.");
    const snapshots = personalizeQuestionOrder(layoutQuestions);
    const now = new Date();
    const startedAt = now.toISOString();
    const deadlineAt = attemptDeadlines(startedAt).hardDeadlineAt;
    await createAttemptWithSnapshots(context.env.DB, {
        id: crypto.randomUUID(), participantId: parsed.data.participantId, batchId: parsed.data.batchId,
        sessionId: session.id, stage: parsed.data.stage, attemptNumber: attemptNumberForStage(parsed.data.stage),
        resetSequence: await nextResetSequence(context.env.DB,parsed.data.participantId,parsed.data.stage), startedAt, deadlineAt, snapshots,
    });
    attempt = await findAttempt(context.env.DB, parsed.data.participantId, parsed.data.stage);
  }
  if (!attempt) throw new HttpError(500, "ATTEMPT_CREATE_FAILED", "Tes tidak dapat dimulai. Silakan coba kembali.");
  const snapshots = await listAttemptSnapshots(context.env.DB, attempt.id);
  return context.json(publicAttempt(attempt, snapshots, new Date().toISOString(), session.passing_score, session.slug), 201);
});

attemptRoutes.get("/:attemptId", async (context) => {
  const participantId = context.req.query("participantId") ?? "";
  let attempt = await loadOwnedAttempt(context.env.DB, context.req.param("attemptId"), participantId);
  attempt = await finalizeExpiredAttempt(context.env.DB, attempt);
  const session = await findPublicTraining(context.env.DB, context.req.param("slug") ?? "");
  if (!session || attempt.training_session_id !== session.id) throw new HttpError(404, "ATTEMPT_NOT_FOUND", "Tes tidak ditemukan.");
  const snapshots = await listAttemptSnapshots(context.env.DB, attempt.id);
  return context.json(publicAttempt(attempt, snapshots, new Date().toISOString(), session.passing_score, session.slug));
});

attemptRoutes.put("/:attemptId/draft", requireSameOrigin, async (context) => {
  const parsed = draftSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "DRAFT_INVALID", "Draft jawaban tidak valid.");
  const attempt = await loadOwnedAttempt(context.env.DB, context.req.param("attemptId"), parsed.data.participantId);
  if (attempt.status !== "IN_PROGRESS") throw new HttpError(409, "ATTEMPT_LOCKED", "Tes sudah selesai dan tidak dapat diubah.");
  if (Date.now() >= Date.parse(attempt.deadline_at)) throw new HttpError(409, "ATTEMPT_EXPIRED", "Waktu tes telah selesai.");
  const snapshots = await listAttemptSnapshots(context.env.DB, attempt.id);
  validateAnswerQuestionIds(parsed.data.answers, snapshots);
  const saved = await saveAttemptDraft(context.env.DB, attempt.id, parsed.data.participantId, JSON.stringify(parsed.data.answers), parsed.data.revision);
  return context.json({ revision: saved?.draft_revision ?? attempt.draft_revision });
});

attemptRoutes.post("/:attemptId/submit", requireSameOrigin, async (context) => {
  const parsed = submitSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "SUBMISSION_INVALID", "Jawaban tidak valid.");
  let attempt = await loadOwnedAttempt(context.env.DB, context.req.param("attemptId"), parsed.data.participantId);
  const session = await findPublicTraining(context.env.DB, context.req.param("slug") ?? "");
  if (!session || attempt.training_session_id !== session.id) throw new HttpError(404, "ATTEMPT_NOT_FOUND", "Tes tidak ditemukan.");
  if (attempt.status === "SUBMITTED") return context.json({ attempt: { id: attempt.id, stage: attempt.stage, status: attempt.status, score: attempt.score, passingScore: session.passing_score, passed: attempt.stage === "PRE" ? null : isPassing(attempt.score ?? 0, session.passing_score) } });
  if (attempt.status !== "IN_PROGRESS") throw new HttpError(409, "ATTEMPT_LOCKED", "Tes sudah tidak dapat dikirim.");
  const snapshots = await listAttemptSnapshots(context.env.DB, attempt.id);
  validateAnswerQuestionIds(parsed.data.answers, snapshots);
  const decision = evaluateSubmission(
    snapshots.map((item) => item.question_id), parsed.data.answers,
    attempt.deadline_at, parsed.data.mode,
  );
  if (!decision.allowed) {
    throw new HttpError(422, "ANSWERS_INCOMPLETE", `Masih ada ${decision.missingQuestionIds.length} soal yang belum dijawab.`);
  }
  const finalAnswers = decision.timedOut
    ? fillMissingAnswers(snapshots.map((item) => item.question_id), parsed.data.answers, "C")
    : parsed.data.answers;
  const correctCount = snapshots.filter((item) => finalAnswers[item.question_id] === item.correct_option_key).length;
  const score = calculateScore(correctCount, snapshots.length);
  await submitAttempt(context.env.DB, {
    attempt, snapshots, answers: finalAnswers, score, correctCount, submittedAt: new Date().toISOString(),
  });
  attempt = await loadOwnedAttempt(context.env.DB, attempt.id, parsed.data.participantId);
  return context.json({ attempt: { id: attempt.id, stage: attempt.stage, status: attempt.status, score: attempt.score, passingScore: session.passing_score, passed: attempt.stage === "PRE" ? null : isPassing(attempt.score ?? 0, session.passing_score) } });
});

attemptRoutes.get("/:attemptId/image", async (context) => {
  const participantId = context.req.query("participantId") ?? "";
  const key = context.req.query("key") ?? "";
  const attempt = await loadOwnedAttempt(context.env.DB, context.req.param("attemptId"), participantId);
  const allowed = await context.env.DB.prepare(
    `SELECT 1 AS found FROM attempt_question_snapshots WHERE attempt_id = ? AND image_key = ? LIMIT 1`,
  ).bind(attempt.id, key).first<{ found: number }>();
  if (!allowed) throw new HttpError(404, "IMAGE_NOT_FOUND", "Gambar tidak ditemukan.");
  const object = await context.env.QUESTION_IMAGES.get(key);
  if (!object) throw new HttpError(404, "IMAGE_NOT_FOUND", "Gambar tidak ditemukan.");
  const headers = new Headers(); object.writeHttpMetadata(headers);
  if (!headers.has("Content-Type")) {
    const extension = key.split(".").pop()?.toLowerCase();
    const contentType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
    headers.set("Content-Type", contentType);
  }
  headers.set("Cache-Control", "private, max-age=300"); headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers });
});
