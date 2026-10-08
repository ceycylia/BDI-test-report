export type TrainingSessionRecord = {
  id: string;
  name: string;
  slug: string;
  bank_id: string;
  bank_name: string;
  question_count: number;
  duration_minutes: number;
  passing_score: number;
  training_start_date: string;
  training_end_date: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED";
  pre_mode: "MANUAL" | "SCHEDULED";
  pre_start_at: string | null;
  pre_end_at: string | null;
  pre_manual_open: number;
  post_mode: "MANUAL" | "SCHEDULED";
  post_start_at: string | null;
  post_end_at: string | null;
  post_manual_open: number;
  training_id: string | null;
  material_id: string | null;
  training_name: string | null;
  material_name: string | null;
  cohorts_json: string;
  created_at: string;
  updated_at: string;
};

export type BatchRecord = {
  id: string;
  training_session_id: string;
  batch_number: number;
  batch_name: string;
  question_count: number;
  created_at: string;
};

export async function listTrainingSessions(
  database: D1Database,
  activeYear?: number,
): Promise<TrainingSessionRecord[]> {
  const result = await database
    .prepare(
      `SELECT sessions.*, banks.name AS bank_name,
              trainings.name AS training_name,
              materials.name AS material_name,
              COALESCE((
                SELECT json_group_array(json_object('id', related.id, 'name', related.name))
                  FROM (
                    SELECT DISTINCT cohorts.id, cohorts.name
                      FROM batches
                      JOIN training_cohorts AS cohorts ON cohorts.id = batches.cohort_id
                     WHERE batches.training_session_id = sessions.id
                  ) AS related
              ), '[]') AS cohorts_json
         FROM training_sessions AS sessions
         JOIN question_banks AS banks ON banks.id = sessions.bank_id
         LEFT JOIN trainings ON trainings.id = sessions.training_id
         LEFT JOIN training_materials AS materials ON materials.id = sessions.material_id
        WHERE (? IS NULL OR SUBSTR(sessions.training_start_date, 1, 4) = ?)
        ORDER BY sessions.created_at DESC`,
    )
    .bind(activeYear ?? null, activeYear ? String(activeYear) : null)
    .all<TrainingSessionRecord>();
  return result.results;
}

export async function paginateTrainingSessions(
  database: D1Database,
  input: { year: number; page: number; limit: number; search?: string; trainingId?: string; materialId?: string; cohortId?: string; scheduleStatus?: string },
): Promise<{ rows: TrainingSessionRecord[]; total: number }> {
  const conditions = ["SUBSTR(sessions.training_start_date, 1, 4) = ?"];
  const bindings: unknown[] = [String(input.year)];
  if (input.trainingId) { conditions.push("sessions.training_id = ?"); bindings.push(input.trainingId); }
  if (input.materialId) { conditions.push("sessions.material_id = ?"); bindings.push(input.materialId); }
  if (input.cohortId) { conditions.push("EXISTS (SELECT 1 FROM batches cohort_batches WHERE cohort_batches.training_session_id=sessions.id AND cohort_batches.cohort_id=?)"); bindings.push(input.cohortId); }
  if (input.search?.trim()) {
    const needle = `%${input.search.trim().replace(/[\\%_]/gu, "\\$&")}%`;
    conditions.push(`(materials.name LIKE ? ESCAPE '\\' OR trainings.name LIKE ? ESCAPE '\\' OR EXISTS (
      SELECT 1 FROM batches search_batches JOIN training_cohorts search_cohorts ON search_cohorts.id=search_batches.cohort_id
      WHERE search_batches.training_session_id=sessions.id AND search_cohorts.name LIKE ? ESCAPE '\\'
    ))`);
    bindings.push(needle, needle, needle);
  }
  const open = `((sessions.pre_mode='MANUAL' AND sessions.pre_manual_open=1) OR (sessions.pre_mode='SCHEDULED' AND datetime('now') BETWEEN datetime(sessions.pre_start_at) AND datetime(sessions.pre_end_at)) OR (sessions.post_mode='MANUAL' AND sessions.post_manual_open=1) OR (sessions.post_mode='SCHEDULED' AND datetime('now') BETWEEN datetime(sessions.post_start_at) AND datetime(sessions.post_end_at)))`;
  const future = `((sessions.pre_mode='SCHEDULED' AND datetime('now') < datetime(sessions.pre_start_at)) OR (sessions.post_mode='SCHEDULED' AND datetime('now') < datetime(sessions.post_start_at)))`;
  if (input.scheduleStatus === "ONGOING") conditions.push(`sessions.status='ACTIVE' AND ${open}`);
  if (input.scheduleStatus === "NOT_OPEN") conditions.push(`(sessions.status='DRAFT' OR (sessions.status='ACTIVE' AND NOT ${open} AND ${future}))`);
  if (input.scheduleStatus === "FINISHED") conditions.push(`(sessions.status='COMPLETED' OR (sessions.status='ACTIVE' AND NOT ${open} AND NOT ${future}))`);
  const where = `WHERE ${conditions.join(" AND ")}`;
  const from = `FROM training_sessions sessions JOIN question_banks banks ON banks.id=sessions.bank_id LEFT JOIN trainings ON trainings.id=sessions.training_id LEFT JOIN training_materials materials ON materials.id=sessions.material_id`;
  const [count, result] = await Promise.all([
    database.prepare(`SELECT COUNT(*) AS total ${from} ${where}`).bind(...bindings).first<{ total: number }>(),
    database.prepare(
      `SELECT sessions.*, banks.name AS bank_name, trainings.name AS training_name, materials.name AS material_name,
              COALESCE((SELECT json_group_array(json_object('id', related.id, 'name', related.name)) FROM (
                SELECT DISTINCT cohorts.id, cohorts.name FROM batches JOIN training_cohorts cohorts ON cohorts.id=batches.cohort_id WHERE batches.training_session_id=sessions.id
              ) related), '[]') AS cohorts_json
       ${from} ${where} ORDER BY sessions.created_at DESC, sessions.rowid DESC LIMIT ? OFFSET ?`,
    ).bind(...bindings, input.limit, (input.page - 1) * input.limit).all<TrainingSessionRecord>(),
  ]);
  return { rows: result.results, total: Number(count?.total ?? 0) };
}

export async function findTrainingSession(
  database: D1Database,
  sessionId: string,
): Promise<TrainingSessionRecord | null> {
  return database
    .prepare(
      `SELECT sessions.*, banks.name AS bank_name,
              trainings.name AS training_name,
              materials.name AS material_name,
              COALESCE((
                SELECT json_group_array(json_object('id', related.id, 'name', related.name))
                  FROM (
                    SELECT DISTINCT cohorts.id, cohorts.name
                      FROM batches
                      JOIN training_cohorts AS cohorts ON cohorts.id = batches.cohort_id
                     WHERE batches.training_session_id = sessions.id
                  ) AS related
              ), '[]') AS cohorts_json
         FROM training_sessions AS sessions
         JOIN question_banks AS banks ON banks.id = sessions.bank_id
         LEFT JOIN trainings ON trainings.id = sessions.training_id
         LEFT JOIN training_materials AS materials ON materials.id = sessions.material_id
        WHERE sessions.id = ?
        LIMIT 1`,
    )
    .bind(sessionId)
    .first<TrainingSessionRecord>();
}

export async function slugExists(database: D1Database, slug: string): Promise<boolean> {
  const row = await database
    .prepare("SELECT EXISTS(SELECT 1 FROM training_sessions WHERE slug = ? COLLATE NOCASE) AS found")
    .bind(slug)
    .first<{ found: number }>();
  return row?.found === 1;
}

export async function activeQuestionCount(database: D1Database, bankId: string): Promise<number> {
  const row = await database
    .prepare("SELECT COUNT(*) AS count FROM questions WHERE bank_id = ?")
    .bind(bankId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function createTrainingSession(
  database: D1Database,
  input: {
    id: string;
    name: string;
    slug: string;
    bankId: string;
    trainingId: string;
    materialId: string;
    questionCount: number;
    durationMinutes: number;
    passingScore: number;
    trainingStartDate: string;
    trainingEndDate: string;
    preMode: "MANUAL" | "SCHEDULED";
    preStartAt: string | null;
    preEndAt: string | null;
    preManualOpen: boolean;
    postMode: "MANUAL" | "SCHEDULED";
    postStartAt: string | null;
    postEndAt: string | null;
    postManualOpen: boolean;
    batches: Array<{ id: string; number: number; name: string; cohortId: string }>;
  },
): Promise<void> {
  const batchJson = JSON.stringify(input.batches);
  await database.batch([
    database
      .prepare(
        `INSERT INTO training_sessions (
           id, name, slug, bank_id, question_count, duration_minutes, passing_score,
           training_start_date, training_end_date,
           pre_mode, pre_start_at, pre_end_at, pre_manual_open,
           post_mode, post_start_at, post_end_at, post_manual_open, training_id, material_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.id,
        input.name,
        input.slug,
        input.bankId,
        input.questionCount,
        input.durationMinutes,
        input.passingScore,
        input.trainingStartDate,
        input.trainingEndDate,
        input.preMode,
        input.preStartAt,
        input.preEndAt,
        input.preManualOpen ? 1 : 0,
        input.postMode,
        input.postStartAt,
        input.postEndAt,
        input.postManualOpen ? 1 : 0,
        input.trainingId,
        input.materialId,
      ),
    database
      .prepare(
        `INSERT INTO batches (id, training_session_id, batch_number, batch_name, cohort_id)
         SELECT json_extract(value, '$.id'), ?,
                json_extract(value, '$.number'), json_extract(value, '$.name'), json_extract(value, '$.cohortId')
           FROM json_each(?)`,
      )
      .bind(input.id, batchJson),
  ]);
}

export async function listBatches(
  database: D1Database,
  sessionId: string,
): Promise<BatchRecord[]> {
  const result = await database
    .prepare(
      `SELECT batches.id, batches.training_session_id, batches.batch_number,
              batches.batch_name, batches.created_at,
              COUNT(batch_questions.question_id) AS question_count
         FROM batches
         LEFT JOIN batch_questions ON batch_questions.batch_id = batches.id
        WHERE batches.training_session_id = ?
        GROUP BY batches.id
        ORDER BY batches.batch_number ASC`,
    )
    .bind(sessionId)
    .all<BatchRecord>();
  return result.results;
}

export async function listActiveQuestionUsageForSession(
  database: D1Database,
  sessionId: string,
): Promise<Array<{ id: string; times_assigned: number }>> {
  const result = await database
    .prepare(
      `SELECT questions.id, questions.times_assigned
         FROM questions
         JOIN training_sessions ON training_sessions.bank_id = questions.bank_id
        WHERE training_sessions.id = ?
        ORDER BY questions.id`,
    )
    .bind(sessionId)
    .all<{ id: string; times_assigned: number }>();
  return result.results;
}

export async function listExistingPackageAssignments(
  database: D1Database,
  sessionId: string,
): Promise<Array<{ batch_id: string; question_id: string }>> {
  const result = await database
    .prepare(
      `SELECT batch_questions.batch_id, batch_questions.question_id
         FROM batch_questions
         JOIN batches ON batches.id = batch_questions.batch_id
        WHERE batches.training_session_id = ?`,
    )
    .bind(sessionId)
    .all<{ batch_id: string; question_id: string }>();
  return result.results;
}

export async function saveGeneratedPackages(
  database: D1Database,
  sessionId: string,
  input: {
    questionCount: number;
    oldCounts: Array<{ questionId: string; count: number }>;
    assignments: Array<{ batchId: string; questionId: string }>;
    newCounts: Array<{ questionId: string; count: number }>;
    layouts: Array<{
      id: string;
      batchId: string;
      stage: string;
      questionOrderJson: string;
      optionOrdersJson: string;
    }>;
  },
): Promise<void> {
  await database.batch([
    database
      .prepare(
        `UPDATE training_sessions
            SET question_count = ?, status = 'ACTIVE',
                activated_at = COALESCE(activated_at, CURRENT_TIMESTAMP),
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status IN ('DRAFT', 'ACTIVE')`,
      )
      .bind(input.questionCount, sessionId),
    database
      .prepare(
        `UPDATE questions
            SET times_assigned = MAX(
              0,
              times_assigned - COALESCE(
                (SELECT json_extract(value, '$.count')
                   FROM json_each(?)
                  WHERE json_extract(value, '$.questionId') = questions.id),
                0
              )
            )`,
      )
      .bind(JSON.stringify(input.oldCounts)),
    database
      .prepare(
        `DELETE FROM batch_layouts
          WHERE batch_id IN (SELECT id FROM batches WHERE training_session_id = ?)`,
      )
      .bind(sessionId),
    database
      .prepare(
        `DELETE FROM batch_questions
          WHERE batch_id IN (SELECT id FROM batches WHERE training_session_id = ?)`,
      )
      .bind(sessionId),
    database
      .prepare(
        `INSERT INTO batch_questions (batch_id, question_id)
         SELECT json_extract(value, '$.batchId'), json_extract(value, '$.questionId')
           FROM json_each(?)`,
      )
      .bind(JSON.stringify(input.assignments)),
    database
      .prepare(
        `UPDATE questions
            SET times_assigned = times_assigned + COALESCE(
              (SELECT json_extract(value, '$.count')
                 FROM json_each(?)
                WHERE json_extract(value, '$.questionId') = questions.id),
              0
            )`,
      )
      .bind(JSON.stringify(input.newCounts)),
    database
      .prepare(
        `INSERT INTO batch_layouts (
           id, batch_id, stage, question_order_json, option_orders_json
         )
         SELECT json_extract(value, '$.id'),
                json_extract(value, '$.batchId'),
                json_extract(value, '$.stage'),
                json_extract(value, '$.questionOrderJson'),
                json_extract(value, '$.optionOrdersJson')
           FROM json_each(?)`,
      )
      .bind(JSON.stringify(input.layouts)),
  ]);
}

export async function getPackagePreview(
  database: D1Database,
  sessionId: string,
): Promise<
  Array<{
    batch_id: string;
    batch_number: number;
    batch_name: string;
    question_ids_json: string;
    layout_count: number;
  }>
> {
  const result = await database
    .prepare(
      `SELECT batches.id AS batch_id, batches.batch_number, batches.batch_name,
              COALESCE(json_group_array(batch_questions.question_id) FILTER (
                WHERE batch_questions.question_id IS NOT NULL
              ), '[]') AS question_ids_json,
              (SELECT COUNT(*) FROM batch_layouts WHERE batch_layouts.batch_id = batches.id)
                AS layout_count
         FROM batches
         LEFT JOIN batch_questions ON batch_questions.batch_id = batches.id
        WHERE batches.training_session_id = ?
        GROUP BY batches.id
        ORDER BY batches.batch_number`,
    )
    .bind(sessionId)
    .all<{
      batch_id: string;
      batch_number: number;
      batch_name: string;
      question_ids_json: string;
      layout_count: number;
    }>();
  return result.results;
}

export async function activateTrainingSession(
  database: D1Database,
  sessionId: string,
): Promise<void> {
  await database
    .prepare(
      `UPDATE training_sessions
          SET status = 'ACTIVE', activated_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'DRAFT'`,
    )
    .bind(sessionId)
    .run();
}

export async function setManualStageOpen(
  database: D1Database,
  sessionId: string,
  stage: "PRE" | "POST",
  open: boolean,
): Promise<void> {
  const column = stage === "PRE" ? "pre_manual_open" : "post_manual_open";
  await database
    .prepare(`UPDATE training_sessions SET ${column} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(open ? 1 : 0, sessionId)
    .run();
}

/** Changes only whether a new attempt may be started. Existing attempts retain
 * their own persisted deadlines and are deliberately not part of this update. */
export async function updateStageSchedule(
  database: D1Database,
  input: {
    sessionId: string;
    stage: "PRE" | "POST";
    mode: "MANUAL" | "SCHEDULED";
    manualOpen: boolean;
    startAt: string | null;
    endAt: string | null;
  },
) {
  const fields = input.stage === "PRE"
    ? { mode: "pre_mode", open: "pre_manual_open", start: "pre_start_at", end: "pre_end_at" }
    : { mode: "post_mode", open: "post_manual_open", start: "post_start_at", end: "post_end_at" };
  await database.prepare(
    `UPDATE training_sessions
        SET ${fields.mode} = ?, ${fields.open} = ?, ${fields.start} = ?, ${fields.end} = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
  ).bind(input.mode, input.manualOpen ? 1 : 0, input.startAt, input.endAt, input.sessionId).run();
}

export async function getTrainingDeleteImpact(database: D1Database, sessionId: string) {
  return database.prepare(
    `SELECT sessions.id, sessions.name, sessions.status,
      (SELECT COUNT(*) FROM batches WHERE training_session_id = sessions.id) AS batch_count,
      (SELECT COUNT(*) FROM participants JOIN batches ON batches.id = participants.batch_id WHERE batches.training_session_id = sessions.id) AS participant_count,
      (SELECT COUNT(*) FROM attempts WHERE training_session_id = sessions.id) AS attempt_count,
      (SELECT COUNT(*) FROM attempt_answers JOIN attempts ON attempts.id = attempt_answers.attempt_id WHERE attempts.training_session_id = sessions.id) AS answer_count
      FROM training_sessions AS sessions WHERE sessions.id = ? LIMIT 1`,
  ).bind(sessionId).first<{
    id: string; name: string; status: string; batch_count: number;
    participant_count: number; attempt_count: number; answer_count: number;
  }>();
}

export async function deleteTrainingSession(
  database: D1Database,
  input: { sessionId: string; adminId: string; metadata: Record<string, unknown> },
) {
  await database.batch([
    database.prepare(
      `INSERT INTO audit_logs (id, admin_id, action, entity_type, entity_id, metadata_json)
       VALUES (?, ?, 'DELETE_TRAINING_SESSION', 'training_session', ?, ?)`,
    ).bind(crypto.randomUUID(), input.adminId, input.sessionId, JSON.stringify(input.metadata)),
    database.prepare("DELETE FROM training_sessions WHERE id = ?").bind(input.sessionId),
  ]);
}
