export type AttemptStage = "PRE" | "POST" | "REMEDIAL_1" | "REMEDIAL_2" | "REMEDIAL_3";
export type OriginalOptionKey = "A" | "B" | "C" | "D";

export type AttemptRecord = {
  id: string; participant_id: string; batch_id: string; training_session_id: string;
  stage: AttemptStage; attempt_number: number; started_at: string; deadline_at: string;
  submitted_at: string | null; status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED" | "RESET";
  score: number | null; total_questions: number | null; correct_count: number | null; wrong_count: number | null;
  draft_answers_json: string; draft_revision: number;
};

export type SnapshotRecord = {
  question_id: string; question_text: string; image_key: string | null;
  option_a: string; option_b: string; option_c: string; option_d: string;
  correct_option_key: OriginalOptionKey; display_position: number; display_option_order_json: string;
};

export async function findParticipantContext(database: D1Database, participantId: string, batchId: string, sessionId: string) {
  return database.prepare(
    `SELECT participants.id, participants.name FROM participants
      JOIN batches ON batches.id = participants.batch_id
      WHERE participants.id = ? AND participants.batch_id = ? AND batches.training_session_id = ? LIMIT 1`,
  ).bind(participantId, batchId, sessionId).first<{ id: string; name: string }>();
}

export async function findAttempt(database: D1Database, participantId: string, stage: AttemptStage) {
  return database.prepare(
    `SELECT * FROM attempts WHERE participant_id = ? AND stage = ? AND status <> 'RESET'
      ORDER BY created_at DESC LIMIT 1`,
  ).bind(participantId, stage).first<AttemptRecord>();
}

export async function findResetAttempt(database: D1Database, participantId: string, stage: AttemptStage) {
  return database.prepare(
    `SELECT * FROM attempts WHERE participant_id = ? AND stage = ? AND status = 'RESET'
      ORDER BY reset_at DESC LIMIT 1`,
  ).bind(participantId, stage).first<AttemptRecord>();
}

export async function findAttemptById(database: D1Database, attemptId: string, participantId: string) {
  return database.prepare(
    `SELECT * FROM attempts WHERE id = ? AND participant_id = ? LIMIT 1`,
  ).bind(attemptId, participantId).first<AttemptRecord>();
}

export async function getLayoutQuestions(database: D1Database, batchId: string, stage: AttemptStage) {
  const layout = await database.prepare(
    `SELECT question_order_json, option_orders_json FROM batch_layouts WHERE batch_id = ? AND stage = ? LIMIT 1`,
  ).bind(batchId, stage).first<{ question_order_json: string; option_orders_json: string }>();
  if (!layout) return null;
  const questionIds = JSON.parse(layout.question_order_json) as string[];
  const result = await database.prepare(
    `SELECT id, question_text, image_key, option_a, option_b, option_c, option_d, correct_option_key
       FROM questions WHERE id IN (SELECT value FROM json_each(?))`,
  ).bind(JSON.stringify(questionIds)).all<{
    id: string; question_text: string; image_key: string | null; option_a: string; option_b: string;
    option_c: string; option_d: string; correct_option_key: OriginalOptionKey;
  }>();
  const byId = new Map(result.results.map((question) => [question.id, question]));
  const optionOrders = JSON.parse(layout.option_orders_json) as Record<string, OriginalOptionKey[]>;
  return questionIds.map((questionId, index) => {
    const question = byId.get(questionId);
    if (!question) throw new Error(`Snapshot soal ${questionId} tidak ditemukan.`);
    return { ...question, position: index + 1, optionOrder: optionOrders[questionId] ?? ["A", "B", "C", "D"] };
  });
}

export async function createAttemptWithSnapshots(
  database: D1Database,
  input: { id: string; participantId: string; batchId: string; sessionId: string; stage: AttemptStage; attemptNumber: number; resetSequence?: number; startedAt: string; deadlineAt: string; snapshots: NonNullable<Awaited<ReturnType<typeof getLayoutQuestions>>> },
) {
  const snapshotRows = input.snapshots.map((question) => ({
    id: crypto.randomUUID(), attemptId: input.id, questionId: question.id,
    questionText: question.question_text, imageKey: question.image_key,
    optionA: question.option_a, optionB: question.option_b, optionC: question.option_c, optionD: question.option_d,
    correctOptionKey: question.correct_option_key, position: question.position,
    optionOrderJson: JSON.stringify(question.optionOrder),
  }));
  await database.batch([
    database.prepare(
      `INSERT OR IGNORE INTO attempts (
        id, participant_id, batch_id, training_session_id, stage, attempt_number, reset_sequence, started_at, deadline_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(input.id, input.participantId, input.batchId, input.sessionId, input.stage, input.attemptNumber, input.resetSequence ?? 0, input.startedAt, input.deadlineAt),
    database.prepare(
      `INSERT INTO attempt_question_snapshots (
        id, attempt_id, question_id, question_text, image_key, option_a, option_b, option_c, option_d,
        correct_option_key, display_position, display_option_order_json
      ) SELECT json_extract(value, '$.id'), json_extract(value, '$.attemptId'),
        json_extract(value, '$.questionId'), json_extract(value, '$.questionText'), json_extract(value, '$.imageKey'),
        json_extract(value, '$.optionA'), json_extract(value, '$.optionB'), json_extract(value, '$.optionC'),
        json_extract(value, '$.optionD'), json_extract(value, '$.correctOptionKey'), json_extract(value, '$.position'),
        json_extract(value, '$.optionOrderJson') FROM json_each(?)
        WHERE EXISTS (SELECT 1 FROM attempts WHERE id = ?)`,
    ).bind(JSON.stringify(snapshotRows), input.id),
  ]);
}

export async function nextResetSequence(database:D1Database,participantId:string,stage:AttemptStage){const row=await database.prepare(`SELECT COALESCE(MAX(reset_sequence),-1)+1 next_sequence FROM attempts WHERE participant_id=? AND stage=?`).bind(participantId,stage).first<{next_sequence:number}>();return row?.next_sequence??0;}

export async function reactivateResetAttemptWithSnapshots(
  database: D1Database,
  input: { attemptId: string; startedAt: string; deadlineAt: string; snapshots: NonNullable<Awaited<ReturnType<typeof getLayoutQuestions>>> },
) {
  const rows = input.snapshots.map((question) => ({
    id: crypto.randomUUID(), attemptId: input.attemptId, questionId: question.id,
    questionText: question.question_text, imageKey: question.image_key,
    optionA: question.option_a, optionB: question.option_b, optionC: question.option_c, optionD: question.option_d,
    correctOptionKey: question.correct_option_key, position: question.position,
    optionOrderJson: JSON.stringify(question.optionOrder),
  }));
  await database.batch([
    database.prepare("DELETE FROM attempt_answers WHERE attempt_id = ?").bind(input.attemptId),
    database.prepare("DELETE FROM attempt_question_snapshots WHERE attempt_id = ?").bind(input.attemptId),
    database.prepare(
      `UPDATE attempts SET started_at = ?, deadline_at = ?, submitted_at = NULL, status = 'IN_PROGRESS',
        score = NULL, total_questions = NULL, correct_count = NULL, wrong_count = NULL,
        draft_answers_json = '{}', draft_revision = 0, reset_by_admin_id = NULL, reset_at = NULL,
        updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'RESET'`,
    ).bind(input.startedAt, input.deadlineAt, input.attemptId),
    database.prepare(
      `INSERT INTO attempt_question_snapshots (
        id, attempt_id, question_id, question_text, image_key, option_a, option_b, option_c, option_d,
        correct_option_key, display_position, display_option_order_json
      ) SELECT json_extract(value, '$.id'), json_extract(value, '$.attemptId'),
        json_extract(value, '$.questionId'), json_extract(value, '$.questionText'), json_extract(value, '$.imageKey'),
        json_extract(value, '$.optionA'), json_extract(value, '$.optionB'), json_extract(value, '$.optionC'),
        json_extract(value, '$.optionD'), json_extract(value, '$.correctOptionKey'), json_extract(value, '$.position'),
        json_extract(value, '$.optionOrderJson') FROM json_each(?)`,
    ).bind(JSON.stringify(rows)),
  ]);
}

export async function listAttemptSnapshots(database: D1Database, attemptId: string) {
  const result = await database.prepare(
    `SELECT question_id, question_text, image_key, option_a, option_b, option_c, option_d,
            correct_option_key, display_position, display_option_order_json
       FROM attempt_question_snapshots WHERE attempt_id = ? ORDER BY display_position`,
  ).bind(attemptId).all<SnapshotRecord>();
  return result.results;
}

export async function saveAttemptDraft(database: D1Database, attemptId: string, participantId: string, answersJson: string, revision: number) {
  await database.prepare(
    `UPDATE attempts SET draft_answers_json = ?, draft_revision = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND participant_id = ? AND status = 'IN_PROGRESS' AND draft_revision < ?`,
  ).bind(answersJson, revision, attemptId, participantId, revision).run();
  return findAttemptById(database, attemptId, participantId);
}

export async function submitAttempt(
  database: D1Database,
  input: { attempt: AttemptRecord; snapshots: SnapshotRecord[]; answers: Record<string, OriginalOptionKey>; score: number; correctCount: number; submittedAt: string },
) {
  const rows = input.snapshots.flatMap((snapshot) => {
    const selected = input.answers[snapshot.question_id];
    return selected ? [{
      id: crypto.randomUUID(), attemptId: input.attempt.id, questionId: snapshot.question_id,
      selected, correct: snapshot.correct_option_key, isCorrect: selected === snapshot.correct_option_key ? 1 : 0,
    }] : [];
  });
  await database.batch([
    database.prepare(
      `INSERT INTO attempt_answers (
        id, attempt_id, question_id, selected_original_option_key, correct_original_option_key, is_correct
      ) SELECT json_extract(value, '$.id'), json_extract(value, '$.attemptId'), json_extract(value, '$.questionId'),
        json_extract(value, '$.selected'), json_extract(value, '$.correct'), json_extract(value, '$.isCorrect')
        FROM json_each(?) WHERE EXISTS (SELECT 1 FROM attempts WHERE id = ? AND status = 'IN_PROGRESS')`,
    ).bind(JSON.stringify(rows), input.attempt.id),
    database.prepare(
      `UPDATE attempts SET status = 'SUBMITTED', submitted_at = ?, score = ?, total_questions = ?,
        correct_count = ?, wrong_count = ?, draft_answers_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'IN_PROGRESS'`,
    ).bind(input.submittedAt, input.score, input.snapshots.length, input.correctCount,
      input.snapshots.length - input.correctCount, JSON.stringify(input.answers), input.attempt.id),
  ]);
}
