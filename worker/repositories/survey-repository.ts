export type SurveyTemplateStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type SurveyQuestionType =
  | "SINGLE_CHOICE"
  | "SCALE"
  | "LONG_TEXT";

export type SurveyTemplateRecord = {
  id: string;
  name: string;
  version: number;
  is_active: number;
  description: string | null;
  status: SurveyTemplateStatus;
  published_at: string | null;
  source_template_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SurveyTemplateSummaryRecord = SurveyTemplateRecord & {
  section_count: number;
  question_count: number;
  campaign_count: number;
};

export type SurveySectionRecord = {
  id: string;
  survey_template_id: string;
  section_code: string;
  title: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SurveyQuestionRecord = {
  id: string;
  survey_section_id: string;
  question_text: string;
  question_type: SurveyQuestionType;
  is_required: number;
  sort_order: number;
  scale_min: number | null;
  scale_max: number | null;
  scale_min_label: string | null;
  scale_max_label: string | null;
  helper_text: string | null;
  created_at: string;
  updated_at: string;
};

export type SurveyQuestionOptionRecord = {
  id: string;
  survey_question_id: string;
  option_value: string;
  option_label: string;
  allows_other_text: number;
  sort_order: number;
  created_at: string;
};

export type SurveyQuestionDetail = SurveyQuestionRecord & {
  options: SurveyQuestionOptionRecord[];
};

export type SurveySectionDetail = SurveySectionRecord & {
  questions: SurveyQuestionDetail[];
};

export type SurveyTemplateDetail = {
  template: SurveyTemplateRecord;
  sections: SurveySectionDetail[];
};


export async function listSurveyTemplates(
  database: D1Database
): Promise<SurveyTemplateSummaryRecord[]> {
  const result = await database
    .prepare(
      `SELECT
         templates.id,
         templates.name,
         templates.version,
         templates.is_active,
         templates.description,
         templates.status,
         templates.published_at,
         templates.source_template_id,
         templates.created_at,
         templates.updated_at,

         (
           SELECT COUNT(*)
           FROM survey_sections sections
           WHERE sections.survey_template_id = templates.id
         ) AS section_count,

         (
           SELECT COUNT(*)
           FROM survey_questions questions
           JOIN survey_sections sections
             ON sections.id = questions.survey_section_id
           WHERE sections.survey_template_id = templates.id
         ) AS question_count,

         (
           SELECT COUNT(*)
           FROM survey_campaigns campaigns
           WHERE campaigns.survey_template_id = templates.id
         ) AS campaign_count

       FROM survey_templates templates
       ORDER BY
         templates.name COLLATE NOCASE ASC,
         templates.version DESC`
    )
    .all<SurveyTemplateSummaryRecord>();

  return result.results;
}


export async function findSurveyTemplate(
  database: D1Database,
  templateId: string
): Promise<SurveyTemplateRecord | null> {
  return database
    .prepare(
      `SELECT
         id,
         name,
         version,
         is_active,
         description,
         status,
         published_at,
         source_template_id,
         created_at,
         updated_at
       FROM survey_templates
       WHERE id = ?
       LIMIT 1`
    )
    .bind(templateId)
    .first<SurveyTemplateRecord>();
}


export async function getSurveyTemplateDetail(
  database: D1Database,
  templateId: string
): Promise<SurveyTemplateDetail | null> {
  const template = await findSurveyTemplate(database, templateId);

  if (!template) {
    return null;
  }

  const sectionsResult = await database
    .prepare(
      `SELECT
         id,
         survey_template_id,
         section_code,
         title,
         description,
         sort_order,
         created_at,
         updated_at
       FROM survey_sections
       WHERE survey_template_id = ?
       ORDER BY sort_order ASC, id ASC`
    )
    .bind(templateId)
    .all<SurveySectionRecord>();

  const questionsResult = await database
    .prepare(
      `SELECT
         questions.id,
         questions.survey_section_id,
         questions.question_text,
         questions.question_type,
         questions.is_required,
         questions.sort_order,
         questions.scale_min,
         questions.scale_max,
         questions.scale_min_label,
         questions.scale_max_label,
         questions.helper_text,
         questions.created_at,
         questions.updated_at
       FROM survey_questions questions
       JOIN survey_sections sections
         ON sections.id = questions.survey_section_id
       WHERE sections.survey_template_id = ?
       ORDER BY
         sections.sort_order ASC,
         questions.sort_order ASC,
         questions.id ASC`
    )
    .bind(templateId)
    .all<SurveyQuestionRecord>();

  const optionsResult = await database
    .prepare(
      `SELECT
         options.id,
         options.survey_question_id,
         options.option_value,
         options.option_label,
         options.allows_other_text,
         options.sort_order,
         options.created_at
       FROM survey_question_options options
       JOIN survey_questions questions
         ON questions.id = options.survey_question_id
       JOIN survey_sections sections
         ON sections.id = questions.survey_section_id
       WHERE sections.survey_template_id = ?
       ORDER BY
         sections.sort_order ASC,
         questions.sort_order ASC,
         options.sort_order ASC,
         options.id ASC`
    )
    .bind(templateId)
    .all<SurveyQuestionOptionRecord>();

  const optionsByQuestion = new Map<
    string,
    SurveyQuestionOptionRecord[]
  >();

  for (const option of optionsResult.results) {
    const current = optionsByQuestion.get(option.survey_question_id) ?? [];
    current.push(option);
    optionsByQuestion.set(option.survey_question_id, current);
  }

  const questionsBySection = new Map<
    string,
    SurveyQuestionDetail[]
  >();

  for (const question of questionsResult.results) {
    const current = questionsBySection.get(question.survey_section_id) ?? [];

    current.push({
      ...question,
      options: optionsByQuestion.get(question.id) ?? [],
    });

    questionsBySection.set(question.survey_section_id, current);
  }

  return {
    template,
    sections: sectionsResult.results.map((section) => ({
      ...section,
      questions: questionsBySection.get(section.id) ?? [],
    })),
  };
}


export async function getNextSurveyTemplateVersion(
  database: D1Database,
  templateName: string
): Promise<number> {
  const result = await database
    .prepare(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM survey_templates
       WHERE name = ?`
    )
    .bind(templateName)
    .first<{ next_version: number }>();

  return result?.next_version ?? 1;
}


export async function cloneSurveyTemplateVersion(
  database: D1Database,
  source: SurveyTemplateDetail,
  input: {
    id: string;
    version: number;
  }
): Promise<void> {
  const statements: D1PreparedStatement[] = [];

  statements.push(
    database
      .prepare(
        `INSERT INTO survey_templates (
           id,
           name,
           version,
           is_active,
           description,
           status,
           published_at,
           source_template_id
         )
         VALUES (?, ?, ?, 1, ?, 'DRAFT', NULL, ?)`
      )
      .bind(
        input.id,
        source.template.name,
        input.version,
        source.template.description,
        source.template.id
      )
  );

  const sectionIdMap = new Map<string, string>();
  const questionIdMap = new Map<string, string>();

  for (const section of source.sections) {
    const newSectionId = crypto.randomUUID();
    sectionIdMap.set(section.id, newSectionId);

    statements.push(
      database
        .prepare(
          `INSERT INTO survey_sections (
             id,
             survey_template_id,
             section_code,
             title,
             sort_order,
             description
           )
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          newSectionId,
          input.id,
          section.section_code,
          section.title,
          section.sort_order,
          section.description
        )
    );

    for (const question of section.questions) {
      const newQuestionId = crypto.randomUUID();
      questionIdMap.set(question.id, newQuestionId);

      statements.push(
        database
          .prepare(
            `INSERT INTO survey_questions (
               id,
               survey_section_id,
               question_text,
               question_type,
               is_required,
               sort_order,
               scale_min,
               scale_max,
               scale_min_label,
               scale_max_label,
               helper_text
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            newQuestionId,
            newSectionId,
            question.question_text,
            question.question_type,
            question.is_required,
            question.sort_order,
            question.scale_min,
            question.scale_max,
            question.scale_min_label,
            question.scale_max_label,
            question.helper_text
          )
      );

      for (const option of question.options) {
        statements.push(
          database
            .prepare(
              `INSERT INTO survey_question_options (
                 id,
                 survey_question_id,
                 option_value,
                 option_label,
                 allows_other_text,
                 sort_order
               )
               VALUES (?, ?, ?, ?, ?, ?)`
            )
            .bind(
              crypto.randomUUID(),
              newQuestionId,
              option.option_value,
              option.option_label,
              option.allows_other_text,
              option.sort_order
            )
        );
      }
    }
  }

  await database.batch(statements);
}

export type SurveyQuestionDraftInput = {
  questionText: string;
  questionType: SurveyQuestionType;
  helperText: string | null;

  scaleMin: number | null;
  scaleMax: number | null;
  scaleMinLabel: string | null;
  scaleMaxLabel: string | null;

  options: Array<{
    label: string;
    allowsOtherText: boolean;
  }>;
};


export async function findDraftSurveyTemplateByName(
  database: D1Database,
  name: string
): Promise<SurveyTemplateRecord | null> {
  return database
    .prepare(
      `SELECT
         id,
         name,
         version,
         is_active,
         description,
         status,
         published_at,
         source_template_id,
         created_at,
         updated_at
       FROM survey_templates
       WHERE name = ?
         AND status = 'DRAFT'
       ORDER BY version DESC
       LIMIT 1`
    )
    .bind(name)
    .first<SurveyTemplateRecord>();
}


export async function getNextSurveySectionSortOrder(
  database: D1Database,
  templateId: string
): Promise<number> {
  const record = await database
    .prepare(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
       FROM survey_sections
       WHERE survey_template_id = ?`
    )
    .bind(templateId)
    .first<{ next_order: number }>();

  return record?.next_order ?? 1;
}


export async function getNextSurveyQuestionSortOrder(
  database: D1Database,
  sectionId: string
): Promise<number> {
  const record = await database
    .prepare(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
       FROM survey_questions
       WHERE survey_section_id = ?`
    )
    .bind(sectionId)
    .first<{ next_order: number }>();

  return record?.next_order ?? 1;
}


export async function createSurveySection(
  database: D1Database,
  input: {
    id: string;
    templateId: string;
    sectionCode: string;
    title: string;
    description: string | null;
    sortOrder: number;
  }
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO survey_sections (
         id,
         survey_template_id,
         section_code,
         title,
         description,
         sort_order
       )
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.id,
      input.templateId,
      input.sectionCode,
      input.title,
      input.description,
      input.sortOrder
    )
    .run();
}


export async function updateSurveySection(
  database: D1Database,
  input: {
    id: string;
    templateId: string;
    title: string;
    description: string | null;
  }
): Promise<void> {
  await database
    .prepare(
      `UPDATE survey_sections
       SET
         title = ?,
         description = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND survey_template_id = ?`
    )
    .bind(
      input.title,
      input.description,
      input.id,
      input.templateId
    )
    .run();
}


export async function deleteSurveySection(
  database: D1Database,
  templateId: string,
  sectionId: string
): Promise<void> {
  await database
    .prepare(
      `DELETE FROM survey_sections
       WHERE id = ?
         AND survey_template_id = ?`
    )
    .bind(sectionId, templateId)
    .run();
}


export async function createSurveyQuestion(
  database: D1Database,
  input: {
    id: string;
    sectionId: string;
    sortOrder: number;
    question: SurveyQuestionDraftInput;
  }
): Promise<void> {
  const question = input.question;

  const statements: D1PreparedStatement[] = [
    database
      .prepare(
        `INSERT INTO survey_questions (
           id,
           survey_section_id,
           question_text,
           question_type,
           is_required,
           sort_order,
           scale_min,
           scale_max,
           scale_min_label,
           scale_max_label,
           helper_text
         )
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        input.id,
        input.sectionId,
        question.questionText,
        question.questionType,
        input.sortOrder,
        question.scaleMin,
        question.scaleMax,
        question.scaleMinLabel,
        question.scaleMaxLabel,
        question.helperText
      ),
  ];

  if (question.questionType === "SINGLE_CHOICE") {
    question.options.forEach((option, index) => {
      statements.push(
        database
          .prepare(
            `INSERT INTO survey_question_options (
               id,
               survey_question_id,
               option_value,
               option_label,
               allows_other_text,
               sort_order
             )
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            input.id,
            `OPTION_${index + 1}`,
            option.label,
            option.allowsOtherText ? 1 : 0,
            index + 1
          )
      );
    });
  }

  await database.batch(statements);
}


export async function updateSurveyQuestion(
  database: D1Database,
  input: {
    id: string;
    sectionId: string;
    question: SurveyQuestionDraftInput;
  }
): Promise<void> {
  const question = input.question;

  const statements: D1PreparedStatement[] = [
    database
      .prepare(
        `UPDATE survey_questions
         SET
           question_text = ?,
           question_type = ?,
           is_required = 1,
           scale_min = ?,
           scale_max = ?,
           scale_min_label = ?,
           scale_max_label = ?,
           helper_text = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND survey_section_id = ?`
      )
      .bind(
        question.questionText,
        question.questionType,
        question.scaleMin,
        question.scaleMax,
        question.scaleMinLabel,
        question.scaleMaxLabel,
        question.helperText,
        input.id,
        input.sectionId
      ),

    database
      .prepare(
        `DELETE FROM survey_question_options
         WHERE survey_question_id = ?`
      )
      .bind(input.id),
  ];

  if (question.questionType === "SINGLE_CHOICE") {
    question.options.forEach((option, index) => {
      statements.push(
        database
          .prepare(
            `INSERT INTO survey_question_options (
               id,
               survey_question_id,
               option_value,
               option_label,
               allows_other_text,
               sort_order
             )
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            input.id,
            `OPTION_${index + 1}`,
            option.label,
            option.allowsOtherText ? 1 : 0,
            index + 1
          )
      );
    });
  }

  await database.batch(statements);
}


export async function deleteSurveyQuestion(
  database: D1Database,
  questionId: string,
  sectionId: string
): Promise<void> {
  await database
    .prepare(
      `DELETE FROM survey_questions
       WHERE id = ?
         AND survey_section_id = ?`
    )
    .bind(questionId, sectionId)
    .run();
}


export async function publishSurveyTemplate(
  database: D1Database,
  input: {
    templateId: string;
    templateName: string;
  }
): Promise<void> {
  await database.batch([
    database
      .prepare(
        `UPDATE survey_templates
         SET
           status = 'ARCHIVED',
           is_active = 0,
           updated_at = CURRENT_TIMESTAMP
         WHERE name = ?
           AND status = 'PUBLISHED'
           AND id <> ?`
      )
      .bind(input.templateName, input.templateId),

    database
      .prepare(
        `UPDATE survey_templates
         SET
           status = 'PUBLISHED',
           is_active = 1,
           published_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND status = 'DRAFT'`
      )
      .bind(input.templateId),
  ]);
}

export async function paginateSurveyTemplates(
  database: D1Database,
  input: { page: number; limit: number },
): Promise<{ rows: SurveyTemplateSummaryRecord[]; total: number }> {
  const [count, result] = await Promise.all([
    database.prepare("SELECT COUNT(*) AS total FROM survey_templates").first<{ total: number }>(),
    database.prepare(
      `SELECT templates.id, templates.name, templates.version, templates.is_active,
              templates.description, templates.status, templates.published_at,
              templates.source_template_id, templates.created_at, templates.updated_at,
              (SELECT COUNT(*) FROM survey_sections sections WHERE sections.survey_template_id=templates.id) AS section_count,
              (SELECT COUNT(*) FROM survey_questions questions JOIN survey_sections sections ON sections.id=questions.survey_section_id WHERE sections.survey_template_id=templates.id) AS question_count,
              (SELECT COUNT(*) FROM survey_campaigns campaigns WHERE campaigns.survey_template_id=templates.id) AS campaign_count
       FROM survey_templates templates
       ORDER BY templates.name COLLATE NOCASE ASC, templates.version DESC
       LIMIT ? OFFSET ?`,
    ).bind(input.limit, (input.page - 1) * input.limit).all<SurveyTemplateSummaryRecord>(),
  ]);
  return { rows: result.results, total: Number(count?.total ?? 0) };
}


export async function archiveSurveyTemplate(
  database: D1Database,
  templateId: string,
): Promise<number> {
  const result = await database
    .prepare(
      `UPDATE survey_templates
       SET
         status = 'ARCHIVED',
         is_active = 0,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND UPPER(status) = 'PUBLISHED'`,
    )
    .bind(templateId)
    .run();

  return Number(result.meta.changes ?? 0);
}


export async function reactivateSurveyTemplate(
  database: D1Database,
  input: {
    templateId: string;
    templateName: string;
  },
): Promise<number> {
  const results = await database.batch([
    database
      .prepare(
        `UPDATE survey_templates
         SET
           status = 'ARCHIVED',
           is_active = 0,
           updated_at = CURRENT_TIMESTAMP
         WHERE name = ?
           AND UPPER(status) = 'PUBLISHED'
           AND id <> ?
           AND EXISTS (
             SELECT 1
             FROM survey_templates target
             WHERE target.id = ?
               AND UPPER(target.status) = 'ARCHIVED'
           )`,
      )
      .bind(input.templateName, input.templateId, input.templateId),
    database
      .prepare(
        `UPDATE survey_templates
         SET
           status = 'PUBLISHED',
           is_active = 1,
           published_at = COALESCE(published_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND UPPER(status) = 'ARCHIVED'`,
      )
      .bind(input.templateId),
  ]);

  return Number(results[1]?.meta.changes ?? 0);
}
