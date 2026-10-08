import { Hono } from "hono";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { requireAdmin, requireCsrf, requireSameOrigin } from "../../middleware/admin-auth";
import { getManualScoreContext, getParticipantResult, listExportAnswers, listParticipantAttemptDetails, listResultFilterOptions, listResultSummaries, resetAttempt, saveManualAttemptScores, updateParticipantName } from "../../repositories/result-repository";
import { findOrCreateExamParticipant } from "../../repositories/participant-repository";
import { attemptNumberForStage, nextPostStage, type AttemptStage } from "../../domain/attempts/progression";
import { createXlsx } from "../../export/xlsx";
import type { AppEnvironment } from "../../types";
import { paginationMeta, parsePagination } from "../../http/pagination";

export const resultRoutes = new Hono<AppEnvironment>();
resultRoutes.use("*", requireAdmin);

function activeYear(value: string | undefined) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2200) return parsed;
  return Number(new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date()));
}

resultRoutes.get("/", async (context) => {
  const pagination = parsePagination({ page: context.req.query("page"), limit: context.req.query("limit"), pageSize: context.req.query("pageSize") });
  const results = await listResultSummaries(context.env.DB, {
    year: activeYear(context.req.query("year")),
    trainingId: context.req.query("trainingId"), materialId: context.req.query("materialId"),
    cohortId: context.req.query("cohortId"),
    status: context.req.query("status"), search: context.req.query("search"),
    page: pagination.page, pageSize: pagination.limit,
  });
  const total = Number(results[0]?.total_count ?? 0);
  return context.json({ results, pagination: paginationMeta(pagination, total), total });
});

resultRoutes.get("/options", async (context) => {
  return context.json(await listResultFilterOptions(context.env.DB, activeYear(context.req.query("year"))));
});

function optionValue(row: Record<string, string | number | null>, key: unknown) {
  return typeof key === "string" ? row[`option_${key.toLowerCase()}`] ?? "" : "";
}

type ExportRow = Record<string, string | number | null>;

function selectedAnswer(row: ExportRow) {
  const key = row.selected_original_option_key;
  return typeof key === "string" ? String(optionValue(row, key) || key) : "";
}

function numericScore(value: string | number | null) {
  const score = typeof value === "number" ? value : typeof value === "string" && value !== "" ? Number(value) : null;
  return score !== null && Number.isFinite(score) ? score : null;
}

function averageScore(values: Array<string | number | null>) {
  const scores = values.map(numericScore).filter((score): score is number => score !== null);
  if (!scores.length) return "-";
  return Math.round((scores.reduce((total, score) => total + score, 0) / scores.length) * 100) / 100;
}

function summaryStatus(rows: ExportRow[]) {
  const statuses = [...new Set(rows.map((row) => String(row.result_status ?? "")).filter(Boolean))];
  return statuses.length === 1 ? statuses[0]!.replaceAll("_", " ") : "-";
}

function safeSheetName(name: string, used: Set<string>) {
  const base = name.replace(/[\\/:*?\[\]]/g, " ").replace(/\s+/g, " ").trim() || "Mata Diklat";
  let candidate = base.slice(0, 31);
  let suffix = 2;
  while (used.has(candidate.toLocaleLowerCase("id-ID"))) {
    const marker = ` (${suffix})`;
    candidate = `${base.slice(0, 31 - marker.length)}${marker}`;
    suffix += 1;
  }
  used.add(candidate.toLocaleLowerCase("id-ID"));
  return candidate;
}

function safeFileName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLocaleLowerCase("id-ID");
  return normalized || "pelatihan";
}

function buildMaterialSheet(
  sheetName: string,
  attempts: ExportRow[],
) {
  const questions = [...new Map(
    attempts
      .slice()
      .sort((left, right) => Number(left.display_position) - Number(right.display_position) || String(left.question_id).localeCompare(String(right.question_id)))
      .map((row) => [String(row.question_id), { id: String(row.question_id), text: String(row.question_text ?? "") }]),
  ).values()];
  const attemptsById = new Map<string, ExportRow[]>();
  for (const row of attempts) {
    const attemptId = String(row.attempt_id);
    attemptsById.set(attemptId, [...(attemptsById.get(attemptId) ?? []), row]);
  }
  const formatTimestamp = (value: string | number | null | undefined) => {
    const date = typeof value === "string" || typeof value === "number" ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).format(date).replace(",", "");
  };
  const formatScore = (value: string | number | null | undefined) => {
    const score = typeof value === "number" ? value : typeof value === "string" && value !== "" ? Number(value) : null;
    if (score === null || !Number.isFinite(score)) return "";
    return `${Math.round(score * 100) / 100} / 100`;
  };
  const rows: Array<Array<string | number | null>> = [[
    "Timestamp", "Score", "NAMA",
    ...questions.map((question, index) => `${index + 1}. ${question.text.replace(/^\s*\d+\.\s*/u, "")}`),
  ]];
  [...attemptsById.values()]
    .sort((left, right) => String(left[0]?.submitted_at ?? "").localeCompare(String(right[0]?.submitted_at ?? "")) || String(left[0]?.name ?? "").localeCompare(String(right[0]?.name ?? "")))
    .forEach((attempt) => {
      const answers = new Map(attempt.map((row) => [String(row.question_id), selectedAnswer(row)]));
      rows.push([
        formatTimestamp(attempt[0]?.submitted_at), formatScore(attempt[0]?.score), attempt[0]?.name ?? "",
        ...questions.map((question) => answers.get(question.id) ?? ""),
      ]);
    });
  const rowStyles: Record<number, "title" | "section" | "header" | "data" | "alternate-data"> = { 0: "header" };
  const rowHeights: Record<number, number> = { 0: 22.5 };
  rows.slice(1).forEach((_, index) => { rowStyles[index + 1] = "data"; rowHeights[index + 1] = 22.5; });
  return {
    name: sheetName,
    rows,
    variant: "test-results-reference" as const,
    rowStyles,
    rowHeights,
    columnWidths: [18.85, 18.85, 18.85, ...Array.from({ length: Math.max(0, questions.length) }, () => 37.57)],
    autoFilter: false,
    freezeRows: 0,
  };
}

function buildSummarySheet(trainingName: string, summaries: ExportRow[]) {
  const participants = new Map<string, ExportRow[]>();
  for (const row of summaries) {
    const key = `${row.id}:${row.cohort_id}`;
    participants.set(key, [...(participants.get(key) ?? []), row]);
  }
  const dataRows = [...participants.values()]
    .sort((left, right) => String(left[0]?.batch_name ?? "").localeCompare(String(right[0]?.batch_name ?? "")) || String(left[0]?.name ?? "").localeCompare(String(right[0]?.name ?? "")))
    .map((rows) => {
      const participant = rows[0]!;
      return [
        participant.name ?? "", participant.cohort_name ?? "",
        averageScore(rows.map((row) => row.pre_score ?? null)),
        averageScore(rows.map((row) => row.post_score ?? null)),
        averageScore(rows.map((row) => row.remedial_2_score ?? row.remedial_1_score ?? null)),
        summaryStatus(rows),
      ];
    });
  const rowStyles: Record<number, "title" | "section" | "header" | "data" | "alternate-data"> = { 0: "title", 2: "header" };
  const rowHeights: Record<number, number> = { 0: 24, 2: 22.5 };
  dataRows.forEach((_, index) => { rowStyles[index + 3] = "data"; rowHeights[index + 3] = 22.5; });
  return {
    name: "Rangkuman",
    rows: [[trainingName], [null], ["Nama", "Angkatan", "Rata-rata Pretest", "Rata-rata Post-test", "Rata-rata Remedial", "Status"], ...dataRows],
    variant: "test-results" as const,
    rowStyles,
    rowHeights,
    centerColumns: [2, 3, 4],
    columnWidths: [28, 18, 20, 20, 20, 22],
    freezeRows: 3,
    autoFilterRange: `A3:F${Math.max(3, dataRows.length + 3)}`,
  };
}

resultRoutes.get("/export", async (context) => {
  const trainingId = context.req.query("trainingId")?.trim();
  if (!trainingId) throw new HttpError(422, "TRAINING_REQUIRED", "Pilih pelatihan terlebih dahulu.");
  const summaries = await listResultSummaries(context.env.DB, {
    year: activeYear(context.req.query("year")),
    trainingId,
  });
  if (!summaries.length) throw new HttpError(404, "TRAINING_RESULTS_NOT_FOUND", "Belum ada hasil tes untuk pelatihan yang dipilih.");
  const participantIds = summaries.map((row) => String(row.id));
  const answers = await listExportAnswers(context.env.DB, participantIds);
  if (!answers.length) throw new HttpError(404, "TRAINING_RESULTS_NOT_FOUND", "Belum ada hasil tes untuk pelatihan yang dipilih.");
  const trainingName = String(summaries[0]?.training_name ?? "Pelatihan");
  const materials = [...new Map(summaries.map((row) => [String(row.training_session_id), row])).values()]
    .sort((left, right) => Number(left.material_sort_order ?? 0) - Number(right.material_sort_order ?? 0) || String(left.material_name ?? "").localeCompare(String(right.material_name ?? "")));
  const usedSheetNames = new Set<string>();
  const materialSheets = materials.map((material) => buildMaterialSheet(
    safeSheetName(String(material.material_name ?? "Mata Diklat"), usedSheetNames),
    answers.filter((answer) => String(answer.training_session_id) === String(material.training_session_id)),
  ));
  const workbook = createXlsx([...materialSheets, buildSummarySheet(trainingName, summaries)]);
  const filename = `hasil-tes-${safeFileName(trainingName)}.xlsx`;
  return new Response(workbook.slice().buffer as ArrayBuffer, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  } });
});

resultRoutes.get("/participants/:participantId", async (context) => {
  const participant = await getParticipantResult(context.env.DB, context.req.param("participantId"), activeYear(context.req.query("year")));
  if (!participant) throw new HttpError(404, "PARTICIPANT_NOT_FOUND", "Peserta tidak ditemukan.");
  const details = await listParticipantAttemptDetails(context.env.DB, participant.id);
  return context.json({ participant, ...details });
});

const manualScoreSchema = z.object({
  batchId: z.string().min(1),
  trainingSessionId: z.string().min(1),
  scores: z.array(z.object({
    stage: z.enum(["PRE", "POST", "REMEDIAL_1", "REMEDIAL_2"]),
    score: z.number().min(0).max(100),
  })).min(1).max(2),
});

type ManualScoreField = { stage: "PRE" | "POST" | "REMEDIAL_1" | "REMEDIAL_2"; label: string; score: number | null };

function labelForManualScoreStage(stage: ManualScoreField["stage"]) {
  return {
    PRE: "Nilai Pre-Test",
    POST: "Nilai Post-Test",
    REMEDIAL_1: "Nilai Remedial 1",
    REMEDIAL_2: "Nilai Remedial 2",
  }[stage];
}

function manualScoreFields(
  attempts: Array<Record<string, string | number | null>>,
  passingScore: number,
): ManualScoreField[] {
  const submitted = attempts.filter((attempt) => attempt.status === "SUBMITTED");
  const byStage = new Map(submitted.map((attempt) => [String(attempt.stage), attempt]));
  const field = (stage: ManualScoreField["stage"]): ManualScoreField => ({
    stage,
    label: labelForManualScoreStage(stage),
    score: typeof byStage.get(stage)?.score === "number" ? Number(byStage.get(stage)?.score) : null,
  });
  const pre = byStage.get("PRE");
  const postStages = ["POST", "REMEDIAL_1", "REMEDIAL_2"] as const;
  const hasPostScore = postStages.some((stage) => byStage.has(stage));

  if (!pre && !hasPostScore) return [field("PRE"), field("POST")];
  if (!pre) return [field("PRE")];

  const progression = attempts
    .filter((attempt) => ["POST", "REMEDIAL_1", "REMEDIAL_2"].includes(String(attempt.stage)))
    .map((attempt) => ({
      stage: String(attempt.stage) as AttemptStage,
      status: String(attempt.status),
      score: typeof attempt.score === "number" ? attempt.score : null,
    }));
  const nextStage = nextPostStage(progression, passingScore);
  if (nextStage === "POST" || nextStage === "REMEDIAL_1" || nextStage === "REMEDIAL_2") {
    return [field(nextStage)];
  }

  const latestStage = [...postStages].reverse().find((stage) => byStage.has(stage)) ?? "POST";
  return [field(latestStage)];
}

async function manualScorePlan(context: Parameters<typeof getManualScoreContext>[0], referenceId: string, batchId: string, sessionId: string) {
  const target = await getManualScoreContext(context, referenceId, batchId, sessionId);
  if (!target) throw new HttpError(404, "PARTICIPANT_NOT_FOUND", "Peserta atau pelaksanaan tes tidak ditemukan.");
  const attempts = target.participant_id
    ? (await listParticipantAttemptDetails(context, target.participant_id)).attempts
    : [];
  return { target, fields: manualScoreFields(attempts, Number(target.passing_score)) };
}

resultRoutes.get("/participants/:participantId/manual-score-plan", async (context) => {
  const batchId = context.req.query("batchId") ?? "";
  const sessionId = context.req.query("trainingSessionId") ?? "";
  if (!batchId || !sessionId) throw new HttpError(422, "MANUAL_SCORE_CONTEXT_INVALID", "Data pelaksanaan tes tidak lengkap.");
  const plan = await manualScorePlan(context.env.DB, context.req.param("participantId"), batchId, sessionId);
  return context.json({ fields: plan.fields });
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

resultRoutes.put("/participants/:participantId/manual-scores", requireSameOrigin, requireCsrf, async (context) => {
  const parsed = manualScoreSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "SCORE_INVALID", "Nilai harus berada di antara 0 dan 100.");
  const referenceId = context.req.param("participantId");
  const plan = await manualScorePlan(context.env.DB, referenceId, parsed.data.batchId, parsed.data.trainingSessionId);
  const expectedStages = plan.fields.map((field) => field.stage);
  const submittedStages = parsed.data.scores.map((score) => score.stage);
  if (
    submittedStages.length !== expectedStages.length ||
    submittedStages.some((stage, index) => stage !== expectedStages[index])
  ) {
    throw new HttpError(409, "MANUAL_SCORE_STAGE_INVALID", "Tahap nilai sudah berubah. Buka kembali input nilai dan coba lagi.");
  }
  const participant = plan.target.participant_id
    ? { id: plan.target.participant_id }
    : await findOrCreateExamParticipant(context.env.DB, {
      profileId: plan.target.profile_id,
      batchId: plan.target.batch_id,
      name: plan.target.name,
      normalizedName: plan.target.normalized_name,
    });
  await saveManualAttemptScores(context.env.DB, {
    participantId: participant.id,
    batchId: plan.target.batch_id,
    sessionId: plan.target.training_session_id,
    adminId: context.get("admin").id,
    scores: parsed.data.scores.map((score) => ({
      ...score,
      attemptNumber: attemptNumberForStage(score.stage),
    })),
  });
  return context.json({ success: true });
});
