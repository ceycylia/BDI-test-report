import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { HttpError } from "./http/errors";
import { adminRoutes } from "./routes/admin/admin-routes";
import { authRoutes } from "./routes/admin/auth-routes";
import { questionBankRoutes } from "./routes/admin/question-bank-routes";
import { trainingRoutes } from "./routes/admin/training-routes";
import { trainingEntryRoutes } from "./routes/public/training-entry-routes";
import { attemptRoutes } from "./routes/public/attempt-routes";
import { resultRoutes } from "./routes/admin/result-routes";
import { dashboardRoutes } from "./routes/admin/dashboard-routes";
import { participantAdminRoutes } from "./routes/admin/participant-admin-routes";
import { surveyTemplateRoutes } from "./routes/admin/survey-template-routes";
import type { AppEnvironment } from "./types";

export const app = new Hono<AppEnvironment>();

app.use("*", secureHeaders());
app.use("*", async (context, next) => {
  const requestId = crypto.randomUUID();
  context.header("X-Request-Id", requestId);
  await next();
});

app.get("/api/health", (context) =>
  context.json({
    status: "ok",
    service: "bdi-test-report",
    timestamp: new Date().toISOString(),
  }),
);

app.route("/api/admin", authRoutes);
app.route("/api/admin/admins", adminRoutes);
app.route("/api/admin/banks", questionBankRoutes);
app.route("/api/admin/training", trainingRoutes);
app.route("/api/admin/results", resultRoutes);
app.route("/api/admin/dashboard", dashboardRoutes);
app.route("/api/admin/participants", participantAdminRoutes);
app.route("/api/public/training", trainingEntryRoutes);
app.route("/api/public/training/:slug/attempts", attemptRoutes);

app.route("/api/admin/survey-templates", surveyTemplateRoutes);

app.notFound((context) =>
  context.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "Endpoint tidak ditemukan.",
      },
    },
    404,
  ),
);

app.onError((error, context) => {
  if (error instanceof HttpError) {
    return context.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      error.status,
    );
  }

  const errorId = crypto.randomUUID();
  const pathname = new URL(context.req.url).pathname;

  console.error(
    JSON.stringify({
      event: "request_error",
      errorId,
      method: context.req.method,
      pathname,
      message: error.message,
    }),
  );

  return context.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi gangguan pada sistem. Silakan coba kembali.",
        errorId,
      },
    },
    500,
  );
});

export default app;
