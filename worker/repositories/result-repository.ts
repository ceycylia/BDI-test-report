import { cleanParticipantName, normalizeParticipantName } from "../domain/participants/normalize-name";

export type ResultFilters = {
  year?: number;
  trainingId?: string;
  materialId?: string;
  cohortId?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function listResultSummaries(database: D1Database, filters: ResultFilters) {
  const conditions: string[] = [];
  const bindings: string[] = [];
  if (filters.year) { conditions.push("training_year = ?"); bindings.push(String(filters.year)); }
  if (filters.trainingId) { conditions.push("training_id = ?"); bindings.push(filters.trainingId); }
  if (filters.materialId) { conditions.push("material_id = ?"); bindings.push(filters.materialId); }
  if (filters.cohortId) { conditions.push("cohort_id = ?"); bindings.push(filters.cohortId); }
  if (filters.status) { conditions.push("result_status = ?"); bindings.push(filters.status); }
  if (filters.search) { conditions.push("normalized_name LIKE ?"); bindings.push(`%${normalizeParticipantName(filters.search)}%`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const pageSize = Math.min(50, Math.max(1, Math.floor(filters.pageSize ?? 20)));
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pagination = filters.page === undefined && filters.pageSize === undefined ? "" : ` LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
  const result = await database.prepare(
    `WITH summary AS (
      SELECT COALESCE(participants.id, profiles.id) AS id, COALESCE(participants.name, profiles.name) AS name, profiles.normalized_name,
        batches.id AS batch_id, batches.batch_name,
        sessions.id AS training_session_id,
        sessions.training_id AS training_id, trainings.name AS training_name,
        sessions.material_id AS material_id, materials.name AS material_name,
        batches.cohort_id AS cohort_id, cohorts.name AS cohort_name,
        SUBSTR(cohorts.start_date, 1, 4) AS training_year,
        sessions.passing_score,
        MAX(CASE WHEN attempts.stage = 'PRE' AND attempts.status = 'SUBMITTED' THEN attempts.score END) AS pre_score,
        MAX(CASE WHEN attempts.stage = 'POST' AND attempts.status = 'SUBMITTED' THEN attempts.score END) AS post_score,
        MAX(CASE WHEN attempts.stage = 'REMEDIAL_1' AND attempts.status = 'SUBMITTED' THEN attempts.score END) AS remedial_1_score,
        MAX(CASE WHEN attempts.stage = 'REMEDIAL_2' AND attempts.status = 'SUBMITTED' THEN attempts.score END) AS remedial_2_score,
        MAX(CASE WHEN attempts.stage <> 'PRE' AND attempts.status = 'SUBMITTED' THEN attempts.score END) AS final_post_score,
        MAX(CASE WHEN attempts.status = 'IN_PROGRESS' THEN attempts.stage END) AS active_stage
      FROM participant_profiles AS profiles
      JOIN trainings ON trainings.id = profiles.training_id
      JOIN training_cohorts AS cohorts ON cohorts.id = profiles.cohort_id
      JOIN training_sessions AS sessions ON sessions.training_id = profiles.training_id
      JOIN batches ON batches.training_session_id = sessions.id AND batches.cohort_id = profiles.cohort_id
      JOIN training_materials AS materials ON materials.id = sessions.material_id
      LEFT JOIN participants ON participants.profile_id = profiles.id AND participants.batch_id = batches.id
      LEFT JOIN attempts ON attempts.participant_id = participants.id AND attempts.status <> 'RESET'
      WHERE profiles.is_active = 1
      GROUP BY profiles.id, sessions.id
    ), results AS (
      SELECT *, CASE WHEN active_stage IS NOT NULL THEN 'SEDANG_MENGERJAKAN'
        WHEN pre_score IS NULL THEN 'BELUM_PRE'
        WHEN final_post_score IS NULL THEN 'BELUM_POST'
        WHEN final_post_score >= passing_score THEN 'LULUS' ELSE 'BELUM_LULUS' END AS result_status
        FROM summary
    ) SELECT *, COUNT(*) OVER() AS total_count FROM results ${where} ORDER BY training_name, material_name, cohort_name, name${pagination}`,
  ).bind(...bindings).all<Record<string, string | number | null>>();
  return result.results;
}

export async function listResultFilterOptions(database: D1Database, year: number) {
  const yearText = String(year);
  const [trainings, materials, cohorts] = await Promise.all([
    database.prepare(
      `SELECT DISTINCT trainings.id, trainings.name
         FROM trainings
         JOIN training_sessions AS sessions ON sessions.training_id = trainings.id
        WHERE trainings.is_deleted = 0 AND SUBSTR(sessions.training_start_date, 1, 4) = ?
        ORDER BY trainings.name COLLATE NOCASE, trainings.id`,
    ).bind(yearText).all<{ id: string; name: string }>(),
    database.prepare(
      `SELECT DISTINCT materials.id, materials.training_id, materials.name
         FROM training_materials AS materials
         JOIN trainings ON trainings.id = materials.training_id
         JOIN training_sessions AS sessions ON sessions.material_id = materials.id
        WHERE trainings.is_deleted = 0 AND SUBSTR(sessions.training_start_date, 1, 4) = ?
        ORDER BY materials.name COLLATE NOCASE, materials.id`,
    ).bind(yearText).all<{ id: string; training_id: string; name: string }>(),
    database.prepare(
      `SELECT DISTINCT cohorts.id, cohorts.training_id, cohorts.name
         FROM training_cohorts AS cohorts
         JOIN trainings ON trainings.id = cohorts.training_id
         JOIN batches ON batches.cohort_id = cohorts.id
         JOIN training_sessions AS sessions ON sessions.id = batches.training_session_id
        WHERE trainings.is_deleted = 0 AND SUBSTR(cohorts.start_date, 1, 4) = ?
        ORDER BY cohorts.name COLLATE NOCASE, cohorts.id`,
    ).bind(yearText).all<{ id: string; training_id: string; name: string }>(),
  ]);
  return {
    trainings: trainings.results,
    materials: materials.results,
    cohorts: cohorts.results,
  };
}

export async function getParticipantResult(database: D1Database, participantId: string, year?: number) {
  return database.prepare(
    `SELECT COALESCE(participants.id, profiles.id) AS id, COALESCE(participants.name, profiles.name) AS name, profiles.normalized_name,
      batches.id AS batch_id, batches.batch_name,
      sessions.training_id AS training_id, trainings.name AS training_name,
      sessions.material_id AS material_id, materials.name AS material_name,
      batches.cohort_id AS cohort_id, cohorts.name AS cohort_name,
      sessions.passing_score
      FROM participant_profiles AS profiles
      JOIN training_sessions AS sessions ON sessions.training_id = profiles.training_id
      JOIN batches ON batches.training_session_id = sessions.id AND batches.cohort_id = profiles.cohort_id
      LEFT JOIN participants ON participants.profile_id = profiles.id AND participants.batch_id = batches.id
      JOIN trainings ON trainings.id = sessions.training_id
      JOIN training_materials AS materials ON materials.id = sessions.material_id
      JOIN training_cohorts AS cohorts ON cohorts.id = batches.cohort_id
      WHERE (participants.id = ? OR profiles.id = ?)${year ? " AND SUBSTR(cohorts.start_date, 1, 4) = ?" : ""} LIMIT 1`,
  ).bind(...(year ? [participantId, participantId, String(year)] : [participantId, participantId])).first<{
    id: string; name: string; normalized_name: string; batch_id: string; batch_name: string;
    training_id: string; training_name: string; material_id: string; material_name: string;
    cohort_id: string; cohort_name: string; passing_score: number;
  }>();
}

export async function listParticipantAttemptDetails(database: D1Database, participantId: string) {
  const attempts = await database.prepare(
    `SELECT id, stage, attempt_number, started_at, deadline_at, submitted_at, status,
      score, total_questions, correct_count, wrong_count
      FROM attempts WHERE participant_id = ? ORDER BY created_at`,
  ).bind(participantId).all<Record<string, string | number | null>>();
  const answers = await database.prepare(
    `SELECT snapshots.attempt_id, snapshots.question_id, snapshots.display_position,
      snapshots.question_text, snapshots.option_a, snapshots.option_b, snapshots.option_c, snapshots.option_d,
      snapshots.correct_option_key, answers.selected_original_option_key, answers.is_correct
      FROM attempt_question_snapshots AS snapshots
      LEFT JOIN attempt_answers AS answers ON answers.attempt_id = snapshots.attempt_id AND answers.question_id = snapshots.question_id
      JOIN attempts ON attempts.id = snapshots.attempt_id
      WHERE attempts.participant_id = ? ORDER BY attempts.created_at, snapshots.display_position`,
  ).bind(participantId).all<Record<string, string | number | null>>();
  return { attempts: attempts.results, answers: answers.results };
}

export async function updateParticipantName(database: D1Database, participantId: string, name: string) {
  const cleaned = cleanParticipantName(name);
  await database.prepare(
    `UPDATE participants SET name = ?, normalized_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).bind(cleaned, normalizeParticipantName(cleaned), participantId).run();
}

export async function resetAttempt(database: D1Database, attemptId: string, participantId: string, adminId: string, reason: string | null) {
  await database.batch([
    database.prepare(
      `UPDATE attempts SET status = 'RESET', reset_by_admin_id = ?, reset_at = CURRENT_TIMESTAMP, reset_reason = ?,
        updated_at = CURRENT_TIMESTAMP WHERE id = ? AND participant_id = ? AND status <> 'RESET'`,
    ).bind(adminId, reason, attemptId, participantId),
    database.prepare(
      `INSERT INTO audit_logs (id, admin_id, action, entity_type, entity_id, metadata_json)
       VALUES (?, ?, 'RESET_ATTEMPT', 'attempt', ?, json_object('participantId', ?, 'reason', ?))`,
    ).bind(crypto.randomUUID(), adminId, attemptId, participantId, reason),
  ]);
}

export async function adjustFinalAttemptScore(database: D1Database, attemptId: string, participantId: string, adminId: string, score: number) {
  await database.batch([
    database.prepare(
      `UPDATE attempts SET score = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND participant_id = ? AND stage IN ('POST', 'REMEDIAL_1', 'REMEDIAL_2') AND status = 'SUBMITTED'`,
    ).bind(score, attemptId, participantId),
    database.prepare(
      `INSERT INTO audit_logs (id, admin_id, action, entity_type, entity_id, metadata_json)
       VALUES (?, ?, 'ADJUST_FINAL_SCORE', 'attempt', ?, json_object('participantId', ?, 'score', ?))`,
    ).bind(crypto.randomUUID(), adminId, attemptId, participantId, score),
  ]);
}

export async function listExportAnswers(database: D1Database, participantIds: string[]) {
  if (!participantIds.length) return [];
  const result = await database.prepare(
    `SELECT participants.name, batches.batch_name, sessions.name AS training_name,
      attempts.stage, attempts.score, snapshots.display_position, snapshots.question_text,
      answers.selected_original_option_key, answers.correct_original_option_key, answers.is_correct,
      snapshots.option_a, snapshots.option_b, snapshots.option_c, snapshots.option_d
      FROM attempt_question_snapshots AS snapshots
      JOIN attempts ON attempts.id = snapshots.attempt_id
      JOIN participants ON participants.id = attempts.participant_id
      JOIN batches ON batches.id = attempts.batch_id
      JOIN training_sessions AS sessions ON sessions.id = attempts.training_session_id
      LEFT JOIN attempt_answers AS answers ON answers.attempt_id = attempts.id AND answers.question_id = snapshots.question_id
      WHERE participants.id IN (SELECT value FROM json_each(?)) AND attempts.status = 'SUBMITTED'
      ORDER BY sessions.name, batches.batch_number, participants.name, attempts.created_at, snapshots.display_position`,
  ).bind(JSON.stringify(participantIds)).all<Record<string, string | number | null>>();
  return result.results;
}

export async function listExportTrainingInfo(database: D1Database, sessionIds: string[]) {
  if (!sessionIds.length) return [];
  const result = await database.prepare(
    `SELECT sessions.name AS training_name, sessions.slug, banks.name AS bank_name,
      sessions.question_count, sessions.duration_minutes, sessions.passing_score,
      sessions.training_start_date, sessions.training_end_date, sessions.status,
      GROUP_CONCAT(batches.batch_name, ', ') AS batches
      FROM training_sessions AS sessions JOIN question_banks AS banks ON banks.id = sessions.bank_id
      LEFT JOIN batches ON batches.training_session_id = sessions.id
      WHERE sessions.id IN (SELECT value FROM json_each(?)) GROUP BY sessions.id ORDER BY sessions.name`,
  ).bind(JSON.stringify(sessionIds)).all<Record<string, string | number | null>>();
  return result.results;
}
