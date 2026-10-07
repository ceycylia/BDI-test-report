import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Trash2 } from "lucide-react";
import { ConfirmDeleteModal } from "../../components/ui/ConfirmDeleteModal";
import {
  adminMutation,
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

export function SurveyTemplateListPage({ embedded = false }: { embedded?: boolean }) {
  const [templates, setTemplates] = useState<SurveyTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SurveyTemplateSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await adminQuery<{ templates: SurveyTemplateSummary[] }>(
      "/api/admin/survey-templates"
      );
      setTemplates(payload.templates);
      setError(null);
    } catch (reason) {
      setError(reason instanceof AdminApiError ? reason.message : "Template evaluasi tidak dapat dimuat.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function deleteDraft() {
    if (!deleteTarget) return;
    setDeleting(true); setError(null);
    try {
      await adminMutation(`/api/admin/survey-templates/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await load();
    } catch (reason) {
      setError(reason instanceof AdminApiError ? reason.message : "Draft Template Evaluasi tidak dapat dihapus.");
      setDeleteTarget(null);
    } finally { setDeleting(false); }
  }

  if (loading) {
    return <p className="muted">Memuat template evaluasi…</p>;
  }

  return (
    <>
      {!embedded && <header className="admin-page-header">
        <div>
          <p className="section-label">Evaluasi Pelatihan</p>
          <h1>Template Evaluasi</h1>
          <p className="muted">
            Kelola questionnaire evaluasi yang digunakan peserta setelah
            menyelesaikan rangkaian tes.
          </p>
        </div>
      </header>}

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
                    Digunakan pada {template.campaignCount} Pelaksanaan Evaluasi
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
                    to={`/admin/evaluasi/template/${template.id}`}
                  >
                    Lihat Template
                  </Link>
                  {template.status === "DRAFT" && template.campaignCount === 0 && (
                    <button
                      type="button"
                      className="icon-button is-danger"
                      aria-label={`Hapus Draft versi ${template.version} ${template.name}`}
                      title="Hapus Draft"
                      onClick={() => setDeleteTarget(template)}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Hapus Template Evaluasi?"
        description={deleteTarget ? <>Draft versi {deleteTarget.version} dari <strong>{deleteTarget.name}</strong> akan dihapus. Tindakan ini tidak dapat dibatalkan.</> : undefined}
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void deleteDraft()}
      />
    </>
  );
}
