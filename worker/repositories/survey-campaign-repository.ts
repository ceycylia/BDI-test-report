export type SurveyCampaignRecord = {
  id: string;
  survey_template_id: string;
  cohort_id: string;
  slug: string;
  mode: "MANUAL" | "SCHEDULED";
  opens_at: string | null;
  closes_at: string | null;
  opened_manually_at: string | null;
  manual_open: number;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  training_id: string;
  training_name: string;
  template_name: string;
  template_version: number;
  template_status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

export type CampaignCohortRecord = {
  id: string;
  training_id: string;
  name: string;
  start_date: string;
  end_date: string;
};

export type CampaignParticipantRecord = {
  id: string;
  name: string;
  normalized_name: string;
  nik: string;
  cohort_id: string;
  cohort_name: string;
  training_id: string;
};

export type SurveyResponseRecord = {
  id: string;
  survey_campaign_id: string;
  participant_profile_id: string;
  started_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

const campaignSelect = `SELECT campaigns.id, campaigns.survey_template_id, campaigns.cohort_id,
  campaigns.slug, campaigns.mode, campaigns.opens_at, campaigns.closes_at,
  campaigns.opened_manually_at, campaigns.manual_open, campaigns.closed_at,
  campaigns.created_at, campaigns.updated_at,
  trainings.id AS training_id, trainings.name AS training_name,
  templates.name AS template_name, templates.version AS template_version,
  templates.status AS template_status
FROM survey_campaigns campaigns
JOIN training_cohorts primary_cohort ON primary_cohort.id = campaigns.cohort_id
JOIN trainings ON trainings.id = primary_cohort.training_id
JOIN survey_templates templates ON templates.id = campaigns.survey_template_id`;

export async function findSurveyCampaignById(database: D1Database, id: string) {
  return database.prepare(`${campaignSelect} WHERE campaigns.id = ? LIMIT 1`)
    .bind(id).first<SurveyCampaignRecord>();
}

export async function findSurveyCampaignBySlug(database: D1Database, slug: string) {
  return database.prepare(`${campaignSelect} WHERE campaigns.slug = ? COLLATE NOCASE LIMIT 1`)
    .bind(slug).first<SurveyCampaignRecord>();
}

export async function listSurveyCampaignCohorts(database: D1Database, campaignId: string) {
  const result = await database.prepare(
    `SELECT cohorts.id, cohorts.training_id, cohorts.name, cohorts.start_date, cohorts.end_date
     FROM survey_campaign_cohorts links
     JOIN training_cohorts cohorts ON cohorts.id = links.cohort_id
     WHERE links.survey_campaign_id = ?
     ORDER BY cohorts.start_date ASC, cohorts.name COLLATE NOCASE ASC`,
  ).bind(campaignId).all<CampaignCohortRecord>();
  return result.results;
}

export async function listSurveyCampaigns(database: D1Database, year: number) {
  const result = await database.prepare(
    `${campaignSelect}
     WHERE EXISTS (
       SELECT 1 FROM survey_campaign_cohorts year_links
       JOIN training_cohorts year_cohorts ON year_cohorts.id = year_links.cohort_id
       WHERE year_links.survey_campaign_id = campaigns.id
         AND SUBSTR(year_cohorts.start_date, 1, 4) = ?
     )
     ORDER BY campaigns.created_at DESC, campaigns.rowid DESC`,
  ).bind(String(year)).all<SurveyCampaignRecord>();
  return result.results;
}

export async function paginateSurveyCampaigns(
  database: D1Database,
  input: { year: number; page: number; limit: number; search?: string; trainingId?: string; cohortId?: string; status?: string },
) {
  const conditions = [`EXISTS (
    SELECT 1 FROM survey_campaign_cohorts year_links
    JOIN training_cohorts year_cohorts ON year_cohorts.id = year_links.cohort_id
    WHERE year_links.survey_campaign_id = campaigns.id
      AND SUBSTR(year_cohorts.start_date, 1, 4) = ?
  )`];
  const bindings: unknown[] = [String(input.year)];
  if (input.trainingId) { conditions.push("primary_cohort.training_id = ?"); bindings.push(input.trainingId); }
  if (input.cohortId) {
    conditions.push("EXISTS (SELECT 1 FROM survey_campaign_cohorts filter_links WHERE filter_links.survey_campaign_id = campaigns.id AND filter_links.cohort_id = ?)");
    bindings.push(input.cohortId);
  }
  if (input.search?.trim()) {
    const needle = `%${input.search.trim().replace(/[\\%_]/gu, "\\$&")}%`;
    conditions.push(`(trainings.name LIKE ? ESCAPE '\\' OR EXISTS (
      SELECT 1 FROM survey_campaign_cohorts search_links JOIN training_cohorts search_cohorts ON search_cohorts.id=search_links.cohort_id
      WHERE search_links.survey_campaign_id=campaigns.id AND search_cohorts.name LIKE ? ESCAPE '\\'
    ))`);
    bindings.push(needle, needle);
  }
  if (input.status === "OPEN") conditions.push("((campaigns.mode='MANUAL' AND campaigns.manual_open=1) OR (campaigns.mode='SCHEDULED' AND datetime('now') BETWEEN datetime(campaigns.opens_at) AND datetime(campaigns.closes_at)))");
  if (input.status === "NOT_OPEN") conditions.push("((campaigns.mode='MANUAL' AND campaigns.manual_open=0 AND campaigns.opened_manually_at IS NULL AND campaigns.closed_at IS NULL) OR (campaigns.mode='SCHEDULED' AND datetime('now') < datetime(campaigns.opens_at)))");
  if (input.status === "FINISHED") conditions.push("((campaigns.mode='MANUAL' AND campaigns.manual_open=0 AND (campaigns.opened_manually_at IS NOT NULL OR campaigns.closed_at IS NOT NULL)) OR (campaigns.mode='SCHEDULED' AND datetime('now') > datetime(campaigns.closes_at)))");
  const where = `WHERE ${conditions.join(" AND ")}`;
  const [count, result] = await Promise.all([
    database.prepare(`SELECT COUNT(*) AS total FROM survey_campaigns campaigns JOIN training_cohorts primary_cohort ON primary_cohort.id=campaigns.cohort_id JOIN trainings ON trainings.id=primary_cohort.training_id JOIN survey_templates templates ON templates.id=campaigns.survey_template_id ${where}`).bind(...bindings).first<{ total: number }>(),
    database.prepare(`${campaignSelect} ${where} ORDER BY campaigns.created_at DESC, campaigns.rowid DESC LIMIT ? OFFSET ?`).bind(...bindings, input.limit, (input.page - 1) * input.limit).all<SurveyCampaignRecord>(),
  ]);
  return { rows: result.results, total: Number(count?.total ?? 0) };
}

export async function campaignCounts(database: D1Database, campaignId: string, cohortId?: string) {
  const cohortClause = cohortId ? " AND profiles.cohort_id = ?" : "";
  const bindings = cohortId ? [campaignId, cohortId] : [campaignId];
  return database.prepare(
    `SELECT
       COUNT(DISTINCT profiles.id) AS total_participants,
       COUNT(DISTINCT CASE WHEN responses.submitted_at IS NOT NULL THEN profiles.id END) AS respondent_count
     FROM survey_campaign_cohorts links
     JOIN participant_profiles profiles ON profiles.cohort_id = links.cohort_id AND profiles.is_active = 1
     LEFT JOIN survey_responses responses
       ON responses.survey_campaign_id = links.survey_campaign_id
      AND responses.participant_profile_id = profiles.id
     WHERE links.survey_campaign_id = ?${cohortClause}`,
  ).bind(...bindings).first<{ total_participants: number; respondent_count: number }>();
}

export async function listCampaignParticipantCandidates(
  database: D1Database,
  campaignId: string,
  normalizedName: string,
) {
  const result = await database.prepare(
    `SELECT profiles.id, profiles.name, profiles.normalized_name, profiles.nik,
            profiles.cohort_id, cohorts.name AS cohort_name, profiles.training_id
     FROM survey_campaign_cohorts links
     JOIN participant_profiles profiles ON profiles.cohort_id = links.cohort_id
     JOIN training_cohorts cohorts ON cohorts.id = profiles.cohort_id
     WHERE links.survey_campaign_id = ?
       AND profiles.normalized_name = ?
       AND profiles.is_active = 1
     ORDER BY profiles.name COLLATE NOCASE ASC, profiles.id ASC`,
  ).bind(campaignId, normalizedName).all<CampaignParticipantRecord>();
  return result.results;
}

export async function participantCompletedAllPostTests(database: D1Database, participant: CampaignParticipantRecord) {
  const row = await database.prepare(
    `SELECT
       (SELECT COUNT(*) FROM training_materials WHERE training_id = ?) AS material_count,
       COUNT(DISTINCT sessions.material_id) AS completed_material_count
     FROM training_sessions sessions
     JOIN batches ON batches.training_session_id = sessions.id AND batches.cohort_id = ?
     JOIN participants exam_participants ON exam_participants.batch_id = batches.id AND exam_participants.profile_id = ?
     JOIN attempts ON attempts.participant_id = exam_participants.id
       AND attempts.training_session_id = sessions.id
       AND attempts.stage = 'POST'
       AND attempts.status = 'SUBMITTED'
     WHERE sessions.training_id = ?
       AND sessions.material_id IS NOT NULL`,
  ).bind(participant.training_id, participant.cohort_id, participant.id, participant.training_id)
    .first<{ material_count: number; completed_material_count: number }>();
  const total = Number(row?.material_count ?? 0);
  return { eligible: total > 0 && Number(row?.completed_material_count ?? 0) >= total, total, completed: Number(row?.completed_material_count ?? 0) };
}

export async function findSurveyResponse(
  database: D1Database,
  campaignId: string,
  participantProfileId: string,
) {
  return database.prepare(
    `SELECT id, survey_campaign_id, participant_profile_id, started_at, submitted_at, created_at, updated_at
     FROM survey_responses WHERE survey_campaign_id = ? AND participant_profile_id = ? LIMIT 1`,
  ).bind(campaignId, participantProfileId).first<SurveyResponseRecord>();
}

export async function findSurveyResponseById(database: D1Database, campaignId: string, responseId: string) {
  return database.prepare(
    `SELECT id, survey_campaign_id, participant_profile_id, started_at, submitted_at, created_at, updated_at
     FROM survey_responses WHERE id = ? AND survey_campaign_id = ? LIMIT 1`,
  ).bind(responseId, campaignId).first<SurveyResponseRecord>();
}

export async function createSurveyResponse(
  database: D1Database,
  campaignId: string,
  participantProfileId: string,
) {
  const id = crypto.randomUUID();
  await database.prepare(
    `INSERT OR IGNORE INTO survey_responses (id, survey_campaign_id, participant_profile_id, started_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
  ).bind(id, campaignId, participantProfileId).run();
  return findSurveyResponse(database, campaignId, participantProfileId);
}
