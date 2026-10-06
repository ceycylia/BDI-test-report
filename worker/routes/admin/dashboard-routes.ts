import { Hono } from "hono";
import { requireAdmin } from "../../middleware/admin-auth";
import type { AppEnvironment } from "../../types";

export const dashboardRoutes = new Hono<AppEnvironment>();
dashboardRoutes.use("*", requireAdmin);

function currentYearInJakarta() {
  return Number(new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date()));
}

function requestedYear(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2200 ? parsed : currentYearInJakarta();
}

dashboardRoutes.get("/years", async (context) => {
  const result = await context.env.DB.prepare(
    `SELECT DISTINCT CAST(year_value AS INTEGER) AS year FROM (
      SELECT SUBSTR(start_date, 1, 4) AS year_value FROM training_cohorts WHERE start_date IS NOT NULL
      UNION
      SELECT SUBSTR(training_start_date, 1, 4) AS year_value FROM training_sessions WHERE training_start_date IS NOT NULL
    ) WHERE year_value GLOB '[0-9][0-9][0-9][0-9]' ORDER BY year DESC`,
  ).all<{ year: number }>();
  return context.json({ years: [...new Set([currentYearInJakarta(), ...result.results.map((item) => Number(item.year))])].sort((a, b) => b - a) });
});

dashboardRoutes.get("/", async (context) => {
  const year = requestedYear(context.req.query("year"));
  const yearText = String(year);
  const [metrics, activityResult] = await Promise.all([
    context.env.DB.prepare(
    `WITH final_scores AS (
      SELECT participants.id, sessions.passing_score,
        MAX(CASE WHEN attempts.stage <> 'PRE' AND attempts.status = 'SUBMITTED' THEN attempts.score END) AS final_score
      FROM participants JOIN batches ON batches.id = participants.batch_id
      JOIN training_sessions AS sessions ON sessions.id = batches.training_session_id
      JOIN training_cohorts AS cohorts ON cohorts.id = batches.cohort_id
      LEFT JOIN attempts ON attempts.participant_id = participants.id AND attempts.status <> 'RESET'
      WHERE SUBSTR(cohorts.start_date, 1, 4) = ?
      GROUP BY participants.id
    ) SELECT
      (SELECT COUNT(*) FROM question_banks) AS banks,
      (SELECT COUNT(*) FROM questions) AS questions,
      (SELECT COUNT(DISTINCT training_id) FROM training_sessions WHERE SUBSTR(training_start_date, 1, 4) = ?) AS trainings,
      (SELECT COUNT(*) FROM training_sessions WHERE SUBSTR(training_start_date, 1, 4) = ?) AS tests,
      (SELECT COUNT(*) FROM training_sessions WHERE status = 'ACTIVE' AND SUBSTR(training_start_date, 1, 4) = ?) AS active_trainings,
      (SELECT COUNT(*) FROM participant_profiles AS profiles JOIN training_cohorts AS c ON c.id = profiles.cohort_id WHERE SUBSTR(c.start_date, 1, 4) = ?) AS participants,
      (SELECT COUNT(*) FROM participant_profiles AS profiles JOIN training_cohorts AS c ON c.id = profiles.cohort_id WHERE profiles.created_at >= datetime('now', 'start of day') AND SUBSTR(c.start_date, 1, 4) = ?) AS participants_today,
      (SELECT COUNT(*) FROM certificates JOIN participant_profiles AS profiles ON profiles.id = certificates.participant_profile_id JOIN training_cohorts AS c ON c.id = profiles.cohort_id WHERE SUBSTR(c.start_date, 1, 4) = ?) AS certificates,
      (SELECT COUNT(*) FROM final_scores WHERE final_score >= passing_score) AS passed,
      (SELECT COUNT(*) FROM final_scores WHERE final_score IS NOT NULL AND final_score < passing_score) AS not_passed`,
    ).bind(yearText, yearText, yearText, yearText, yearText, yearText, yearText).first<Record<string, number>>(),
    context.env.DB.prepare(
      `SELECT event_type, subject, detail, occurred_at FROM (
        SELECT
          'ATTEMPT_STARTED' AS event_type,
          participants.name AS subject,
          sessions.name || ' · ' || batches.batch_name AS detail,
          attempts.started_at AS occurred_at
        FROM attempts
        JOIN participants ON participants.id = attempts.participant_id
        JOIN training_sessions AS sessions ON sessions.id = attempts.training_session_id
        JOIN batches ON batches.id = attempts.batch_id
        WHERE SUBSTR(sessions.training_start_date, 1, 4) = ?

        UNION ALL

        SELECT
          CASE WHEN attempts.score >= sessions.passing_score THEN 'PARTICIPANT_PASSED' ELSE 'ATTEMPT_SUBMITTED' END,
          participants.name,
          sessions.name || ' · ' || batches.batch_name,
          attempts.submitted_at
        FROM attempts
        JOIN participants ON participants.id = attempts.participant_id
        JOIN training_sessions AS sessions ON sessions.id = attempts.training_session_id
        JOIN batches ON batches.id = attempts.batch_id
        WHERE attempts.status = 'SUBMITTED' AND attempts.submitted_at IS NOT NULL
          AND SUBSTR(sessions.training_start_date, 1, 4) = ?

        UNION ALL

        SELECT 'TRAINING_ACTIVATED', name, 'Pelatihan telah diaktifkan', activated_at
        FROM training_sessions
        WHERE activated_at IS NOT NULL AND SUBSTR(training_start_date, 1, 4) = ?
      )
      WHERE occurred_at IS NOT NULL
        AND date(occurred_at, '+7 hours') = date('now', '+7 hours')
      ORDER BY occurred_at DESC
      LIMIT 6`,
    ).bind(yearText, yearText, yearText).all<{ event_type: string; subject: string; detail: string; occurred_at: string }>(),
  ]);
  return context.json({
    year,
    metrics,
    activities: activityResult.results.map((item) => ({
      type: item.event_type,
      subject: item.subject,
      detail: item.detail,
      occurredAt: item.occurred_at,
    })),
  });
});
