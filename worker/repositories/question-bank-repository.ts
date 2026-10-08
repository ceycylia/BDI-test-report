export type QuestionBankRecord = {
  id: string;
  name: string;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  material_id: string | null;
  material_name?: string | null;
  training_id?: string | null;
  training_name?: string | null;
};

export type QuestionRecord = {
  id: string;
  bank_id: string;
  question_text: string;
  image_key: string | null;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option_key: "A" | "B" | "C" | "D";
  is_active: number;
  times_assigned: number;
  created_at: string;
  updated_at: string;
};

export type QuestionBankSummaryRecord = QuestionBankRecord & {
  active_question_count: number;
  inactive_question_count: number;
};

export async function listQuestionBanks(
  database: D1Database
): Promise<QuestionBankSummaryRecord[]> {
  const result = await database
    .prepare(
      `SELECT banks.id, banks.name, banks.description, banks.is_active, banks.material_id,
              materials.name AS material_name, materials.training_id, trainings.name AS training_name,
              banks.created_at, banks.updated_at,
              COALESCE(SUM(CASE WHEN questions.is_active = 1 THEN 1 ELSE 0 END), 0)
                AS active_question_count,
              COALESCE(SUM(CASE WHEN questions.is_active = 0 THEN 1 ELSE 0 END), 0)
                AS inactive_question_count
         FROM question_banks AS banks
         LEFT JOIN questions ON questions.bank_id = banks.id
         LEFT JOIN training_materials materials ON materials.id = banks.material_id
         LEFT JOIN trainings ON trainings.id = materials.training_id
        GROUP BY banks.id
        ORDER BY banks.created_at DESC, banks.rowid DESC`
    )
    .all<QuestionBankSummaryRecord>();

  return result.results;
}

export async function paginateQuestionBanks(
  database: D1Database,
  input: { page: number; limit: number; trainingId?: string; search?: string },
): Promise<{ rows: QuestionBankSummaryRecord[]; total: number }> {
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  if (input.trainingId) {
    clauses.push("materials.training_id = ?");
    bindings.push(input.trainingId);
  }
  if (input.search?.trim()) {
    clauses.push("(materials.name LIKE ? ESCAPE '\\' OR banks.name LIKE ? ESCAPE '\\')");
    const needle = `%${input.search.trim().replace(/[\\%_]/gu, "\\$&")}%`;
    bindings.push(needle, needle);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const base = `FROM question_banks AS banks
    LEFT JOIN training_materials materials ON materials.id = banks.material_id
    LEFT JOIN trainings ON trainings.id = materials.training_id`;
  const [count, result] = await Promise.all([
    database.prepare(`SELECT COUNT(*) AS total ${base} ${where}`).bind(...bindings).first<{ total: number }>(),
    database.prepare(
      `SELECT banks.id, banks.name, banks.description, banks.is_active, banks.material_id,
              materials.name AS material_name, materials.training_id, trainings.name AS training_name,
              banks.created_at, banks.updated_at,
              (SELECT COUNT(*) FROM questions WHERE questions.bank_id = banks.id AND questions.is_active = 1) AS active_question_count,
              (SELECT COUNT(*) FROM questions WHERE questions.bank_id = banks.id AND questions.is_active = 0) AS inactive_question_count
         ${base} ${where}
        ORDER BY banks.created_at DESC, banks.rowid DESC
        LIMIT ? OFFSET ?`,
    ).bind(...bindings, input.limit, (input.page - 1) * input.limit).all<QuestionBankSummaryRecord>(),
  ]);
  return { rows: result.results, total: Number(count?.total ?? 0) };
}

export async function findQuestionBank(
  database: D1Database,
  bankId: string
): Promise<QuestionBankRecord | null> {
  return database
    .prepare(
      `SELECT banks.id, banks.name, banks.description, banks.is_active, banks.created_at, banks.updated_at,
              banks.material_id, materials.name material_name, materials.training_id, trainings.name training_name
         FROM question_banks banks LEFT JOIN training_materials materials ON materials.id=banks.material_id
         LEFT JOIN trainings ON trainings.id=materials.training_id WHERE banks.id = ?
        LIMIT 1`
    )
    .bind(bankId)
    .first<QuestionBankRecord>();
}

export async function createQuestionBank(
  database: D1Database,
  input: {
    id: string;
    name: string;
    materialId: string;
  }
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO question_banks (id, name, material_id, is_active)
      VALUES (?, ?, ?, 1)`
    )
    .bind(input.id, input.name, input.materialId)
    .run();
}

export async function bulkCreateQuestionBanks(
  database: D1Database,
  banks: Array<{
    id: string;
    name: string;
    materialId: string;
  }>
): Promise<number> {
  if (banks.length === 0) return 0;

  const result = await database
    .prepare(
      `INSERT INTO question_banks (id, name, material_id, is_active)
       SELECT
         json_extract(value, '$.id'),
         json_extract(value, '$.name'),
         json_extract(value, '$.materialId'),
         1
       FROM json_each(?) AS requested
       WHERE NOT EXISTS (
         SELECT 1
         FROM question_banks AS existing
         WHERE existing.material_id = json_extract(requested.value, '$.materialId')
       )`
    )
    .bind(JSON.stringify(banks))
    .run();

  return result.meta.changes ?? 0;
}

export async function updateQuestionBank(
  database: D1Database,
  input: {
    id: string;
  }
): Promise<void> {
  await database
    .prepare(
      `UPDATE question_banks
          SET is_active = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`
    )
    .bind(input.id)
    .run();
}

export async function getQuestionBankDependencyCounts(
  database: D1Database,
  bankId: string
): Promise<{ questions: number; trainingSessions: number }> {
  const record = await database
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM questions WHERE bank_id = ?) AS questions,
         (SELECT COUNT(*) FROM training_sessions WHERE bank_id = ?) AS training_sessions`
    )
    .bind(bankId, bankId)
    .first<{ questions: number; training_sessions: number }>();

  return {
    questions: record?.questions ?? 0,
    trainingSessions: record?.training_sessions ?? 0,
  };
}

export async function deleteQuestionBank(
  database: D1Database,
  bankId: string
): Promise<void> {
  await database
    .prepare("DELETE FROM question_banks WHERE id = ?")
    .bind(bankId)
    .run();
}

export async function listQuestions(
  database: D1Database,
  bankId: string
): Promise<QuestionRecord[]> {
  const result = await database
    .prepare(
      `SELECT id, bank_id, question_text, image_key,
              option_a, option_b, option_c, option_d, correct_option_key,
              is_active, times_assigned, created_at, updated_at
         FROM questions
        WHERE bank_id = ?
        ORDER BY created_at DESC, rowid DESC`
    )
    .bind(bankId)
    .all<QuestionRecord>();

  return result.results;
}

export async function paginateQuestions(
  database: D1Database,
  input: { bankId: string; page: number; limit: number; search?: string },
): Promise<{ rows: QuestionRecord[]; total: number }> {
  const bindings: unknown[] = [input.bankId];
  let searchClause = "";
  if (input.search?.trim()) {
    const needle = `%${input.search.trim().replace(/[\\%_]/gu, "\\$&")}%`;
    searchClause = ` AND (question_text LIKE ? ESCAPE '\\' OR option_a LIKE ? ESCAPE '\\' OR option_b LIKE ? ESCAPE '\\' OR option_c LIKE ? ESCAPE '\\' OR option_d LIKE ? ESCAPE '\\')`;
    bindings.push(needle, needle, needle, needle, needle);
  }
  const [count, result] = await Promise.all([
    database.prepare(`SELECT COUNT(*) AS total FROM questions WHERE bank_id = ?${searchClause}`).bind(...bindings).first<{ total: number }>(),
    database.prepare(
      `SELECT id, bank_id, question_text, image_key,
              option_a, option_b, option_c, option_d, correct_option_key,
              is_active, times_assigned, created_at, updated_at
         FROM questions
        WHERE bank_id = ?${searchClause}
        ORDER BY created_at DESC, rowid DESC
        LIMIT ? OFFSET ?`,
    ).bind(...bindings, input.limit, (input.page - 1) * input.limit).all<QuestionRecord>(),
  ]);
  return { rows: result.results, total: Number(count?.total ?? 0) };
}

export async function findQuestion(
  database: D1Database,
  bankId: string,
  questionId: string
): Promise<QuestionRecord | null> {
  return database
    .prepare(
      `SELECT id, bank_id, question_text, image_key,
              option_a, option_b, option_c, option_d, correct_option_key,
              is_active, times_assigned, created_at, updated_at
         FROM questions
        WHERE id = ? AND bank_id = ?
        LIMIT 1`
    )
    .bind(questionId, bankId)
    .first<QuestionRecord>();
}

export async function createQuestion(
  database: D1Database,
  input: {
    id: string;
    bankId: string;
    questionText: string;
    imageKey: string | null;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOptionKey: "A" | "B" | "C" | "D";
  }
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO questions (
         id, bank_id, question_text, image_key,
         option_a, option_b, option_c, option_d, correct_option_key, is_active
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .bind(
      input.id,
      input.bankId,
      input.questionText,
      input.imageKey,
      input.optionA,
      input.optionB,
      input.optionC,
      input.optionD,
      input.correctOptionKey
    )
    .run();
}

export async function bulkCreateQuestions(
  database: D1Database,
  bankId: string,
  questions: Array<{
    id: string;
    questionText: string;
    imageKey: string | null;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOptionKey: "A" | "B" | "C" | "D";
  }>
): Promise<void> {
  const encoded = JSON.stringify(questions);
  await database
    .prepare(
      `INSERT INTO questions (
         id, bank_id, question_text, image_key,
         option_a, option_b, option_c, option_d, correct_option_key, is_active
       )
       SELECT
         json_extract(value, '$.id'),
         ?,
         json_extract(value, '$.questionText'),
         json_extract(value, '$.imageKey'),
         json_extract(value, '$.optionA'),
         json_extract(value, '$.optionB'),
         json_extract(value, '$.optionC'),
         json_extract(value, '$.optionD'),
         json_extract(value, '$.correctOptionKey'),
         1
       FROM json_each(?)`
    )
    .bind(bankId, encoded)
    .run();
}

export async function updateQuestion(
  database: D1Database,
  input: {
    id: string;
    bankId: string;
    questionText: string;
    imageKey: string | null;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOptionKey: "A" | "B" | "C" | "D";
  }
): Promise<void> {
  await database
    .prepare(
      `UPDATE questions
          SET question_text = ?, image_key = ?, option_a = ?, option_b = ?,
              option_c = ?, option_d = ?, correct_option_key = ?, is_active = 1,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND bank_id = ?`
    )
    .bind(
      input.questionText,
      input.imageKey,
      input.optionA,
      input.optionB,
      input.optionC,
      input.optionD,
      input.correctOptionKey,
      input.id,
      input.bankId
    )
    .run();
}

export async function questionHasDependencies(
  database: D1Database,
  questionId: string
): Promise<boolean> {
  const record = await database
    .prepare(
      `SELECT
         EXISTS(SELECT 1 FROM batch_questions WHERE question_id = ?)
         OR EXISTS(SELECT 1 FROM attempt_question_snapshots WHERE question_id = ?)
         OR EXISTS(SELECT 1 FROM attempt_answers WHERE question_id = ?)
           AS has_dependencies`
    )
    .bind(questionId, questionId, questionId)
    .first<{ has_dependencies: number }>();

  return record?.has_dependencies === 1;
}

export async function deleteQuestion(
  database: D1Database,
  bankId: string,
  questionId: string
): Promise<void> {
  await database
    .prepare("DELETE FROM questions WHERE id = ? AND bank_id = ?")
    .bind(questionId, bankId)
    .run();
}
