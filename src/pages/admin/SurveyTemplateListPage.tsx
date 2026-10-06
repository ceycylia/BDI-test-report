import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import {
  adminQuery,
  AdminApiError,
} from "../../features/admin-auth/admin-api";

type SurveyTemplateSummary = {
  id: string;
  name: string;
  version: number;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isActive: boolean;
  publishedAt: string | null;
  sourceTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
  sectionCount: number;
  questionCount: number;
  campaignCount: number;
};

function statusLabel(status: SurveyTemplateSummary["status"]) {
  if (status === "PUBLISHED") return "Published";
  if (status === "DRAFT") return "Draft";
  return "Archived";
}

export function SurveyTemplateListPage() {
  const [templates, setTemplates] = useState<SurveyTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void adminQuery<{ templates: SurveyTemplateSummary[] }>(
      "/api/admin/survey-templates"
    )
      .then((payload) => {
        setTemplates(payload.templates);
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof AdminApiError
            ? reason.message
            : "Template evaluasi tidak dapat dimuat."
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p className="muted">Memuat template evaluasi…</p>;
  }

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="section-label">Evaluasi Pelatihan</p>
          <h1>Template Survey</h1>
          <p className="muted">
            Kelola questionnaire evaluasi yang digunakan peserta setelah
            menyelesaikan rangkaian tes.
          </p>
        </div>
      </header>

      {error && (
        <p className="form-message is-error" role="alert">
          {error}
        </p>
      )}

      <section className="panel">
        {templates.length === 0 ? (
          <div className="empty-state">
            <ClipboardList aria-hidden="true" />
            <strong>Belum ada template evaluasi</strong>
            <p>Template Survey belum tersedia.</p>
          </div>
        ) : (
          <div className="entity-list">
            {templates.map((template) => (
              <article key={template.id}>
                <div>
                  <strong>{template.name}</strong>

                  <small>
                    Versi {template.version} · {template.sectionCount} bagian ·{" "}
                    {template.questionCount} pertanyaan
                  </small>

                  <small>
                    Digunakan pada {template.campaignCount} pelaksanaan survey
                  </small>
                </div>

                <div className="button-row">
                  <span
                    className={
                      template.status === "PUBLISHED"
                        ? "status-badge is-active"
                        : "status-badge"
                    }
                  >
                    {statusLabel(template.status)}
                  </span>

                  <Link
                    className="button button--secondary"
                    to={`/admin/evaluasi/${template.id}`}
                  >
                    Lihat Template
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}