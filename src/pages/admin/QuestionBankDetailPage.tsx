import { ArrowUp } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  adminMutation,
  adminQuery,
  adminUpload,
  AdminApiError,
} from "../../features/admin-auth/admin-api";
import type {
  Question,
  QuestionBank,
  QuestionInput,
} from "../../features/question-banks/types";
import { useAutoDismiss } from "../../components/ui/useAutoDismiss";
import { QuestionImportModal } from "./QuestionImportPage";
import { SearchInput } from "../../components/ui/SearchInput";
import { ConfirmDeleteModal } from "../../components/ui/ConfirmDeleteModal";
import { IconActionButton } from "../../components/ui/IconActionButton";
import { ModalPortal } from "../../components/ui/ModalPortal";
import { ADMIN_PAGE_SIZE, Pagination, type PaginationMeta } from "../../components/ui/Pagination";

const emptyQuestion: QuestionInput = {
  questionText: "",
  imageKey: null,
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOptionKey: "A",
};

export function QuestionBankDetailPage() {
  const { bankId = "" } = useParams();
  const navigate = useNavigate();
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionDraft, setQuestionDraft] =
    useState<QuestionInput>(emptyQuestion);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useAutoDismiss(message, setMessage);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: ADMIN_PAGE_SIZE, total: 0, totalPages: 1 });

  const loadDetail = async (requestedPage = page) => {
    const query = new URLSearchParams({ page: String(requestedPage), limit: String(ADMIN_PAGE_SIZE) });
    if (search.trim()) query.set("search", search.trim());
    const payload = await adminQuery<{
      bank: QuestionBank;
      questions: Question[];
      pagination: PaginationMeta;
    }>(`/api/admin/banks/${bankId}?${query}`);
    if (requestedPage > payload.pagination.totalPages) {
      setPage(payload.pagination.totalPages);
      return;
    }
    setBank(payload.bank);
    setQuestions(payload.questions);
    setPagination(payload.pagination);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDetail(page)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Bank Soal tidak dapat dimuat."
        )
      )
      .finally(() => setLoading(false)), 250);
    return () => window.clearTimeout(timer);
  }, [bankId, page, search]);
  useEffect(() => { setPage(1); }, [search]);

  useEffect(() => {
    const updateVisibility = () => setShowScrollTop(window.scrollY >= 480);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  const resetQuestionEditor = () => {
    setEditingQuestionId(null);
    setQuestionDraft(emptyQuestion);
  };

  const handleBankDelete = async () => {
    if (!bank) return;

    setDeleting(true);
    setError(null);

    try {
      await adminMutation(`/api/admin/banks/${bankId}`, {
        method: "DELETE",
      });

      setDeleteConfirmOpen(false);

      navigate("/admin/bank-soal", {
        replace: true,
      });
    } catch (reason) {
      setDeleteConfirmOpen(false);
      setError(
        reason instanceof Error
          ? reason.message
          : "Bank Soal tidak dapat dihapus."
      );
    } finally {
      setDeleting(false);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const form = new FormData();
    form.set("image", file);
    const payload = await adminUpload<{ imageKey: string }>(
      `/api/admin/banks/${bankId}/images`,
      form
    );
    return payload.imageKey;
  };

  const handleQuestionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);

    try {
      const image = form.get("image");
      const imageKey =
        image instanceof File && image.size > 0
          ? await uploadImage(image)
          : questionDraft.imageKey;
      const payload = { ...questionDraft, imageKey };

      if (editingQuestionId) {
        await adminMutation(
          `/api/admin/banks/${bankId}/questions/${editingQuestionId}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
        setMessage("Soal berhasil diperbarui.");
      } else {
        await adminMutation(`/api/admin/banks/${bankId}/questions`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Soal berhasil ditambahkan.");
      }
      resetQuestionEditor();
      setQuestionModalOpen(false);
      setPage(1);
      await loadDetail(1);
    } catch (reason) {
      setError(
        reason instanceof AdminApiError
          ? reason.message
          : "Soal tidak dapat disimpan."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const editQuestion = (question: Question) => {
    setEditingQuestionId(question.id);

    setQuestionDraft({
      questionText: question.questionText,
      imageKey: question.imageKey,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctOptionKey: question.correctOptionKey,
    });

    setQuestionModalOpen(true);
  };

  const removeQuestion = async (question: Question) => {
    setDeleting(true);
    try {
      await adminMutation(
        `/api/admin/banks/${bankId}/questions/${question.id}`,
        {
          method: "DELETE",
        }
      );
      setQuestionToDelete(null);
      await loadDetail(page);
    } catch (reason) {
      setQuestionToDelete(null);
      setError(
        reason instanceof Error ? reason.message : "Soal tidak dapat dihapus."
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p className="muted">Memuat Bank Soal…</p>;
  if (!bank)
    return (
      <p className="form-message is-error">
        {error ?? "Bank Soal tidak ditemukan."}
      </p>
    );

  return (
    <>
      <header className="bank-detail-header">
        <div className="bank-detail-header__main">
          <Link className="back-link" to="/admin/bank-soal">
            ← Bank Soal
          </Link>

          <div className="bank-detail-header__title-row">
            <div>
              <h1>{bank.materialName ?? bank.name}</h1>
              {bank.trainingName && (
                <p className="bank-detail-header__subtitle">
                  Pelatihan: {bank.trainingName}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bank-detail-header__actions">
          <button
            className="button"
            type="button"
            onClick={() => {
              resetQuestionEditor();
              setQuestionModalOpen(true);
            }}
          >
            + Tambah Soal
          </button>

          <button
            type="button"
            className="button button--secondary"
            onClick={() => setImportModalOpen(true)}
          >
            Upload Word
          </button>

        </div>
      </header>

      {error && (
        <p className="form-message is-error" role="alert">
          {error}
        </p>
      )}
      {message && <p className="form-message is-success">{message}</p>}

      <section
        className="panel question-list-panel"
        aria-labelledby="question-list-title"
      >
          <div className="question-list-toolbar">
            <div>
              <p className="section-label">Daftar soal</p>
              <h2 id="question-list-title">{pagination.total} soal</h2>
            </div>

            <label className="search-field">
              <span>Cari soal</span>
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="Ketik pertanyaan atau jawaban"
              />
            </label>
          </div>

          {questions.length === 0 ? (
            <div className="empty-state empty-state--bank">
              <div className="empty-state__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M6 3h9l3 3v15H6z" />
                  <path d="M15 3v4h4" />
                  <path d="M9 12h6M12 9v6" />
                </svg>
              </div>

              <div className="empty-state__copy">
                <strong>Belum ada soal</strong>
                <p>
                  Tambahkan soal pertama untuk mulai mengisi Bank Soal ini.
                  Anda juga bisa menggunakan Upload Word dari bagian atas.
                </p>
              </div>

              <button
                className="button"
                type="button"
                onClick={() => {
                  resetQuestionEditor();
                  setQuestionModalOpen(true);
                }}
              >
                + Tambah Soal
              </button>
            </div>
          ) : (
            <div className="question-list">
              {questions.map((question, index) => (
                <article className="question-card" key={question.id}>
                  <div className="question-card__header">
                    <strong>Soal {(pagination.page - 1) * pagination.limit + index + 1}</strong>
                  </div>

                  <p className="question-card__text">{question.questionText}</p>

                  {question.imageKey && (
                    <img
                      className="question-card__image"
                      src={`/api/admin/banks/image?key=${encodeURIComponent(
                        question.imageKey
                      )}`}
                      alt="Gambar pertanyaan"
                      loading="lazy"
                    />
                  )}

                  <ol className="option-list">
                    {(["A", "B", "C", "D"] as const).map((key) => (
                      <li
                        className={
                          question.correctOptionKey === key ? "is-correct" : ""
                        }
                        key={key}
                      >
                        <strong>{key}.</strong>{" "}
                        {question[`option${key}` as const]}
                      </li>
                    ))}
                  </ol>

                  <div className="question-card__footer">
                    <span>Digunakan {question.timesAssigned} kali</span>

                    <div className="row-actions">
                      <IconActionButton action="edit" label={`Edit Pertanyaan ${question.questionText}`} onClick={() => editQuestion(question)} />
                      <IconActionButton action="delete" label={`Hapus Pertanyaan ${question.questionText}`} onClick={() => setQuestionToDelete(question)} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <Pagination pagination={pagination} itemLabel="soal" loading={loading} onPageChange={setPage} />
      </section>

      <section className="panel danger-zone bank-danger-zone" aria-labelledby="bank-danger-title">
        <div>
          <p className="section-label">Zona Berbahaya</p>
          <h2 id="bank-danger-title">Hapus Bank Soal</h2>
          <p>Bank Soal hanya dapat dihapus jika belum berisi soal dan belum digunakan oleh pelaksanaan atau paket Test.</p>
        </div>
        <button
          className="button danger-button"
          type="button"
          onClick={() => setDeleteConfirmOpen(true)}
        >
          Hapus Bank Soal
        </button>
      </section>
      {showScrollTop && <button
        type="button"
        className="bank-scroll-top"
        aria-label="Kembali ke atas"
        title="Kembali ke atas"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      ><ArrowUp aria-hidden="true" /></button>}
      <ConfirmDeleteModal
        open={deleteConfirmOpen}
        title="Hapus Bank Soal?"
        itemName={bank.materialName ?? bank.name}
        description="Bank Soal hanya dapat dihapus jika belum berisi soal dan belum digunakan oleh pelaksanaan Test. Tindakan ini tidak dapat dibatalkan."
        busy={deleting}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => void handleBankDelete()}
      />

      <ConfirmDeleteModal
        open={Boolean(questionToDelete)}
        title="Hapus Soal?"
        itemName={questionToDelete?.questionText}
        description="Soal hanya dapat dihapus jika belum pernah digunakan. Tindakan ini tidak dapat dibatalkan."
        busy={deleting}
        onCancel={() => setQuestionToDelete(null)}
        onConfirm={() => {
          if (questionToDelete) void removeQuestion(questionToDelete);
        }}
      />

      {questionModalOpen &&
          <ModalPortal
            blocked={submitting}
            onClose={() => {
              setQuestionModalOpen(false);
              resetQuestionEditor();
            }}
          >
            <section
              className="participant-modal question-editor-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="question-editor-title"
            >
              <header className="participant-modal__header">
                <div>
                  <p className="section-label">Bank Soal</p>

                  <h2 id="question-editor-title">
                    {editingQuestionId ? "Edit Soal" : "Tambah Soal"}
                  </h2>

                  <p>
                    {editingQuestionId
                      ? "Perbarui isi soal dan jawabannya."
                      : "Tambahkan satu soal baru ke Bank Soal ini."}
                  </p>
                </div>

                <button
                  type="button"
                  className="participant-modal__close"
                  aria-label="Tutup"
                  disabled={submitting}
                  onClick={() => {
                    setQuestionModalOpen(false);
                    resetQuestionEditor();
                  }}
                >
                  ×
                </button>
              </header>

              <form
                className="participant-modal__form form-stack"
                onSubmit={(event) => void handleQuestionSubmit(event)}
              >
                <label>
                  Pertanyaan
                  <textarea
                    rows={4}
                    required
                    value={questionDraft.questionText}
                    onChange={(event) =>
                      setQuestionDraft((current) => ({
                        ...current,
                        questionText: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Gambar pertanyaan (opsional)
                  <input
                    name="image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                  />
                  <small>JPG, PNG, atau WebP. Maksimal 5 MB.</small>
                </label>

                {questionDraft.imageKey && (
                  <img
                    className="question-image-preview"
                    src={`/api/admin/banks/image?key=${encodeURIComponent(
                      questionDraft.imageKey
                    )}`}
                    alt="Gambar soal saat ini"
                  />
                )}

                {(["A", "B", "C", "D"] as const).map((key) => {
                  const field = `option${key}` as const;

                  return (
                    <label key={key}>
                      Pilihan {key}
                      <textarea
                        rows={2}
                        required
                        value={questionDraft[field]}
                        onChange={(event) =>
                          setQuestionDraft((current) => ({
                            ...current,
                            [field]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  );
                })}

                <label>
                  Kunci jawaban
                  <select
                    value={questionDraft.correctOptionKey}
                    onChange={(event) =>
                      setQuestionDraft((current) => ({
                        ...current,
                        correctOptionKey: event.target
                          .value as QuestionInput["correctOptionKey"],
                      }))
                    }
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </label>

                <footer className="participant-modal__actions">
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={submitting}
                    onClick={() => {
                      setQuestionModalOpen(false);
                      resetQuestionEditor();
                    }}
                  >
                    Batal
                  </button>

                  <button
                    className="button"
                    type="submit"
                    disabled={submitting}
                  >
                    {submitting
                      ? "Menyimpan…"
                      : editingQuestionId
                      ? "Simpan Perubahan"
                      : "Tambah Soal"}
                  </button>
                </footer>
              </form>
            </section>
          </ModalPortal>}
      {importModalOpen && <QuestionImportModal
        bankId={bankId}
        onClose={() => setImportModalOpen(false)}
        onImported={async (count) => {
          setPage(1);
          await loadDetail(1);
          setMessage(`${count} soal berhasil diimport.`);
          setImportModalOpen(false);
        }}
      />}
    </>
  );
}
