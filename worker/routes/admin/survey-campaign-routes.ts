import { Hono } from "hono";
import { z } from "zod";
import { evaluationStatus, indicatorPercentage, sectionPercentage } from "../../domain/surveys/evaluation";
import { createEvaluationIndicatorReportDocx } from "../../export/evaluation-report-docx";
import { HttpError } from "../../http/errors";
import { requireAdmin, requireCsrf, requireSameOrigin } from "../../middleware/admin-auth";
import {
  campaignCounts,
  findSurveyCampaignById,
  listSurveyCampaignCohorts,
  paginateSurveyCampaigns,
  type SurveyCampaignRecord,
} from "../../repositories/survey-campaign-repository";
import { getSurveyTemplateDetail } from "../../repositories/survey-repository";
import type { AppEnvironment } from "../../types";
import { paginationMeta, parsePagination } from "../../http/pagination";

export const surveyCampaignRoutes = new Hono<AppEnvironment>();
surveyCampaignRoutes.use("*", requireAdmin);

function activeYear(value: string | undefined) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2200) return parsed;
  return Number(new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date()));
}

function formatCohortList(names: string[]) {
  if (!names.length) return "";
  const cohortNumbers = names.map((name) => name.match(/^Angkatan\s+(.+)$/i)?.[1] ?? null);
  const parts = cohortNumbers.every((value): value is string => value !== null) ? cohortNumbers : names;
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} dan ${parts.at(-1)}`;
  return cohortNumbers.every((value) => value !== null) ? `Angkatan ${list}` : list;
}

function cohortFilePart(names: string[]) {
  return names
    .map((name) => name.replace(/^Angkatan\s+/i, ""))
    .join("-")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function scheduleOf(campaign: SurveyCampaignRecord) {
  return {
    mode: campaign.mode,
    manualOpen: campaign.manual_open === 1,
    opensAt: campaign.opens_at,
    closesAt: campaign.closes_at,
    openedManuallyAt: campaign.opened_manually_at,
    closedAt: campaign.closed_at,
  };
}

async function requireCampaignInYear(database: D1Database, campaignId: string, year: number) {
  const row = await database.prepare(
    `SELECT 1 AS found
     FROM survey_campaign_cohorts links
     JOIN training_cohorts cohorts ON cohorts.id = links.cohort_id
     WHERE links.survey_campaign_id = ? AND SUBSTR(cohorts.start_date, 1, 4) = ?
     LIMIT 1`,
  ).bind(campaignId, String(year)).first<{ found: number }>();
  if (!row) throw new HttpError(404, "SURVEY_CAMPAIGN_NOT_FOUND", `Pelaksanaan Evaluasi tidak ditemukan pada Tahun Aktif ${year}.`);
}

async function mapCampaign(database: D1Database, campaign: SurveyCampaignRecord) {
  const [cohorts, counts] = await Promise.all([
    listSurveyCampaignCohorts(database, campaign.id),
    campaignCounts(database, campaign.id),
  ]);
  return {
    id: campaign.id,
    slug: campaign.slug,
    training: { id: campaign.training_id, name: campaign.training_name },
    template: { id: campaign.survey_template_id, name: campaign.template_name, version: campaign.template_version },
    cohorts: cohorts.map((cohort) => ({ id: cohort.id, name: cohort.name, startDate: cohort.start_date, endDate: cohort.end_date })),
    schedule: scheduleOf(campaign),
    status: evaluationStatus(scheduleOf(campaign)),
    totalParticipants: Number(counts?.total_participants ?? 0),
    respondentCount: Number(counts?.respondent_count ?? 0),
    createdAt: campaign.created_at,
    updatedAt: campaign.updated_at,
  };
}

surveyCampaignRoutes.get("/catalog", async (context) => {
  const year = activeYear(context.req.query("year"));
  const yearText = String(year);
  const [trainings, cohorts, templates] = await Promise.all([
    context.env.DB.prepare(
      `SELECT DISTINCT trainings.id, trainings.name
       FROM trainings JOIN training_cohorts cohorts ON cohorts.training_id = trainings.id
       WHERE trainings.is_deleted = 0 AND SUBSTR(cohorts.start_date, 1, 4) = ?
       ORDER BY trainings.name COLLATE NOCASE ASC`,
    ).bind(yearText).all<{ id: string; name: string }>(),
    context.env.DB.prepare(
      `SELECT cohorts.id, cohorts.training_id, cohorts.name, cohorts.start_date, cohorts.end_date,
              EXISTS(SELECT 1 FROM survey_campaign_cohorts links WHERE links.cohort_id = cohorts.id) AS has_campaign
       FROM training_cohorts cohorts JOIN trainings ON trainings.id = cohorts.training_id
       WHERE trainings.is_deleted = 0 AND SUBSTR(cohorts.start_date, 1, 4) = ?
       ORDER BY cohorts.start_date ASC, cohorts.name COLLATE NOCASE ASC`,
    ).bind(yearText).all<{ id: string; training_id: string; name: string; start_date: string; end_date: string; has_campaign: number }>(),
    context.env.DB.prepare(
      `SELECT templates.id, templates.name, templates.version FROM survey_templates templates
       WHERE templates.status = 'PUBLISHED' AND templates.is_active = 1
         AND NOT EXISTS (
           SELECT 1 FROM survey_sections sections
           JOIN survey_questions questions ON questions.survey_section_id = sections.id
           WHERE sections.survey_template_id = templates.id
             AND questions.question_type = 'SCALE'
             AND (questions.scale_min <> 1 OR questions.scale_max <> 4)
         )
       ORDER BY name COLLATE NOCASE ASC, version DESC`,
    ).all<{ id: string; name: string; version: number }>(),
  ]);
  return context.json({
    year,
    trainings: trainings.results,
    cohorts: cohorts.results.map((item) => ({ id: item.id, trainingId: item.training_id, name: item.name, startDate: item.start_date, endDate: item.end_date, hasCampaign: item.has_campaign === 1 })),
    templates: templates.results,
  });
});

surveyCampaignRoutes.get("/", async (context) => {
  const pagination = parsePagination({ page: context.req.query("page"), limit: context.req.query("limit"), pageSize: context.req.query("pageSize") });
  const result = await paginateSurveyCampaigns(context.env.DB, {
    year: activeYear(context.req.query("year")), page: pagination.page, limit: pagination.limit,
    search: context.req.query("search"), trainingId: context.req.query("trainingId"), cohortId: context.req.query("cohortId"), status: context.req.query("status"),
  });
  return context.json({ campaigns: await Promise.all(result.rows.map((campaign) => mapCampaign(context.env.DB, campaign))), pagination: paginationMeta(pagination, result.total) });
});

const createSchema = z.object({
  trainingId: z.string().uuid(),
  cohortIds: z.array(z.string().uuid()).min(1, "Pilih minimal satu Angkatan.").max(100),
  templateId: z.string().uuid(),
  activeYear: z.number().int().min(2000).max(2200),
  mode: z.enum(["OPEN_NOW", "SCHEDULED"]),
  opensAt: z.string().datetime().nullable().optional(),
  closesAt: z.string().datetime().nullable().optional(),
}).superRefine((value, issue) => {
  if (value.mode === "SCHEDULED" && (!value.opensAt || !value.closesAt || Date.parse(value.closesAt) <= Date.parse(value.opensAt))) {
    issue.addIssue({ code: "custom", path: ["closesAt"], message: "Waktu tutup harus setelah waktu buka." });
  }
});

surveyCampaignRoutes.post("/", requireSameOrigin, requireCsrf, async (context) => {
  const parsed = createSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "SURVEY_CAMPAIGN_INVALID", parsed.error.issues[0]?.message ?? "Data Evaluasi tidak valid.");
  const input = parsed.data;
  const cohortIds = [...new Set(input.cohortIds)];
  const placeholders = cohortIds.map(() => "?").join(",");
  const [template, cohorts, occupied] = await Promise.all([
    context.env.DB.prepare(
      `SELECT templates.id FROM survey_templates templates
       WHERE templates.id = ? AND templates.status = 'PUBLISHED' AND templates.is_active = 1
         AND NOT EXISTS (
           SELECT 1 FROM survey_sections sections
           JOIN survey_questions questions ON questions.survey_section_id = sections.id
           WHERE sections.survey_template_id = templates.id
             AND questions.question_type = 'SCALE'
             AND (questions.scale_min <> 1 OR questions.scale_max <> 4)
         )`,
    ).bind(input.templateId).first(),
    context.env.DB.prepare(`SELECT id, training_id, start_date FROM training_cohorts WHERE id IN (${placeholders})`).bind(...cohortIds).all<{ id: string; training_id: string; start_date: string }>(),
    context.env.DB.prepare(`SELECT cohort_id FROM survey_campaign_cohorts WHERE cohort_id IN (${placeholders}) LIMIT 1`).bind(...cohortIds).first<{ cohort_id: string }>(),
  ]);
  if (!template) throw new HttpError(422, "SURVEY_TEMPLATE_NOT_PUBLISHED", "Pilih Template Evaluasi Published dengan skala 1–4.");
  if (cohorts.results.length !== cohortIds.length || cohorts.results.some((cohort) => cohort.training_id !== input.trainingId)) {
    throw new HttpError(422, "SURVEY_COHORT_INVALID", "Angkatan harus berasal dari Pelatihan yang dipilih.");
  }
  if (cohorts.results.some((cohort) => cohort.start_date.slice(0, 4) !== String(input.activeYear))) {
    throw new HttpError(422, "YEAR_MISMATCH", `Angkatan harus berada pada Tahun Aktif ${input.activeYear}.`);
  }
  if (occupied) throw new HttpError(409, "SURVEY_COHORT_ALREADY_USED", "Salah satu Angkatan sudah memiliki Pelaksanaan Evaluasi.");

  const id = crypto.randomUUID();
  const slug = `evaluasi-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const manual = input.mode === "OPEN_NOW";
  const statements: D1PreparedStatement[] = [
    context.env.DB.prepare(
      `INSERT INTO survey_campaigns (
        id, survey_template_id, cohort_id, slug, mode, opens_at, closes_at,
        opened_manually_at, manual_open, closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    ).bind(id, input.templateId, cohortIds[0], slug, manual ? "MANUAL" : "SCHEDULED", manual ? null : input.opensAt, manual ? null : input.closesAt, manual ? new Date().toISOString() : null, manual ? 1 : 0),
    ...cohortIds.map((cohortId) => context.env.DB.prepare(
      "INSERT INTO survey_campaign_cohorts (survey_campaign_id, cohort_id) VALUES (?, ?)",
    ).bind(id, cohortId)),
  ];
  try { await context.env.DB.batch(statements); }
  catch (error) {
    if (String(error).includes("UNIQUE")) throw new HttpError(409, "SURVEY_COHORT_ALREADY_USED", "Salah satu Angkatan sudah memiliki Pelaksanaan Evaluasi.");
    throw error;
  }
  const campaign = await findSurveyCampaignById(context.env.DB, id);
  return context.json({ campaign: await mapCampaign(context.env.DB, campaign!) }, 201);
});

const scheduleSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("OPEN_NOW") }),
  z.object({ status: z.literal("CLOSED") }),
  z.object({ status: z.literal("SCHEDULED"), opensAt: z.string().datetime(), closesAt: z.string().datetime() })
    .refine((value) => Date.parse(value.closesAt) > Date.parse(value.opensAt), { path: ["closesAt"], message: "Waktu tutup harus setelah waktu buka." }),
]);

surveyCampaignRoutes.put("/:campaignId/schedule", requireSameOrigin, requireCsrf, async (context) => {
  const campaign = await findSurveyCampaignById(context.env.DB, context.req.param("campaignId"));
  if (!campaign) throw new HttpError(404, "SURVEY_CAMPAIGN_NOT_FOUND", "Pelaksanaan Evaluasi tidak ditemukan.");
  await requireCampaignInYear(context.env.DB, campaign.id, activeYear(context.req.query("year")));
  const parsed = scheduleSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "SURVEY_SCHEDULE_INVALID", parsed.error.issues[0]?.message ?? "Pengaturan jadwal tidak valid.");
  const input = parsed.data;
  if (input.status === "SCHEDULED") {
    await context.env.DB.prepare(
      `UPDATE survey_campaigns SET mode='SCHEDULED', opens_at=?, closes_at=?, manual_open=0,
       closed_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    ).bind(input.opensAt, input.closesAt, campaign.id).run();
  } else if (input.status === "OPEN_NOW") {
    await context.env.DB.prepare(
      `UPDATE survey_campaigns SET mode='MANUAL', opens_at=NULL, closes_at=NULL, manual_open=1,
       opened_manually_at=COALESCE(opened_manually_at, CURRENT_TIMESTAMP), closed_at=NULL,
       updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    ).bind(campaign.id).run();
  } else {
    await context.env.DB.prepare(
      `UPDATE survey_campaigns SET mode='MANUAL', opens_at=NULL, closes_at=NULL, manual_open=0,
       closed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    ).bind(campaign.id).run();
  }
  const updated = await findSurveyCampaignById(context.env.DB, campaign.id);
  return context.json({ campaign: await mapCampaign(context.env.DB, updated!) });
});

type ResultAnswer = {
  question_id: string; option_id: string | null; other_text: string | null; numeric_value: number | null; text_value: string | null;
  participant_name: string; nik: string; cohort_id: string; cohort_name: string; submitted_at: string;
};

async function resultData(database: D1Database, campaign: SurveyCampaignRecord, cohortId?: string, participantOptions?: { page: number; limit: number; search?: string; status?: string }, commentOptions?: { page: number; limit: number }) {
  const cohorts = await listSurveyCampaignCohorts(database, campaign.id);
  if (cohortId && !cohorts.some((cohort) => cohort.id === cohortId)) throw new HttpError(422, "SURVEY_COHORT_INVALID", "Angkatan tidak termasuk dalam Evaluasi ini.");
  const template = await getSurveyTemplateDetail(database, campaign.survey_template_id);
  if (!template) throw new HttpError(409, "SURVEY_TEMPLATE_MISSING", "Template Evaluasi tidak ditemukan.");
  const cohortSql = cohortId ? " AND profiles.cohort_id = ?" : "";
  const params = cohortId ? [campaign.id, cohortId] : [campaign.id];
  const participantConditions: string[] = [];
  const participantFilterBindings: unknown[] = [];
  if (participantOptions?.search?.trim()) {
    const needle = `%${participantOptions.search.trim().replace(/[\\%_]/gu, "\\$&")}%`;
    participantConditions.push("(profiles.name LIKE ? ESCAPE '\\' OR profiles.nik LIKE ? ESCAPE '\\')");
    participantFilterBindings.push(needle, needle);
  }
  if (participantOptions?.status === "SUBMITTED") participantConditions.push("responses.submitted_at IS NOT NULL");
  if (participantOptions?.status === "NOT_SUBMITTED") participantConditions.push("responses.submitted_at IS NULL");
  const participantFilterSql = participantConditions.length ? ` AND ${participantConditions.join(" AND ")}` : "";
  const participantLimit = participantOptions?.limit ?? 20;
  const participantOffset = ((participantOptions?.page ?? 1) - 1) * participantLimit;
  const commentLimit = commentOptions?.limit ?? 20;
  const commentOffset = ((commentOptions?.page ?? 1) - 1) * commentLimit;
  const [participantRows, participantFilteredCount, counts, answerRows, commentRows, commentCount] = await Promise.all([
    database.prepare(
      `SELECT profiles.id, profiles.name, profiles.nik, profiles.cohort_id, cohorts.name AS cohort_name,
              responses.submitted_at
       FROM survey_campaign_cohorts links
       JOIN participant_profiles profiles ON profiles.cohort_id = links.cohort_id AND profiles.is_active = 1
       JOIN training_cohorts cohorts ON cohorts.id = profiles.cohort_id
       LEFT JOIN survey_responses responses ON responses.survey_campaign_id = links.survey_campaign_id
         AND responses.participant_profile_id = profiles.id
       WHERE links.survey_campaign_id = ?${cohortSql}${participantFilterSql}
       ORDER BY cohorts.start_date, cohorts.name COLLATE NOCASE, profiles.name COLLATE NOCASE, profiles.rowid
       LIMIT ? OFFSET ?`,
    ).bind(...params, ...participantFilterBindings, participantLimit, participantOffset).all<{ id: string; name: string; nik: string; cohort_id: string; cohort_name: string; submitted_at: string | null }>(),
    database.prepare(
      `SELECT COUNT(*) AS total FROM survey_campaign_cohorts links
       JOIN participant_profiles profiles ON profiles.cohort_id=links.cohort_id AND profiles.is_active=1
       LEFT JOIN survey_responses responses ON responses.survey_campaign_id=links.survey_campaign_id AND responses.participant_profile_id=profiles.id
       WHERE links.survey_campaign_id=?${cohortSql}${participantFilterSql}`,
    ).bind(...params, ...participantFilterBindings).first<{ total: number }>(),
    campaignCounts(database, campaign.id, cohortId),
    database.prepare(
      `SELECT answers.survey_question_id AS question_id, answers.option_id, answers.other_text,
              answers.numeric_value, answers.text_value, profiles.name AS participant_name,
              profiles.nik, profiles.cohort_id, cohorts.name AS cohort_name, responses.submitted_at
       FROM survey_answers answers
       JOIN survey_responses responses ON responses.id = answers.survey_response_id AND responses.submitted_at IS NOT NULL
       JOIN survey_questions questions ON questions.id = answers.survey_question_id AND questions.question_type <> 'LONG_TEXT'
       JOIN participant_profiles profiles ON profiles.id = responses.participant_profile_id
       JOIN training_cohorts cohorts ON cohorts.id = profiles.cohort_id
       WHERE responses.survey_campaign_id = ?${cohortSql}
       ORDER BY responses.submitted_at, profiles.name COLLATE NOCASE`,
    ).bind(...params).all<ResultAnswer>(),
    database.prepare(
      `SELECT answers.survey_question_id AS question_id, answers.option_id, answers.other_text,
              answers.numeric_value, answers.text_value, profiles.name AS participant_name,
              profiles.nik, profiles.cohort_id, cohorts.name AS cohort_name, responses.submitted_at
       FROM survey_answers answers
       JOIN survey_responses responses ON responses.id=answers.survey_response_id AND responses.submitted_at IS NOT NULL
       JOIN survey_questions questions ON questions.id=answers.survey_question_id AND questions.question_type='LONG_TEXT'
       JOIN participant_profiles profiles ON profiles.id=responses.participant_profile_id
       JOIN training_cohorts cohorts ON cohorts.id=profiles.cohort_id
       WHERE responses.survey_campaign_id=?${cohortSql} AND TRIM(COALESCE(answers.text_value,''))<>''
       ORDER BY responses.submitted_at DESC, answers.rowid DESC LIMIT ? OFFSET ?`,
    ).bind(...params, commentLimit, commentOffset).all<ResultAnswer>(),
    database.prepare(
      `SELECT COUNT(*) AS total FROM survey_answers answers
       JOIN survey_responses responses ON responses.id=answers.survey_response_id AND responses.submitted_at IS NOT NULL
       JOIN survey_questions questions ON questions.id=answers.survey_question_id AND questions.question_type='LONG_TEXT'
       JOIN participant_profiles profiles ON profiles.id=responses.participant_profile_id
       WHERE responses.survey_campaign_id=?${cohortSql} AND TRIM(COALESCE(answers.text_value,''))<>''`,
    ).bind(...params).first<{ total: number }>(),
  ]);
  const answersByQuestion = new Map<string, ResultAnswer[]>();
  for (const answer of answerRows.results) {
    const current = answersByQuestion.get(answer.question_id) ?? [];
    current.push(answer); answersByQuestion.set(answer.question_id, current);
  }
  for (const answer of commentRows.results) {
    const current = answersByQuestion.get(answer.question_id) ?? [];
    current.push(answer); answersByQuestion.set(answer.question_id, current);
  }
  const indicators: Array<{ no: number; sectionId: string; sectionCode: string; sectionTitle: string; questionId: string; indicator: string; value: number | null; responseCount: number; distribution: Array<{ value: number; count: number }> }> = [];
  const singleChoice: Array<{ sectionTitle: string; questionId: string; question: string; responseCount: number; options: Array<{ label: string; count: number; percentage: number }> }> = [];
  const comments: Array<{ sectionTitle: string; questionId: string; question: string; entries: Array<{ participantName: string; cohortName: string; text: string }> }> = [];
  const sections = template.sections.map((section) => {
    const sectionValues: Array<number | null> = [];
    for (const question of section.questions) {
      const answers = answersByQuestion.get(question.id) ?? [];
      if (question.question_type === "SCALE") {
        const numeric = answers.filter((answer) => answer.numeric_value !== null);
        const total = numeric.reduce((sum, answer) => sum + Number(answer.numeric_value), 0);
        const value = indicatorPercentage(total, numeric.length, Number(question.scale_max ?? 4));
        sectionValues.push(value);
        const distribution = Array.from({ length: Number(question.scale_max ?? 4) - Number(question.scale_min ?? 1) + 1 }, (_, index) => Number(question.scale_min ?? 1) + index)
          .map((score) => ({ value: score, count: numeric.filter((answer) => Number(answer.numeric_value) === score).length }));
        indicators.push({ no: indicators.length + 1, sectionId: section.id, sectionCode: section.section_code, sectionTitle: section.title, questionId: question.id, indicator: question.question_text, value, responseCount: numeric.length, distribution });
      } else if (question.question_type === "SINGLE_CHOICE") {
        const valid = answers.filter((answer) => answer.option_id !== null);
        singleChoice.push({
          sectionTitle: section.title, questionId: question.id, question: question.question_text, responseCount: valid.length,
          options: question.options.map((option) => {
            const count = valid.filter((answer) => answer.option_id === option.id).length;
            return { label: option.option_label, count, percentage: valid.length ? (count / valid.length) * 100 : 0 };
          }),
        });
      } else {
        comments.push({ sectionTitle: section.title, questionId: question.id, question: question.question_text, entries: answers.filter((answer) => answer.text_value?.trim()).map((answer) => ({ participantName: answer.participant_name, cohortName: answer.cohort_name, text: answer.text_value!.trim() })) });
      }
    }
    return { id: section.id, code: section.section_code, title: section.title, value: sectionPercentage(sectionValues) };
  });
  const participants = participantRows.results.map((participant) => ({ id: participant.id, name: participant.name, nik: participant.nik, cohortId: participant.cohort_id, cohortName: participant.cohort_name, status: participant.submitted_at ? "SUBMITTED" as const : "NOT_SUBMITTED" as const, submittedAt: participant.submitted_at }));
  const totalParticipants = Number(counts?.total_participants ?? 0);
  const respondentCount = Number(counts?.respondent_count ?? 0);
  const overallValue = sectionPercentage(indicators.map((indicator) => indicator.value));
  return { template, cohorts, participants, participantTotal: Number(participantFilteredCount?.total ?? 0), commentTotal: Number(commentCount?.total ?? 0), totalParticipants, respondentCount, responsePercentage: totalParticipants ? (respondentCount / totalParticipants) * 100 : 0, overallValue, sections, indicators, singleChoice, comments };
}

surveyCampaignRoutes.get("/:campaignId/results", async (context) => {
  const campaign = await findSurveyCampaignById(context.env.DB, context.req.param("campaignId"));
  if (!campaign) throw new HttpError(404, "SURVEY_CAMPAIGN_NOT_FOUND", "Pelaksanaan Evaluasi tidak ditemukan.");
  await requireCampaignInYear(context.env.DB, campaign.id, activeYear(context.req.query("year")));
  const pagination = parsePagination({ page: context.req.query("participantPage"), limit: context.req.query("participantLimit") });
  const commentPagination = parsePagination({ page: context.req.query("commentPage"), limit: context.req.query("commentLimit") });
  const data = await resultData(context.env.DB, campaign, context.req.query("cohortId") || undefined, {
    page: pagination.page, limit: pagination.limit, search: context.req.query("participantSearch"), status: context.req.query("participantStatus"),
  }, { page: commentPagination.page, limit: commentPagination.limit });
  const mapped = await mapCampaign(context.env.DB, campaign);
  return context.json({ campaign: mapped, results: { ...data, template: undefined, participantPagination: paginationMeta(pagination, data.participantTotal), commentPagination: paginationMeta(commentPagination, data.commentTotal) } });
});

surveyCampaignRoutes.get("/:campaignId/export-word", async (context) => {
  const campaign = await findSurveyCampaignById(context.env.DB, context.req.param("campaignId"));
  if (!campaign) throw new HttpError(404, "SURVEY_CAMPAIGN_NOT_FOUND", "Pelaksanaan Evaluasi tidak ditemukan.");
  await requireCampaignInYear(context.env.DB, campaign.id, activeYear(context.req.query("year")));
  const cohortId = context.req.query("cohortId") || undefined;
  const data = await resultData(context.env.DB, campaign, cohortId);
  const selectedCohortNames = (cohortId ? data.cohorts.filter((item) => item.id === cohortId) : data.cohorts).map((item) => item.name);
  const cohortLabel = formatCohortList(selectedCohortNames);
  const cohortSlug = cohortFilePart(selectedCohortNames);
  const report = await createEvaluationIndicatorReportDocx({
    title: `Tabel. Rincian Nilai Per Indikator pada Penyelenggaraan Diklat ${campaign.training_name}${cohortLabel ? ` ${cohortLabel}` : ""}`,
    rows: data.indicators.map((item) => ({ no: item.no, indicator: item.indicator, value: item.value })),
  });
  return new Response(report, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="tabel-evaluasi-${campaign.slug}${cohortSlug ? `-angkatan-${cohortSlug}` : ""}.docx"`,
    "Cache-Control": "no-store",
  } });
});

surveyCampaignRoutes.get("/:campaignId", async (context) => {
  const campaign = await findSurveyCampaignById(context.env.DB, context.req.param("campaignId"));
  if (!campaign) throw new HttpError(404, "SURVEY_CAMPAIGN_NOT_FOUND", "Pelaksanaan Evaluasi tidak ditemukan.");
  await requireCampaignInYear(context.env.DB, campaign.id, activeYear(context.req.query("year")));
  return context.json({ campaign: await mapCampaign(context.env.DB, campaign) });
});
