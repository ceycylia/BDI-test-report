import { Hono, type Context } from "hono";
import { z } from "zod";
import * as XLSX from "xlsx";
import { zipSync } from "fflate";
import {
  PDFDocument,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import bookmanRegularDataUri from "../../assets/fonts/URWBookman-Light.otf?inline";
import bookmanBoldDataUri from "../../assets/fonts/URWBookman-Demi.otf?inline";
import completionLetterHeaderDataUri from "../../assets/images/completion-letter-header.png?inline";
import {
  requireAdmin,
  requireCsrf,
  requireSameOrigin,
} from "../../middleware/admin-auth";
import { HttpError } from "../../http/errors";
import {
  cleanParticipantName,
  normalizeParticipantName,
} from "../../domain/participants/normalize-name";
import { maskNik, normalizeNik } from "../../domain/participants/normalize-nik";
import { parseImportedNik } from "../../domain/participants/import-validation";
import { createXlsx } from "../../export/xlsx";
import { formatDateForDisplay } from "../../domain/dates/date-format";
import {
  A4_LANDSCAPE,
  certificateLayout,
  mm,
} from "../../domain/certificates/print-layout";
import type { AppEnvironment } from "../../types";
import { paginationMeta, parsePagination } from "../../http/pagination";

export const participantAdminRoutes = new Hono<AppEnvironment>();
participantAdminRoutes.use("*", requireAdmin);

const trainingInput = z.object({
  name: z.string().trim().min(3).max(200),
  isActive: z.boolean().default(true),
});
const materialInput = z.object({
  trainingId: z.string().min(1),
  unitCode: z.string().trim().max(100).nullable().optional(),
  name: z.string().trim().min(2).max(200),
  jp: z.number().int().positive().max(999),
  sortOrder: z.number().int().positive().max(999),
});
const materialImportInput = z.object({
  trainingId: z.string().min(1),
  rows: z
    .array(
      z.object({
        row: z.number().int().positive(),
        unitCode: z.string().trim().max(100).optional(),
        name: z.string(),
        jp: z.number(),
        sortOrder: z.number(),
        errors: z.array(z.string()),
      })
    )
    .min(1)
    .max(1_000),
});
const cohortInput = z
  .object({
    activeYear: z.number().int().min(2000).max(2200).optional(),
    trainingId: z.string().min(1),
    name: z.string().trim().min(1).max(100),
    startDate: z.string().date(),
    endDate: z.string().date(),
    status: z.enum(["ACTIVE", "INACTIVE", "COMPLETED"]),
  })
  .refine(
    (v) => v.endDate >= v.startDate,
    "Tanggal selesai harus setelah tanggal mulai."
  );
const bulkCohortInput = z.object({
  activeYear: z.number().int().min(2000).max(2200).optional(),
  trainingId: z.string().min(1),
  cohorts: z
    .array(
      z
        .object({
          name: z.string().trim().min(1).max(100),
          startDate: z.string().date(),
          endDate: z.string().date(),
          status: z.enum(["ACTIVE", "INACTIVE", "COMPLETED"]),
        })
        .refine(
          (value) => value.endDate >= value.startDate,
          "Tanggal selesai harus setelah tanggal mulai."
        )
    )
    .min(1)
    .max(100),
});
const participantInput = z.object({
  trainingId: z.string().min(1),
  cohortId: z.string().min(1),
  name: z.string().trim().min(2).max(150),
  nik: z.string().trim().min(3).max(40),
  birthPlace: z.string().trim().min(2).max(120),
  birthDate: z.string().date(),
  address: z.string().trim().min(1).max(500),
  isActive: z.boolean().default(true),
});
const allowedParticipantImages = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);

type ParticipantListFilters = {
  year?: string;
  trainingId?: string;
  cohortId?: string;
  status?: "true" | "false";
  search?: string;
};

function participantListWhere(filters: ParticipantListFilters) {
  const conditions: string[] = [];
  const bindings: Array<string | number> = [];

  if (filters.year && /^\d{4}$/u.test(filters.year)) {
    conditions.push("SUBSTR(cohorts.start_date,1,4)=?");
    bindings.push(filters.year);
  }
  if (filters.trainingId) {
    conditions.push("profiles.training_id=?");
    bindings.push(filters.trainingId);
  }
  if (filters.cohortId) {
    conditions.push("profiles.cohort_id=?");
    bindings.push(filters.cohortId);
  }
  if (filters.status === "true" || filters.status === "false") {
    conditions.push("profiles.is_active=?");
    bindings.push(filters.status === "true" ? 1 : 0);
  }
  if (filters.search?.trim()) {
    conditions.push("profiles.normalized_name LIKE ?");
    bindings.push(`%${normalizeParticipantName(filters.search)}%`);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    bindings,
  };
}

function validationError(parsed: { success: false; error: z.ZodError }) {
  return new HttpError(
    422,
    "DATA_INVALID",
    parsed.error.issues[0]?.message ?? "Data tidak valid."
  );
}

async function requireMatchingCohort(
  database: D1Database,
  trainingId: string,
  cohortId: string
) {
  const cohort = await database
    .prepare(`SELECT id FROM training_cohorts WHERE id = ? AND training_id = ?`)
    .bind(cohortId, trainingId)
    .first();
  if (!cohort)
    throw new HttpError(
      422,
      "COHORT_INVALID",
      "Angkatan tidak sesuai pelatihan."
    );
}

participantAdminRoutes.get("/catalog", async (c) => {
  const requestedYear = c.req.query("year");
  const year = requestedYear && /^\d{4}$/u.test(requestedYear) ? requestedYear : null;
  const cohortQuery = `SELECT cohorts.*, trainings.name training_name, (SELECT COUNT(*) FROM participant_profiles WHERE cohort_id=cohorts.id) participant_count FROM training_cohorts cohorts JOIN trainings ON trainings.id=cohorts.training_id WHERE trainings.is_deleted=0${year ? " AND SUBSTR(cohorts.start_date,1,4)=?" : ""} ORDER BY cohorts.created_at DESC, cohorts.rowid DESC`;
  const cohortStatement = c.env.DB.prepare(cohortQuery);
  const [trainings, materials, cohorts] = await Promise.all([
    c.env.DB.prepare(
      `SELECT trainings.*, (SELECT COUNT(*) FROM training_materials WHERE training_id=trainings.id) material_count, (SELECT COALESCE(SUM(jp),0) FROM training_materials WHERE training_id=trainings.id) total_jp FROM trainings WHERE trainings.is_deleted=0 ORDER BY trainings.created_at DESC, trainings.rowid DESC`
    ).all(),
    c.env.DB.prepare(
      `SELECT materials.*, trainings.name training_name,
              (SELECT banks.id FROM question_banks banks WHERE banks.material_id=materials.id ORDER BY banks.is_active DESC, banks.created_at DESC LIMIT 1) bank_id,
              (SELECT banks.name FROM question_banks banks WHERE banks.material_id=materials.id ORDER BY banks.is_active DESC, banks.created_at DESC LIMIT 1) bank_name
         FROM training_materials materials
         JOIN trainings ON trainings.id=materials.training_id
        WHERE trainings.is_deleted=0
        ORDER BY trainings.created_at DESC, materials.sort_order ASC`
    ).all(),
    (year ? cohortStatement.bind(year) : cohortStatement).all(),
  ]);
  return c.json({
    trainings: trainings.results,
    materials: materials.results,
    cohorts: cohorts.results,
  });
});
participantAdminRoutes.get("/catalog/trainings", async (c) => {
  const pagination = parsePagination({ page: c.req.query("page"), limit: c.req.query("limit"), pageSize: c.req.query("pageSize") });
  const clauses = ["trainings.is_deleted = 0"];
  const bindings: unknown[] = [];
  const search = c.req.query("search")?.trim();
  const status = c.req.query("status");
  if (search) { clauses.push("trainings.name LIKE ? ESCAPE '\\'"); bindings.push(`%${search.replace(/[\\%_]/gu, "\\$&")}%`); }
  if (status === "true" || status === "false") { clauses.push("trainings.is_active = ?"); bindings.push(status === "true" ? 1 : 0); }
  const where = `WHERE ${clauses.join(" AND ")}`;
  const [count, rows] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS total FROM trainings ${where}`).bind(...bindings).first<{ total: number }>(),
    c.env.DB.prepare(
      `SELECT trainings.*, (SELECT COUNT(*) FROM training_materials WHERE training_id=trainings.id) material_count,
              (SELECT COALESCE(SUM(jp),0) FROM training_materials WHERE training_id=trainings.id) total_jp
       FROM trainings ${where}
       ORDER BY trainings.created_at DESC, trainings.rowid DESC LIMIT ? OFFSET ?`,
    ).bind(...bindings, pagination.limit, pagination.offset).all(),
  ]);
  const total = Number(count?.total ?? 0);
  return c.json({ trainings: rows.results, pagination: paginationMeta(pagination, total) });
});

participantAdminRoutes.get("/catalog/materials", async (c) => {
  const pagination = parsePagination({ page: c.req.query("page"), limit: c.req.query("limit"), pageSize: c.req.query("pageSize") });
  const clauses = ["trainings.is_deleted = 0"];
  const bindings: unknown[] = [];
  const trainingSearch = c.req.query("trainingSearch")?.trim();
  if (trainingSearch) { clauses.push("trainings.name LIKE ? ESCAPE '\\'"); bindings.push(`%${trainingSearch.replace(/[\\%_]/gu, "\\$&")}%`); }
  const where = `WHERE ${clauses.join(" AND ")}`;
  const base = `FROM training_materials materials JOIN trainings ON trainings.id=materials.training_id ${where}`;
  const [count, rows] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS total ${base}`).bind(...bindings).first<{ total: number }>(),
    c.env.DB.prepare(
      `SELECT materials.*, trainings.name training_name,
              (SELECT banks.id FROM question_banks banks WHERE banks.material_id=materials.id ORDER BY banks.is_active DESC, banks.created_at DESC LIMIT 1) bank_id,
              (SELECT banks.name FROM question_banks banks WHERE banks.material_id=materials.id ORDER BY banks.is_active DESC, banks.created_at DESC LIMIT 1) bank_name
       ${base}
       ORDER BY trainings.created_at DESC, materials.sort_order ASC, materials.rowid ASC LIMIT ? OFFSET ?`,
    ).bind(...bindings, pagination.limit, pagination.offset).all(),
  ]);
  const total = Number(count?.total ?? 0);
  return c.json({ materials: rows.results, pagination: paginationMeta(pagination, total) });
});

participantAdminRoutes.get("/catalog/cohorts", async (c) => {
  const pagination = parsePagination({ page: c.req.query("page"), limit: c.req.query("limit"), pageSize: c.req.query("pageSize") });
  const year = c.req.query("year") && /^\d{4}$/u.test(c.req.query("year")!) ? c.req.query("year")! : null;
  const bindings: unknown[] = [];
  const where = year ? "WHERE trainings.is_deleted=0 AND SUBSTR(cohorts.start_date,1,4)=?" : "WHERE trainings.is_deleted=0";
  if (year) bindings.push(year);
  const base = `FROM training_cohorts cohorts JOIN trainings ON trainings.id=cohorts.training_id ${where}`;
  const [count, rows] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS total ${base}`).bind(...bindings).first<{ total: number }>(),
    c.env.DB.prepare(
      `SELECT cohorts.*, trainings.name training_name,
              (SELECT COUNT(*) FROM participant_profiles WHERE cohort_id=cohorts.id) participant_count
       ${base} ORDER BY cohorts.created_at DESC, cohorts.rowid DESC LIMIT ? OFFSET ?`,
    ).bind(...bindings, pagination.limit, pagination.offset).all(),
  ]);
  const total = Number(count?.total ?? 0);
  return c.json({ cohorts: rows.results, pagination: paginationMeta(pagination, total) });
});

participantAdminRoutes.post(
  "/trainings",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = trainingInput.safeParse(
      await c.req.json().catch(() => null)
    );
    if (!parsed.success) throw validationError(parsed);
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO trainings(id,name,is_active) VALUES(?,?,?)`
    )
      .bind(id, parsed.data.name, parsed.data.isActive ? 1 : 0)
      .run();
    return c.json({ id }, 201);
  }
);
participantAdminRoutes.put(
  "/trainings/:id",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = trainingInput.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!parsed.success) {
      throw validationError(parsed);
    }

    const trainingId = c.req.param("id");

    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE trainings
              SET name = ?,
                  is_active = ?,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`
      ).bind(parsed.data.name, parsed.data.isActive ? 1 : 0, trainingId),

      c.env.DB.prepare(
        `UPDATE question_banks
              SET name = ?,
                  updated_at = CURRENT_TIMESTAMP
            WHERE material_id IN (
              SELECT id
                FROM training_materials
               WHERE training_id = ?
            )`
      ).bind(parsed.data.name, trainingId),
    ]);

    return c.json({ success: true });
  }
);
participantAdminRoutes.delete(
  "/trainings/:id",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const training = await c.env.DB.prepare(
      `SELECT id FROM trainings WHERE id=? AND is_deleted=0`
    )
      .bind(c.req.param("id"))
      .first();
    if (!training)
      throw new HttpError(
        404,
        "TRAINING_NOT_FOUND",
        "Pelatihan tidak ditemukan atau sudah dihapus."
      );
    await c.env.DB.prepare(
      `UPDATE trainings SET is_deleted=1,is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?`
    )
      .bind(c.req.param("id"))
      .run();
    return c.json({ success: true, preservedHistory: true });
  }
);
participantAdminRoutes.post(
  "/materials",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = materialInput.safeParse(
      await c.req.json().catch(() => null)
    );
    if (!parsed.success) throw validationError(parsed);
    const id = crypto.randomUUID();
    const unitCode = parsed.data.unitCode?.trim() || null;
    try {
      await c.env.DB.prepare(
        `INSERT INTO training_materials(id,training_id,unit_code,name,jp,sort_order) VALUES(?,?,?,?,?,?)`
      )
        .bind(
          id,
          parsed.data.trainingId,
          unitCode,
          parsed.data.name,
          parsed.data.jp,
          parsed.data.sortOrder
        )
        .run();
    } catch (e) {
      if (String(e).includes("UNIQUE"))
        throw new HttpError(
          409,
          "MATERIAL_DUPLICATE",
          "Nama atau urutan materi sudah digunakan pada pelatihan ini."
        );
      throw e;
    }
    return c.json({ id }, 201);
  }
);
participantAdminRoutes.put(
  "/materials/:id",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = materialInput.safeParse(
      await c.req.json().catch(() => null)
    );
    if (!parsed.success) throw validationError(parsed);
    const id = c.req.param("id");
    const hasUnitCode = Object.prototype.hasOwnProperty.call(
      parsed.data,
      "unitCode"
    );
    const unitCode = parsed.data.unitCode?.trim() || null;
    const current = await c.env.DB.prepare(
      `SELECT training_id,sort_order,EXISTS(SELECT 1 FROM question_banks WHERE material_id=training_materials.id) has_bank FROM training_materials WHERE id=?`
    )
      .bind(id)
      .first<{ training_id: string; sort_order: number; has_bank: number }>();
    if (!current)
      throw new HttpError(404, "MATERIAL_NOT_FOUND", "Materi tidak ditemukan.");
    if (current.has_bank && current.training_id !== parsed.data.trainingId)
      throw new HttpError(
        409,
        "MATERIAL_IN_USE",
        "Materi yang sudah memiliki Bank Soal tidak dapat dipindah ke pelatihan lain."
      );
    const conflict = await c.env.DB.prepare(
      `SELECT id,sort_order FROM training_materials WHERE training_id=? AND sort_order=? AND id<>?`
    )
      .bind(parsed.data.trainingId, parsed.data.sortOrder, id)
      .first<{ id: string; sort_order: number }>();
    try {
      if (conflict && current.training_id === parsed.data.trainingId) {
        const maximum = await c.env.DB.prepare(
          `SELECT COALESCE(MAX(sort_order),0)+1000 temporary_order FROM training_materials WHERE training_id=?`
        )
          .bind(parsed.data.trainingId)
          .first<{ temporary_order: number }>();
        await c.env.DB.batch([
          c.env.DB.prepare(
            `UPDATE training_materials SET sort_order=? WHERE id=?`
          ).bind(maximum?.temporary_order ?? 1000000, conflict.id),
          c.env.DB.prepare(
            `UPDATE training_materials
                SET name=?,
                    unit_code=CASE WHEN ?=1 THEN ? ELSE unit_code END,
                    jp=?,sort_order=?,updated_at=CURRENT_TIMESTAMP
              WHERE id=?`
          ).bind(
            parsed.data.name,
            hasUnitCode ? 1 : 0,
            unitCode,
            parsed.data.jp,
            parsed.data.sortOrder,
            id
          ),
          c.env.DB.prepare(
            `UPDATE training_materials SET sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
          ).bind(current.sort_order, conflict.id),
        ]);
      } else {
        await c.env.DB.prepare(
          `UPDATE training_materials
              SET training_id=?,name=?,
                  unit_code=CASE WHEN ?=1 THEN ? ELSE unit_code END,
                  jp=?,sort_order=?,updated_at=CURRENT_TIMESTAMP
            WHERE id=?`
        )
          .bind(
            parsed.data.trainingId,
            parsed.data.name,
            hasUnitCode ? 1 : 0,
            unitCode,
            parsed.data.jp,
            parsed.data.sortOrder,
            id
          )
          .run();
      }
    } catch (e) {
      if (String(e).includes("UNIQUE"))
        throw new HttpError(
          409,
          "MATERIAL_DUPLICATE",
          "Nama atau urutan materi sudah digunakan pada pelatihan ini."
        );
      throw e;
    }
    return c.json({ success: true });
  }
);
participantAdminRoutes.delete(
  "/materials/:id",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const deps = await c.env.DB.prepare(
      `SELECT EXISTS(SELECT 1 FROM question_banks WHERE material_id=?) used`
    )
      .bind(c.req.param("id"))
      .first<{ used: number }>();
    if (deps?.used)
      throw new HttpError(
        409,
        "MATERIAL_IN_USE",
        "Materi sudah memiliki Bank Soal dan tidak dapat dihapus."
      );
    await c.env.DB.prepare(`DELETE FROM training_materials WHERE id=?`)
      .bind(c.req.param("id"))
      .run();
    return c.json({ success: true });
  }
);

participantAdminRoutes.post(
  "/materials/import-preview",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const form = await c.req.formData();
    const trainingId = String(form.get("trainingId") ?? "");
    const file = form.get("file");
    const training = await c.env.DB.prepare(
      `SELECT id FROM trainings WHERE id=? AND is_deleted=0`
    )
      .bind(trainingId)
      .first();
    if (!training)
      throw new HttpError(
        422,
        "TRAINING_INVALID",
        "Pilih pelatihan yang valid."
      );
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 8_000_000 ||
      !/[.]xlsx$/iu.test(file.name)
    )
      throw new HttpError(
        422,
        "MATERIAL_FILE_INVALID",
        "File harus berformat .xlsx dan maksimal 8 MB."
      );
    let sheet: XLSX.WorkSheet;
    try {
      const book = XLSX.read(new Uint8Array(await file.arrayBuffer()), {
        type: "array",
      });
      const firstSheet = book.Sheets[book.SheetNames[0] ?? ""];
      if (!firstSheet) throw new Error("sheet");
      sheet = firstSheet;
    } catch {
      throw new HttpError(
        422,
        "MATERIAL_FILE_INVALID",
        "File Excel tidak dapat dibaca."
      );
    }
    const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    const header =
      values[0]?.map((value) =>
        String(value)
          .replace(/^\uFEFF/u, "")
          .replace(/\s+/gu, " ")
          .trim()
          .toLocaleLowerCase("id")
      ) ?? [];
    const hasUnitCodeColumn =
      header[0] === "kode unit" &&
      header[1] === "nama materi" &&
      header[2] === "jumlah jp" &&
      header[3] === "urutan";
    const usesLegacyColumns =
      header[0] === "nama materi" &&
      header[1] === "jumlah jp" &&
      header[2] === "urutan";
    if (!hasUnitCodeColumn && !usesLegacyColumns)
      throw new HttpError(
        422,
        "MATERIAL_TEMPLATE_INVALID",
        "Header template harus: Kode Unit, Nama Materi, Jumlah JP, Urutan."
      );
    const rows = values
      .slice(1)
      .map((value, index) => {
        const unitCode = hasUnitCodeColumn
          ? String(value[0] ?? "").trim()
          : "";
        const name = String(value[hasUnitCodeColumn ? 1 : 0] ?? "").trim();
        const jpCell = String(value[hasUnitCodeColumn ? 2 : 1] ?? "").trim();
        const sortOrderCell = String(
          value[hasUnitCodeColumn ? 3 : 2] ?? ""
        ).trim();
        const jp = jpCell ? Number(jpCell) : Number.NaN;
        const sortOrder = sortOrderCell ? Number(sortOrderCell) : Number.NaN;
        const errors: string[] = [];
        if (unitCode.length > 100)
          errors.push("Kode unit maksimal 100 karakter.");
        if (!name) errors.push("Nama materi wajib diisi.");
        else if (name.length > 200)
          errors.push("Nama materi maksimal 200 karakter.");
        if (!Number.isInteger(jp) || jp < 1 || jp > 999)
          errors.push("Jumlah JP harus bilangan 1–999.");
        if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 999)
          errors.push("Urutan harus bilangan 1–999.");
        return {
          row: index + 2,
          unitCode,
          name,
          jp,
          sortOrder,
          errors,
          hasValue: Boolean(unitCode || name || jpCell || sortOrderCell),
        };
      })
      .filter((row) => row.hasValue)
      .map(({ hasValue, ...row }) => row);
    if (!rows.length)
      throw new HttpError(
        422,
        "MATERIAL_IMPORT_EMPTY",
        "File tidak berisi data materi."
      );
    const names = new Set<string>(),
      orders = new Set<number>();
    for (const row of rows) {
      const normalized = row.name.toLocaleLowerCase("id");
      if (normalized && names.has(normalized))
        row.errors.push("Nama materi duplikat di file.");
      names.add(normalized);
      if (Number.isInteger(row.sortOrder) && orders.has(row.sortOrder))
        row.errors.push("Urutan duplikat di file.");
      orders.add(row.sortOrder);
    }
    return c.json({ rows });
  }
);
participantAdminRoutes.post(
  "/materials/import",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = materialImportInput.safeParse(
      await c.req.json().catch(() => null)
    );
    if (!parsed.success) throw validationError(parsed);
    const data = parsed.data;
    const training = await c.env.DB.prepare(
      `SELECT id FROM trainings WHERE id=? AND is_deleted=0`
    )
      .bind(data.trainingId)
      .first();
    if (!training)
      throw new HttpError(
        422,
        "TRAINING_INVALID",
        "Pilih pelatihan yang valid."
      );
    if (data.rows.some((row) => row.errors.length))
      throw new HttpError(
        422,
        "MATERIAL_IMPORT_INVALID",
        "Perbaiki baris yang belum valid sebelum menyimpan."
      );
    const names = new Set<string>(),
      orders = new Set<number>();
    for (const row of data.rows) {
      const check = materialInput.safeParse({
        trainingId: data.trainingId,
        unitCode: row.unitCode ?? "",
        name: row.name,
        jp: row.jp,
        sortOrder: row.sortOrder,
      });
      if (!check.success) throw validationError(check);
      const normalized = row.name.trim().toLocaleLowerCase("id");
      if (names.has(normalized) || orders.has(row.sortOrder))
        throw new HttpError(
          409,
          "MATERIAL_DUPLICATE",
          "Nama atau urutan materi duplikat di file."
        );
      names.add(normalized);
      orders.add(row.sortOrder);
    }
    try {
      await c.env.DB.batch(
        data.rows.map((row) =>
          c.env.DB.prepare(
            `INSERT INTO training_materials(id,training_id,unit_code,name,jp,sort_order) VALUES(?,?,?,?,?,?)`
          ).bind(
            crypto.randomUUID(),
            data.trainingId,
            row.unitCode?.trim() || null,
            row.name.trim(),
            row.jp,
            row.sortOrder
          )
        )
      );
    } catch (error) {
      if (String(error).includes("UNIQUE"))
        throw new HttpError(
          409,
          "MATERIAL_DUPLICATE",
          "Nama atau urutan materi sudah digunakan pada pelatihan ini."
        );
      throw error;
    }
    return c.json({ imported: data.rows.length }, 201);
  }
);
participantAdminRoutes.post(
  "/cohorts",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = cohortInput.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw validationError(parsed);
    if (parsed.data.activeYear && parsed.data.startDate.slice(0, 4) !== String(parsed.data.activeYear)) {
      throw new HttpError(422, "YEAR_MISMATCH", `Tanggal mulai berada pada tahun ${parsed.data.startDate.slice(0, 4)}, sedangkan Tahun Aktif adalah ${parsed.data.activeYear}.`);
    }
    const id = crypto.randomUUID();
    try {
      await c.env.DB.prepare(
        `INSERT INTO training_cohorts(id,training_id,name,start_date,end_date,status) VALUES(?,?,?,?,?,?)`
      )
        .bind(
          id,
          parsed.data.trainingId,
          parsed.data.name,
          parsed.data.startDate,
          parsed.data.endDate,
          parsed.data.status
        )
        .run();
    } catch (e) {
      if (String(e).includes("UNIQUE"))
        throw new HttpError(
          409,
          "COHORT_DUPLICATE",
          "Nama angkatan sudah digunakan pada pelatihan ini."
        );
      throw e;
    }
    return c.json({ id }, 201);
  }
);
participantAdminRoutes.post(
  "/cohorts/bulk",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = bulkCohortInput.safeParse(
      await c.req.json().catch(() => null)
    );
    if (!parsed.success) throw validationError(parsed);
    const mismatched = parsed.data.activeYear
      ? parsed.data.cohorts.find((cohort) => cohort.startDate.slice(0, 4) !== String(parsed.data.activeYear))
      : undefined;
    if (mismatched) throw new HttpError(422, "YEAR_MISMATCH", `Tanggal mulai ${mismatched.name} berada pada tahun ${mismatched.startDate.slice(0, 4)}, sedangkan Tahun Aktif adalah ${parsed.data.activeYear}.`);
    const normalizedNames = parsed.data.cohorts.map((cohort) =>
      cohort.name.trim().toLocaleLowerCase("id")
    );
    const duplicateInRequest = normalizedNames.find(
      (name, index) => normalizedNames.indexOf(name) !== index
    );
    if (duplicateInRequest) {
      const duplicate =
        parsed.data.cohorts[normalizedNames.indexOf(duplicateInRequest)];
      throw new HttpError(
        409,
        "COHORT_DUPLICATE",
        `Nama angkatan “${
          duplicate?.name ?? duplicateInRequest
        }” muncul lebih dari sekali pada preview.`
      );
    }
    const training = await c.env.DB.prepare(
      `SELECT id FROM trainings WHERE id=? AND is_deleted=0`
    )
      .bind(parsed.data.trainingId)
      .first();
    if (!training)
      throw new HttpError(
        404,
        "TRAINING_NOT_FOUND",
        "Pelatihan tidak ditemukan."
      );
    const existing = await c.env.DB.prepare(
      `SELECT name FROM training_cohorts WHERE training_id=? AND lower(name) IN (SELECT lower(value) FROM json_each(?)) ORDER BY name`
    )
      .bind(
        parsed.data.trainingId,
        JSON.stringify(parsed.data.cohorts.map((cohort) => cohort.name.trim()))
      )
      .all<{ name: string }>();
    if (existing.results.length)
      throw new HttpError(
        409,
        "COHORT_DUPLICATE",
        `Angkatan berikut sudah terdaftar pada pelatihan ini: ${existing.results
          .map((cohort) => cohort.name)
          .join(", ")}.`
      );
    const statements = parsed.data.cohorts.map((cohort) =>
      c.env.DB.prepare(
        `INSERT INTO training_cohorts(id,training_id,name,start_date,end_date,status) VALUES(?,?,?,?,?,?)`
      ).bind(
        crypto.randomUUID(),
        parsed.data.trainingId,
        cohort.name.trim(),
        cohort.startDate,
        cohort.endDate,
        cohort.status
      )
    );
    try {
      await c.env.DB.batch(statements);
    } catch (e) {
      if (String(e).includes("UNIQUE"))
        throw new HttpError(
          409,
          "COHORT_DUPLICATE",
          "Salah satu nama angkatan sudah digunakan pada pelatihan ini."
        );
      throw e;
    }
    return c.json({ created: statements.length }, 201);
  }
);
participantAdminRoutes.put(
  "/cohorts/:id",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = cohortInput.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw validationError(parsed);
    if (parsed.data.activeYear && parsed.data.startDate.slice(0, 4) !== String(parsed.data.activeYear)) {
      throw new HttpError(422, "YEAR_MISMATCH", `Tanggal mulai berada pada tahun ${parsed.data.startDate.slice(0, 4)}, sedangkan Tahun Aktif adalah ${parsed.data.activeYear}.`);
    }
    const id = c.req.param("id");
    const current = await c.env.DB.prepare(
      `SELECT training_id,(EXISTS(SELECT 1 FROM participant_profiles WHERE cohort_id=training_cohorts.id) OR EXISTS(SELECT 1 FROM batches WHERE cohort_id=training_cohorts.id)) AS in_use FROM training_cohorts WHERE id=?`
    )
      .bind(id)
      .first<{ training_id: string; in_use: number }>();
    if (!current)
      throw new HttpError(404, "COHORT_NOT_FOUND", "Angkatan tidak ditemukan.");
    if (current.in_use && current.training_id !== parsed.data.trainingId)
      throw new HttpError(
        409,
        "COHORT_IN_USE",
        "Angkatan yang sudah digunakan tidak dapat dipindah ke pelatihan lain."
      );
    try {
      await c.env.DB.prepare(
        `UPDATE training_cohorts SET training_id=?,name=?,start_date=?,end_date=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
      )
        .bind(
          parsed.data.trainingId,
          parsed.data.name,
          parsed.data.startDate,
          parsed.data.endDate,
          parsed.data.status,
          id
        )
        .run();
    } catch (e) {
      if (String(e).includes("UNIQUE"))
        throw new HttpError(
          409,
          "COHORT_DUPLICATE",
          "Nama angkatan sudah digunakan pada pelatihan ini."
        );
      throw e;
    }
    return c.json({ success: true });
  }
);
participantAdminRoutes.delete(
  "/cohorts/:id",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const id = c.req.param("id");
    const cohort = await c.env.DB.prepare(
      `SELECT id,
        (EXISTS(SELECT 1 FROM participant_profiles WHERE cohort_id=training_cohorts.id)
          OR EXISTS(SELECT 1 FROM batches WHERE cohort_id=training_cohorts.id)
          OR EXISTS(SELECT 1 FROM certificates WHERE cohort_id=training_cohorts.id)) AS in_use
       FROM training_cohorts WHERE id=?`
    )
      .bind(id)
      .first<{ id: string; in_use: number }>();
    if (!cohort)
      throw new HttpError(404, "COHORT_NOT_FOUND", "Angkatan tidak ditemukan.");
    if (cohort.in_use)
      throw new HttpError(
        409,
        "COHORT_IN_USE",
        "Angkatan sudah digunakan oleh peserta atau pelaksanaan tes dan tidak dapat dihapus. Nonaktifkan angkatan jika tidak ingin digunakan lagi."
      );
    await c.env.DB.prepare(`DELETE FROM training_cohorts WHERE id=?`)
      .bind(id)
      .run();
    return c.json({ success: true });
  }
);

participantAdminRoutes.get("/participants", async (c) => {
  const pagination = parsePagination({ page: c.req.query("page"), limit: c.req.query("limit"), pageSize: c.req.query("pageSize") });
  const { where, bindings } = participantListWhere({
    year: c.req.query("year"),
    trainingId: c.req.query("trainingId"),
    cohortId: c.req.query("cohortId"),
    status: c.req.query("status") as ParticipantListFilters["status"],
    search: c.req.query("search"),
  });
  const [count, result] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COUNT(*) AS total
       FROM participant_profiles profiles
       JOIN trainings ON trainings.id=profiles.training_id
       JOIN training_cohorts cohorts ON cohorts.id=profiles.cohort_id
       ${where}`,
    ).bind(...bindings).first<{ total: number }>(),
    c.env.DB.prepare(
      `SELECT profiles.*, trainings.name training_name, cohorts.name cohort_name
       FROM participant_profiles profiles
       JOIN trainings ON trainings.id=profiles.training_id
       JOIN training_cohorts cohorts ON cohorts.id=profiles.cohort_id
       ${where}
       ORDER BY profiles.created_at DESC, profiles.rowid DESC
       LIMIT ? OFFSET ?`,
    ).bind(...bindings, pagination.limit, pagination.offset).all<Record<string, unknown>>(),
  ]);
  const total = Number(count?.total ?? 0);
  return c.json({
    participants: result.results.map((r) => ({
      ...r,
      nik_masked: maskNik(String(r.nik)),
      nik: undefined,
    })),
    pagination: paginationMeta(pagination, total),
  });
});
participantAdminRoutes.delete(
  "/participants/bulk",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = z
      .union([
        z.object({ participantIds: z.array(z.string().uuid()).min(1).max(5000) }),
        z.object({
          filters: z.object({
            year: z.number().int().min(2000).max(2200),
            trainingId: z.string().min(1).optional(),
            cohortId: z.string().min(1).optional(),
            status: z.boolean().optional(),
            search: z.string().trim().max(150).optional(),
          }),
        }),
      ])
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw validationError(parsed);
    let profiles: D1Result<{ id: string; photo_key: string | null }>;
    if ("participantIds" in parsed.data) {
      const participantIds = [...new Set(parsed.data.participantIds)];
      const idsJson = JSON.stringify(participantIds);
      profiles = await c.env.DB.prepare(
        `SELECT id,photo_key FROM participant_profiles WHERE id IN (SELECT value FROM json_each(?))`,
      ).bind(idsJson).all<{ id: string; photo_key: string | null }>();
    } else {
      const filters = parsed.data.filters;
      const { where, bindings } = participantListWhere({
        year: String(filters.year),
        trainingId: filters.trainingId,
        cohortId: filters.cohortId,
        status: filters.status === undefined ? undefined : String(filters.status) as "true" | "false",
        search: filters.search,
      });
      profiles = await c.env.DB.prepare(
        `SELECT profiles.id, profiles.photo_key
         FROM participant_profiles profiles
         JOIN trainings ON trainings.id=profiles.training_id
         JOIN training_cohorts cohorts ON cohorts.id=profiles.cohort_id
         ${where}
         ORDER BY profiles.created_at DESC, profiles.rowid DESC
         LIMIT 5001`,
      ).bind(...bindings).all<{ id: string; photo_key: string | null }>();
      if (profiles.results.length > 5000) {
        throw new HttpError(422, "TOO_MANY_PARTICIPANTS", "Hasil filter melebihi 5.000 peserta. Persempit filter sebelum menghapus data.");
      }
    }
    if (!profiles.results.length)
      throw new HttpError(
        404,
        "PARTICIPANT_NOT_FOUND",
        "Tidak ada peserta yang cocok untuk dihapus."
      );
    const existingIdsJson = JSON.stringify(
      profiles.results.map((profile) => profile.id)
    );
    const certificates = await c.env.DB.prepare(
      `SELECT pdf_key FROM certificates WHERE participant_profile_id IN (SELECT value FROM json_each(?)) AND pdf_key IS NOT NULL`
    )
      .bind(existingIdsJson)
      .all<{ pdf_key: string }>();
    await c.env.DB.batch([
      c.env.DB.prepare(
        `DELETE FROM certificates WHERE participant_profile_id IN (SELECT value FROM json_each(?))`
      ).bind(existingIdsJson),
      c.env.DB.prepare(
        `DELETE FROM completion_letters WHERE participant_profile_id IN (SELECT value FROM json_each(?))`
      ).bind(existingIdsJson),
      c.env.DB.prepare(
        `DELETE FROM participants WHERE profile_id IN (SELECT value FROM json_each(?))`
      ).bind(existingIdsJson),
      c.env.DB.prepare(
        `DELETE FROM participant_profiles WHERE id IN (SELECT value FROM json_each(?))`
      ).bind(existingIdsJson),
    ]);
    const objectKeys = [
      ...profiles.results.map((profile) => profile.photo_key),
      ...certificates.results.map((certificate) => certificate.pdf_key),
    ].filter((key): key is string => Boolean(key));
    await Promise.all(
      objectKeys.map((key) => c.env.QUESTION_IMAGES.delete(key))
    );
    return c.json({ deleted: profiles.results.length });
  }
);
participantAdminRoutes.get("/participants/:id", async (c) => {
  const year = c.req.query("year") && /^\d{4}$/u.test(c.req.query("year")!) ? c.req.query("year")! : null;
  const row = await c.env.DB.prepare(
    `SELECT profiles.*,trainings.name training_name,cohorts.name cohort_name FROM participant_profiles profiles JOIN trainings ON trainings.id=profiles.training_id JOIN training_cohorts cohorts ON cohorts.id=profiles.cohort_id WHERE profiles.id=?${year ? " AND SUBSTR(cohorts.start_date,1,4)=?" : ""}`
  )
    .bind(...(year ? [c.req.param("id"), year] : [c.req.param("id")]))
    .first();
  if (!row)
    throw new HttpError(
      404,
      "PARTICIPANT_NOT_FOUND",
      "Peserta tidak ditemukan."
    );
  return c.json({ participant: row });
});
participantAdminRoutes.post(
  "/participants",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = participantInput.safeParse(
      await c.req.json().catch(() => null)
    );
    if (!parsed.success) throw validationError(parsed);
    const d = parsed.data;
    await requireMatchingCohort(c.env.DB, d.trainingId, d.cohortId);
    const id = crypto.randomUUID();
    try {
      await c.env.DB.prepare(
        `INSERT INTO participant_profiles(id,training_id,cohort_id,name,normalized_name,nik,birth_place,birth_date,address,is_active) VALUES(?,?,?,?,?,?,?,?,?,?)`
      )
        .bind(
          id,
          d.trainingId,
          d.cohortId,
          cleanParticipantName(d.name),
          normalizeParticipantName(d.name),
          normalizeNik(d.nik),
          d.birthPlace,
          d.birthDate,
          d.address,
          d.isActive ? 1 : 0
        )
        .run();
    } catch (e) {
      if (String(e).includes("UNIQUE"))
        throw new HttpError(
          409,
          "PARTICIPANT_DUPLICATE",
          "NIK sudah terdaftar pada angkatan ini."
        );
      throw e;
    }
    return c.json({ id }, 201);
  }
);
participantAdminRoutes.put(
  "/participants/:id",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = participantInput.safeParse(
      await c.req.json().catch(() => null)
    );
    if (!parsed.success) throw validationError(parsed);
    const d = parsed.data;
    await requireMatchingCohort(c.env.DB, d.trainingId, d.cohortId);
    const profileId = c.req.param("id");
    const existing = await c.env.DB.prepare(
      `SELECT training_id,cohort_id,EXISTS(SELECT 1 FROM participants WHERE profile_id=participant_profiles.id) has_exam FROM participant_profiles WHERE id=?`
    )
      .bind(profileId)
      .first<{ training_id: string; cohort_id: string; has_exam: number }>();
    if (!existing)
      throw new HttpError(
        404,
        "PARTICIPANT_NOT_FOUND",
        "Peserta tidak ditemukan."
      );
    if (
      existing.has_exam &&
      (existing.training_id !== d.trainingId ||
        existing.cohort_id !== d.cohortId)
    )
      throw new HttpError(
        409,
        "PARTICIPANT_HAS_ATTEMPTS",
        "Pelatihan atau angkatan tidak dapat dipindah setelah peserta mulai ujian."
      );
    const cleanName = cleanParticipantName(d.name);
    const normalizedName = normalizeParticipantName(d.name);
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(
          `UPDATE participant_profiles SET training_id=?,cohort_id=?,name=?,normalized_name=?,nik=?,birth_place=?,birth_date=?,address=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
        ).bind(
          d.trainingId,
          d.cohortId,
          cleanName,
          normalizedName,
          normalizeNik(d.nik),
          d.birthPlace,
          d.birthDate,
          d.address,
          d.isActive ? 1 : 0,
          profileId
        ),
        c.env.DB.prepare(
          `UPDATE participants SET name=?,normalized_name=?,updated_at=CURRENT_TIMESTAMP WHERE profile_id=?`
        ).bind(cleanName, normalizedName, profileId),
      ]);
    } catch (e) {
      if (String(e).includes("UNIQUE"))
        throw new HttpError(
          409,
          "PARTICIPANT_DUPLICATE",
          "NIK sudah terdaftar pada angkatan ini."
        );
      throw e;
    }
    return c.json({ success: true });
  }
);
participantAdminRoutes.post(
  "/participants/:id/photo",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const form = await c.req.formData();
    const file = form.get("photo");
    const ext =
      file instanceof File
        ? allowedParticipantImages.get(file.type)
        : undefined;
    if (!(file instanceof File) || !ext || file.size > 5_000_000)
      throw new HttpError(
        422,
        "PHOTO_INVALID",
        "Foto harus berupa JPG atau PNG maksimal 5 MB."
      );
    const old = await c.env.DB.prepare(
      `SELECT photo_key FROM participant_profiles WHERE id=?`
    )
      .bind(c.req.param("id"))
      .first<{ photo_key: string | null }>();
    if (!old)
      throw new HttpError(
        404,
        "PARTICIPANT_NOT_FOUND",
        "Peserta tidak ditemukan."
      );
    const key = `participants/${c.req.param(
      "id"
    )}/${crypto.randomUUID()}.${ext}`;
    await c.env.QUESTION_IMAGES.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });
    await c.env.DB.prepare(
      `UPDATE participant_profiles SET photo_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
    )
      .bind(key, c.req.param("id"))
      .run();
    if (old.photo_key) await c.env.QUESTION_IMAGES.delete(old.photo_key);
    return c.json({ success: true });
  }
);
participantAdminRoutes.get("/participants/:id/photo", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT photo_key FROM participant_profiles WHERE id=?`
  )
    .bind(c.req.param("id"))
    .first<{ photo_key: string | null }>();
  if (!row?.photo_key)
    throw new HttpError(404, "PHOTO_NOT_FOUND", "Foto tidak ditemukan.");
  const object = await c.env.QUESTION_IMAGES.get(row.photo_key);
  if (!object)
    throw new HttpError(404, "PHOTO_NOT_FOUND", "Foto tidak ditemukan.");
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
});

participantAdminRoutes.get("/participants-template", async () => {
  const bytes = createXlsx([
    {
      name: "Data Peserta",
      rows: [
        ["No", "Nama Lengkap", "NIK", "Tempat Lahir", "Tanggal Lahir", "Alamat"],
        [1, "Ade Febriyanti", "1271054102860002", "Medan", "1986-02-01", "Jl. Industri No. 1, Medan"],
        [2, "Budi Santoso", "1271051206880001", "Medan", "1988-06-12", "Jl. Pembangunan No. 2, Medan"],
        [3, "Citra Lestari", "1271055501950003", "Binjai", "1995-01-15", "Jl. Merdeka No. 3, Binjai"],
        [4, "Dedi Irawan", "1271051205800004", "Deli Serdang", "1980-05-12", "Jl. Besar No. 4, Deli Serdang"],
        [5, "Eka Putri", "1271054001970005", "Medan", "1997-01-01", "Jl. Karya No. 5, Medan"],
      ],
      textColumns: [2],
      dateColumns: [4],
      columnWidths: [8, 28, 22, 22, 18, 45],
    },
    {
      name: "Petunjuk",
      rows: [
        ["Petunjuk Import Peserta", "Keterangan"],
        ["Nama Lengkap", "Wajib. Isi sesuai identitas peserta."],
        [
          "NIK",
          "Wajib. Tepat 16 digit angka dan disimpan sebagai Teks. Tidak perlu menambahkan tanda apostrof.",
        ],
        ["Tempat Lahir", "Wajib."],
        ["Tanggal Lahir", "Wajib. Gunakan format DD/MM/YYYY."],
        ["Alamat", "Wajib. Isi alamat peserta sesuai data resmi."],
        [
          "Pelatihan & Angkatan",
          "Tidak perlu ditulis di Excel. Pilih di aplikasi sebelum preview.",
        ],
        [
          "Foto",
          "Tidak dimasukkan ke Excel. Unggah foto terpisah setelah peserta berhasil diimport.",
        ],
      ],
      columnWidths: [28, 92],
      autoFilter: false,
    },
  ]);
  return new Response(bytes.slice().buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="Template-Import-Peserta-BDI.xlsx"',
      "Cache-Control": "no-store",
    },
  });
});

function validCalendarDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
function formatCalendarDate(year: number, month: number, day: number) {
  return validCalendarDate(year, month, day)
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
      )}`
    : "";
}
function excelDate(value: unknown) {
  if (value instanceof Date)
    return formatCalendarDate(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate()
    );
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    return date ? formatCalendarDate(date.y, date.m, date.d) : "";
  }
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})[-/]([01]?\d)[-/]([0-3]?\d)$/);
  if (iso)
    return formatCalendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const local = text.match(/^([0-3]?\d)[-/]([01]?\d)[-/](\d{4})$/);
  return local
    ? formatCalendarDate(Number(local[3]), Number(local[2]), Number(local[1]))
    : "";
}

participantAdminRoutes.post(
  "/participants/import-preview",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const form = await c.req.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size > 8_000_000 ||
      !/\.(xlsx|xls)$/iu.test(file.name)
    )
      throw new HttpError(
        422,
        "FILE_INVALID",
        "Pilih file Excel .xlsx atau .xls maksimal 8 MB."
      );
    const trainingId = String(form.get("trainingId") ?? "");
    const cohortId = String(form.get("cohortId") ?? "");
    await requireMatchingCohort(c.env.DB, trainingId, cohortId);
    const existingRows = (
      await c.env.DB.prepare(
        `SELECT nik FROM participant_profiles WHERE cohort_id=?`
      )
        .bind(cohortId)
        .all<{ nik: string }>()
    ).results;
    const existing = new Set(existingRows.map((row) => normalizeNik(row.nik)));
    const fileNiks = new Set<string>();
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: false,
      });
    } catch {
      throw new HttpError(
        422,
        "FILE_INVALID",
        "File Excel tidak dapat dibaca."
      );
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]!];
    if (!sheet)
      throw new HttpError(
        422,
        "FILE_INVALID",
        "Sheet data peserta tidak ditemukan."
      );
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: true,
    });
    const rows = raw.map((record, index) => {
      const name = String(record["Nama Lengkap"] ?? "").trim();
      const parsedNik = parseImportedNik(record.NIK);
      const nik = parsedNik.nik;
      const birthPlace = String(record["Tempat Lahir"] ?? "").trim();
      const birthDate = excelDate(record["Tanggal Lahir"]);
      const address = String(record.Alamat ?? "").trim();
      const errors: string[] = [];
      if (!name) errors.push("Nama kosong");
      if (!nik) errors.push("NIK wajib");
      else if (parsedNik.error) errors.push(parsedNik.error);
      else if (!/^\d{16}$/u.test(nik)) errors.push("NIK harus 16 digit angka");
      if (!birthPlace) errors.push("Tempat lahir kosong");
      if (!birthDate) errors.push("Tanggal lahir tidak valid");
      if (!address) errors.push("Alamat kosong");
      if (nik && existing.has(nik)) errors.push("Peserta sudah terdaftar");
      else if (nik && fileNiks.has(nik)) errors.push("NIK duplikat dalam file");
      if (nik) fileNiks.add(nik);
      return { row: index + 2, name, nik, birthPlace, birthDate, address, errors };
    });
    return c.json({ rows });
  }
);

participantAdminRoutes.post(
  "/participants/import",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = z
      .object({
        trainingId: z.string().min(1),
        cohortId: z.string().min(1),
        rows: z
          .array(
            z.object({
              name: z.string().trim().min(1),
              nik: z.string().regex(/^\d{16}$/u, "NIK harus 16 digit angka"),
              birthPlace: z.string().trim().min(1),
              birthDate: z.string().date(),
              address: z.string().trim().min(1).max(500),
            })
          )
          .min(1)
          .max(1000),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw validationError(parsed);
    const data = parsed.data;
    await requireMatchingCohort(c.env.DB, data.trainingId, data.cohortId);
    const existing = await c.env.DB.prepare(
      `SELECT nik FROM participant_profiles WHERE cohort_id=?`
    )
      .bind(data.cohortId)
      .all<{ nik: string }>();
    const seen = new Set(existing.results.map((row) => normalizeNik(row.nik)));
    const statements: D1PreparedStatement[] = [];
    for (const row of data.rows) {
      const nik = normalizeNik(row.nik);
      if (seen.has(nik))
        throw new HttpError(
          409,
          "PARTICIPANT_DUPLICATE",
          `NIK ${maskNik(nik)} sudah terdaftar atau duplikat di dalam file.`
        );
      seen.add(nik);
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO participant_profiles(id,training_id,cohort_id,name,normalized_name,nik,birth_place,birth_date,address) VALUES(?,?,?,?,?,?,?,?,?)`
        ).bind(
          crypto.randomUUID(),
          data.trainingId,
          data.cohortId,
          cleanParticipantName(row.name),
          normalizeParticipantName(row.name),
          nik,
          row.birthPlace,
          row.birthDate,
          row.address
        )
      );
    }
    await c.env.DB.batch(statements);
    return c.json({ imported: statements.length });
  }
);

participantAdminRoutes.get("/certificates", async (c) => {
  const year = c.req.query("year") && /^\d{4}$/u.test(c.req.query("year")!) ? c.req.query("year")! : null;
  const pagination = parsePagination({ page: c.req.query("page"), limit: c.req.query("limit"), pageSize: c.req.query("pageSize") });
  const conditions: string[] = [];
  const bindings: unknown[] = [];
  if (year) { conditions.push("training_year = ?"); bindings.push(year); }
  if (c.req.query("trainingId")) { conditions.push("training_id = ?"); bindings.push(c.req.query("trainingId")!); }
  if (c.req.query("cohortId")) { conditions.push("cohort_id = ?"); bindings.push(c.req.query("cohortId")!); }
  const status = c.req.query("status");
  if (status === "LULUS" || status === "BELUM_LULUS") { conditions.push("graduation_status = ?"); bindings.push(status); }
  if (status === "READY") conditions.push("graduation_status = 'LULUS' AND certificate_id IS NULL");
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const cte = `WITH scores AS (
    SELECT p.profile_id,MAX(CASE WHEN a.stage<>'PRE' AND a.status='SUBMITTED' THEN a.score END) final_score,MAX(s.passing_score) passing_score
    FROM participants p JOIN attempts a ON a.participant_id=p.id JOIN training_sessions s ON s.id=a.training_session_id
    WHERE p.profile_id IS NOT NULL GROUP BY p.profile_id
  ), certificate_rows AS (
    SELECT profiles.id participant_id,profiles.name,profiles.nik,profiles.training_id,profiles.cohort_id,
      trainings.name training_name,cohorts.name cohort_name,SUBSTR(cohorts.start_date,1,4) training_year,
      scores.final_score,scores.passing_score,CASE WHEN scores.final_score>=scores.passing_score THEN 'LULUS' ELSE 'BELUM_LULUS' END graduation_status,
      certificates.id certificate_id,certificates.certificate_number,certificates.status certificate_status,
      completion_letters.id completion_letter_id,completion_letters.completion_letter_number,
      profiles.created_at,profiles.rowid source_rowid
    FROM participant_profiles profiles JOIN trainings ON trainings.id=profiles.training_id JOIN training_cohorts cohorts ON cohorts.id=profiles.cohort_id
    LEFT JOIN scores ON scores.profile_id=profiles.id LEFT JOIN certificates ON certificates.participant_profile_id=profiles.id
    LEFT JOIN completion_letters ON completion_letters.participant_profile_id=profiles.id
  )`;
  const [count, rows] = await Promise.all([
    c.env.DB.prepare(`${cte} SELECT COUNT(*) AS total FROM certificate_rows ${where}`).bind(...bindings).first<{ total: number }>(),
    c.env.DB.prepare(`${cte} SELECT * FROM certificate_rows ${where} ORDER BY created_at DESC, source_rowid DESC LIMIT ? OFFSET ?`).bind(...bindings, pagination.limit, pagination.offset).all<Record<string, unknown>>(),
  ]);
  const total = Number(count?.total ?? 0);
  return c.json({
    certificates: rows.results.map((r) => ({
      ...r,
      nik_masked: maskNik(String(r.nik)),
      nik: undefined,
    })),
    pagination: paginationMeta(pagination, total),
  });
});
participantAdminRoutes.get("/certificates/numbering-targets", async (c) => {
  const conditions = ["profiles.is_active=1"];
  const bindings: unknown[] = [];
  const year = c.req.query("year");
  if (year && /^\d{4}$/u.test(year)) { conditions.push("SUBSTR(cohorts.start_date,1,4)=?"); bindings.push(year); }
  if (c.req.query("trainingId")) { conditions.push("profiles.training_id=?"); bindings.push(c.req.query("trainingId")!); }
  if (c.req.query("cohortId")) { conditions.push("profiles.cohort_id=?"); bindings.push(c.req.query("cohortId")!); }
  const rows = await c.env.DB.prepare(
    `WITH scores AS (
       SELECT p.profile_id,MAX(CASE WHEN a.stage<>'PRE' AND a.status='SUBMITTED' THEN a.score END) final_score,MAX(s.passing_score) passing_score
       FROM participants p JOIN attempts a ON a.participant_id=p.id JOIN training_sessions s ON s.id=a.training_session_id
       WHERE p.profile_id IS NOT NULL GROUP BY p.profile_id
     )
     SELECT profiles.id participant_id,profiles.name,profiles.training_id,profiles.cohort_id,
            certificates.certificate_number,completion_letters.completion_letter_number
     FROM participant_profiles profiles JOIN training_cohorts cohorts ON cohorts.id=profiles.cohort_id
     JOIN scores ON scores.profile_id=profiles.id AND scores.final_score>=scores.passing_score
     LEFT JOIN certificates ON certificates.participant_profile_id=profiles.id
     LEFT JOIN completion_letters ON completion_letters.participant_profile_id=profiles.id
     WHERE ${conditions.join(" AND ")}
     ORDER BY profiles.created_at DESC, profiles.rowid DESC`,
  ).bind(...bindings).all<{
    participant_id: string; name: string; training_id: string; cohort_id: string;
    certificate_number: string | null; completion_letter_number: string | null;
  }>();
  return c.json({ certificates: rows.results.map((row) => ({ ...row, graduation_status: "LULUS" })) });
});
participantAdminRoutes.get("/certificate-settings", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT certificate_prefix,signer_name,signer_title,signer_nip,issue_place,issue_date,signature_key,stamp_key,front_template_key,back_template_key FROM global_certificate_settings WHERE id=1`
  )
    .first();
  return c.json({
    settings: row ?? {
      certificate_prefix: "",
      signer_name: "",
      signer_title: "",
      signer_nip: "",
      issue_place: "",
      issue_date: "",
    },
  });
});
participantAdminRoutes.put(
  "/certificate-settings",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = z
      .object({
        signerName: z.string().max(150),
        signerTitle: z.string().max(150),
        signerNip: z.string().max(80),
        issuePlace: z.string().max(120),
        issueDate: z.string().date().or(z.literal("")).optional().default(""),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw validationError(parsed);
    const d = parsed.data;
    await c.env.DB.prepare(
      `INSERT INTO global_certificate_settings(id,certificate_prefix,signer_name,signer_title,signer_nip,issue_place,issue_date) VALUES(1,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET signer_name=excluded.signer_name,signer_title=excluded.signer_title,signer_nip=excluded.signer_nip,issue_place=excluded.issue_place,issue_date=excluded.issue_date,updated_at=CURRENT_TIMESTAMP`
    )
      .bind(
        "",
        d.signerName,
        d.signerTitle,
        d.signerNip,
        d.issuePlace,
        d.issueDate
      )
      .run();
    return c.json({ success: true });
  }
);
participantAdminRoutes.post(
  "/certificate-settings/assets",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const form = await c.req.formData();
    const updates: Array<{
      column:
        | "signature_key"
        | "stamp_key"
        | "front_template_key"
        | "back_template_key";
      key: string;
    }> = [];
    for (const [field, column] of [
      ["signature", "signature_key"],
      // Stamp and preview backgrounds are intentionally no longer configurable.
    ] as const) {
      const file = form.get(field);
      if (file instanceof File && file.size) {
        if (!file.type.startsWith("image/") || file.size > 8_000_000)
          throw new HttpError(
            422,
            "IMAGE_INVALID",
            "Tanda tangan harus berupa gambar maksimal 8 MB."
          );
        const ext = file.type.includes("png") ? "png" : "jpg";
        const key = `certificates/assets/global/${field}-${crypto.randomUUID()}.${ext}`;
        await c.env.QUESTION_IMAGES.put(key, await file.arrayBuffer(), {
          httpMetadata: { contentType: file.type },
        });
        updates.push({ column, key });
      }
    }
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO global_certificate_settings(id,certificate_prefix) VALUES(1,?)`
    )
      .bind("")
      .run();
    for (const item of updates)
      await c.env.DB.prepare(
        `UPDATE global_certificate_settings SET ${item.column}=?,updated_at=CURRENT_TIMESTAMP WHERE id=1`
      )
        .bind(item.key)
        .run();
    return c.json({ success: true });
  }
);

type CertificateSide = "FRONT" | "BACK";
function safeText(value: unknown) {
  return String(value ?? "").replace(/[^\x20-\x7E]/g, "-");
}
function fontBytes(dataUri: string) {
  const encoded = dataUri.slice(dataUri.indexOf(",") + 1);
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function cohortLabel(value: unknown) {
  const name = upperName(value);
  return /^ANGKATAN\b/u.test(name) ? name : `ANGKATAN ${name}`;
}
function trainingLabel(value: unknown) {
  const name = upperName(value);
  return /^PELATIHAN\b/u.test(name) ? name : `PELATIHAN ${name}`;
}
function upperName(value: unknown) {
  return String(value ?? "").trim().toLocaleUpperCase("id-ID");
}
function formatLongDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return Number.isNaN(date.getTime())
    ? value
    : `${date.getUTCDate()} ${
        months[date.getUTCMonth()]
      } ${date.getUTCFullYear()}`;
}
async function certificateData(db: D1Database, profileId: string) {
  return db
    .prepare(
      `WITH score AS (SELECT MAX(CASE WHEN a.stage<>'PRE' AND a.status='SUBMITTED' THEN a.score END) final_score,MAX(s.passing_score) passing_score FROM participants p JOIN attempts a ON a.participant_id=p.id JOIN training_sessions s ON s.id=a.training_session_id WHERE p.profile_id=?) SELECT p.*,t.name training_name,c.name cohort_name,c.start_date,c.end_date AS issue_date,(SELECT COALESCE(SUM(jp),0) FROM training_materials WHERE training_id=t.id) total_jp,score.final_score,score.passing_score,settings.signer_name,settings.signer_title,settings.signer_nip,settings.issue_place,settings.signature_key FROM participant_profiles p JOIN trainings t ON t.id=p.training_id JOIN training_cohorts c ON c.id=p.cohort_id CROSS JOIN score LEFT JOIN global_certificate_settings settings ON settings.id=1 WHERE p.id=?`
    )
    .bind(profileId, profileId)
    .first<Record<string, unknown>>();
}
function point(page: any, x: number, y: number, _d: Record<string, unknown>) {
  return {
    x: mm(x),
    y: page.getHeight() - mm(y),
  };
}
function drawCentered(
  page: any,
  font: any,
  text: string,
  x: number,
  y: number,
  size: number,
  d: Record<string, unknown>
) {
  const p = point(page, x, y, d);
  page.drawText(safeText(text), {
    x: p.x - font.widthOfTextAtSize(safeText(text), size) / 2,
    y: p.y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}
function drawTextAt(
  page: any,
  font: any,
  text: string | undefined,
  x: number,
  y: number,
  size: number,
  d: Record<string, unknown>
) {
  const p = point(page, x, y, d);
  page.drawText(safeText(text), {
    x: p.x,
    y: p.y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}
function drawWrapped(
  page: any,
  font: any,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  size: number,
  d: Record<string, unknown>
) {
  const words = safeText(text).split(/\s+/);
  let line = "";
  let row = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= mm(width)) {
      line = next;
      continue;
    }
    const p = point(page, x, y + row * lineHeight, d);
    page.drawText(line, { x: p.x, y: p.y, font, size, color: rgb(0, 0, 0) });
    line = word;
    row++;
  }
  if (line) {
    const p = point(page, x, y + row * lineHeight, d);
    page.drawText(line, { x: p.x, y: p.y, font, size, color: rgb(0, 0, 0) });
  }
}
function drawJustified(
  page: any,
  font: any,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  size: number,
  d: Record<string, unknown>,
  justifyLastLine = false
) {
  const words = safeText(text).split(/\s+/).filter(Boolean);
  const lines: string[][] = [];
  let line: string[] = [];
  for (const word of words) {
    const candidate = [...line, word];
    if (line.length && font.widthOfTextAtSize(candidate.join(" "), size) > mm(width)) {
      lines.push(line);
      line = [word];
    } else {
      line = candidate;
    }
  }
  if (line.length) lines.push(line);
  lines.forEach((lineWords, row) => {
    const p = point(page, x, y + row * lineHeight, d);
    const shouldJustify = lineWords.length > 1 && (justifyLastLine || row < lines.length - 1);
    if (!shouldJustify) {
      page.drawText(lineWords.join(" "), { x: p.x, y: p.y, font, size, color: rgb(0, 0, 0) });
      return;
    }
    const wordsWidth = lineWords.reduce((total, word) => total + font.widthOfTextAtSize(word, size), 0);
    const gap = (mm(width) - wordsWidth) / (lineWords.length - 1);
    let cursor = p.x;
    lineWords.forEach((word) => {
      page.drawText(word, { x: cursor, y: p.y, font, size, color: rgb(0, 0, 0) });
      cursor += font.widthOfTextAtSize(word, size) + gap;
    });
  });
}
async function embedImage(
  c: Context<AppEnvironment>,
  pdf: PDFDocument,
  key: unknown
) {
  if (!key) return null;
  const obj = await c.env.QUESTION_IMAGES.get(String(key));
  if (!obj) return null;
  const bytes = await obj.arrayBuffer();
  try {
    return String(key).endsWith(".png")
      ? await pdf.embedPng(bytes)
      : await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}
function box(
  page: any,
  x: number,
  y: number,
  width: number,
  height: number,
  d: Record<string, unknown>
) {
  const p = point(page, x, y, d);
  return { x: p.x, y: p.y - mm(height), width: mm(width), height: mm(height) };
}
function drawImageCover(
  page: any,
  image: any,
  layout: { x: number; y: number; width: number; height: number },
  d: Record<string, unknown>
) {
  const target = box(page, layout.x, layout.y, layout.width, layout.height, d);
  const scale = Math.max(
    target.width / image.width,
    target.height / image.height
  );
  const width = image.width * scale,
    height = image.height * scale;
  page.pushOperators(
    pushGraphicsState(),
    rectangle(target.x, target.y, target.width, target.height),
    clip(),
    endPath()
  );
  page.drawImage(image, {
    x: target.x + (target.width - width) / 2,
    y: target.y + (target.height - height) / 2,
    width,
    height,
  });
  page.pushOperators(popGraphicsState());
  page.drawRectangle({
    x: target.x,
    y: target.y,
    width: target.width,
    height: target.height,
    borderColor: rgb(0.03, 0.03, 0.03),
    borderWidth: 0.7,
  });
}
function drawImageContained(
  page: any,
  image: any,
  layout: { x: number; y: number; width: number; height: number },
  d: Record<string, unknown>
) {
  const target = box(page, layout.x, layout.y, layout.width, layout.height, d);
  const scale = Math.min(
    target.width / image.width,
    target.height / image.height
  );
  const width = image.width * scale,
    height = image.height * scale;
  page.drawImage(image, {
    x: target.x + (target.width - width) / 2,
    y: target.y + (target.height - height) / 2,
    width,
    height,
  });
}
function drawRule(
  page: any,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  d: Record<string, unknown>
) {
  page.drawLine({
    start: point(page, x1, y1, d),
    end: point(page, x2, y2, d),
    thickness: 0.75,
    color: rgb(0.03, 0.03, 0.03),
  });
}
async function renderCertificate(
  c: Context<AppEnvironment>,
  profileId: string,
  side: CertificateSide,
  preview = false
) {
  const d = await certificateData(c.env.DB, profileId);
  if (!d)
    throw new HttpError(
      404,
      "PARTICIPANT_NOT_FOUND",
      "Peserta tidak ditemukan."
    );
  if (Number(d.final_score ?? -1) < Number(d.passing_score ?? 101))
    throw new HttpError(
      409,
      "NOT_ELIGIBLE",
      "Sertifikat hanya dapat dibuat untuk peserta yang lulus."
    );
  if (!preview && !d.issue_date)
    throw new HttpError(
      409,
      "ISSUE_DATE_REQUIRED",
      "Atur tanggal penerbitan sertifikat terlebih dahulu."
    );
  const cert = await c.env.DB.prepare(
    `SELECT * FROM certificates WHERE participant_profile_id=?`
  )
    .bind(profileId)
    .first<Record<string, unknown>>();
  if (!preview && !cert?.certificate_number)
    throw new HttpError(
      409,
      "CERTIFICATE_NUMBER_REQUIRED",
      "Simpan nomor sertifikat resmi terlebih dahulu."
    );
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(fontBytes(bookmanRegularDataUri));
  const bold = await pdf.embedFont(fontBytes(bookmanBoldDataUri));
  const page = pdf.addPage([mm(A4_LANDSCAPE.width), mm(A4_LANDSCAPE.height)]);
  if (preview) {
    const template = await embedImage(
      c,
      pdf,
      side === "FRONT" ? d.front_template_key : d.back_template_key
    );
    if (template)
      page.drawImage(template, {
        x: 0,
        y: 0,
        width: page.getWidth(),
        height: page.getHeight(),
      });
  }
  if (side === "FRONT") {
    const l = certificateLayout.front;
    const number = String(
      cert?.certificate_number ?? "Nomor sertifikat belum diisi"
    );
    drawCentered(
      page,
      bold,
      `NOMOR : ${number}`,
      l.number.x,
      l.number.y,
      12,
      d
    );
    drawTextAt(
      page,
      regular,
      "Dengan ini menyatakan bahwa:",
      l.declaration.x,
      l.declaration.y,
      12,
      d
    );
    const rows = [
      ["Nama", upperName(d.name)],
      ["NIK", String(d.nik)],
      [
        "Tempat, tanggal lahir",
        `${d.birth_place}, ${formatLongDate(String(d.birth_date))}`,
      ],
    ];
    rows.forEach(([label, value], index) => {
      const y = l.label.y + index * l.label.lineHeight;
      drawTextAt(page, regular, label, l.label.x, y, 12, d);
      drawTextAt(page, bold, `:  ${value}`, l.value.x, y, 12, d);
    });
    const narrative = `telah menyelesaikan ${trainingLabel(
      d.training_name
    )} ${cohortLabel(
      d.cohort_name
    )} yang dilaksanakan pada tanggal ${formatLongDate(
      String(d.start_date)
    )} s.d. ${formatLongDate(String(d.end_date))} selama ${
      d.total_jp
    } jam pelatihan dan dinyatakan LULUS.`;
    drawJustified(
      page,
      regular,
      narrative,
      l.narrative.x,
      l.narrative.y,
      l.narrative.width,
      l.narrative.lineHeight,
      12,
      d
    );
    const photo = await embedImage(c, pdf, d.photo_key);
    if (photo) drawImageCover(page, photo, l.photo, d);
    drawCentered(
      page,
      regular,
      `${d.issue_place || "Medan"}, ${
        d.issue_date
          ? formatLongDate(String(d.issue_date))
          : "Tanggal penerbitan belum diisi"
      }`,
      l.issue.x,
      l.issue.y,
      12,
      d
    );
    drawCentered(
      page,
      regular,
      String(d.signer_title || ""),
      l.signerTitle.x,
      l.signerTitle.y,
      12,
      d
    );
    const signature = await embedImage(c, pdf, d.signature_key);
    if (signature) drawImageContained(page, signature, l.signature, d);
    drawCentered(
      page,
      bold,
      upperName(d.signer_name),
      l.signerName.x,
      l.signerName.y,
      12,
      d
    );
    drawCentered(
      page,
      bold,
      d.signer_nip ? `NIP. ${d.signer_nip}` : "",
      l.signerNip.x,
      l.signerNip.y,
      12,
      d
    );
  } else {
    const l = certificateLayout.back;
    drawCentered(
      page,
      bold,
      "DAFTAR UNIT KOMPETENSI",
      l.heading.x,
      l.heading.y,
      15,
      d
    );
    const materials = await c.env.DB.prepare(
      `SELECT unit_code,name FROM training_materials WHERE training_id=? ORDER BY sort_order`
    )
      .bind(d.training_id)
      .all<{ name: string; unit_code: string | null }>();
    const rowHeight = 8;
    const rows = Math.max(materials.results.length, 1);
    const headerBottom = l.table.top + l.table.headerHeight;
    const tableBottom = headerBottom + rows * rowHeight;
    const verticals = [
      l.table.number.left,
      l.table.number.right,
      l.table.material.right,
      l.table.unitCode.right,
      l.table.result.right,
    ];
    drawRule(
      page,
      l.table.x,
      l.table.top,
      l.table.x + l.table.width,
      l.table.top,
      d
    );
    drawRule(
      page,
      l.table.x,
      tableBottom,
      l.table.x + l.table.width,
      tableBottom,
      d
    );
    drawRule(
      page,
      l.table.x,
      headerBottom,
      l.table.x + l.table.width,
      headerBottom,
      d
    );
    for (const x of verticals)
      drawRule(page, x, l.table.top, x, tableBottom, d);
    for (let index = 1; index < rows; index++)
      drawRule(
        page,
        l.table.x,
        headerBottom + index * rowHeight,
        l.table.x + l.table.width,
        headerBottom + index * rowHeight,
        d
      );
    const headerY = l.table.top + 8;
    for (const [text, left, right] of [
      ["No", l.table.number.left, l.table.number.right],
      ["Unit Kompetensi", l.table.material.left, l.table.material.right],
      ["Kode Unit", l.table.unitCode.left, l.table.unitCode.right],
      ["Hasil", l.table.result.left, l.table.result.right],
    ] as const) {
      const lines = text.split("\n");
      lines.forEach((line, index) =>
        drawCentered(
          page,
          bold,
          line,
          (left + right) / 2,
          headerY + index * 4.2,
          10,
          d
        )
      );
    }
    materials.results.forEach((material, index) => {
      const y = headerBottom + (index + 0.67) * rowHeight;
      drawCentered(
        page,
        regular,
        String(index + 1),
        (l.table.number.left + l.table.number.right) / 2,
        y,
        9.5,
        d
      );
      drawTextAt(
        page,
        regular,
        upperName(material.name),
        l.table.material.left + 1.5,
        y,
        9.5,
        d
      );
      drawCentered(
        page,
        regular,
        material.unit_code ? String(material.unit_code).trim().toLocaleUpperCase("id-ID") : "",
        (l.table.unitCode.left + l.table.unitCode.right) / 2,
        y,
        8.5,
        d
      );
      drawCentered(
        page,
        regular,
        "LULUS",
        (l.table.result.left + l.table.result.right) / 2,
        y,
        9.5,
        d
      );
    });
  }
  return {
    bytes: await pdf.save(),
    certificateId: String(cert?.id ?? ""),
    number: String(cert?.certificate_number ?? ""),
  };
}

async function renderCompletionLetter(
  c: Context<AppEnvironment>,
  profileId: string,
  preview = false
) {
  const d = await certificateData(c.env.DB, profileId);
  if (!d)
    throw new HttpError(404, "PARTICIPANT_NOT_FOUND", "Peserta tidak ditemukan.");
  if (Number(d.final_score ?? -1) < Number(d.passing_score ?? 101))
    throw new HttpError(409, "NOT_ELIGIBLE", "Surat keterangan hanya dapat dibuat untuk peserta yang lulus.");
  if (!preview && !d.issue_date)
    throw new HttpError(409, "ISSUE_DATE_REQUIRED", "Atur tanggal penerbitan terlebih dahulu.");
  const letter = await c.env.DB.prepare(
    `SELECT * FROM completion_letters WHERE participant_profile_id=?`
  ).bind(profileId).first<Record<string, unknown>>();
  if (!preview && !letter?.completion_letter_number)
    throw new HttpError(409, "COMPLETION_LETTER_NUMBER_REQUIRED", "Simpan nomor surat resmi terlebih dahulu.");

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(fontBytes(bookmanRegularDataUri));
  const bold = await pdf.embedFont(fontBytes(bookmanBoldDataUri));
  const header = await pdf.embedPng(fontBytes(completionLetterHeaderDataUri));
  const page = pdf.addPage([mm(210), mm(297)]);
  const bodySize = 10.5;
  const titleSize = 11;
  const headerWidth = 184;
  const headerHeight = headerWidth * (header.height / header.width);
  page.drawImage(header, box(page, 13, 15, headerWidth, headerHeight, d));

  drawCentered(page, regular, "SURAT KETERANGAN TELAH MENYELESAIKAN PELATIHAN", 105, 59, titleSize, d);
  drawCentered(
    page,
    regular,
    `NOMOR : ${String(letter?.completion_letter_number ?? "Nomor surat belum diisi")}`,
    105,
    66.5,
    bodySize,
    d
  );

  drawTextAt(page, regular, "Yang bertanda tangan di bawah ini:", 25, 81, bodySize, d);
  const officialRows = [
    ["Nama", upperName(d.signer_name)],
    ["NIP", String(d.signer_nip || "")],
    ["Jabatan", String(d.signer_title || "")],
  ];
  officialRows.forEach(([label, value], index) => {
    const y = 88.5 + index * 7;
    drawTextAt(page, regular, label, 25, y, bodySize, d);
    drawTextAt(page, regular, ":", 76, y, bodySize, d);
    drawTextAt(page, regular, value, 89, y, bodySize, d);
  });

  drawTextAt(page, regular, "menerangkan bahwa:", 25, 115, bodySize, d);
  const participantRows = [
    ["Nama", upperName(d.name)],
    ["NIK", String(d.nik || "")],
    ["Tanggal, tempat lahir", `${formatLongDate(String(d.birth_date))}, ${String(d.birth_place || "")}`],
  ];
  participantRows.forEach(([label, value], index) => {
    const y = 123 + index * 9;
    drawTextAt(page, regular, label, 26, y, bodySize, d);
    drawTextAt(page, regular, ":", 76, y, bodySize, d);
    drawTextAt(page, regular, value, 89, y, bodySize, d);
  });
  drawTextAt(page, regular, "Alamat", 26, 150, bodySize, d);
  drawTextAt(page, regular, ":", 76, 150, bodySize, d);
  drawWrapped(page, regular, String(d.address || "-"), 89, 150, 94, 5.7, bodySize, d);

  drawJustified(
    page,
    regular,
    `telah menyelesaikan ${trainingLabel(d.training_name)} yang dilaksanakan pada tanggal ${formatLongDate(String(d.start_date))} s.d. ${formatLongDate(String(d.end_date))} selama ${d.total_jp} JPL.`,
    25,
    169,
    160,
    6.5,
    bodySize,
    d
  );
  drawJustified(
    page,
    regular,
    "Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.",
    25,
    190,
    160,
    6.5,
    bodySize,
    d,
    true
  );

  const issueText = `${String(d.issue_place || "Medan")}, ${d.issue_date ? formatLongDate(String(d.issue_date)) : "Tanggal penerbitan belum diisi"}`;
  drawCentered(page, regular, issueText, 145, 204, bodySize, d);
  drawCentered(page, regular, String(d.signer_title || ""), 145, 211, bodySize, d);
  const signature = await embedImage(c, pdf, d.signature_key);
  if (signature) drawImageContained(page, signature, { x: 122, y: 216, width: 46, height: 14 }, d);
  const signerName = upperName(d.signer_name);
  drawCentered(page, bold, signerName, 145, 237, bodySize, d);
  const signerNameWidth = bold.widthOfTextAtSize(safeText(signerName), bodySize) / mm(1);
  if (signerName) drawRule(page, 145 - signerNameWidth / 2, 238.2, 145 + signerNameWidth / 2, 238.2, d);
  drawCentered(page, bold, d.signer_nip ? `NIP. ${d.signer_nip}` : "", 145, 244, bodySize, d);

  return {
    bytes: await pdf.save(),
    letterId: String(letter?.id ?? ""),
    number: String(letter?.completion_letter_number ?? ""),
  };
}

async function combinePdfDocuments(documents: Uint8Array[]) {
  const combined = await PDFDocument.create();
  for (const bytes of documents) {
    const source = await PDFDocument.load(bytes);
    const pages = await combined.copyPages(source, source.getPageIndices());
    pages.forEach((page) => combined.addPage(page));
  }
  return combined.save();
}

function safeDocumentName(value: string) {
  return value.toLocaleUpperCase("id-ID").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "PESERTA";
}
participantAdminRoutes.put(
  "/certificates/:participantId/number",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = z
      .object({ certificateNumber: z.string().trim().min(1).max(120) })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw validationError(parsed);
    const d = await certificateData(c.env.DB, c.req.param("participantId"));
    if (!d || Number(d.final_score ?? -1) < Number(d.passing_score ?? 101))
      throw new HttpError(
        409,
        "NOT_ELIGIBLE",
        "Nomor hanya dapat disimpan untuk peserta yang lulus."
      );
    if (!d.issue_date)
      throw new HttpError(
        409,
        "ISSUE_DATE_REQUIRED",
        "Atur tanggal penerbitan sertifikat terlebih dahulu."
      );
    const existing = await c.env.DB.prepare(
      `SELECT id FROM certificates WHERE participant_profile_id=?`
    )
      .bind(c.req.param("participantId"))
      .first<{ id: string }>();
    if (existing)
      await c.env.DB.prepare(
        `UPDATE certificates SET certificate_number=?,issued_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
      )
        .bind(parsed.data.certificateNumber, d.issue_date, existing.id)
        .run();
    else
      await c.env.DB.prepare(
        `INSERT INTO certificates(id,participant_profile_id,training_id,cohort_id,certificate_number,issued_at) VALUES(?,?,?,?,?,?)`
      )
        .bind(
          crypto.randomUUID(),
          c.req.param("participantId"),
          d.training_id,
          d.cohort_id,
          parsed.data.certificateNumber,
          d.issue_date
        )
        .run();
    return c.json({ success: true });
  }
);
participantAdminRoutes.put(
  "/completion-letters/:participantId/number",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = z.object({ completionLetterNumber: z.string().trim().min(1).max(160) })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw validationError(parsed);
    const d = await certificateData(c.env.DB, c.req.param("participantId"));
    if (!d || Number(d.final_score ?? -1) < Number(d.passing_score ?? 101))
      throw new HttpError(409, "NOT_ELIGIBLE", "Nomor surat hanya dapat disimpan untuk peserta yang lulus.");
    if (!d.issue_date)
      throw new HttpError(409, "ISSUE_DATE_REQUIRED", "Atur tanggal penerbitan terlebih dahulu.");
    const existing = await c.env.DB.prepare(
      `SELECT id FROM completion_letters WHERE participant_profile_id=?`
    ).bind(c.req.param("participantId")).first<{ id: string }>();
    if (existing) {
      await c.env.DB.prepare(
        `UPDATE completion_letters SET completion_letter_number=?,issued_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
      ).bind(parsed.data.completionLetterNumber, d.issue_date, existing.id).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO completion_letters(id,participant_profile_id,training_id,cohort_id,completion_letter_number,issued_at) VALUES(?,?,?,?,?,?)`
      ).bind(
        crypto.randomUUID(),
        c.req.param("participantId"),
        d.training_id,
        d.cohort_id,
        parsed.data.completionLetterNumber,
        d.issue_date
      ).run();
    }
    return c.json({ success: true });
  }
);
participantAdminRoutes.put(
  "/document-numbers/bulk",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = z.object({
      entries: z.array(z.object({
        participantId: z.string().uuid(),
        certificateNumber: z.string().trim().min(1).max(120).optional(),
        completionLetterNumber: z.string().trim().min(1).max(160).optional(),
      }).refine(
        (entry) => Boolean(entry.certificateNumber || entry.completionLetterNumber),
        "Minimal satu nomor dokumen harus diisi."
      )).min(1).max(1000),
    }).safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw validationError(parsed);
    const participantIds = parsed.data.entries.map((entry) => entry.participantId);
    if (new Set(participantIds).size !== participantIds.length)
      throw new HttpError(422, "DATA_INVALID", "Peserta tidak boleh muncul lebih dari sekali.");

    const profiles = await c.env.DB.prepare(
      `WITH scores AS (
        SELECT p.profile_id,
          MAX(CASE WHEN a.stage<>'PRE' AND a.status='SUBMITTED' THEN a.score END) final_score,
          MAX(s.passing_score) passing_score
        FROM participants p
        JOIN attempts a ON a.participant_id=p.id
        JOIN training_sessions s ON s.id=a.training_session_id
        WHERE p.profile_id IS NOT NULL
        GROUP BY p.profile_id
      )
      SELECT profiles.id,profiles.training_id,profiles.cohort_id,cohorts.end_date AS issue_date,scores.final_score,scores.passing_score
      FROM participant_profiles profiles
      JOIN training_cohorts cohorts ON cohorts.id=profiles.cohort_id
      LEFT JOIN scores ON scores.profile_id=profiles.id
      WHERE profiles.id IN (SELECT value FROM json_each(?))`
    ).bind(JSON.stringify(participantIds)).all<{
      id: string;
      training_id: string;
      cohort_id: string;
      final_score: number | null;
      passing_score: number | null;
      issue_date: string;
    }>();
    if (
      profiles.results.length !== participantIds.length ||
      profiles.results.some((profile) =>
        Number(profile.final_score ?? -1) < Number(profile.passing_score ?? 101)
      )
    )
      throw new HttpError(409, "NOT_ELIGIBLE", "Nomor hanya dapat diterapkan kepada peserta yang lulus.");

    const ensureUniqueNumbers = async (
      table: "certificates" | "completion_letters",
      column: "certificate_number" | "completion_letter_number",
      values: Array<{ participantId: string; number: string }>
    ) => {
      if (!values.length) return;
      if (new Set(values.map((value) => value.number)).size !== values.length)
        throw new HttpError(409, "DOCUMENT_NUMBER_DUPLICATE", "Nomor dokumen hasil pengisian tidak boleh sama.");
      const existing = await c.env.DB.prepare(
        `SELECT participant_profile_id,${column} number FROM ${table} WHERE ${column} IN (SELECT value FROM json_each(?))`
      ).bind(JSON.stringify(values.map((value) => value.number))).all<{
        participant_profile_id: string;
        number: string;
      }>();
      const owners = new Map(values.map((value) => [value.number, value.participantId]));
      const targetParticipantIds = new Set(values.map((value) => value.participantId));
      if (existing.results.some((row) =>
        owners.get(row.number) !== row.participant_profile_id &&
        !targetParticipantIds.has(row.participant_profile_id)
      ))
        throw new HttpError(409, "DOCUMENT_NUMBER_DUPLICATE", "Salah satu nomor dokumen sudah digunakan peserta lain.");
    };

    await ensureUniqueNumbers(
      "certificates",
      "certificate_number",
      parsed.data.entries.flatMap((entry) => entry.certificateNumber
        ? [{ participantId: entry.participantId, number: entry.certificateNumber }]
        : [])
    );
    await ensureUniqueNumbers(
      "completion_letters",
      "completion_letter_number",
      parsed.data.entries.flatMap((entry) => entry.completionLetterNumber
        ? [{ participantId: entry.participantId, number: entry.completionLetterNumber }]
        : [])
    );

    const profileById = new Map(profiles.results.map((profile) => [profile.id, profile]));
    const statements: D1PreparedStatement[] = [];
    const certificateTargets = parsed.data.entries.filter((entry) => entry.certificateNumber);
    const letterTargets = parsed.data.entries.filter((entry) => entry.completionLetterNumber);
    for (const entry of certificateTargets) {
      statements.push(c.env.DB.prepare(
        `UPDATE certificates SET certificate_number=? WHERE participant_profile_id=?`
      ).bind(`__bulk_certificate_${crypto.randomUUID()}`, entry.participantId));
    }
    for (const entry of letterTargets) {
      statements.push(c.env.DB.prepare(
        `UPDATE completion_letters SET completion_letter_number=? WHERE participant_profile_id=?`
      ).bind(`__bulk_letter_${crypto.randomUUID()}`, entry.participantId));
    }
    for (const entry of parsed.data.entries) {
      const profile = profileById.get(entry.participantId)!;
      if (entry.certificateNumber) {
        statements.push(c.env.DB.prepare(
          `INSERT INTO certificates(id,participant_profile_id,training_id,cohort_id,certificate_number,issued_at)
           VALUES(?,?,?,?,?,?)
           ON CONFLICT(participant_profile_id,training_id,cohort_id) DO UPDATE SET
             certificate_number=excluded.certificate_number,
             issued_at=excluded.issued_at,
             updated_at=CURRENT_TIMESTAMP`
        ).bind(
          crypto.randomUUID(),
          profile.id,
          profile.training_id,
          profile.cohort_id,
          entry.certificateNumber,
          profile.issue_date
        ));
      }
      if (entry.completionLetterNumber) {
        statements.push(c.env.DB.prepare(
          `INSERT INTO completion_letters(id,participant_profile_id,training_id,cohort_id,completion_letter_number,issued_at)
           VALUES(?,?,?,?,?,?)
           ON CONFLICT(participant_profile_id) DO UPDATE SET
             completion_letter_number=excluded.completion_letter_number,
             issued_at=excluded.issued_at,
             updated_at=CURRENT_TIMESTAMP`
        ).bind(
          crypto.randomUUID(),
          profile.id,
          profile.training_id,
          profile.cohort_id,
          entry.completionLetterNumber,
          profile.issue_date
        ));
      }
    }
    await c.env.DB.batch(statements);
    return c.json({
      participantsUpdated: new Set(parsed.data.entries.map((entry) => entry.participantId)).size,
      numbersUpdated: certificateTargets.length + letterTargets.length,
    });
  }
);
participantAdminRoutes.post(
  "/certificates/:participantId/generate",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = z
      .object({ side: z.enum(["FRONT", "BACK", "BOTH"]).default("BOTH") })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw validationError(parsed);
    let last: { certificateId: string } | null = null;
    const sides: CertificateSide[] =
      parsed.data.side === "BOTH" ? ["FRONT", "BACK"] : [parsed.data.side];
    for (const side of sides) {
      const result = await renderCertificate(
        c,
        c.req.param("participantId"),
        side
      );
      const key = `certificates/${c.req.param(
        "participantId"
      )}/${side.toLowerCase()}.pdf`;
      await c.env.QUESTION_IMAGES.put(key, result.bytes, {
        httpMetadata: { contentType: "application/pdf" },
      });
      await c.env.DB.prepare(
        `UPDATE certificates SET ${
          side === "FRONT" ? "pdf_key" : "back_pdf_key"
        }=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
      )
        .bind(key, result.certificateId)
        .run();
      last = result;
    }
    return c.json({ success: true, certificateId: last?.certificateId });
  }
);
participantAdminRoutes.post(
  "/certificates/generate-all",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = z
      .object({
        trainingId: z.string(),
        cohortId: z.string(),
        side: z.enum(["FRONT", "BACK", "BOTH"]).default("BOTH"),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw validationError(parsed);
    const rows = await c.env.DB.prepare(
      `SELECT id FROM participant_profiles WHERE training_id=? AND cohort_id=? AND is_active=1`
    )
      .bind(parsed.data.trainingId, parsed.data.cohortId)
      .all<{ id: string }>();
    let generated = 0;
    for (const row of rows.results) {
      try {
        const sides: CertificateSide[] =
          parsed.data.side === "BOTH" ? ["FRONT", "BACK"] : [parsed.data.side];
        for (const side of sides) {
          const result = await renderCertificate(c, row.id, side);
          const key = `certificates/${row.id}/${side.toLowerCase()}.pdf`;
          await c.env.QUESTION_IMAGES.put(key, result.bytes, {
            httpMetadata: { contentType: "application/pdf" },
          });
          await c.env.DB.prepare(
            `UPDATE certificates SET ${
              side === "FRONT" ? "pdf_key" : "back_pdf_key"
            }=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
          )
            .bind(key, result.certificateId)
            .run();
        }
        generated++;
      } catch (e) {
        if (
          !(
            e instanceof HttpError &&
            (e.code === "NOT_ELIGIBLE" ||
              e.code === "CERTIFICATE_NUMBER_REQUIRED")
          )
        )
          throw e;
      }
    }
    return c.json({ generated });
  }
);
participantAdminRoutes.post(
  "/certificates/download-all",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = z
      .object({ trainingId: z.string(), cohortId: z.string() })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw validationError(parsed);
    const rows = await c.env.DB.prepare(
      `SELECT id,name FROM participant_profiles WHERE training_id=? AND cohort_id=? AND is_active=1 ORDER BY name`
    )
      .bind(parsed.data.trainingId, parsed.data.cohortId)
      .all<{ id: string; name: string }>();
    const files: Record<string, Uint8Array> = {};
    for (const row of rows.results) {
      try {
        const [front, back] = await Promise.all([
          renderCertificate(c, row.id, "FRONT"),
          renderCertificate(c, row.id, "BACK"),
        ]);
        const safeName =
          row.name.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") ||
          row.id;
        files[`${safeName}/Sertifikat-Depan.pdf`] = front.bytes;
        files[`${safeName}/Sertifikat-Belakang.pdf`] = back.bytes;
        for (const [side, result] of [
          ["FRONT", front],
          ["BACK", back],
        ] as const) {
          const key = `certificates/${row.id}/${side.toLowerCase()}.pdf`;
          await c.env.QUESTION_IMAGES.put(key, result.bytes, {
            httpMetadata: { contentType: "application/pdf" },
          });
          await c.env.DB.prepare(
            `UPDATE certificates SET ${
              side === "FRONT" ? "pdf_key" : "back_pdf_key"
            }=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
          )
            .bind(key, result.certificateId)
            .run();
        }
      } catch (error) {
        if (
          !(
            error instanceof HttpError &&
            (error.code === "NOT_ELIGIBLE" ||
              error.code === "CERTIFICATE_NUMBER_REQUIRED")
          )
        )
          throw error;
      }
    }
    if (!Object.keys(files).length)
      throw new HttpError(
        409,
        "CERTIFICATE_NUMBER_REQUIRED",
        "Belum ada peserta lulus dengan nomor sertifikat resmi pada angkatan ini."
      );
    const archive = zipSync(files, { level: 6 });
    return new Response(archive, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="sertifikat-${parsed.data.cohortId}.zip"`,
      },
    });
  }
);
participantAdminRoutes.get(
  "/certificates/:certificateId/preview",
  async (c) => {
    const side =
      c.req.query("side") === "BACK" ? "BACK" : ("FRONT" as CertificateSide);
    const cert = await c.env.DB.prepare(
      `SELECT participant_profile_id,certificate_number FROM certificates WHERE id=?`
    )
      .bind(c.req.param("certificateId"))
      .first<{ participant_profile_id: string; certificate_number: string }>();
    if (!cert)
      throw new HttpError(404, "PDF_NOT_FOUND", "Sertifikat tidak ditemukan.");
    const result = await renderCertificate(
      c,
      cert.participant_profile_id,
      side,
      true
    );
    return new Response(result.bytes.slice().buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="preview-${cert.certificate_number}.pdf"`,
      },
    });
  }
);
participantAdminRoutes.get(
  "/certificates/preview-participant/:participantId",
  async (c) => {
    const side =
      c.req.query("side") === "BACK" ? "BACK" : ("FRONT" as CertificateSide);
    const result = await renderCertificate(
      c,
      c.req.param("participantId"),
      side,
      true
    );
    return new Response(result.bytes.slice().buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=preview-sertifikat.pdf",
      },
    });
  }
);
participantAdminRoutes.get("/certificates/:certificateId/pdf", async (c) => {
  const side = c.req.query("side") === "BACK" ? "BACK" : "FRONT";
  const row = await c.env.DB.prepare(
    `SELECT pdf_key,back_pdf_key,certificate_number FROM certificates WHERE id=?`
  )
    .bind(c.req.param("certificateId"))
    .first<{
      pdf_key: string | null;
      back_pdf_key: string | null;
      certificate_number: string;
    }>();
  const key = side === "BACK" ? row?.back_pdf_key : row?.pdf_key;
  if (!key)
    throw new HttpError(404, "PDF_NOT_FOUND", "PDF sertifikat belum dibuat.");
  const obj = await c.env.QUESTION_IMAGES.get(key);
  if (!obj)
    throw new HttpError(
      404,
      "PDF_NOT_FOUND",
      "PDF sertifikat tidak ditemukan."
    );
  return new Response(obj.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="sertifikat-${side.toLowerCase()}-${row!.certificate_number.replace(
        /[^a-zA-Z0-9-]/g,
        "-"
      )}.pdf"`,
    },
  });
});
participantAdminRoutes.get(
  "/certificates/:certificateId/download",
  async (c) => {
    const cert = await c.env.DB.prepare(
      `SELECT participant_profile_id,certificate_number FROM certificates WHERE id=?`
    )
      .bind(c.req.param("certificateId"))
      .first<{ participant_profile_id: string; certificate_number: string }>();
    if (!cert)
      throw new HttpError(404, "PDF_NOT_FOUND", "Sertifikat tidak ditemukan.");
    const [front, back] = await Promise.all([
      renderCertificate(c, cert.participant_profile_id, "FRONT"),
      renderCertificate(c, cert.participant_profile_id, "BACK"),
    ]);
    const combined = await PDFDocument.create();
    for (const source of [front.bytes, back.bytes]) {
      const document = await PDFDocument.load(source);
      const [page] = await combined.copyPages(document, [0]);
      combined.addPage(page);
    }
    const safeNumber = cert.certificate_number.replace(/[^a-zA-Z0-9-]/g, "-");
    const bytes = await combined.save();
    return new Response(bytes.slice().buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="sertifikat-${safeNumber}.pdf"`,
      },
    });
  }
);

participantAdminRoutes.get(
  "/completion-letters/preview-participant/:participantId",
  async (c) => {
    const result = await renderCompletionLetter(c, c.req.param("participantId"), true);
    return new Response(result.bytes.slice().buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=preview-surat-keterangan.pdf",
      },
    });
  }
);

participantAdminRoutes.get(
  "/completion-letters/:participantId/download",
  async (c) => {
    const result = await renderCompletionLetter(c, c.req.param("participantId"));
    const safeNumber = safeDocumentName(result.number);
    return new Response(result.bytes.slice().buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="surat-keterangan-${safeNumber}.pdf"`,
      },
    });
  }
);

participantAdminRoutes.post(
  "/completion-letters/download-all",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = z.object({ trainingId: z.string(), cohortId: z.string() })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw validationError(parsed);
    const rows = await c.env.DB.prepare(
      `SELECT id,name FROM participant_profiles WHERE training_id=? AND cohort_id=? AND is_active=1 ORDER BY name`
    ).bind(parsed.data.trainingId, parsed.data.cohortId).all<{ id: string; name: string }>();
    const files: Record<string, Uint8Array> = {};
    for (const row of rows.results) {
      try {
        const letter = await renderCompletionLetter(c, row.id);
        files[`Surat Keterangan - ${safeDocumentName(row.name)}.pdf`] = letter.bytes;
      } catch (error) {
        if (!(error instanceof HttpError && (error.code === "NOT_ELIGIBLE" || error.code === "COMPLETION_LETTER_NUMBER_REQUIRED"))) throw error;
      }
    }
    if (!Object.keys(files).length)
      throw new HttpError(409, "COMPLETION_LETTER_NUMBER_REQUIRED", "Belum ada peserta lulus dengan nomor surat resmi pada angkatan ini.");
    const archive = zipSync(files, { level: 6 });
    return new Response(archive, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="surat-keterangan-${parsed.data.cohortId}.zip"`,
      },
    });
  }
);

participantAdminRoutes.post(
  "/documents/download-all",
  requireSameOrigin,
  requireCsrf,
  async (c) => {
    const parsed = z.object({ trainingId: z.string(), cohortId: z.string() })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw validationError(parsed);
    const rows = await c.env.DB.prepare(
      `SELECT id,name FROM participant_profiles WHERE training_id=? AND cohort_id=? AND is_active=1 ORDER BY name`
    ).bind(parsed.data.trainingId, parsed.data.cohortId).all<{ id: string; name: string }>();
    const files: Record<string, Uint8Array> = {};
    for (const row of rows.results) {
      try {
        const [front, back, letter] = await Promise.all([
          renderCertificate(c, row.id, "FRONT"),
          renderCertificate(c, row.id, "BACK"),
          renderCompletionLetter(c, row.id),
        ]);
        const safeName = safeDocumentName(row.name);
        files[`${safeName}/Sertifikat - ${safeName}.pdf`] = await combinePdfDocuments([front.bytes, back.bytes]);
        files[`${safeName}/Surat Keterangan - ${safeName}.pdf`] = letter.bytes;
      } catch (error) {
        if (!(error instanceof HttpError && ["NOT_ELIGIBLE", "CERTIFICATE_NUMBER_REQUIRED", "COMPLETION_LETTER_NUMBER_REQUIRED"].includes(error.code))) throw error;
      }
    }
    if (!Object.keys(files).length)
      throw new HttpError(409, "DOCUMENT_NUMBER_REQUIRED", "Belum ada peserta lulus yang memiliki nomor sertifikat dan nomor surat resmi lengkap.");
    const archive = zipSync(files, { level: 6 });
    return new Response(archive, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="dokumen-kelulusan-${parsed.data.cohortId}.zip"`,
      },
    });
  }
);
