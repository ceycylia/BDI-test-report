import { cleanParticipantName, normalizeParticipantName } from "../domain/participants/normalize-name";

export type ResultFilters = { sessionId?: string; batchId?: string; status?: string; search?: string };

export async function listResultSummaries(database: D1Database, filters: ResultFilters) {
  const conditions: string[] = [];
  const bindings: string[] = [];
  if (filters.sessionId) { conditions.push("training_id = ?"); bindings.push(filters.sessionId); }
  if (filters.batchId) { conditions.push("batch_id = ?"); bindings.push(filters.batchId); }
  if (filters.status) { conditions.push("result_status = ?"); bindings.push(filters.status); }
  if (filters.search) { conditions.push("normalized_name LIKE ?"); bindings.push(`%${normalizeParticipantName(filters.search)}%`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await database.prepare(
    `WITH summary AS (
      SELECT participants.id, participants.name, participants.normalized_name,
        batches.id AS batch_id, batches.batch_name, sessions.id AS training_id,
        sessions.name AS training_name, sessions.passing_score,
        MAX(CASE WHEN attempts.stage = 'PRE' AND attempts.status = 'SUBMITTED' THEN attempts.score END) AS pre_score,
        MAX(CASE WHEN attempts.stage = 'POST' AND attempts.status = 'SUBMITTED' THEN attempts.score END) AS post_score,
        MAX(CASE WHEN attempts.stage = 'REMEDIAL_1' AND attempts.status = 'SUBMITTED' THEN attempts.score END) AS remedial_1_score,
        MAX(CASE WHEN attempts.stage = 'REMEDIAL_2' AND attempts.status = 'SUBMITTED' THEN attempts.score END) AS remedial_2_score,
        MAX(CASE WHEN attempts.stage = 'REMEDIAL_3' AND attempts.status = 'SUBMITTED' THEN attempts.score END) AS remedial_3_score,
        MAX(CASE WHEN attempts.stage <> 'PRE' AND attempts.status = 'SUBMITTED' THEN attempts.score END) AS final_post_score
      FROM participants JOIN batches ON batches.id = participants.batch_id
      JOIN training_sessions AS sessions ON sessions.id = batches.training_session_id
      LEFT JOIN attempts ON attempts.participant_id = participants.id AND attempts.status <> 'RESET'
      GROUP BY participants.id
    ), results AS (
      SELECT *, CASE WHEN final_post_score IS NULL THEN 'BELUM_POST'
        WHEN final_post_score >= passing_score THEN 'LULUS' ELSE 'BELUM_LULUS' END AS result_status
      FROM summary
    ) SELECT * FROM results ${where} ORDER BY training_name, batch_name, name`,
  ).bind(...bindings).all<Record<string, string | number | null>>();
  return result.results;
}

export async function getParticipantResult(database: D1Database, participantId: string) {
  return database.prepare(
    `SELECT participants.id, participants.name, participants.normalized_name,
      batches.id AS batch_id, batches.batch_name, sessions.id AS training_id,
      sessions.name AS training_name, sessions.passing_score
      FROM participants JOIN batches ON batches.id = participants.batch_id
      JOIN training_sessions AS sessions ON sessions.id = batches.training_session_id
      WHERE participants.id = ? LIMIT 1`,
  ).bind(participantId).first<{
    id: string; name: string; normalized_name: string; batch_id: string; batch_name: string;
    training_id: string; training_name: string; passing_score: number;
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
