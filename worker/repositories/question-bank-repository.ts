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
        ORDER BY banks.updated_at DESC, banks.name COLLATE NOCASE ASC`
    )
    .all<QuestionBankSummaryRecord>();

  return result.results;
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
      `INSERT INTO question_banks (id, name, material_id)
      VALUES (?, ?, ?)`
    )
    .bind(input.id, input.name, input.materialId)
    .run();
}

export async function updateQuestionBank(
  database: D1Database,
  input: {
    id: string;
    isActive: boolean;
  }
): Promise<void> {
  await database
    .prepare(
      `UPDATE question_banks
          SET is_active = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`
    )
    .bind(input.isActive ? 1 : 0, input.id)
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
        ORDER BY created_at ASC, id ASC`
    )
    .bind(bankId)
    .all<QuestionRecord>();

  return result.results;
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
         option_a, option_b, option_c, option_d, correct_option_key
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
         option_a, option_b, option_c, option_d, correct_option_key
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
         json_extract(value, '$.correctOptionKey')
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
    isActive: boolean;
  }
): Promise<void> {
  await database
    .prepare(
      `UPDATE questions
          SET question_text = ?, image_key = ?, option_a = ?, option_b = ?,
              option_c = ?, option_d = ?, correct_option_key = ?, is_active = ?,
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
      input.isActive ? 1 : 0,
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
