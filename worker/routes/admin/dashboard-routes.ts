import { Hono } from "hono";
import { requireAdmin } from "../../middleware/admin-auth";
import type { AppEnvironment } from "../../types";

export const dashboardRoutes = new Hono<AppEnvironment>();
dashboardRoutes.use("*", requireAdmin);

dashboardRoutes.get("/", async (context) => {
  const [metrics, activityResult] = await Promise.all([
    context.env.DB.prepare(
    `WITH final_scores AS (
      SELECT participants.id, sessions.passing_score,
        MAX(CASE WHEN attempts.stage <> 'PRE' AND attempts.status = 'SUBMITTED' THEN attempts.score END) AS final_score
      FROM participants JOIN batches ON batches.id = participants.batch_id
      JOIN training_sessions AS sessions ON sessions.id = batches.training_session_id
      LEFT JOIN attempts ON attempts.participant_id = participants.id AND attempts.status <> 'RESET'
      GROUP BY participants.id
    ) SELECT
      (SELECT COUNT(*) FROM question_banks) AS banks,
      (SELECT COUNT(*) FROM questions) AS questions,
      (SELECT COUNT(*) FROM training_sessions WHERE status = 'ACTIVE') AS active_trainings,
      (SELECT COUNT(*) FROM participants WHERE created_at >= datetime('now', 'start of day')) AS participants_today,
      (SELECT COUNT(*) FROM final_scores WHERE final_score >= passing_score) AS passed,
      (SELECT COUNT(*) FROM final_scores WHERE final_score IS NOT NULL AND final_score < passing_score) AS not_passed`,
    ).first<Record<string, number>>(),
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

        UNION ALL

        SELECT 'TRAINING_ACTIVATED', name, 'Pelatihan telah diaktifkan', activated_at
        FROM training_sessions
        WHERE activated_at IS NOT NULL

        UNION ALL

        SELECT 'BANK_UPDATED', name, 'Bank soal diperbarui', updated_at
        FROM question_banks
        WHERE updated_at > created_at
      )
      WHERE occurred_at IS NOT NULL
      ORDER BY occurred_at DESC
      LIMIT 6`,
    ).all<{ event_type: string; subject: string; detail: string; occurred_at: string }>(),
  ]);
  return context.json({
    metrics,
    activities: activityResult.results.map((item) => ({
      type: item.event_type,
      subject: item.subject,
      detail: item.detail,
      occurredAt: item.occurred_at,
    })),
  });
});
