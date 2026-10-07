import { Hono } from "hono";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import {
  requireAdmin,
  requireCsrf,
  requireSameOrigin,
} from "../../middleware/admin-auth";
import {
  cloneSurveyTemplateVersion,
  createSurveyQuestion,
  createSurveySection,
  deleteSurveyQuestion,
  deleteSurveySection,
  findDraftSurveyTemplateByName,
  getNextSurveyQuestionSortOrder,
  getNextSurveySectionSortOrder,
  getNextSurveyTemplateVersion,
  getSurveyTemplateDetail,
  listSurveyTemplates,
  publishSurveyTemplate,
  updateSurveyQuestion,
  updateSurveySection,
  type SurveyQuestionDetail,
  type SurveyQuestionOptionRecord,
  type SurveySectionDetail,
  type SurveyTemplateRecord,
} from "../../repositories/survey-repository";
import type { AppEnvironment } from "../../types";


function mapOption(option: SurveyQuestionOptionRecord) {
  return {
    id: option.id,
    value: option.option_value,
    label: option.option_label,
    allowsOtherText: option.allows_other_text === 1,
    sortOrder: option.sort_order,
  };
}


function mapQuestion(question: SurveyQuestionDetail) {
  return {
    id: question.id,
    questionText: question.question_text,
    questionType: question.question_type,
    isRequired: question.is_required === 1,
    sortOrder: question.sort_order,

    scaleMin: question.scale_min,
    scaleMax: question.scale_max,
    scaleMinLabel: question.scale_min_label,
    scaleMaxLabel: question.scale_max_label,

    helperText: question.helper_text,

    options: question.options.map(mapOption),

    createdAt: question.created_at,
    updatedAt: question.updated_at,
  };
}


function mapSection(section: SurveySectionDetail) {
  return {
    id: section.id,
    sectionCode: section.section_code,
    title: section.title,
    description: section.description,
    sortOrder: section.sort_order,

    questions: section.questions.map(mapQuestion),

    createdAt: section.created_at,
    updatedAt: section.updated_at,
  };
}


function mapTemplate(template: SurveyTemplateRecord) {
  return {
    id: template.id,
    name: template.name,
    version: template.version,
    description: template.description,

    status: template.status,
    isActive: template.is_active === 1,

    publishedAt: template.published_at,
    sourceTemplateId: template.source_template_id,

    createdAt: template.created_at,
    updatedAt: template.updated_at,
  };
}


// =========================================================
// VALIDATION SCHEMA
// =========================================================

const sectionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul bagian wajib diisi.")
    .max(200),

  description: z
    .string()
    .trim()
    .max(2_000)
    .nullable()
    .optional(),
});


const questionOptionSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Pilihan jawaban tidak boleh kosong.")
    .max(1_000),

  allowsOtherText: z.boolean().default(false),
});


const questionSchema = z
  .object({
    questionText: z
      .string()
      .trim()
      .min(1, "Pertanyaan wajib diisi.")
      .max(10_000),

    questionType: z.enum([
      "SINGLE_CHOICE",
      "SCALE",
      "LONG_TEXT",
    ]),

    helperText: z
      .string()
      .trim()
      .max(5_000)
      .nullable()
      .optional(),

    scaleMin: z.number().int().nullable().optional(),

    scaleMax: z.number().int().nullable().optional(),

    scaleMinLabel: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional(),

    scaleMaxLabel: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional(),

    options: z
      .array(questionOptionSchema)
      .max(50)
      .optional()
      .default([]),
  })
  .superRefine((value, context) => {
    if (value.questionType === "SINGLE_CHOICE") {
      if (value.options.length < 2) {
        context.addIssue({
          code: "custom",
          message:
            "Pertanyaan pilihan tunggal minimal memiliki 2 pilihan jawaban.",
        });
      }

      const otherCount = value.options.filter(
        (option) => option.allowsOtherText
      ).length;

      if (otherCount > 1) {
        context.addIssue({
          code: "custom",
          message:
            'Hanya satu pilihan yang boleh menggunakan jawaban "Yang lain".',
        });
      }
    }

    if (value.questionType === "SCALE") {
      if (
        value.scaleMin === null ||
        value.scaleMin === undefined ||
        value.scaleMax === null ||
        value.scaleMax === undefined
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Nilai minimum dan maksimum skala wajib diisi.",
        });
      } else if (value.scaleMax <= value.scaleMin) {
        context.addIssue({
          code: "custom",
          message:
            "Nilai maksimum harus lebih besar dari nilai minimum.",
        });
      }
    }
  });


// =========================================================
// HELPERS
// =========================================================

function sectionCodeFromOrder(order: number): string {
  let value = order;
  let result = "";

  while (value > 0) {
    value -= 1;

    result =
      String.fromCharCode(65 + (value % 26)) +
      result;

    value = Math.floor(value / 26);
  }

  return result;
}


function normalizeQuestionInput(
  input: z.infer<typeof questionSchema>
) {
  if (input.questionType === "SINGLE_CHOICE") {
    return {
      questionText: input.questionText,
      questionType: input.questionType,
      helperText: input.helperText || null,

      scaleMin: null,
      scaleMax: null,
      scaleMinLabel: null,
      scaleMaxLabel: null,

      options: input.options,
    };
  }

  if (input.questionType === "SCALE") {
    return {
      questionText: input.questionText,
      questionType: input.questionType,
      helperText: input.helperText || null,

      scaleMin: input.scaleMin ?? null,
      scaleMax: input.scaleMax ?? null,
      scaleMinLabel: input.scaleMinLabel || null,
      scaleMaxLabel: input.scaleMaxLabel || null,

      options: [],
    };
  }

  return {
    questionText: input.questionText,
    questionType: input.questionType,
    helperText: input.helperText || null,

    scaleMin: null,
    scaleMax: null,
    scaleMinLabel: null,
    scaleMaxLabel: null,

    options: [],
  };
}


// =========================================================
// ROUTER
// =========================================================

export const surveyTemplateRoutes =
  new Hono<AppEnvironment>();

surveyTemplateRoutes.use("*", requireAdmin);


// =========================================================
// GET TEMPLATE LIST
// =========================================================

surveyTemplateRoutes.get("/", async (context) => {
  const templates = await listSurveyTemplates(
    context.env.DB
  );

  context.header("Cache-Control", "no-store");

  return context.json({
    templates: templates.map((template) => ({
      ...mapTemplate(template),

      sectionCount: template.section_count,
      questionCount: template.question_count,
      campaignCount: template.campaign_count,
    })),
  });
});


// =========================================================
// GET TEMPLATE DETAIL
// =========================================================

surveyTemplateRoutes.get(
  "/:templateId",
  async (context) => {
    const templateId =
      context.req.param("templateId");

    const detail =
      await getSurveyTemplateDetail(
        context.env.DB,
        templateId
      );

    if (!detail) {
      throw new HttpError(
        404,
        "SURVEY_TEMPLATE_NOT_FOUND",
        "Template Survey tidak ditemukan."
      );
    }

    context.header("Cache-Control", "no-store");

    return context.json({
      template: {
        ...mapTemplate(detail.template),

        sections:
          detail.sections.map(mapSection),
      },
    });
  }
);


// =========================================================
// CREATE NEW VERSION
// =========================================================

surveyTemplateRoutes.post(
  "/:templateId/new-version",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const templateId =
      context.req.param("templateId");

    const source =
      await getSurveyTemplateDetail(
        context.env.DB,
        templateId
      );

    if (!source) {
      throw new HttpError(
        404,
        "SURVEY_TEMPLATE_NOT_FOUND",
        "Template Survey tidak ditemukan."
      );
    }

    if (
      source.template.status !== "PUBLISHED"
    ) {
      throw new HttpError(
        409,
        "SURVEY_TEMPLATE_NOT_PUBLISHED",
        "Versi baru hanya dapat dibuat dari template yang sudah dipublikasikan."
      );
    }

    const existingDraft =
      await findDraftSurveyTemplateByName(
        context.env.DB,
        source.template.name
      );

    if (existingDraft) {
      throw new HttpError(
        409,
        "SURVEY_TEMPLATE_DRAFT_EXISTS",
        `Versi ${existingDraft.version} masih berstatus Draft. Selesaikan atau publish Draft tersebut terlebih dahulu.`
      );
    }

    const nextVersion =
      await getNextSurveyTemplateVersion(
        context.env.DB,
        source.template.name
      );

    const newTemplateId =
      crypto.randomUUID();

    try {
      await cloneSurveyTemplateVersion(
        context.env.DB,
        source,
        {
          id: newTemplateId,
          version: nextVersion,
        }
      );
    } catch (error) {
      if (
        String(error).includes("UNIQUE")
      ) {
        throw new HttpError(
          409,
          "SURVEY_TEMPLATE_VERSION_CONFLICT",
          "Versi template berubah. Silakan muat ulang halaman dan coba kembali."
        );
      }

      throw error;
    }

    return context.json(
      {
        template: {
          id: newTemplateId,
          name: source.template.name,
          version: nextVersion,
          description:
            source.template.description,

          status: "DRAFT",
          isActive: true,

          publishedAt: null,

          sourceTemplateId:
            source.template.id,
        },
      },
      201
    );
  }
);


// =========================================================
// CREATE SECTION
// =========================================================

surveyTemplateRoutes.post(
  "/:templateId/sections",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const templateId =
      context.req.param("templateId");

    const detail =
      await getSurveyTemplateDetail(
        context.env.DB,
        templateId
      );

    if (!detail) {
      throw new HttpError(
        404,
        "SURVEY_TEMPLATE_NOT_FOUND",
        "Template Survey tidak ditemukan."
      );
    }

    if (
      detail.template.status !== "DRAFT"
    ) {
      throw new HttpError(
        409,
        "SURVEY_TEMPLATE_LOCKED",
        "Hanya template Draft yang dapat diedit."
      );
    }

    const parsed =
      sectionSchema.safeParse(
        await context.req
          .json()
          .catch(() => null)
      );

    if (!parsed.success) {
      throw new HttpError(
        422,
        "SURVEY_SECTION_INVALID",
        parsed.error.issues[0]?.message ??
          "Data bagian tidak valid."
      );
    }

    const sortOrder =
      await getNextSurveySectionSortOrder(
        context.env.DB,
        templateId
      );

    const sectionId =
      crypto.randomUUID();

    await createSurveySection(
      context.env.DB,
      {
        id: sectionId,
        templateId,

        sectionCode:
          sectionCodeFromOrder(sortOrder),

        title: parsed.data.title,

        description:
          parsed.data.description || null,

        sortOrder,
      }
    );

    return context.json(
      {
        section: {
          id: sectionId,
        },
      },
      201
    );
  }
);


// =========================================================
// UPDATE SECTION
// =========================================================

surveyTemplateRoutes.put(
  "/:templateId/sections/:sectionId",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const templateId =
      context.req.param("templateId");

    const sectionId =
      context.req.param("sectionId");

    const detail =
      await getSurveyTemplateDetail(
        context.env.DB,
        templateId
      );

    if (!detail) {
      throw new HttpError(
        404,
        "SURVEY_TEMPLATE_NOT_FOUND",
        "Template Survey tidak ditemukan."
      );
    }

    if (
      detail.template.status !== "DRAFT"
    ) {
      throw new HttpError(
        409,
        "SURVEY_TEMPLATE_LOCKED",
        "Hanya template Draft yang dapat diedit."
      );
    }

    const section =
      detail.sections.find(
        (item) => item.id === sectionId
      );

    if (!section) {
      throw new HttpError(
        404,
        "SURVEY_SECTION_NOT_FOUND",
        "Bagian Survey tidak ditemukan."
      );
    }

    const parsed =
      sectionSchema.safeParse(
        await context.req
          .json()
          .catch(() => null)
      );

    if (!parsed.success) {
      throw new HttpError(
        422,
        "SURVEY_SECTION_INVALID",
        parsed.error.issues[0]?.message ??
          "Data bagian tidak valid."
      );
    }

    await updateSurveySection(
      context.env.DB,
      {
        id: sectionId,
        templateId,

        title: parsed.data.title,

        description:
          parsed.data.description || null,
      }
    );

    return context.json({
      success: true,
    });
  }
);


// =========================================================
// DELETE SECTION
// =========================================================

surveyTemplateRoutes.delete(
  "/:templateId/sections/:sectionId",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const templateId =
      context.req.param("templateId");

    const sectionId =
      context.req.param("sectionId");

    const detail =
      await getSurveyTemplateDetail(
        context.env.DB,
        templateId
      );

    if (!detail) {
      throw new HttpError(
        404,
        "SURVEY_TEMPLATE_NOT_FOUND",
        "Template Survey tidak ditemukan."
      );
    }

    if (
      detail.template.status !== "DRAFT"
    ) {
      throw new HttpError(
        409,
        "SURVEY_TEMPLATE_LOCKED",
        "Hanya template Draft yang dapat diedit."
      );
    }

    const section =
      detail.sections.find(
        (item) => item.id === sectionId
      );

    if (!section) {
      throw new HttpError(
        404,
        "SURVEY_SECTION_NOT_FOUND",
        "Bagian Survey tidak ditemukan."
      );
    }

    await deleteSurveySection(
      context.env.DB,
      templateId,
      sectionId
    );

    return context.json({
      success: true,
    });
  }
);


// =========================================================
// CREATE QUESTION
// =========================================================

surveyTemplateRoutes.post(
  "/:templateId/sections/:sectionId/questions",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const templateId =
      context.req.param("templateId");

    const sectionId =
      context.req.param("sectionId");

    const detail =
      await getSurveyTemplateDetail(
        context.env.DB,
        templateId
      );

    if (!detail) {
      throw new HttpError(
        404,
        "SURVEY_TEMPLATE_NOT_FOUND",
        "Template Survey tidak ditemukan."
      );
    }

    if (
      detail.template.status !== "DRAFT"
    ) {
      throw new HttpError(
        409,
        "SURVEY_TEMPLATE_LOCKED",
        "Hanya template Draft yang dapat diedit."
      );
    }

    const section =
      detail.sections.find(
        (item) => item.id === sectionId
      );

    if (!section) {
      throw new HttpError(
        404,
        "SURVEY_SECTION_NOT_FOUND",
        "Bagian Survey tidak ditemukan."
      );
    }

    const parsed =
      questionSchema.safeParse(
        await context.req
          .json()
          .catch(() => null)
      );

    if (!parsed.success) {
      throw new HttpError(
        422,
        "SURVEY_QUESTION_INVALID",
        parsed.error.issues[0]?.message ??
          "Data pertanyaan tidak valid."
      );
    }

    const sortOrder =
      await getNextSurveyQuestionSortOrder(
        context.env.DB,
        sectionId
      );

    const questionId =
      crypto.randomUUID();

    await createSurveyQuestion(
      context.env.DB,
      {
        id: questionId,
        sectionId,
        sortOrder,

        question:
          normalizeQuestionInput(
            parsed.data
          ),
      }
    );

    return context.json(
      {
        question: {
          id: questionId,
        },
      },
      201
    );
  }
);


// =========================================================
// UPDATE QUESTION
// =========================================================

surveyTemplateRoutes.put(
  "/:templateId/questions/:questionId",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const templateId =
      context.req.param("templateId");

    const questionId =
      context.req.param("questionId");

    const detail =
      await getSurveyTemplateDetail(
        context.env.DB,
        templateId
      );

    if (!detail) {
      throw new HttpError(
        404,
        "SURVEY_TEMPLATE_NOT_FOUND",
        "Template Survey tidak ditemukan."
      );
    }

    if (
      detail.template.status !== "DRAFT"
    ) {
      throw new HttpError(
        409,
        "SURVEY_TEMPLATE_LOCKED",
        "Hanya template Draft yang dapat diedit."
      );
    }

    const section =
      detail.sections.find((item) =>
        item.questions.some(
          (question) =>
            question.id === questionId
        )
      );

    if (!section) {
      throw new HttpError(
        404,
        "SURVEY_QUESTION_NOT_FOUND",
        "Pertanyaan Survey tidak ditemukan."
      );
    }

    const parsed =
      questionSchema.safeParse(
        await context.req
          .json()
          .catch(() => null)
      );

    if (!parsed.success) {
      throw new HttpError(
        422,
        "SURVEY_QUESTION_INVALID",
        parsed.error.issues[0]?.message ??
          "Data pertanyaan tidak valid."
      );
    }

    await updateSurveyQuestion(
      context.env.DB,
      {
        id: questionId,
        sectionId: section.id,

        question:
          normalizeQuestionInput(
            parsed.data
          ),
      }
    );

    return context.json({
      success: true,
    });
  }
);


// =========================================================
// DELETE QUESTION
// =========================================================

surveyTemplateRoutes.delete(
  "/:templateId/questions/:questionId",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const templateId =
      context.req.param("templateId");

    const questionId =
      context.req.param("questionId");

    const detail =
      await getSurveyTemplateDetail(
        context.env.DB,
        templateId
      );

    if (!detail) {
      throw new HttpError(
        404,
        "SURVEY_TEMPLATE_NOT_FOUND",
        "Template Survey tidak ditemukan."
      );
    }

    if (
      detail.template.status !== "DRAFT"
    ) {
      throw new HttpError(
        409,
        "SURVEY_TEMPLATE_LOCKED",
        "Hanya template Draft yang dapat diedit."
      );
    }

    const section =
      detail.sections.find((item) =>
        item.questions.some(
          (question) =>
            question.id === questionId
        )
      );

    if (!section) {
      throw new HttpError(
        404,
        "SURVEY_QUESTION_NOT_FOUND",
        "Pertanyaan Survey tidak ditemukan."
      );
    }

    await deleteSurveyQuestion(
      context.env.DB,
      questionId,
      section.id
    );

    return context.json({
      success: true,
    });
  }
);


// =========================================================
// PUBLISH TEMPLATE
// =========================================================

surveyTemplateRoutes.post(
  "/:templateId/publish",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const templateId =
      context.req.param("templateId");

    const detail =
      await getSurveyTemplateDetail(
        context.env.DB,
        templateId
      );

    if (!detail) {
      throw new HttpError(
        404,
        "SURVEY_TEMPLATE_NOT_FOUND",
        "Template Survey tidak ditemukan."
      );
    }

    if (
      detail.template.status !== "DRAFT"
    ) {
      throw new HttpError(
        409,
        "SURVEY_TEMPLATE_NOT_DRAFT",
        "Hanya template Draft yang dapat dipublikasikan."
      );
    }

    if (
      detail.sections.length === 0
    ) {
      throw new HttpError(
        422,
        "SURVEY_TEMPLATE_EMPTY",
        "Template Survey minimal memiliki satu bagian."
      );
    }

    for (
      const section of detail.sections
    ) {
      if (
        section.questions.length === 0
      ) {
        throw new HttpError(
          422,
          "SURVEY_SECTION_EMPTY",
          `Bagian ${section.section_code} belum memiliki pertanyaan.`
        );
      }

      for (
        const question of section.questions
      ) {
        if (
          question.is_required !== 1
        ) {
          throw new HttpError(
            422,
            "SURVEY_QUESTION_NOT_REQUIRED",
            "Semua pertanyaan evaluasi wajib diisi."
          );
        }

        if (
          question.question_type ===
            "SINGLE_CHOICE" &&
          question.options.length < 2
        ) {
          throw new HttpError(
            422,
            "SURVEY_OPTIONS_INCOMPLETE",
            `"${question.question_text}" minimal membutuhkan dua pilihan jawaban.`
          );
        }

        if (
          question.question_type ===
            "SCALE" &&
          (
            question.scale_min === null ||
            question.scale_max === null ||
            question.scale_max <=
              question.scale_min
          )
        ) {
          throw new HttpError(
            422,
            "SURVEY_SCALE_INVALID",
            `Skala pada "${question.question_text}" tidak valid.`
          );
        }
      }
    }

    await publishSurveyTemplate(
      context.env.DB,
      {
        templateId,
        templateName:
          detail.template.name,
      }
    );

    return context.json({
      success: true,
      status: "PUBLISHED",
    });
  }
);


// =========================================================
// DELETE UNUSED DRAFT TEMPLATE
// =========================================================

surveyTemplateRoutes.delete(
  "/:templateId",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const templateId = context.req.param("templateId");
    const template = await context.env.DB.prepare(
      `SELECT templates.id, templates.name, templates.version, templates.status,
              COUNT(campaigns.id) AS campaign_count
       FROM survey_templates templates
       LEFT JOIN survey_campaigns campaigns ON campaigns.survey_template_id = templates.id
       WHERE templates.id = ?
       GROUP BY templates.id
       LIMIT 1`,
    ).bind(templateId).first<{ id: string; name: string; version: number; status: string; campaign_count: number }>();

    if (!template) {
      throw new HttpError(404, "SURVEY_TEMPLATE_NOT_FOUND", "Template Evaluasi tidak ditemukan.");
    }
    if (template.status !== "DRAFT") {
      throw new HttpError(409, "SURVEY_TEMPLATE_DELETE_FORBIDDEN", "Hanya Template Evaluasi berstatus Draft yang boleh dihapus.");
    }
    if (Number(template.campaign_count) > 0) {
      throw new HttpError(409, "SURVEY_TEMPLATE_IN_USE", "Draft ini sudah digunakan pada Pelaksanaan Evaluasi dan tidak dapat dihapus.");
    }

    const deleted = await context.env.DB.prepare(
      `DELETE FROM survey_templates
       WHERE id = ? AND status = 'DRAFT'
         AND NOT EXISTS (SELECT 1 FROM survey_campaigns WHERE survey_template_id = ?)`,
    ).bind(templateId, templateId).run();
    if (!deleted.meta.changes) {
      throw new HttpError(409, "SURVEY_TEMPLATE_DELETE_CONFLICT", "Draft tidak dapat dihapus karena status atau dependency-nya telah berubah.");
    }

    return context.json({ deleted: true, template: { id: template.id, name: template.name, version: template.version } });
  },
);
