import { Hono } from "hono";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { requireAdmin, requireCsrf, requireSameOrigin } from "../../middleware/admin-auth";
import { getManualScoreContext, getParticipantResult, listExportAnswers, listParticipantAttemptDetails, listResultFilterOptions, listResultSummaries, resetAttempt, saveManualAttemptScores, updateParticipantName } from "../../repositories/result-repository";
import { findOrCreateExamParticipant } from "../../repositories/participant-repository";
import { attemptNumberForStage, type AttemptStage } from "../../domain/attempts/progression";
import { manualScoreFields } from "../../domain/attempts/admin-attempt-management";
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

export type ExportRow = Record<string, string | number | null>;

function optionValue(row: ExportRow, key: unknown) {
  return typeof key === "string" ? row[`option_${key.toLocaleLowerCase("id-ID")}`] ?? "" : "";
}

function selectedAnswer(row: ExportRow) {
  const key = row.selected_original_option_key;
  return typeof key === "string" ? String(optionValue(row, key) || key) : "";
}

function numericScore(value: string | number | null | undefined) {
  const score = typeof value === "number" ? value : typeof value === "string" && value !== "" ? Number(value) : null;
  return score !== null && Number.isFinite(score) ? Math.round(score * 100) / 100 : null;
}

function averageScore(values: Array<string | number | null | undefined>) {
  const scores = values.map(numericScore).filter((score): score is number => score !== null);
  if (!scores.length) return null;
  return Math.round((scores.reduce((total, score) => total + score, 0) / scores.length) * 100) / 100;
}

function bestRemedial(row: ExportRow) {
  const scores = [row.remedial_1_score, row.remedial_2_score]
    .map(numericScore)
    .filter((score): score is number => score !== null);
  return scores.length ? Math.max(...scores) : null;
}

function humanStatus(value: string | number | null | undefined) {
  const status = String(value ?? "").trim();
  if (!status) return "-";
  return status
    .toLocaleLowerCase("id-ID")
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("id-ID"));
}

function participantOverallStatus(rows: ExportRow[]) {
  if (rows.some((row) => row.active_stage !== null && row.active_stage !== "")) return "Sedang Mengerjakan";
  if (rows.some((row) => numericScore(row.pre_score) === null || numericScore(row.final_post_score) === null)) return "Belum Selesai";
  if (rows.some((row) => {
    const finalScore = numericScore(row.final_post_score);
    const passingScore = numericScore(row.passing_score);
    return finalScore !== null && passingScore !== null && finalScore < passingScore;
  })) return "Belum Lulus";
  return "Lulus";
}

function stableParticipantKey(row: ExportRow) {
  return `${String(row.profile_id ?? row.id ?? "")}:${String(row.cohort_id ?? "")}`;
}

function sortSummaryRows(left: ExportRow, right: ExportRow) {
  return String(left.cohort_name ?? "").localeCompare(String(right.cohort_name ?? ""), "id-ID")
    || String(left.name ?? "").localeCompare(String(right.name ?? ""), "id-ID")
    || Number(left.material_sort_order ?? 0) - Number(right.material_sort_order ?? 0)
    || String(left.material_name ?? "").localeCompare(String(right.material_name ?? ""), "id-ID");
}

function reportSheet(
  name: string,
  title: string,
  headers: string[],
  dataRows: Array<Array<string | number | null>>,
  columnWidths: number[],
  centerColumns: number[] = [],
) {
  const rowStyles: Record<number, "title" | "section" | "header" | "data" | "alternate-data"> = { 0: "title", 2: "header" };
  const rowHeights: Record<number, number> = { 0: 24, 2: 22.5 };
  dataRows.forEach((_, index) => {
    rowStyles[index + 3] = index % 2 === 0 ? "data" : "alternate-data";
    rowHeights[index + 3] = 22.5;
  });
  const lastColumn = String.fromCharCode(64 + Math.min(headers.length, 26));
  return {
    name,
    rows: [[title], [null], headers, ...dataRows],
    variant: "test-results" as const,
    rowStyles,
    rowHeights,
    centerColumns,
    columnWidths,
    freezeRows: 3,
    autoFilterRange: `A3:${lastColumn}${Math.max(3, dataRows.length + 3)}`,
  };
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

function excelColumnName(index: number) {
  let result = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  }
  return result;
}

function formatExportTimestamp(value: string | number | null | undefined) {
  const date = typeof value === "string" || typeof value === "number" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(date).replace(",", "");
}

function buildMaterialAnswerSheet(sheetName: string, attempts: ExportRow[]) {
  const questions = [...new Map(
    attempts
      .slice()
      .sort((left, right) => Number(left.display_position) - Number(right.display_position)
        || String(left.question_id).localeCompare(String(right.question_id)))
      .map((row) => [String(row.question_id), { id: String(row.question_id), text: String(row.question_text ?? "") }]),
  ).values()];
  const attemptsById = new Map<string, ExportRow[]>();
  for (const row of attempts) {
    const attemptId = String(row.attempt_id);
    attemptsById.set(attemptId, [...(attemptsById.get(attemptId) ?? []), row]);
  }
  const rows: Array<Array<string | number | null>> = [[
    "Timestamp", "Score", "NAMA", "Tahap", "Angkatan",
    ...questions.map((question, index) => `${index + 1}. ${question.text.replace(/^\s*\d+\.\s*/u, "")}`),
  ]];
  [...attemptsById.values()]
    .sort((left, right) => String(left[0]?.submitted_at ?? "").localeCompare(String(right[0]?.submitted_at ?? ""))
      || String(left[0]?.name ?? "").localeCompare(String(right[0]?.name ?? ""), "id-ID"))
    .forEach((attempt) => {
      const answers = new Map(attempt.map((row) => [String(row.question_id), selectedAnswer(row)]));
      rows.push([
        formatExportTimestamp(attempt[0]?.submitted_at), numericScore(attempt[0]?.score), attempt[0]?.name ?? "",
        humanStatus(attempt[0]?.stage), attempt[0]?.cohort_name ?? attempt[0]?.batch_name ?? "",
        ...questions.map((question) => answers.get(question.id) ?? ""),
      ]);
    });
  const rowStyles: Record<number, "header" | "data"> = { 0: "header" };
  const rowHeights: Record<number, number> = { 0: 30 };
  rows.slice(1).forEach((_, index) => {
    rowStyles[index + 1] = "data";
    rowHeights[index + 1] = 22.5;
  });
  return {
    name: sheetName,
    rows,
    variant: "test-results-reference" as const,
    rowStyles,
    rowHeights,
    centerColumns: [0, 1, 3],
    columnWidths: [19, 12, 28, 18, 20, ...Array.from({ length: questions.length }, () => 38)],
    freezeRows: 1,
    autoFilterRange: `A1:${excelColumnName(rows[0]!.length - 1)}${Math.max(1, rows.length)}`,
  };
}

export function buildMaterialAnswerSheets(summaries: ExportRow[], answers: ExportRow[]) {
  const participantIds = new Set(
    summaries.map((row) => String(row.participant_id ?? "")).filter(Boolean),
  );
  const filteredAnswers = answers.filter((row) => participantIds.has(String(row.participant_id ?? "")));
  const materials = [...new Map(
    summaries.map((row) => [String(row.material_id), row]),
  ).values()].sort((left, right) => Number(left.material_sort_order ?? 0) - Number(right.material_sort_order ?? 0)
    || String(left.material_name ?? "").localeCompare(String(right.material_name ?? ""), "id-ID"));
  const usedSheetNames = new Set(["rangkuman nilai", "nilai per materi", "data lengkap"]);
  return materials.map((material) => buildMaterialAnswerSheet(
    safeSheetName(String(material.material_name ?? "Mata Diklat"), usedSheetNames),
    filteredAnswers.filter((answer) => String(answer.material_id) === String(material.material_id)),
  ));
}

function buildSummarySheet(trainingName: string, summaries: ExportRow[]) {
  const participants = new Map<string, ExportRow[]>();
  for (const row of summaries) {
    const key = stableParticipantKey(row);
    participants.set(key, [...(participants.get(key) ?? []), row]);
  }
  const rows = [...participants.values()]
    .map((participantRows) => participantRows.slice().sort(sortSummaryRows))
    .sort((left, right) => sortSummaryRows(left[0]!, right[0]!))
    .map((participantRows, index) => {
      const participant = participantRows[0]!;
      return [
        index + 1,
        participant.name ?? "",
        participant.nik ?? "",
        participant.cohort_name ?? "",
        averageScore(participantRows.map((row) => row.pre_score)),
        averageScore(participantRows.map((row) => row.post_score)),
        averageScore(participantRows.map((row) => row.final_post_score)),
        participantOverallStatus(participantRows),
      ];
    });
  return reportSheet(
    "Rangkuman Nilai",
    `Rangkuman Nilai - ${trainingName}`,
    ["No", "Nama Peserta", "NIK", "Angkatan", "Rata-rata Pre Test", "Rata-rata Post Test", "Rata-rata Nilai Final", "Status"],
    rows,
    [7, 30, 20, 20, 19, 20, 22, 20],
    [0, 4, 5, 6, 7],
  );
}

function buildMaterialScoreSheet(trainingName: string, summaries: ExportRow[]) {
  const rows = summaries
    .slice()
    .sort(sortSummaryRows)
    .map((row, index) => [
      index + 1,
      row.name ?? "",
      row.nik ?? "",
      row.cohort_name ?? "",
      row.material_name ?? "",
      numericScore(row.pre_score),
      numericScore(row.post_score),
      bestRemedial(row),
      numericScore(row.final_post_score),
      humanStatus(row.result_status),
    ]);
  return reportSheet(
    "Nilai Per Materi",
    `Nilai Per Materi - ${trainingName}`,
    ["No", "Nama Peserta", "NIK", "Angkatan", "Materi", "Pre Test", "Post Test", "Remedial", "Nilai Final", "Status"],
    rows,
    [7, 28, 20, 20, 34, 14, 14, 14, 14, 20],
    [0, 5, 6, 7, 8, 9],
  );
}

function buildCompleteDataSheet(trainingName: string, summaries: ExportRow[]) {
  const rows = summaries
    .slice()
    .sort(sortSummaryRows)
    .map((row, index) => [
      index + 1,
      row.profile_id ?? "",
      row.participant_id ?? "",
      row.name ?? "",
      row.nik ?? "",
      row.cohort_name ?? "",
      row.training_year ?? "",
      row.training_name ?? "",
      row.material_name ?? "",
      numericScore(row.pre_score),
      numericScore(row.post_score),
      numericScore(row.remedial_1_score),
      numericScore(row.remedial_2_score),
      numericScore(row.final_post_score),
      numericScore(row.passing_score),
      humanStatus(row.result_status),
      row.pre_submitted_at ?? "",
      row.post_submitted_at ?? "",
      row.remedial_1_submitted_at ?? "",
      row.remedial_2_submitted_at ?? "",
    ]);
  return reportSheet(
    "Data Lengkap",
    `Data Lengkap Hasil Tes - ${trainingName}`,
    [
      "No", "Profile ID", "Participant ID", "Nama Peserta", "NIK", "Angkatan", "Tahun", "Pelatihan", "Materi",
      "Pre Test", "Post Test", "Remedial 1", "Remedial 2", "Nilai Final", "Passing Score", "Status",
      "Tanggal Pre", "Tanggal Post", "Tanggal Remedial 1", "Tanggal Remedial 2",
    ],
    rows,
    [7, 30, 30, 28, 20, 20, 10, 30, 34, 13, 13, 13, 13, 13, 15, 20, 22, 22, 22, 22],
    [0, 6, 9, 10, 11, 12, 13, 14, 15],
  );
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

resultRoutes.get("/export", async (context) => {
  const trainingId = context.req.query("trainingId")?.trim();
  if (!trainingId) throw new HttpError(422, "TRAINING_REQUIRED", "Pilih pelatihan terlebih dahulu.");

  const summaries = await listResultSummaries(context.env.DB, {
    year: activeYear(context.req.query("year")),
    trainingId,
    materialId: context.req.query("materialId"),
    cohortId: context.req.query("cohortId"),
    status: context.req.query("status"),
    search: context.req.query("search"),
  });
  if (!summaries.length) throw new HttpError(404, "TRAINING_RESULTS_NOT_FOUND", "Belum ada hasil tes yang cocok dengan filter yang dipilih.");

  const trainingName = String(summaries[0]?.training_name ?? "Pelatihan");
  const participantIds = [...new Set(
    summaries.map((row) => String(row.participant_id ?? "")).filter(Boolean),
  )];
  const answers = await listExportAnswers(context.env.DB, participantIds);
  const workbook = createXlsx([
    buildSummarySheet(trainingName, summaries),
    buildMaterialScoreSheet(trainingName, summaries),
    buildCompleteDataSheet(trainingName, summaries),
    ...buildMaterialAnswerSheets(summaries, answers),
  ]);
  const filename = `hasil-tes-${safeFileName(trainingName)}.xlsx`;
  return new Response(workbook.slice().buffer as ArrayBuffer, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  } });
});

resultRoutes.get("/participants/:participantId", async (context) => {
  const participant = await getParticipantResult(
    context.env.DB,
    context.req.param("participantId"),
    activeYear(context.req.query("year")),
    context.req.query("batchId"),
    context.req.query("trainingSessionId"),
  );
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
  })).min(1).max(4),
});

async function manualScorePlan(context: Parameters<typeof getManualScoreContext>[0], referenceId: string, batchId: string, sessionId: string) {
  const target = await getManualScoreContext(context, referenceId, batchId, sessionId);
  if (!target) throw new HttpError(404, "PARTICIPANT_NOT_FOUND", "Peserta atau pelaksanaan tes tidak ditemukan.");
  const attempts = target.participant_id
    ? (await listParticipantAttemptDetails(context, target.participant_id)).attempts
    : [];
  return { target, fields: manualScoreFields(attempts) };
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
  const body = z.object({
    batchId: z.string().min(1),
    trainingSessionId: z.string().min(1),
    reason: z.string().trim().max(500).nullable().optional(),
  }).safeParse(await context.req.json().catch(() => null));
  if (!body.success) throw new HttpError(422, "RESET_CONTEXT_INVALID", "Data mata diklat untuk reset tidak lengkap.");
  const detail = await listParticipantAttemptDetails(context.env.DB, participantId);
  const attempt = detail.attempts.find((item) => item.id === context.req.param("attemptId"));
  if (!attempt) throw new HttpError(404, "ATTEMPT_NOT_FOUND", "Attempt tidak ditemukan.");
  if (attempt.status === "RESET") throw new HttpError(409, "ATTEMPT_ALREADY_RESET", "Attempt ini sudah direset.");
  if (attempt.batch_id !== body.data.batchId || attempt.training_session_id !== body.data.trainingSessionId) {
    throw new HttpError(409, "RESET_CONTEXT_MISMATCH", "Attempt tidak sesuai dengan mata diklat yang sedang dibuka.");
  }
  await resetAttempt(context.env.DB, {
    attemptId: context.req.param("attemptId"),
    participantId,
    batchId: body.data.batchId,
    sessionId: body.data.trainingSessionId,
    stage: String(attempt.stage) as AttemptStage,
    adminId: context.get("admin").id,
    reason: body.data.reason ?? null,
  });
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
