import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, ClipboardList, RefreshCcw, Trash2, X } from "lucide-react";
import { ConfirmDeleteModal } from "../../components/ui/ConfirmDeleteModal";
import { ModalPortal } from "../../components/ui/ModalPortal";
import {
  adminMutation,
  adminQuery,
  AdminApiError,
} from "../../features/admin-auth/admin-api";
import { ADMIN_PAGE_SIZE, Pagination, type PaginationMeta } from "../../components/ui/Pagination";

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
  canDelete: boolean;
  deleteBlockedReason: string | null;
};

type LifecycleTarget = {
  action: "archive" | "reactivate";
  template: SurveyTemplateSummary;
};

function statusLabel(status: SurveyTemplateSummary["status"]) {
  if (status === "PUBLISHED") return "Published";
  if (status === "DRAFT") return "Draft";
  return "Archived";
}

export function SurveyTemplateListPage({
  embedded = false,
  onTemplatesChanged,
}: {
  embedded?: boolean;
  onTemplatesChanged?: () => Promise<void> | void;
}) {
  const [templates, setTemplates] = useState<SurveyTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SurveyTemplateSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lifecycleTarget, setLifecycleTarget] = useState<LifecycleTarget | null>(null);
  const [updatingLifecycle, setUpdatingLifecycle] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: ADMIN_PAGE_SIZE, total: 0, totalPages: 1 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await adminQuery<{ templates: SurveyTemplateSummary[]; pagination: PaginationMeta }>(
      `/api/admin/survey-templates?page=${page}&limit=${ADMIN_PAGE_SIZE}`
      );
      if (page > payload.pagination.totalPages) { setPage(payload.pagination.totalPages); return; }
      setTemplates(payload.templates);
      setPagination(payload.pagination);
      setError(null);
    } catch (reason) {
      setError(reason instanceof AdminApiError ? reason.message : "Template evaluasi tidak dapat dimuat.");
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  async function deleteTemplate() {
    if (!deleteTarget) return;
    setDeleting(true); setError(null); setNotice(null);
    try {
      await adminMutation(`/api/admin/survey-templates/${deleteTarget.id}`, { method: "DELETE" });
      setNotice(`Template Evaluasi versi ${deleteTarget.version} berhasil dihapus.`);
      setDeleteTarget(null);
      await load();
      await onTemplatesChanged?.();
    } catch (reason) {
      setError(reason instanceof AdminApiError ? reason.message : "Template Evaluasi tidak dapat dihapus.");
      setDeleteTarget(null);
    } finally { setDeleting(false); }
  }

  async function updateLifecycle() {
    if (!lifecycleTarget) return;
    const { action, template } = lifecycleTarget;
    setUpdatingLifecycle(true);
    setError(null);
    setNotice(null);
    try {
      await adminMutation(`/api/admin/survey-templates/${template.id}/${action}`, {
        method: "POST",
      });
      setNotice(
        action === "archive"
          ? `Template Evaluasi versi ${template.version} berhasil di-Archive.`
          : `Template Evaluasi versi ${template.version} berhasil diaktifkan kembali.`,
      );
      setLifecycleTarget(null);
      await load();
      await onTemplatesChanged?.();
    } catch (reason) {
      setError(
        reason instanceof AdminApiError
          ? reason.message
          : action === "archive"
            ? "Template Evaluasi tidak dapat di-Archive."
            : "Template Evaluasi tidak dapat diaktifkan kembali.",
      );
      setLifecycleTarget(null);
    } finally {
      setUpdatingLifecycle(false);
    }
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
      {notice && (
        <p className="form-message is-success" role="status">
          {notice}
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
            {templates.map((template) => {
              const templateStatus = String(template.status).trim().toUpperCase();
              return (
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
                    {!template.canDelete && template.deleteBlockedReason && (
                      <small className="muted">{template.deleteBlockedReason}</small>
                    )}
                  </div>

                  <div className="button-row">
                    <span
                      className={
                        templateStatus === "PUBLISHED"
                          ? "status-badge is-active"
                          : "status-badge"
                      }
                    >
                      {statusLabel(templateStatus as SurveyTemplateSummary["status"])}
                    </span>

                    {templateStatus === "PUBLISHED" && (
                      <button
                        type="button"
                        className="button button--secondary button--small"
                        onClick={() => setLifecycleTarget({ action: "archive", template })}
                      >
                        <Archive aria-hidden="true" /> Archive
                      </button>
                    )}
                    {templateStatus === "ARCHIVED" && (
                      <button
                        type="button"
                        className="button button--secondary button--small"
                        onClick={() => setLifecycleTarget({ action: "reactivate", template })}
                      >
                        <RefreshCcw aria-hidden="true" /> Aktifkan Kembali
                      </button>
                    )}
                    <Link
                      className="button button--secondary"
                      to={`/admin/evaluasi/template/${template.id}`}
                    >
                      Lihat Template
                    </Link>
                    {template.canDelete && (
                      <button
                        type="button"
                        className="text-button is-danger"
                        aria-label={`Hapus Template Evaluasi versi ${template.version} ${template.name}`}
                        title="Hapus Template"
                        onClick={() => setDeleteTarget(template)}
                      >
                        <Trash2 aria-hidden="true" /> Hapus
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <Pagination pagination={pagination} itemLabel="template evaluasi" loading={loading} onPageChange={setPage} />
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Hapus Template Evaluasi?"
        description={deleteTarget ? <><p><strong>{deleteTarget.name}</strong></p><p>Versi {deleteTarget.version}</p><p>Template ini belum pernah digunakan dan akan dihapus permanen.</p></> : undefined}
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void deleteTemplate()}
      />
      {lifecycleTarget && (
        <ModalPortal
          onClose={() => setLifecycleTarget(null)}
          blocked={updatingLifecycle}
        >
          <section
            className="participant-modal delete-confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="template-lifecycle-confirm-title"
          >
            <header className="participant-modal__header">
              <div>
                <p className="section-label">Konfirmasi</p>
                <h2 id="template-lifecycle-confirm-title">
                  {lifecycleTarget.action === "archive"
                    ? "Archive Template Evaluasi?"
                    : "Aktifkan Kembali Template?"}
                </h2>
              </div>
              <button
                type="button"
                className="participant-modal__close"
                aria-label="Tutup konfirmasi"
                disabled={updatingLifecycle}
                onClick={() => setLifecycleTarget(null)}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="participant-modal__body">
              <p><strong>{lifecycleTarget.template.name}</strong></p>
              <p>Versi {lifecycleTarget.template.version}</p>
              <p>
                {lifecycleTarget.action === "archive"
                  ? "Template tidak akan tersedia untuk Pelaksanaan Evaluasi baru. Campaign dan hasil lama tetap tersimpan."
                  : "Template akan kembali tersedia untuk Pelaksanaan Evaluasi baru."}
              </p>
            </div>
            <footer className="participant-modal__actions">
              <button
                type="button"
                className="button button--secondary"
                disabled={updatingLifecycle}
                onClick={() => setLifecycleTarget(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="button"
                disabled={updatingLifecycle}
                onClick={() => void updateLifecycle()}
              >
                {updatingLifecycle
                  ? "Menyimpan…"
                  : lifecycleTarget.action === "archive"
                    ? "Archive"
                    : "Aktifkan"}
              </button>
            </footer>
          </section>
        </ModalPortal>
      )}
    </>
  );
}
