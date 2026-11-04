import type { Context } from "hono";
import { HttpError } from "../http/errors";
import type { AppEnvironment } from "../types";

export const fundingSources = ["RUPIAH_MURNI", "PNBP"] as const;
export type FundingSource = (typeof fundingSources)[number];

export function isFundingSource(value: unknown): value is FundingSource {
  return typeof value === "string" && fundingSources.includes(value as FundingSource);
}

/** Existing clients and data use Rupiah Murni until a context is supplied. */
export function activeFundingSource(context: Context<AppEnvironment>): FundingSource {
  const value = context.req.query("fundingSource") ?? context.req.header("X-Funding-Source");
  return isFundingSource(value) ? value : "RUPIAH_MURNI";
}

export async function requireCohortInFundingSource(
  database: D1Database,
  cohortId: string,
  fundingSource: FundingSource,
) {
  const cohort = await database.prepare(
    `SELECT id, training_id, name, start_date, end_date, status, funding_source
     FROM training_cohorts WHERE id = ? LIMIT 1`,
  ).bind(cohortId).first<{
    id: string;
    training_id: string;
    name: string;
    start_date: string;
    end_date: string;
    status: string;
    funding_source: FundingSource;
  }>();
  if (!cohort) throw new HttpError(404, "COHORT_NOT_FOUND", "Angkatan tidak ditemukan.");
  if (cohort.funding_source !== fundingSource) {
    throw new HttpError(
      409,
      `FUNDING_SOURCE_CONTEXT_${cohort.funding_source}`,
      `Data ini berada pada sumber pembiayaan ${cohort.funding_source === "PNBP" ? "PNBP" : "Rupiah Murni"}. Ubah Sumber Aktif untuk melanjutkan.`,
    );
  }
  return cohort;
}

export async function requireCohortsInFundingSource(
  database: D1Database,
  cohortIds: string[],
  fundingSource: FundingSource,
) {
  if (!cohortIds.length) return [];
  const placeholders = cohortIds.map(() => "?").join(",");
  const rows = await database.prepare(
    `SELECT id, training_id, name, start_date, end_date, status, funding_source
     FROM training_cohorts WHERE id IN (${placeholders})`,
  ).bind(...cohortIds).all<{
    id: string;
    training_id: string;
    name: string;
    start_date: string;
    end_date: string;
    status: string;
    funding_source: FundingSource;
  }>();
  if (rows.results.length !== new Set(cohortIds).size) {
    throw new HttpError(404, "COHORT_NOT_FOUND", "Salah satu Angkatan tidak ditemukan.");
  }
  const mismatch = rows.results.find((row) => row.funding_source !== fundingSource);
  if (mismatch) {
    throw new HttpError(
      409,
      `FUNDING_SOURCE_CONTEXT_${mismatch.funding_source}`,
      `Salah satu Angkatan berada pada sumber pembiayaan ${mismatch.funding_source === "PNBP" ? "PNBP" : "Rupiah Murni"}. Ubah Sumber Aktif untuk melanjutkan.`,
    );
  }
  return rows.results;
}

export async function requireSessionInFundingSource(
  database: D1Database,
  sessionId: string,
  fundingSource: FundingSource,
) {
  const row = await database.prepare(
    `SELECT sessions.id, MIN(cohorts.funding_source) AS funding_source,
            COUNT(DISTINCT cohorts.funding_source) AS source_count
     FROM training_sessions sessions
     JOIN batches ON batches.training_session_id = sessions.id
     JOIN training_cohorts cohorts ON cohorts.id = batches.cohort_id
     WHERE sessions.id = ? GROUP BY sessions.id`,
  ).bind(sessionId).first<{ id: string; funding_source: FundingSource; source_count: number }>();
  if (!row) throw new HttpError(404, "TRAINING_NOT_FOUND", "Pelaksanaan tes tidak ditemukan.");
  if (row.source_count !== 1 || row.funding_source !== fundingSource) {
    const actual = row.funding_source === "PNBP" ? "PNBP" : "RUPIAH_MURNI";
    throw new HttpError(409, `FUNDING_SOURCE_CONTEXT_${actual}`, `Pelaksanaan tes ini berada pada sumber pembiayaan ${actual === "PNBP" ? "PNBP" : "Rupiah Murni"}. Ubah Sumber Aktif untuk melanjutkan.`);
  }
  return row;
}

export async function requireParticipantReferenceInFundingSource(
  database: D1Database,
  referenceId: string,
  fundingSource: FundingSource,
) {
  const row = await database.prepare(
    `SELECT cohorts.funding_source
     FROM participant_profiles profiles
     JOIN training_cohorts cohorts ON cohorts.id=profiles.cohort_id
     LEFT JOIN participants exam_participants ON exam_participants.profile_id=profiles.id
     WHERE profiles.id=? OR exam_participants.id=? LIMIT 1`,
  ).bind(referenceId, referenceId).first<{ funding_source: FundingSource }>();
  if (!row) throw new HttpError(404, "PARTICIPANT_NOT_FOUND", "Peserta tidak ditemukan.");
  if (row.funding_source !== fundingSource) {
    throw new HttpError(409, `FUNDING_SOURCE_CONTEXT_${row.funding_source}`, `Peserta ini berada pada sumber pembiayaan ${row.funding_source === "PNBP" ? "PNBP" : "Rupiah Murni"}. Ubah Sumber Aktif untuk melanjutkan.`);
  }
}
