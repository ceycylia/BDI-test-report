import { Hono } from "hono";
import { z } from "zod";
import { isEvaluationOpen } from "../../domain/surveys/evaluation";
import { normalizeParticipantName } from "../../domain/participants/normalize-name";
import { normalizeNik } from "../../domain/participants/normalize-nik";
import { HttpError } from "../../http/errors";
import { requireSameOrigin } from "../../middleware/admin-auth";
import {
  createSurveyResponse,
  findSurveyCampaignBySlug,
  findSurveyResponse,
  findSurveyResponseById,
  listCampaignParticipantCandidates,
  listSurveyCampaignCohorts,
  participantCompletedAllPostTests,
  type CampaignParticipantRecord,
  type SurveyCampaignRecord,
  type SurveyResponseRecord,
} from "../../repositories/survey-campaign-repository";
import { getSurveyTemplateDetail, type SurveyQuestionDetail, type SurveyTemplateDetail } from "../../repositories/survey-repository";
import type { AppEnvironment } from "../../types";

export const surveyEvaluationRoutes = new Hono<AppEnvironment>();

function scheduleOf(campaign: SurveyCampaignRecord) {
  return { mode: campaign.mode, manualOpen: campaign.manual_open === 1, opensAt: campaign.opens_at, closesAt: campaign.closes_at, openedManuallyAt: campaign.opened_manually_at, closedAt: campaign.closed_at };
}

function ensureCampaignAvailable(campaign: SurveyCampaignRecord) {
  if (campaign.template_status === "DRAFT") throw new HttpError(409, "SURVEY_TEMPLATE_UNAVAILABLE", "Template Evaluasi belum tersedia.");
  if (!isEvaluationOpen(scheduleOf(campaign))) throw new HttpError(409, "SURVEY_CLOSED", "Evaluasi belum dibuka atau sudah ditutup.");
}

function publicTemplate(detail: SurveyTemplateDetail) {
  return {
    id: detail.template.id, name: detail.template.name, description: detail.template.description,
    sections: detail.sections.map((section) => ({
      id: section.id, code: section.section_code, title: section.title, description: section.description,
      questions: section.questions.map((question) => ({
        id: question.id, text: question.question_text, type: question.question_type,
        required: question.is_required === 1, helperText: question.helper_text,
        scaleMin: question.scale_min, scaleMax: question.scale_max,
        scaleMinLabel: question.scale_min_label, scaleMaxLabel: question.scale_max_label,
        options: question.options.map((option) => ({ id: option.id, label: option.option_label, allowsOtherText: option.allows_other_text === 1 })),
      })),
    })),
  };
}

surveyEvaluationRoutes.get("/:slug", async (context) => {
  const campaign = await findSurveyCampaignBySlug(context.env.DB, context.req.param("slug"));
  if (!campaign) throw new HttpError(404, "SURVEY_NOT_FOUND", "Link Evaluasi tidak ditemukan.");
  const cohorts = await listSurveyCampaignCohorts(context.env.DB, campaign.id);
  return context.json({
    evaluation: {
      name: campaign.template_name, trainingName: campaign.training_name,
      cohortNames: cohorts.map((cohort) => cohort.name), open: isEvaluationOpen(scheduleOf(campaign)),
    },
  });
});

const identifySchema = z.object({
  name: z.string().trim().min(2, "Nama lengkap wajib diisi.").max(150),
  nik: z.string().trim().regex(/^\d+$/u, "NIK hanya boleh berisi angka.").max(40).optional(),
});

surveyEvaluationRoutes.post("/:slug/identify", requireSameOrigin, async (context) => {
  const parsed = identifySchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "SURVEY_IDENTITY_INVALID", parsed.error.issues[0]?.message ?? "Data peserta tidak valid.");
  const campaign = await findSurveyCampaignBySlug(context.env.DB, context.req.param("slug"));
  if (!campaign) throw new HttpError(404, "SURVEY_NOT_FOUND", "Link Evaluasi tidak ditemukan.");
  ensureCampaignAvailable(campaign);
  const candidates = await listCampaignParticipantCandidates(context.env.DB, campaign.id, normalizeParticipantName(parsed.data.name));
  if (!candidates.length) throw new HttpError(404, "SURVEY_PARTICIPANT_NOT_FOUND", "Nama tidak ditemukan pada daftar peserta Evaluasi ini.");
  if (candidates.length > 1 && !parsed.data.nik) return context.json({ verificationRequired: true });
  const matches = parsed.data.nik ? candidates.filter((item) => normalizeNik(item.nik) === normalizeNik(parsed.data.nik!)) : candidates;
  if (matches.length !== 1) throw new HttpError(404, "SURVEY_PARTICIPANT_NOT_FOUND", "Nama dan NIK tidak cocok dengan daftar peserta Evaluasi ini.");
  const participant = matches[0]!;
  const existing = await findSurveyResponse(context.env.DB, campaign.id, participant.id);
  if (existing?.submitted_at) return context.json({ alreadySubmitted: true, participant: { name: participant.name, cohortName: participant.cohort_name } });
  const completion = await participantCompletedAllPostTests(context.env.DB, participant);
  if (!completion.eligible) throw new HttpError(409, "SURVEY_POST_TEST_INCOMPLETE", `Selesaikan Post-Test seluruh materi terlebih dahulu (${completion.completed}/${completion.total} selesai).`);
  const response = existing ?? await createSurveyResponse(context.env.DB, campaign.id, participant.id);
  return context.json({ verificationRequired: false, alreadySubmitted: false, responseId: response!.id, participant: { name: participant.name, cohortName: participant.cohort_name } });
});

const answerSchema = z.object({
  questionId: z.string().uuid(),
  optionId: z.string().uuid().nullable().optional(),
  otherText: z.string().max(5_000).nullable().optional(),
  numericValue: z.number().int().nullable().optional(),
  textValue: z.string().max(20_000).nullable().optional(),
});
const answersSchema = z.object({ answers: z.array(answerSchema).max(500) });

type AnswerInput = z.infer<typeof answerSchema>;

async function responseContext(database: D1Database, slug: string, responseId: string) {
  const campaign = await findSurveyCampaignBySlug(database, slug);
  if (!campaign) throw new HttpError(404, "SURVEY_NOT_FOUND", "Link Evaluasi tidak ditemukan.");
  const response = await findSurveyResponseById(database, campaign.id, responseId);
  if (!response) throw new HttpError(404, "SURVEY_RESPONSE_NOT_FOUND", "Sesi Evaluasi tidak ditemukan.");
  const participant = await database.prepare(
    `SELECT profiles.id, profiles.name, profiles.normalized_name, profiles.nik, profiles.cohort_id,
            cohorts.name AS cohort_name, profiles.training_id
     FROM participant_profiles profiles
     JOIN training_cohorts cohorts ON cohorts.id = profiles.cohort_id
     JOIN survey_campaign_cohorts links ON links.cohort_id = profiles.cohort_id AND links.survey_campaign_id = ?
     WHERE profiles.id = ? AND profiles.is_active = 1 LIMIT 1`,
  ).bind(campaign.id, response.participant_profile_id).first<CampaignParticipantRecord>();
  if (!participant) throw new HttpError(403, "SURVEY_PARTICIPANT_INVALID", "Peserta tidak terdaftar pada Evaluasi ini.");
  const template = await getSurveyTemplateDetail(database, campaign.survey_template_id);
  if (!template || campaign.template_status === "DRAFT") throw new HttpError(409, "SURVEY_TEMPLATE_UNAVAILABLE", "Template Evaluasi tidak tersedia.");
  return { campaign, response, participant, template };
}

function validateAnswers(template: SurveyTemplateDetail, answers: AnswerInput[], requireComplete: boolean) {
  const questions = new Map<string, SurveyQuestionDetail>();
  for (const section of template.sections) for (const question of section.questions) questions.set(question.id, question);
  const unique = new Map<string, AnswerInput>();
  for (const answer of answers) {
    if (unique.has(answer.questionId)) throw new HttpError(422, "SURVEY_ANSWER_DUPLICATE", "Satu pertanyaan hanya boleh memiliki satu jawaban.");
    const question = questions.get(answer.questionId);
    if (!question) throw new HttpError(422, "SURVEY_QUESTION_INVALID", "Pertanyaan tidak berasal dari Template Evaluasi ini.");
    if (question.question_type === "SCALE") {
      const value = answer.numericValue;
      if (value === null || value === undefined || value < Number(question.scale_min) || value > Number(question.scale_max)) throw new HttpError(422, "SURVEY_SCALE_INVALID", "Nilai skala tidak valid.");
      unique.set(answer.questionId, { questionId: answer.questionId, numericValue: value });
    } else if (question.question_type === "SINGLE_CHOICE") {
      const option = question.options.find((item) => item.id === answer.optionId);
      if (!option) throw new HttpError(422, "SURVEY_OPTION_INVALID", "Pilihan jawaban tidak berasal dari pertanyaan ini.");
      const otherText = answer.otherText?.trim() || null;
      if (requireComplete && option.allows_other_text === 1 && !otherText) throw new HttpError(422, "SURVEY_OTHER_REQUIRED", "Lengkapi jawaban lainnya.");
      unique.set(answer.questionId, { questionId: answer.questionId, optionId: option.id, otherText: option.allows_other_text === 1 ? otherText : null });
    } else {
      const textValue = answer.textValue?.trim() || null;
      if (requireComplete && question.is_required === 1 && !textValue) throw new HttpError(422, "SURVEY_REQUIRED_INCOMPLETE", "Masih ada pertanyaan wajib yang belum dijawab.");
      if (textValue) unique.set(answer.questionId, { questionId: answer.questionId, textValue });
    }
  }
  if (requireComplete) {
    const missing = [...questions.values()].find((question) => question.is_required === 1 && !unique.has(question.id));
    if (missing) throw new HttpError(422, "SURVEY_REQUIRED_INCOMPLETE", "Masih ada pertanyaan wajib yang belum dijawab.");
  }
  return [...unique.values()];
}

function answerStatements(database: D1Database, response: SurveyResponseRecord, answers: AnswerInput[], submitted: boolean) {
  return [
    database.prepare(
      `DELETE FROM survey_answers
       WHERE survey_response_id = ?
         AND EXISTS (SELECT 1 FROM survey_responses WHERE id = ? AND submitted_at IS NULL)`,
    ).bind(response.id, response.id),
    ...answers.map((answer) => database.prepare(
      `INSERT INTO survey_answers (id, survey_response_id, survey_question_id, option_id, other_text, numeric_value, text_value)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), response.id, answer.questionId, answer.optionId ?? null, answer.otherText ?? null, answer.numericValue ?? null, answer.textValue ?? null)),
    database.prepare(
      submitted
        ? "UPDATE survey_responses SET submitted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=? AND submitted_at IS NULL"
        : "UPDATE survey_responses SET updated_at=CURRENT_TIMESTAMP WHERE id=? AND submitted_at IS NULL",
    ).bind(response.id),
  ];
}

surveyEvaluationRoutes.get("/:slug/responses/:responseId", async (context) => {
  const loaded = await responseContext(context.env.DB, context.req.param("slug"), context.req.param("responseId"));
  if (!loaded.response.submitted_at) {
    ensureCampaignAvailable(loaded.campaign);
    const completion = await participantCompletedAllPostTests(context.env.DB, loaded.participant);
    if (!completion.eligible) throw new HttpError(409, "SURVEY_POST_TEST_INCOMPLETE", "Post-Test seluruh materi belum selesai.");
  }
  const answers = await context.env.DB.prepare(
    `SELECT survey_question_id AS questionId, option_id AS optionId, other_text AS otherText,
            numeric_value AS numericValue, text_value AS textValue
     FROM survey_answers WHERE survey_response_id = ?`,
  ).bind(loaded.response.id).all<{ questionId: string; optionId: string | null; otherText: string | null; numericValue: number | null; textValue: string | null }>();
  return context.json({
    submitted: Boolean(loaded.response.submitted_at), submittedAt: loaded.response.submitted_at,
    participant: { name: loaded.participant.name, cohortName: loaded.participant.cohort_name },
    evaluation: { trainingName: loaded.campaign.training_name, template: publicTemplate(loaded.template) },
    answers: answers.results,
  });
});

surveyEvaluationRoutes.put("/:slug/responses/:responseId/draft", requireSameOrigin, async (context) => {
  const parsed = answersSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "SURVEY_ANSWERS_INVALID", parsed.error.issues[0]?.message ?? "Jawaban tidak valid.");
  const loaded = await responseContext(context.env.DB, context.req.param("slug"), context.req.param("responseId"));
  ensureCampaignAvailable(loaded.campaign);
  if (loaded.response.submitted_at) throw new HttpError(409, "SURVEY_ALREADY_SUBMITTED", "Evaluasi sudah pernah Anda isi.");
  const completion = await participantCompletedAllPostTests(context.env.DB, loaded.participant);
  if (!completion.eligible) throw new HttpError(409, "SURVEY_POST_TEST_INCOMPLETE", "Post-Test seluruh materi belum selesai.");
  const answers = validateAnswers(loaded.template, parsed.data.answers, false);
  await context.env.DB.batch(answerStatements(context.env.DB, loaded.response, answers, false));
  return context.json({ saved: true });
});

surveyEvaluationRoutes.post("/:slug/responses/:responseId/submit", requireSameOrigin, async (context) => {
  const parsed = answersSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "SURVEY_ANSWERS_INVALID", parsed.error.issues[0]?.message ?? "Jawaban tidak valid.");
  const loaded = await responseContext(context.env.DB, context.req.param("slug"), context.req.param("responseId"));
  ensureCampaignAvailable(loaded.campaign);
  if (loaded.response.submitted_at) throw new HttpError(409, "SURVEY_ALREADY_SUBMITTED", "Evaluasi sudah pernah Anda isi.");
  const completion = await participantCompletedAllPostTests(context.env.DB, loaded.participant);
  if (!completion.eligible) throw new HttpError(409, "SURVEY_POST_TEST_INCOMPLETE", "Post-Test seluruh materi belum selesai.");
  const answers = validateAnswers(loaded.template, parsed.data.answers, true);
  await context.env.DB.batch(answerStatements(context.env.DB, loaded.response, answers, true));
  return context.json({ submitted: true });
});
