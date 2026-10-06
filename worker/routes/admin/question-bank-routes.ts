import { Hono } from "hono";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import {
  requireAdmin,
  requireCsrf,
  requireSameOrigin,
} from "../../middleware/admin-auth";
import {
  createQuestion,
  bulkCreateQuestions,
  bulkCreateQuestionBanks,
  createQuestionBank,
  deleteQuestion,
  deleteQuestionBank,
  findQuestion,
  findQuestionBank,
  getQuestionBankDependencyCounts,
  listQuestionBanks,
  listQuestions,
  questionHasDependencies,
  updateQuestion,
  updateQuestionBank,
  type QuestionRecord,
} from "../../repositories/question-bank-repository";
import type { AppEnvironment } from "../../types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const bankSchema = z.object({
  materialId: z.string().min(1, "Materi wajib dipilih."),
});

const bulkBankSchema = z.object({
  trainingId: z.string().min(1, "Pelatihan wajib dipilih."),
  materialIds: z
    .array(z.string().min(1))
    .min(1, "Pilih minimal satu materi.")
    .max(500),
});

const updateBankSchema = z.object({
  isActive: z.boolean(),
});

const questionSchema = z.object({
  questionText: z.string().trim().min(1, "Pertanyaan wajib diisi.").max(10_000),
  imageKey: z.string().trim().max(500).nullable().optional(),
  optionA: z.string().trim().min(1, "Pilihan A wajib diisi.").max(5_000),
  optionB: z.string().trim().min(1, "Pilihan B wajib diisi.").max(5_000),
  optionC: z.string().trim().min(1, "Pilihan C wajib diisi.").max(5_000),
  optionD: z.string().trim().min(1, "Pilihan D wajib diisi.").max(5_000),
  correctOptionKey: z.enum(["A", "B", "C", "D"]),
});

const updateQuestionSchema = questionSchema.extend({
  isActive: z.boolean(),
});

const importQuestionsSchema = z.object({
  questions: z.array(questionSchema).min(1).max(500),
});

function mapQuestion(question: QuestionRecord) {
  return {
    id: question.id,
    bankId: question.bank_id,
    questionText: question.question_text,
    imageKey: question.image_key,
    optionA: question.option_a,
    optionB: question.option_b,
    optionC: question.option_c,
    optionD: question.option_d,
    correctOptionKey: question.correct_option_key,
    isActive: question.is_active === 1,
    timesAssigned: question.times_assigned,
    createdAt: question.created_at,
    updatedAt: question.updated_at,
  };
}

export const questionBankRoutes = new Hono<AppEnvironment>();
questionBankRoutes.use("*", requireAdmin);

questionBankRoutes.get("/", async (context) => {
  const banks = await listQuestionBanks(context.env.DB);
  context.header("Cache-Control", "no-store");
  return context.json({
    banks: banks.map((bank) => ({
      id: bank.id,
      name: bank.name,
      description: bank.description,
      isActive: bank.is_active === 1,
      activeQuestionCount: bank.active_question_count,
      inactiveQuestionCount: bank.inactive_question_count,
      createdAt: bank.created_at,
      updatedAt: bank.updated_at,
      materialId: bank.material_id,
      materialName: bank.material_name ?? null,
      trainingId: bank.training_id ?? null,
      trainingName: bank.training_name ?? null,
    })),
  });
});

questionBankRoutes.post(
  "/",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const parsed = bankSchema.safeParse(
      await context.req.json().catch(() => null)
    );
    if (!parsed.success) {
      throw new HttpError(
        422,
        "BANK_INVALID",
        parsed.error.issues[0]?.message ?? "Data Bank Soal tidak valid."
      );
    }

    const material = await context.env.DB.prepare(
      `SELECT
      materials.id,
      trainings.name AS training_name
   FROM training_materials materials
   JOIN trainings
     ON trainings.id = materials.training_id
   WHERE materials.id = ?
     AND trainings.is_active = 1`
    )
      .bind(parsed.data.materialId)
      .first<{
        id: string;
        training_name: string;
      }>();
    if (!material)
      throw new HttpError(
        422,
        "MATERIAL_UNAVAILABLE",
        "Materi tidak ditemukan atau pelatihannya tidak aktif."
      );

    const id = crypto.randomUUID();
    try {
      await createQuestionBank(context.env.DB, {
        id,
        name: material.training_name,
        materialId: parsed.data.materialId,
      });
    } catch (error) {
      if (String(error).includes("UNIQUE"))
        throw new HttpError(
          409,
          "MATERIAL_BANK_EXISTS",
          "Materi ini sudah mempunyai Bank Soal aktif."
        );
      throw error;
    }

    return context.json({ bank: { id, ...parsed.data, isActive: true } }, 201);
  }
);

questionBankRoutes.post(
  "/bulk",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const parsed = bulkBankSchema.safeParse(
      await context.req.json().catch(() => null)
    );
    if (!parsed.success) {
      throw new HttpError(
        422,
        "BANK_BULK_INVALID",
        parsed.error.issues[0]?.message ?? "Data Bank Soal tidak valid."
      );
    }

    const materialIds = [...new Set(parsed.data.materialIds)];
    const materialResult = await context.env.DB.prepare(
      `SELECT materials.id, trainings.name AS training_name,
              EXISTS(
                SELECT 1 FROM question_banks
                WHERE question_banks.material_id = materials.id
              ) AS has_bank
         FROM training_materials AS materials
         JOIN trainings ON trainings.id = materials.training_id
         JOIN json_each(?) AS selected ON selected.value = materials.id
        WHERE materials.training_id = ?
          AND trainings.is_active = 1`
    )
      .bind(JSON.stringify(materialIds), parsed.data.trainingId)
      .all<{ id: string; training_name: string; has_bank: number }>();

    if (materialResult.results.length !== materialIds.length) {
      throw new HttpError(
        422,
        "MATERIAL_UNAVAILABLE",
        "Sebagian materi tidak ditemukan, tidak sesuai pelatihan, atau pelatihannya tidak aktif."
      );
    }

    const newBanks = materialResult.results
      .filter((material) => material.has_bank === 0)
      .map((material) => ({
        id: crypto.randomUUID(),
        name: material.training_name,
        materialId: material.id,
      }));
    const createdCount = await bulkCreateQuestionBanks(
      context.env.DB,
      newBanks
    );

    return context.json(
      {
        createdCount,
        skippedCount: materialIds.length - createdCount,
      },
      createdCount > 0 ? 201 : 200
    );
  }
);

questionBankRoutes.get("/image", async (context) => {
  const key = context.req.query("key");
  if (!key || !key.startsWith("question-banks/")) {
    throw new HttpError(
      422,
      "IMAGE_KEY_INVALID",
      "Referensi gambar tidak valid."
    );
  }

  const object = await context.env.QUESTION_IMAGES.get(key);
  if (!object) {
    throw new HttpError(404, "IMAGE_NOT_FOUND", "Gambar tidak ditemukan.");
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=300");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers });
});

questionBankRoutes.get("/:bankId", async (context) => {
  const bankId = context.req.param("bankId");
  const bank = await findQuestionBank(context.env.DB, bankId);
  if (!bank) {
    throw new HttpError(404, "BANK_NOT_FOUND", "Bank Soal tidak ditemukan.");
  }

  const questions = await listQuestions(context.env.DB, bankId);
  context.header("Cache-Control", "no-store");
  return context.json({
    bank: {
      id: bank.id,
      name: bank.name,
      description: bank.description,
      isActive: bank.is_active === 1,
      createdAt: bank.created_at,
      updatedAt: bank.updated_at,
      materialId: bank.material_id,
      materialName: bank.material_name ?? null,
      trainingId: bank.training_id ?? null,
      trainingName: bank.training_name ?? null,
    },
    questions: questions.map(mapQuestion),
  });
});

questionBankRoutes.put(
  "/:bankId",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const bankId = context.req.param("bankId");
    if (!(await findQuestionBank(context.env.DB, bankId))) {
      throw new HttpError(404, "BANK_NOT_FOUND", "Bank Soal tidak ditemukan.");
    }

    const parsed = updateBankSchema.safeParse(
      await context.req.json().catch(() => null)
    );
    if (!parsed.success) {
      throw new HttpError(
        422,
        "BANK_INVALID",
        parsed.error.issues[0]?.message ?? "Data Bank Soal tidak valid."
      );
    }

    try {
      await updateQuestionBank(context.env.DB, {
        id: bankId,
        isActive: parsed.data.isActive,
      });
    } catch (error) {
      if (String(error).includes("UNIQUE"))
        throw new HttpError(
          409,
          "MATERIAL_BANK_EXISTS",
          "Materi ini sudah mempunyai Bank Soal aktif."
        );
      throw error;
    }
    return context.json({ success: true });
  }
);

questionBankRoutes.delete(
  "/:bankId",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const bankId = context.req.param("bankId");
    if (!(await findQuestionBank(context.env.DB, bankId))) {
      throw new HttpError(404, "BANK_NOT_FOUND", "Bank Soal tidak ditemukan.");
    }

    const dependencies = await getQuestionBankDependencyCounts(
      context.env.DB,
      bankId
    );
    if (dependencies.questions > 0 || dependencies.trainingSessions > 0) {
      throw new HttpError(
        409,
        "BANK_HAS_DEPENDENCIES",
        "Bank Soal masih mempunyai soal atau digunakan pelatihan. Nonaktifkan Bank Soal sebagai gantinya."
      );
    }

    await deleteQuestionBank(context.env.DB, bankId);
    return context.json({ success: true });
  }
);

questionBankRoutes.post(
  "/:bankId/images",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const bankId = context.req.param("bankId");
    if (!(await findQuestionBank(context.env.DB, bankId))) {
      throw new HttpError(404, "BANK_NOT_FOUND", "Bank Soal tidak ditemukan.");
    }

    const declaredLength = Number(context.req.header("Content-Length") ?? 0);
    if (declaredLength > MAX_IMAGE_BYTES + 256_000) {
      throw new HttpError(
        413,
        "IMAGE_TOO_LARGE",
        "Ukuran gambar maksimal 5 MB."
      );
    }

    const body = await context.req.parseBody();
    const file = body.image;
    if (!(file instanceof File)) {
      throw new HttpError(
        422,
        "IMAGE_REQUIRED",
        "Pilih berkas gambar terlebih dahulu."
      );
    }

    const extension = ALLOWED_IMAGE_TYPES.get(file.type);
    if (!extension) {
      throw new HttpError(
        422,
        "IMAGE_TYPE_INVALID",
        "Format gambar harus JPG, PNG, atau WebP."
      );
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      throw new HttpError(
        413,
        "IMAGE_TOO_LARGE",
        "Ukuran gambar maksimal 5 MB."
      );
    }

    const key = `question-banks/${bankId}/${crypto.randomUUID()}.${extension}`;
    await context.env.QUESTION_IMAGES.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { bankId },
    });

    return context.json({ imageKey: key }, 201);
  }
);

questionBankRoutes.post(
  "/:bankId/questions",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const bankId = context.req.param("bankId");
    if (!(await findQuestionBank(context.env.DB, bankId))) {
      throw new HttpError(404, "BANK_NOT_FOUND", "Bank Soal tidak ditemukan.");
    }

    const parsed = questionSchema.safeParse(
      await context.req.json().catch(() => null)
    );
    if (!parsed.success) {
      throw new HttpError(
        422,
        "QUESTION_INVALID",
        parsed.error.issues[0]?.message ?? "Data soal tidak valid."
      );
    }

    if (
      parsed.data.imageKey &&
      !parsed.data.imageKey.startsWith(`question-banks/${bankId}/`)
    ) {
      throw new HttpError(
        422,
        "IMAGE_KEY_INVALID",
        "Gambar tidak berasal dari Bank Soal ini."
      );
    }

    const id = crypto.randomUUID();
    await createQuestion(context.env.DB, {
      id,
      bankId,
      questionText: parsed.data.questionText,
      imageKey: parsed.data.imageKey || null,
      optionA: parsed.data.optionA,
      optionB: parsed.data.optionB,
      optionC: parsed.data.optionC,
      optionD: parsed.data.optionD,
      correctOptionKey: parsed.data.correctOptionKey,
    });
    return context.json({ question: { id } }, 201);
  }
);

questionBankRoutes.post(
  "/:bankId/import",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const bankId = context.req.param("bankId");
    if (!(await findQuestionBank(context.env.DB, bankId))) {
      throw new HttpError(404, "BANK_NOT_FOUND", "Bank Soal tidak ditemukan.");
    }

    const parsed = importQuestionsSchema.safeParse(
      await context.req.json().catch(() => null)
    );
    if (!parsed.success) {
      throw new HttpError(
        422,
        "IMPORT_INVALID",
        parsed.error.issues[0]?.message ?? "Data import tidak valid."
      );
    }

    const foreignImage = parsed.data.questions.find(
      (question) =>
        question.imageKey &&
        !question.imageKey.startsWith(`question-banks/${bankId}/`)
    );
    if (foreignImage) {
      throw new HttpError(
        422,
        "IMAGE_KEY_INVALID",
        "Gambar tidak berasal dari Bank Soal ini."
      );
    }

    const questions = parsed.data.questions.map((question) => ({
      id: crypto.randomUUID(),
      questionText: question.questionText,
      imageKey: question.imageKey || null,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctOptionKey: question.correctOptionKey,
    }));

    try {
      await bulkCreateQuestions(context.env.DB, bankId, questions);
    } catch (error) {
      const uploadedKeys = questions
        .map((question) => question.imageKey)
        .filter((key): key is string => key !== null);
      await Promise.all(
        uploadedKeys.map((key) => context.env.QUESTION_IMAGES.delete(key))
      );
      throw error;
    }

    return context.json({ importedCount: questions.length }, 201);
  }
);

questionBankRoutes.put(
  "/:bankId/questions/:questionId",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const bankId = context.req.param("bankId");
    const questionId = context.req.param("questionId");
    if (!(await findQuestion(context.env.DB, bankId, questionId))) {
      throw new HttpError(404, "QUESTION_NOT_FOUND", "Soal tidak ditemukan.");
    }

    const parsed = updateQuestionSchema.safeParse(
      await context.req.json().catch(() => null)
    );
    if (!parsed.success) {
      throw new HttpError(
        422,
        "QUESTION_INVALID",
        parsed.error.issues[0]?.message ?? "Data soal tidak valid."
      );
    }
    if (
      parsed.data.imageKey &&
      !parsed.data.imageKey.startsWith(`question-banks/${bankId}/`)
    ) {
      throw new HttpError(
        422,
        "IMAGE_KEY_INVALID",
        "Gambar tidak berasal dari Bank Soal ini."
      );
    }

    await updateQuestion(context.env.DB, {
      id: questionId,
      bankId,
      questionText: parsed.data.questionText,
      imageKey: parsed.data.imageKey || null,
      optionA: parsed.data.optionA,
      optionB: parsed.data.optionB,
      optionC: parsed.data.optionC,
      optionD: parsed.data.optionD,
      correctOptionKey: parsed.data.correctOptionKey,
      isActive: parsed.data.isActive,
    });
    return context.json({ success: true });
  }
);

questionBankRoutes.delete(
  "/:bankId/questions/:questionId",
  requireSameOrigin,
  requireCsrf,
  async (context) => {
    const bankId = context.req.param("bankId");
    const questionId = context.req.param("questionId");
    const question = await findQuestion(context.env.DB, bankId, questionId);
    if (!question) {
      throw new HttpError(404, "QUESTION_NOT_FOUND", "Soal tidak ditemukan.");
    }
    if (await questionHasDependencies(context.env.DB, questionId)) {
      throw new HttpError(
        409,
        "QUESTION_HAS_DEPENDENCIES",
        "Soal sudah digunakan. Nonaktifkan soal agar riwayat tetap dapat diaudit."
      );
    }

    await deleteQuestion(context.env.DB, bankId, questionId);
    if (question.image_key) {
      await context.env.QUESTION_IMAGES.delete(question.image_key);
    }
    return context.json({ success: true });
  }
);
