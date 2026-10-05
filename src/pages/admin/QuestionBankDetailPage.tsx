import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { createPortal } from "react-dom";

const emptyQuestion: QuestionInput = {
  questionText: "",
  imageKey: null,
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOptionKey: "A",
  isActive: true,
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
  const [questionModalOpen, setQuestionModalOpen] = useState(false);

  const loadDetail = async () => {
    const payload = await adminQuery<{
      bank: QuestionBank;
      questions: Question[];
    }>(`/api/admin/banks/${bankId}`);
    setBank(payload.bank);
    setQuestions(payload.questions);
  };

  useEffect(() => {
    void loadDetail()
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Bank Soal tidak dapat dimuat."
        )
      )
      .finally(() => setLoading(false));
  }, [bankId]);

  const filteredQuestions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return questions;
    return questions.filter((question) =>
      [
        question.questionText,
        question.optionA,
        question.optionB,
        question.optionC,
        question.optionD,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [questions, search]);

  const resetQuestionEditor = () => {
    setEditingQuestionId(null);
    setQuestionDraft(emptyQuestion);
  };

  const handleBankUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!bank) return;

    const form = new FormData(event.currentTarget);

    setSubmitting(true);
    setError(null);

    try {
      await adminMutation(`/api/admin/banks/${bankId}`, {
        method: "PUT",
        body: JSON.stringify({
          isActive: form.get("isActive") === "on",
        }),
      });

      await loadDetail();
      setMessage("Bank Soal berhasil diperbarui.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Bank Soal tidak dapat diperbarui."
      );
    } finally {
      setSubmitting(false);
    }
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
      await loadDetail();
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
      isActive: question.isActive,
    });

    setQuestionModalOpen(true);
  };

  const toggleQuestion = async (question: Question) => {
    setError(null);
    try {
      await adminMutation(
        `/api/admin/banks/${bankId}/questions/${question.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            questionText: question.questionText,
            imageKey: question.imageKey,
            optionA: question.optionA,
            optionB: question.optionB,
            optionC: question.optionC,
            optionD: question.optionD,
            correctOptionKey: question.correctOptionKey,
            isActive: !question.isActive,
          }),
        }
      );
      await loadDetail();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Status soal tidak dapat diubah."
      );
    }
  };

  const removeQuestion = async (question: Question) => {
    if (
      !window.confirm(
        "Hapus soal ini? Tindakan ini hanya dapat dilakukan jika soal belum digunakan."
      )
    )
      return;
    try {
      await adminMutation(
        `/api/admin/banks/${bankId}/questions/${question.id}`,
        {
          method: "DELETE",
        }
      );
      await loadDetail();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Soal tidak dapat dihapus."
      );
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
              <h1>{bank.name}</h1>
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

          <Link
            className="button button--secondary"
            to={`/admin/bank-soal/${bankId}/import`}
          >
            Upload Word
          </Link>

          <span
            className={
              bank.isActive ? "status-badge is-active" : "status-badge"
            }
          >
            {bank.isActive ? "Aktif" : "Nonaktif"}
          </span>
        </div>
      </header>

      {error && (
        <p className="form-message is-error" role="alert">
          {error}
        </p>
      )}
      {message && <p className="form-message is-success">{message}</p>}

      <div className="bank-detail-grid">
        <section
          className="panel question-list-panel"
          aria-labelledby="question-list-title"
        >
          <div className="question-list-toolbar">
            <div>
              <p className="section-label">Daftar soal</p>
              <h2 id="question-list-title">{questions.length} soal</h2>
            </div>

            <label className="search-field">
              <span>Cari soal</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ketik pertanyaan atau jawaban"
              />
            </label>
          </div>

          {filteredQuestions.length === 0 ? (
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
              {filteredQuestions.map((question, index) => (
                <article className="question-card" key={question.id}>
                  <div className="question-card__header">
                    <strong>Soal {index + 1}</strong>

                    <span
                      className={
                        question.isActive
                          ? "status-badge is-active"
                          : "status-badge"
                      }
                    >
                      {question.isActive ? "Aktif" : "Nonaktif"}
                    </span>
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

                    <div className="button-row">
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => editQuestion(question)}
                      >
                        Edit
                      </button>

                      <button
                        className="text-button"
                        type="button"
                        onClick={() => void toggleQuestion(question)}
                      >
                        {question.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>

                      <button
                        className="text-button is-danger"
                        type="button"
                        onClick={() => void removeQuestion(question)}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="bank-sidebar">
          <section
            className="panel bank-settings-panel"
            aria-labelledby="bank-settings-title"
          >
            <div className="panel-header">
              <h2 id="bank-settings-title">Pengaturan Bank Soal</h2>
              <p>Kelola status dan tindakan untuk bank soal ini.</p>
            </div>

            <form
              className="form-stack"
              onSubmit={(event) => void handleBankUpdate(event)}
            >
              <label className="checkbox-card">
                <input
                  name="isActive"
                  type="checkbox"
                  defaultChecked={bank.isActive}
                />
                <div>
                  <strong>Bank Soal aktif</strong>
                  <small>
                    Soal dari bank ini dapat digunakan dalam pengelolaan tes.
                  </small>
                </div>
              </label>

              <div className="sidebar-actions">
                <button className="button button--secondary" type="submit">
                  Simpan
                </button>

                <button
                  className="danger-button"
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  Hapus Bank Soal
                </button>
              </div>
            </form>
          </section>
        </aside>
      </div>
      {deleteConfirmOpen &&
        createPortal(
          <div
            className="modal-backdrop participant-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !deleting) {
                setDeleteConfirmOpen(false);
              }
            }}
          >
            <section
              className="participant-modal delete-confirm-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-bank-title"
            >
              <header className="participant-modal__header">
                <div>
                  <p className="section-label">Konfirmasi</p>

                  <h2 id="delete-bank-title">Hapus Bank Soal?</h2>

                  <p>
                    Bank Soal <strong>{bank?.name}</strong> akan dihapus.
                  </p>
                </div>

                <button
                  type="button"
                  className="participant-modal__close"
                  aria-label="Tutup"
                  disabled={deleting}
                  onClick={() => setDeleteConfirmOpen(false)}
                >
                  ×
                </button>
              </header>

              <div className="participant-modal__body">
                <p>Tindakan ini tidak dapat dibatalkan.</p>
              </div>

              <footer className="participant-modal__actions">
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={deleting}
                  onClick={() => setDeleteConfirmOpen(false)}
                >
                  Batal
                </button>

                <button
                  type="button"
                  className="danger-button"
                  disabled={deleting}
                  onClick={() => void handleBankDelete()}
                >
                  {deleting ? "Menghapus…" : "Ya, Hapus Bank Soal"}
                </button>
              </footer>
            </section>
          </div>,
          document.body
        )}

      {questionModalOpen &&
        createPortal(
          <div
            className="modal-backdrop participant-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !submitting) {
                setQuestionModalOpen(false);
                resetQuestionEditor();
              }
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

                {editingQuestionId && (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={questionDraft.isActive}
                      onChange={(event) =>
                        setQuestionDraft((current) => ({
                          ...current,
                          isActive: event.target.checked,
                        }))
                      }
                    />
                    Soal aktif
                  </label>
                )}

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
          </div>,
          document.body
        )}
    </>
  );
}
