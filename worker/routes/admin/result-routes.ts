import { Hono } from "hono";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { requireAdmin, requireCsrf, requireSameOrigin } from "../../middleware/admin-auth";
import { getParticipantResult, listParticipantAttemptDetails, listResultFilterOptions, listResultSummaries, resetAttempt, updateParticipantName } from "../../repositories/result-repository";
import { listExportAnswers, listExportTrainingInfo } from "../../repositories/result-repository";
import { createXlsx } from "../../export/xlsx";
import type { AppEnvironment } from "../../types";

export const resultRoutes = new Hono<AppEnvironment>();
resultRoutes.use("*", requireAdmin);

function activeYear(value: string | undefined) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2200) return parsed;
  return Number(new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date()));
}

resultRoutes.get("/", async (context) => {
  const results = await listResultSummaries(context.env.DB, {
    year: activeYear(context.req.query("year")),
    trainingId: context.req.query("trainingId"), materialId: context.req.query("materialId"),
    cohortId: context.req.query("cohortId"),
    status: context.req.query("status"), search: context.req.query("search"),
  });
  return context.json({ results });
});

resultRoutes.get("/options", async (context) => {
  return context.json(await listResultFilterOptions(context.env.DB, activeYear(context.req.query("year"))));
});

function optionValue(row: Record<string, string | number | null>, key: unknown) {
  return typeof key === "string" ? row[`option_${key.toLowerCase()}`] ?? "" : "";
}

function value(row: Record<string, string | number | null>, key: string) {
  return row[key] ?? null;
}

resultRoutes.get("/export", async (context) => {
  const summaries = await listResultSummaries(context.env.DB, {
    year: activeYear(context.req.query("year")),
    trainingId: context.req.query("trainingId"), materialId: context.req.query("materialId"),
    cohortId: context.req.query("cohortId"),
    status: context.req.query("status"), search: context.req.query("search"),
  });
  const participantIds = summaries.map((row) => String(row.id));
  const sessionIds = [...new Set(summaries.map((row) => String(row.training_session_id)))];
  const [answers, trainings] = await Promise.all([
    listExportAnswers(context.env.DB, participantIds), listExportTrainingInfo(context.env.DB, sessionIds),
  ]);
  const workbook = createXlsx([
    { name: "Ringkasan", rows: [
      ["Nama", "Pelatihan", "Angkatan", "Pre-Test", "Post Utama", "Remedial 1", "Remedial 2", "Remedial 3", "Final Post", "Status"],
      ...summaries.map((row) => ["name", "training_name", "batch_name", "pre_score", "post_score", "remedial_1_score", "remedial_2_score", "remedial_3_score", "final_post_score", "result_status"].map((key) => value(row, key))),
    ] },
    { name: "Detail Jawaban", rows: [
      ["Nama", "Pelatihan", "Angkatan", "Tahap", "Nilai", "No.", "Pertanyaan", "Jawaban Peserta", "Jawaban Benar", "Hasil"],
      ...answers.map((row) => [value(row, "name"), value(row, "training_name"), value(row, "batch_name"), value(row, "stage"), value(row, "score"), value(row, "display_position"), value(row, "question_text"), optionValue(row, row.selected_original_option_key), optionValue(row, row.correct_original_option_key), row.is_correct === 1 ? "Benar" : "Salah"]),
    ] },
    { name: "Informasi Tes", dateColumns: [7, 8], rows: [
      ["Pelatihan", "Slug", "Bank Soal", "Angkatan", "Jumlah Soal", "Durasi (menit)", "Passing Grade", "Tanggal Mulai", "Tanggal Selesai", "Status"],
      ...trainings.map((row) => ["training_name", "slug", "bank_name", "batches", "question_count", "duration_minutes", "passing_score", "training_start_date", "training_end_date", "status"].map((key) => value(row, key))),
    ] },
  ]);
  return new Response(workbook.slice().buffer as ArrayBuffer, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": 'attachment; filename="hasil-pelatihan-bdi.xlsx"',
    "Cache-Control": "no-store",
  } });
});

resultRoutes.get("/participants/:participantId", async (context) => {
  const participant = await getParticipantResult(context.env.DB, context.req.param("participantId"), activeYear(context.req.query("year")));
  if (!participant) throw new HttpError(404, "PARTICIPANT_NOT_FOUND", "Peserta tidak ditemukan.");
  const details = await listParticipantAttemptDetails(context.env.DB, participant.id);
  return context.json({ participant, ...details });
});

resultRoutes.put("/participants/:participantId/name", requireSameOrigin, requireCsrf, async (context) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(150) }).safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "NAME_INVALID", "Nama peserta tidak valid.");
  const participantId = context.req.param("participantId");
  if (!(await getParticipantResult(context.env.DB, participantId))) throw new HttpError(404, "PARTICIPANT_NOT_FOUND", "Peserta tidak ditemukan.");
  try { await updateParticipantName(context.env.DB, participantId, parsed.data.name); }
  catch (error) {
    if (String(error).includes("UNIQUE")) throw new HttpError(409, "PARTICIPANT_NAME_DUPLICATE", "Nama yang sama sudah ada pada angkatan ini. Pastikan kedua peserta dapat dibedakan.");
    throw error;
  }
  return context.json({ success: true });
});

resultRoutes.post("/participants/:participantId/attempts/:attemptId/reset", requireSameOrigin, requireCsrf, async (context) => {
  const participantId = context.req.param("participantId");
  const detail = await listParticipantAttemptDetails(context.env.DB, participantId);
  const attempt = detail.attempts.find((item) => item.id === context.req.param("attemptId"));
  if (!attempt) throw new HttpError(404, "ATTEMPT_NOT_FOUND", "Attempt tidak ditemukan.");
  if (attempt.status === "RESET") throw new HttpError(409, "ATTEMPT_ALREADY_RESET", "Attempt ini sudah direset.");
  const body=z.object({reason:z.string().trim().max(500).nullable().optional()}).safeParse(await context.req.json().catch(()=>({})));
  if (!body.success) throw new HttpError(422, "RESET_REASON_INVALID", "Alasan reset maksimal 500 karakter.");
  await resetAttempt(context.env.DB, context.req.param("attemptId"), participantId, context.get("admin").id, body.data.reason ?? null);
  return context.json({ success: true });
});
