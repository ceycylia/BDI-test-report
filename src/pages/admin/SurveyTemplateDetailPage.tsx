import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  adminMutation,
  adminQuery,
  AdminApiError,
} from "../../features/admin-auth/admin-api";


type SurveyQuestionType =
  | "SINGLE_CHOICE"
  | "SCALE"
  | "LONG_TEXT";


type SurveyOption = {
  id: string;
  value: string;
  label: string;
  allowsOtherText: boolean;
  sortOrder: number;
};


type SurveyQuestion = {
  id: string;
  questionText: string;
  questionType: SurveyQuestionType;
  isRequired: boolean;
  sortOrder: number;

  scaleMin: number | null;
  scaleMax: number | null;
  scaleMinLabel: string | null;
  scaleMaxLabel: string | null;

  helperText: string | null;
  options: SurveyOption[];

  createdAt: string;
  updatedAt: string;
};


type SurveySection = {
  id: string;
  sectionCode: string;
  title: string;
  description: string | null;
  sortOrder: number;
  questions: SurveyQuestion[];
  createdAt: string;
  updatedAt: string;
};


type SurveyTemplate = {
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

  sections: SurveySection[];
};


type SectionDraft = {
  title: string;
  description: string;
};


type QuestionOptionDraft = {
  label: string;
  allowsOtherText: boolean;
};


type QuestionDraft = {
  questionText: string;
  questionType: SurveyQuestionType;

  helperText: string;

  scaleMin: number | null;
  scaleMax: number | null;

  scaleMinLabel: string;
  scaleMaxLabel: string;

  options: QuestionOptionDraft[];
};


type DeleteTarget =
  | {
      type: "SECTION";
      id: string;
      label: string;
    }
  | {
      type: "QUESTION";
      id: string;
      label: string;
    };


const emptySectionDraft: SectionDraft = {
  title: "",
  description: "",
};


const emptyQuestionDraft: QuestionDraft = {
  questionText: "",
  questionType: "SCALE",

  helperText: "",

  scaleMin: 1,
  scaleMax: 4,

  scaleMinLabel: "",
  scaleMaxLabel: "",

  options: [],
};


function questionTypeLabel(type: SurveyQuestionType) {
  if (type === "SCALE") {
    return "Skala";
  }

  if (type === "SINGLE_CHOICE") {
    return "Pilihan tunggal";
  }

  return "Jawaban panjang";
}


function statusLabel(
  status: SurveyTemplate["status"]
) {
  if (status === "PUBLISHED") {
    return "Published";
  }

  if (status === "DRAFT") {
    return "Draft";
  }

  return "Archived";
}


export function SurveyTemplateDetailPage() {
  const { templateId } = useParams();
  const navigate = useNavigate();

  const [template, setTemplate] =
    useState<SurveyTemplate | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [creatingVersion, setCreatingVersion] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [publishing, setPublishing] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);


  // =====================================================
  // SECTION EDITOR
  // =====================================================

  const [sectionModalOpen, setSectionModalOpen] =
    useState(false);

  const [editingSection, setEditingSection] =
    useState<SurveySection | null>(null);

  const [sectionDraft, setSectionDraft] =
    useState<SectionDraft>(
      emptySectionDraft
    );


  // =====================================================
  // QUESTION EDITOR
  // =====================================================

  const [questionModalOpen, setQuestionModalOpen] =
    useState(false);

  const [questionSectionId, setQuestionSectionId] =
    useState<string | null>(null);

  const [editingQuestion, setEditingQuestion] =
    useState<SurveyQuestion | null>(null);

  const [questionDraft, setQuestionDraft] =
    useState<QuestionDraft>(
      emptyQuestionDraft
    );


  // =====================================================
  // OTHER MODALS
  // =====================================================

  const [deleteTarget, setDeleteTarget] =
    useState<DeleteTarget | null>(null);

  const [publishConfirmOpen, setPublishConfirmOpen] =
    useState(false);

  const isDraft =
    template?.status === "DRAFT";


  const questionCount = useMemo(
    () =>
      template?.sections.reduce(
        (total, section) =>
          total + section.questions.length,
        0
      ) ?? 0,
    [template]
  );


  // =====================================================
  // LOAD
  // =====================================================

  const loadTemplate = async () => {
    if (!templateId) {
      return;
    }

    const payload = await adminQuery<{
      template: SurveyTemplate;
    }>(
      `/api/admin/survey-templates/${templateId}`
    );

    setTemplate(payload.template);
  };


  const refreshTemplate = async () => {
    try {
      await loadTemplate();
    } catch (reason) {
      setError(
        reason instanceof AdminApiError
          ? reason.message
          : "Template evaluasi tidak dapat dimuat."
      );
    }
  };


  useEffect(() => {
    if (!templateId) {
      setError(
        "ID template evaluasi tidak tersedia."
      );

      setLoading(false);
      return;
    }

    void loadTemplate()
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
  }, [templateId]);


  // =====================================================
  // CREATE VERSION
  // =====================================================

  const createNewVersion = async () => {
    if (!template) {
      return;
    }

    setCreatingVersion(true);
    setError(null);
    setMessage(null);

    try {
      const payload = await adminMutation<{
        template: {
          id: string;
          version: number;
        };
      }>(
        `/api/admin/survey-templates/${template.id}/new-version`,
        {
          method: "POST",
        }
      );

      navigate(
        `/admin/evaluasi/template/${payload.template.id}`
      );
    } catch (reason) {
      setError(
        reason instanceof AdminApiError
          ? reason.message
          : "Versi baru tidak dapat dibuat."
      );
    } finally {
      setCreatingVersion(false);
    }
  };


  // =====================================================
  // SECTION EDITOR
  // =====================================================

  const openNewSection = () => {
    setEditingSection(null);

    setSectionDraft({
      ...emptySectionDraft,
    });

    setSectionModalOpen(true);
  };


  const openEditSection = (
    section: SurveySection
  ) => {
    setEditingSection(section);

    setSectionDraft({
      title: section.title,
      description:
        section.description ?? "",
    });

    setSectionModalOpen(true);
  };


  const closeSectionEditor = () => {
    setSectionModalOpen(false);
    setEditingSection(null);

    setSectionDraft({
      ...emptySectionDraft,
    });
  };


  const handleSectionSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!template || !isDraft) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        title: sectionDraft.title,
        description:
          sectionDraft.description.trim()
            ? sectionDraft.description
            : null,
      };

      if (editingSection) {
        await adminMutation(
          `/api/admin/survey-templates/${template.id}/sections/${editingSection.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        setMessage(
          "Bagian Survey berhasil diperbarui."
        );
      } else {
        await adminMutation(
          `/api/admin/survey-templates/${template.id}/sections`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        setMessage(
          "Bagian Survey berhasil ditambahkan."
        );
      }

      closeSectionEditor();

      await refreshTemplate();
    } catch (reason) {
      setError(
        reason instanceof AdminApiError
          ? reason.message
          : "Bagian Survey tidak dapat disimpan."
      );
    } finally {
      setSaving(false);
    }
  };


  // =====================================================
  // QUESTION EDITOR
  // =====================================================

  const openNewQuestion = (
    sectionId: string
  ) => {
    setEditingQuestion(null);
    setQuestionSectionId(sectionId);

    setQuestionDraft({
      ...emptyQuestionDraft,
      options: [],
    });

    setQuestionModalOpen(true);
  };


  const openEditQuestion = (
    sectionId: string,
    question: SurveyQuestion
  ) => {
    setQuestionSectionId(sectionId);
    setEditingQuestion(question);

    setQuestionDraft({
      questionText:
        question.questionText,

      questionType:
        question.questionType,

      helperText:
        question.helperText ?? "",

      scaleMin:
        question.scaleMin,

      scaleMax:
        question.scaleMax,

      scaleMinLabel:
        question.scaleMinLabel ?? "",

      scaleMaxLabel:
        question.scaleMaxLabel ?? "",

      options:
        question.options.map(
          (option) => ({
            label: option.label,
            allowsOtherText:
              option.allowsOtherText,
          })
        ),
    });

    setQuestionModalOpen(true);
  };


  const closeQuestionEditor = () => {
    setQuestionModalOpen(false);
    setQuestionSectionId(null);
    setEditingQuestion(null);

    setQuestionDraft({
      ...emptyQuestionDraft,
      options: [],
    });
  };


  const changeQuestionType = (
    nextType: SurveyQuestionType
  ) => {
    setQuestionDraft((current) => {
      if (
        nextType ===
        "SINGLE_CHOICE"
      ) {
        return {
          ...current,

          questionType:
            "SINGLE_CHOICE",

          scaleMin: null,
          scaleMax: null,

          scaleMinLabel: "",
          scaleMaxLabel: "",

          options:
            current.options.length >= 2
              ? current.options
              : [
                  {
                    label: "",
                    allowsOtherText: false,
                  },
                  {
                    label: "",
                    allowsOtherText: false,
                  },
                ],
        };
      }

      if (nextType === "SCALE") {
        return {
          ...current,

          questionType: "SCALE",

          scaleMin:
            current.scaleMin ?? 1,

          scaleMax:
            current.scaleMax ?? 4,

          scaleMinLabel:
            current.scaleMinLabel,

          scaleMaxLabel:
            current.scaleMaxLabel,

          options: [],
        };
      }

      return {
        ...current,

        questionType: "LONG_TEXT",

        scaleMin: null,
        scaleMax: null,

        scaleMinLabel: "",
        scaleMaxLabel: "",

        options: [],
      };
    });
  };


  const addQuestionOption = () => {
    setQuestionDraft(
      (current) => ({
        ...current,

        options: [
          ...current.options,
          {
            label: "",
            allowsOtherText: false,
          },
        ],
      })
    );
  };


  const updateQuestionOption = (
    index: number,
    patch: Partial<QuestionOptionDraft>
  ) => {
    setQuestionDraft(
      (current) => ({
        ...current,

        options:
          current.options.map(
            (option, optionIndex) => {
              if (
                optionIndex !== index
              ) {
                if (
                  patch.allowsOtherText ===
                  true
                ) {
                  return {
                    ...option,
                    allowsOtherText:
                      false,
                  };
                }

                return option;
              }

              return {
                ...option,
                ...patch,
              };
            }
          ),
      })
    );
  };


  const removeQuestionOption = (
    index: number
  ) => {
    setQuestionDraft(
      (current) => {
        if (
          current.options.length <= 2
        ) {
          return current;
        }

        return {
          ...current,

          options:
            current.options.filter(
              (_, optionIndex) =>
                optionIndex !== index
            ),
        };
      }
    );
  };


  const handleQuestionSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (
      !template ||
      !isDraft ||
      !questionSectionId
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        questionText:
          questionDraft.questionText,

        questionType:
          questionDraft.questionType,

        helperText:
          questionDraft.helperText.trim()
            ? questionDraft.helperText
            : null,

        scaleMin:
          questionDraft.questionType ===
          "SCALE"
            ? questionDraft.scaleMin
            : null,

        scaleMax:
          questionDraft.questionType ===
          "SCALE"
            ? questionDraft.scaleMax
            : null,

        scaleMinLabel:
          questionDraft.questionType ===
            "SCALE" &&
          questionDraft.scaleMinLabel.trim()
            ? questionDraft.scaleMinLabel
            : null,

        scaleMaxLabel:
          questionDraft.questionType ===
            "SCALE" &&
          questionDraft.scaleMaxLabel.trim()
            ? questionDraft.scaleMaxLabel
            : null,

        options:
          questionDraft.questionType ===
          "SINGLE_CHOICE"
            ? questionDraft.options.map(
                (option) => ({
                  label: option.label,
                  allowsOtherText:
                    option.allowsOtherText,
                })
              )
            : [],
      };

      if (editingQuestion) {
        await adminMutation(
          `/api/admin/survey-templates/${template.id}/questions/${editingQuestion.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        setMessage(
          "Pertanyaan berhasil diperbarui."
        );
      } else {
        await adminMutation(
          `/api/admin/survey-templates/${template.id}/sections/${questionSectionId}/questions`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        setMessage(
          "Pertanyaan berhasil ditambahkan."
        );
      }

      closeQuestionEditor();

      await refreshTemplate();
    } catch (reason) {
      setError(
        reason instanceof AdminApiError
          ? reason.message
          : "Pertanyaan tidak dapat disimpan."
      );
    } finally {
      setSaving(false);
    }
  };


  // =====================================================
  // DELETE
  // =====================================================

  const requestDeleteSection = (
    section: SurveySection
  ) => {
    setDeleteTarget({
      type: "SECTION",
      id: section.id,
      label: `Bagian ${section.sectionCode} — ${section.title}`,
    });
  };


  const requestDeleteQuestion = (
    question: SurveyQuestion
  ) => {
    setDeleteTarget({
      type: "QUESTION",
      id: question.id,
      label: question.questionText,
    });
  };


  const confirmDelete = async () => {
    if (
      !template ||
      !isDraft ||
      !deleteTarget
    ) {
      return;
    }

    setDeleting(true);
    setError(null);
    setMessage(null);

    try {
      if (
        deleteTarget.type ===
        "SECTION"
      ) {
        await adminMutation(
          `/api/admin/survey-templates/${template.id}/sections/${deleteTarget.id}`,
          {
            method: "DELETE",
          }
        );

        setMessage(
          "Bagian Survey berhasil dihapus."
        );
      } else {
        await adminMutation(
          `/api/admin/survey-templates/${template.id}/questions/${deleteTarget.id}`,
          {
            method: "DELETE",
          }
        );

        setMessage(
          "Pertanyaan berhasil dihapus."
        );
      }

      setDeleteTarget(null);

      await refreshTemplate();
    } catch (reason) {
      setError(
        reason instanceof AdminApiError
          ? reason.message
          : "Data Survey tidak dapat dihapus."
      );
    } finally {
      setDeleting(false);
    }
  };


  // =====================================================
  // PUBLISH
  // =====================================================

  const publishTemplate =
    async () => {
      if (
        !template ||
        !isDraft
      ) {
        return;
      }

      setPublishing(true);
      setError(null);
      setMessage(null);

      try {
        await adminMutation(
          `/api/admin/survey-templates/${template.id}/publish`,
          {
            method: "POST",
          }
        );

        setPublishConfirmOpen(false);

        setMessage(
          `Versi ${template.version} berhasil dipublikasikan.`
        );

        await refreshTemplate();
      } catch (reason) {
        setError(
          reason instanceof AdminApiError
            ? reason.message
            : "Template Survey tidak dapat dipublikasikan."
        );
      } finally {
        setPublishing(false);
      }
    };


  // =====================================================
  // LOADING / ERROR
  // =====================================================

  if (loading) {
    return (
      <p className="muted">
        Memuat template evaluasi…
      </p>
    );
  }


  if (!template) {
    return (
      <p className="form-message is-error">
        {error ??
          "Template evaluasi tidak ditemukan."}
      </p>
    );
  }


  // =====================================================
  // VIEW
  // =====================================================

  return (
    <>
      <header className="bank-detail-header">
        <div className="bank-detail-header__main">
          <Link
            className="back-link"
            to="/admin/evaluasi?tab=templates"
          >
            ← Template Survey
          </Link>

          <div className="bank-detail-header__title-row">
            <div>
              <p className="section-label">
                Evaluasi Pelatihan · Versi{" "}
                {template.version}
              </p>

              <h1>{template.name}</h1>

              {template.description && (
                <p className="muted">
                  {template.description}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bank-detail-header__actions">
          <span
            className={
              template.status ===
              "PUBLISHED"
                ? "status-badge is-active"
                : "status-badge"
            }
          >
            {statusLabel(
              template.status
            )}
          </span>

          {template.status ===
            "PUBLISHED" && (
            <button
              className="button"
              type="button"
              disabled={
                creatingVersion
              }
              onClick={() =>
                void createNewVersion()
              }
            >
              {creatingVersion
                ? "Membuat…"
                : "Buat Versi Baru"}
            </button>
          )}

          {isDraft && (
            <button
              className="button"
              type="button"
              disabled={publishing}
              onClick={() =>
                setPublishConfirmOpen(
                  true
                )
              }
            >
              Publish
            </button>
          )}
        </div>
      </header>


      {error && (
        <p
          className="form-message is-error"
          role="alert"
        >
          {error}
        </p>
      )}


      {message && (
        <p className="form-message is-success">
          {message}
        </p>
      )}


      <section className="panel">
        <div className="training-overview-grid">
          <article>
            <span>Status</span>

            <strong>
              {statusLabel(
                template.status
              )}
            </strong>
          </article>

          <article>
            <span>Versi</span>

            <strong>
              {template.version}
            </strong>
          </article>

          <article>
            <span>Bagian</span>

            <strong>
              {template.sections.length}
            </strong>
          </article>

          <article>
            <span>Pertanyaan</span>

            <strong>
              {questionCount}
            </strong>
          </article>
        </div>
      </section>


      {isDraft && (
        <p className="form-message is-success">
          Versi ini masih Draft. Perubahan
          hanya memengaruhi versi ini dan
          belum digunakan peserta sampai
          dipublikasikan.
        </p>
      )}


      <div className="question-list-section">
        {template.sections.map(
          (section) => (
            <section
              className="panel"
              key={section.id}
            >
              <div className="question-list-toolbar">
                <div>
                  <p className="section-label">
                    Bagian{" "}
                    {section.sectionCode}
                  </p>

                  <h2>
                    {section.title}
                  </h2>

                  {section.description && (
                    <p className="muted">
                      {
                        section.description
                      }
                    </p>
                  )}
                </div>

                {isDraft && (
                  <div className="button-row">
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() =>
                        openEditSection(
                          section
                        )
                      }
                    >
                      Edit Bagian
                    </button>

                    <button
                      className="button"
                      type="button"
                      onClick={() =>
                        openNewQuestion(
                          section.id
                        )
                      }
                    >
                      + Tambah Pertanyaan
                    </button>

                    <button
                      className="danger-button"
                      type="button"
                      onClick={() =>
                        requestDeleteSection(
                          section
                        )
                      }
                    >
                      Hapus Bagian
                    </button>
                  </div>
                )}
              </div>


              {section.questions.length ===
              0 ? (
                <div className="empty-state">
                  <strong>
                    Belum ada pertanyaan
                  </strong>

                  <p>
                    Tambahkan minimal satu
                    pertanyaan sebelum
                    template dapat
                    dipublikasikan.
                  </p>

                  {isDraft && (
                    <button
                      className="button"
                      type="button"
                      onClick={() =>
                        openNewQuestion(
                          section.id
                        )
                      }
                    >
                      + Tambah Pertanyaan
                    </button>
                  )}
                </div>
              ) : (
                <div className="question-list">
                  {section.questions.map(
                    (question) => (
                      <article
                        className="question-card"
                        key={question.id}
                      >
                        <div className="question-card__header">
                          <strong>
                            {
                              section.sectionCode
                            }
                            {
                              question.sortOrder
                            }
                          </strong>

                          <div className="button-row">
                            <span className="status-badge">
                              {questionTypeLabel(
                                question.questionType
                              )}
                            </span>

                            <span className="status-badge is-active">
                              Wajib
                            </span>
                          </div>
                        </div>


                        <p className="question-card__text">
                          {
                            question.questionText
                          }
                        </p>


                        {question.helperText && (
                          <p className="muted">
                            {
                              question.helperText
                            }
                          </p>
                        )}


                        {question.questionType ===
                          "SCALE" && (
                          <div className="training-overview-grid">
                            <article>
                              <span>
                                Nilai
                                minimum
                              </span>

                              <strong>
                                {
                                  question.scaleMin
                                }
                              </strong>

                              {question.scaleMinLabel && (
                                <small>
                                  {
                                    question.scaleMinLabel
                                  }
                                </small>
                              )}
                            </article>

                            <article>
                              <span>
                                Nilai
                                maksimum
                              </span>

                              <strong>
                                {
                                  question.scaleMax
                                }
                              </strong>

                              {question.scaleMaxLabel && (
                                <small>
                                  {
                                    question.scaleMaxLabel
                                  }
                                </small>
                              )}
                            </article>
                          </div>
                        )}


                        {question.questionType ===
                          "SINGLE_CHOICE" && (
                          <ol className="option-list">
                            {question.options.map(
                              (
                                option
                              ) => (
                                <li
                                  key={
                                    option.id
                                  }
                                >
                                  <span>
                                    {
                                      option.label
                                    }
                                  </span>

                                  {option.allowsOtherText && (
                                    <small>
                                      Jawaban
                                      lain
                                      diperbolehkan
                                    </small>
                                  )}
                                </li>
                              )
                            )}
                          </ol>
                        )}


                        {question.questionType ===
                          "LONG_TEXT" && (
                          <p className="muted">
                            Peserta mengisi
                            jawaban berupa
                            teks panjang.
                          </p>
                        )}


                        {isDraft && (
                          <div className="question-card__footer">
                            <span>
                              Pertanyaan wajib
                              diisi
                            </span>

                            <div className="button-row">
                              <button
                                className="text-button"
                                type="button"
                                onClick={() =>
                                  openEditQuestion(
                                    section.id,
                                    question
                                  )
                                }
                              >
                                Edit
                              </button>

                              <button
                                className="text-button is-danger"
                                type="button"
                                onClick={() =>
                                  requestDeleteQuestion(
                                    question
                                  )
                                }
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    )
                  )}
                </div>
              )}
            </section>
          )
        )}
      </div>


      {isDraft && (
        <section className="panel">
          <div className="empty-state">
            <strong>
              Tambah bagian evaluasi
            </strong>

            <p>
              Gunakan bagian baru jika
              questionnaire membutuhkan
              kelompok pertanyaan
              tambahan.
            </p>

            <button
              className="button"
              type="button"
              onClick={
                openNewSection
              }
            >
              + Tambah Bagian
            </button>
          </div>
        </section>
      )}


      {/* =================================================
          SECTION MODAL
      ================================================= */}

      {sectionModalOpen &&
        createPortal(
          <div
            className="participant-modal-backdrop"
            role="presentation"
          >
            <section
              className="participant-modal question-editor-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="survey-section-modal-title"
            >
              <header className="participant-modal__header">
                <div>
                  <p className="section-label">
                    Template Survey
                  </p>

                  <h2 id="survey-section-modal-title">
                    {editingSection
                      ? "Edit Bagian"
                      : "Tambah Bagian"}
                  </h2>
                </div>

                <button
                  className="icon-button"
                  type="button"
                  aria-label="Tutup"
                  disabled={saving}
                  onClick={
                    closeSectionEditor
                  }
                >
                  ×
                </button>
              </header>


              <form
                className="participant-modal__form form-stack"
                onSubmit={
                  handleSectionSubmit
                }
              >
                <label>
                  Judul bagian

                  <input
                    required
                    maxLength={200}
                    value={
                      sectionDraft.title
                    }
                    placeholder="Contoh: PROGRAM PELATIHAN"
                    onChange={(
                      event
                    ) =>
                      setSectionDraft(
                        (
                          current
                        ) => ({
                          ...current,

                          title:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                  />
                </label>


                <label>
                  Keterangan

                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={
                      sectionDraft.description
                    }
                    placeholder="Contoh: Beri penilaian pada skala 1–4."
                    onChange={(
                      event
                    ) =>
                      setSectionDraft(
                        (
                          current
                        ) => ({
                          ...current,

                          description:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                  />
                </label>


                <footer className="participant-modal__actions">
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={saving}
                    onClick={
                      closeSectionEditor
                    }
                  >
                    Batal
                  </button>

                  <button
                    className="button"
                    type="submit"
                    disabled={saving}
                  >
                    {saving
                      ? "Menyimpan…"
                      : editingSection
                      ? "Simpan Perubahan"
                      : "Tambah Bagian"}
                  </button>
                </footer>
              </form>
            </section>
          </div>,
          document.body
        )}


      {/* =================================================
          QUESTION MODAL
      ================================================= */}

      {questionModalOpen &&
        createPortal(
          <div
            className="participant-modal-backdrop"
            role="presentation"
          >
            <section
              className="participant-modal question-editor-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="survey-question-modal-title"
            >
              <header className="participant-modal__header">
                <div>
                  <p className="section-label">
                    Template Survey
                  </p>

                  <h2 id="survey-question-modal-title">
                    {editingQuestion
                      ? "Edit Pertanyaan"
                      : "Tambah Pertanyaan"}
                  </h2>
                </div>

                <button
                  className="icon-button"
                  type="button"
                  aria-label="Tutup"
                  disabled={saving}
                  onClick={
                    closeQuestionEditor
                  }
                >
                  ×
                </button>
              </header>


              <form
                className="participant-modal__form form-stack"
                onSubmit={
                  handleQuestionSubmit
                }
              >
                <label>
                  Pertanyaan

                  <textarea
                    rows={4}
                    required
                    maxLength={10000}
                    value={
                      questionDraft.questionText
                    }
                    placeholder="Tulis pertanyaan evaluasi"
                    onChange={(
                      event
                    ) =>
                      setQuestionDraft(
                        (
                          current
                        ) => ({
                          ...current,

                          questionText:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                  />
                </label>


                <label>
                  Tipe pertanyaan

                  <select
                    value={
                      questionDraft.questionType
                    }
                    onChange={(
                      event
                    ) =>
                      changeQuestionType(
                        event
                          .target
                          .value as SurveyQuestionType
                      )
                    }
                  >
                    <option value="SCALE">
                      Skala
                    </option>

                    <option value="SINGLE_CHOICE">
                      Pilihan tunggal
                    </option>

                    <option value="LONG_TEXT">
                      Jawaban panjang
                    </option>
                  </select>
                </label>


                <label>
                  Keterangan tambahan

                  <textarea
                    rows={3}
                    maxLength={5000}
                    value={
                      questionDraft.helperText
                    }
                    placeholder="Opsional. Contoh atau penjelasan tambahan untuk peserta."
                    onChange={(
                      event
                    ) =>
                      setQuestionDraft(
                        (
                          current
                        ) => ({
                          ...current,

                          helperText:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                  />
                </label>


                {questionDraft.questionType ===
                  "SCALE" && (
                  <>
                    <div className="form-grid">
                      <label>
                        Nilai minimum

                        <input
                          type="number"
                          required
                          value={
                            questionDraft.scaleMin ??
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            setQuestionDraft(
                              (
                                current
                              ) => ({
                                ...current,

                                scaleMin:
                                  event
                                    .target
                                    .value ===
                                  ""
                                    ? null
                                    : Number(
                                        event
                                          .target
                                          .value
                                      ),
                              })
                            )
                          }
                        />
                      </label>

                      <label>
                        Nilai maksimum

                        <input
                          type="number"
                          required
                          value={
                            questionDraft.scaleMax ??
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            setQuestionDraft(
                              (
                                current
                              ) => ({
                                ...current,

                                scaleMax:
                                  event
                                    .target
                                    .value ===
                                  ""
                                    ? null
                                    : Number(
                                        event
                                          .target
                                          .value
                                      ),
                              })
                            )
                          }
                        />
                      </label>
                    </div>


                    <div className="form-grid">
                      <label>
                        Label minimum

                        <input
                          value={
                            questionDraft.scaleMinLabel
                          }
                          placeholder="Contoh: Sangat kurang"
                          onChange={(
                            event
                          ) =>
                            setQuestionDraft(
                              (
                                current
                              ) => ({
                                ...current,

                                scaleMinLabel:
                                  event
                                    .target
                                    .value,
                              })
                            )
                          }
                        />
                      </label>

                      <label>
                        Label maksimum

                        <input
                          value={
                            questionDraft.scaleMaxLabel
                          }
                          placeholder="Contoh: Sangat baik"
                          onChange={(
                            event
                          ) =>
                            setQuestionDraft(
                              (
                                current
                              ) => ({
                                ...current,

                                scaleMaxLabel:
                                  event
                                    .target
                                    .value,
                              })
                            )
                          }
                        />
                      </label>
                    </div>
                  </>
                )}


                {questionDraft.questionType ===
                  "SINGLE_CHOICE" && (
                  <div className="form-stack">
                    <div>
                      <strong>
                        Pilihan jawaban
                      </strong>

                      <p className="muted">
                        Minimal dua pilihan.
                        Hanya satu pilihan
                        yang boleh
                        mengizinkan isian
                        "Yang lain".
                      </p>
                    </div>


                    {questionDraft.options.map(
                      (
                        option,
                        index
                      ) => (
                        <div
                          className="checkbox-card"
                          key={index}
                        >
                          <div
                            style={{
                              flex: 1,
                            }}
                          >
                            <label>
                              Pilihan{" "}
                              {index + 1}

                              <input
                                required
                                value={
                                  option.label
                                }
                                placeholder={`Pilihan ${
                                  index +
                                  1
                                }`}
                                onChange={(
                                  event
                                ) =>
                                  updateQuestionOption(
                                    index,
                                    {
                                      label:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                              />
                            </label>


                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={
                                  option.allowsOtherText
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateQuestionOption(
                                    index,
                                    {
                                      allowsOtherText:
                                        event
                                          .target
                                          .checked,
                                    }
                                  )
                                }
                              />

                              Izinkan peserta
                              mengisi jawaban
                              lain
                            </label>
                          </div>


                          <button
                            className="text-button is-danger"
                            type="button"
                            disabled={
                              questionDraft
                                .options
                                .length <=
                              2
                            }
                            onClick={() =>
                              removeQuestionOption(
                                index
                              )
                            }
                          >
                            Hapus
                          </button>
                        </div>
                      )
                    )}


                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={
                        addQuestionOption
                      }
                    >
                      + Tambah Pilihan
                    </button>
                  </div>
                )}


                {questionDraft.questionType ===
                  "LONG_TEXT" && (
                  <div className="empty-state">
                    <strong>
                      Jawaban panjang
                    </strong>

                    <p>
                      Peserta akan mendapat
                      kolom teks untuk
                      menulis komentar atau
                      saran.
                    </p>
                  </div>
                )}


                <div className="checkbox-card">
                  <div>
                    <strong>
                      Wajib diisi
                    </strong>

                    <small>
                      Semua pertanyaan
                      evaluasi wajib dijawab
                      oleh peserta sebelum
                      Survey dapat dikirim.
                    </small>
                  </div>
                </div>


                <footer className="participant-modal__actions">
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={saving}
                    onClick={
                      closeQuestionEditor
                    }
                  >
                    Batal
                  </button>

                  <button
                    className="button"
                    type="submit"
                    disabled={saving}
                  >
                    {saving
                      ? "Menyimpan…"
                      : editingQuestion
                      ? "Simpan Perubahan"
                      : "Tambah Pertanyaan"}
                  </button>
                </footer>
              </form>
            </section>
          </div>,
          document.body
        )}


      {/* =================================================
          DELETE CONFIRMATION
      ================================================= */}

      {deleteTarget &&
        createPortal(
          <div
            className="participant-modal-backdrop"
            role="presentation"
          >
            <section
              className="participant-modal delete-confirm-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="survey-delete-title"
            >
              <header className="participant-modal__header">
                <div>
                  <p className="section-label">
                    Konfirmasi
                  </p>

                  <h2 id="survey-delete-title">
                    {deleteTarget.type ===
                    "SECTION"
                      ? "Hapus Bagian?"
                      : "Hapus Pertanyaan?"}
                  </h2>
                </div>
              </header>


              <div className="participant-modal__body">
                <p>
                  {deleteTarget.type ===
                  "SECTION"
                    ? "Seluruh pertanyaan di dalam bagian ini juga akan dihapus dari versi Draft."
                    : "Pertanyaan ini akan dihapus dari versi Draft."}
                </p>

                <p>
                  <strong>
                    {
                      deleteTarget.label
                    }
                  </strong>
                </p>
              </div>


              <footer className="participant-modal__actions">
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={deleting}
                  onClick={() =>
                    setDeleteTarget(null)
                  }
                >
                  Batal
                </button>

                <button
                  className="danger-button"
                  type="button"
                  disabled={deleting}
                  onClick={() =>
                    void confirmDelete()
                  }
                >
                  {deleting
                    ? "Menghapus…"
                    : "Ya, Hapus"}
                </button>
              </footer>
            </section>
          </div>,
          document.body
        )}


      {/* =================================================
          PUBLISH CONFIRMATION
      ================================================= */}

      {publishConfirmOpen &&
        createPortal(
          <div
            className="participant-modal-backdrop"
            role="presentation"
          >
            <section
              className="participant-modal delete-confirm-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="survey-publish-title"
            >
              <header className="participant-modal__header">
                <div>
                  <p className="section-label">
                    Publish Survey
                  </p>

                  <h2 id="survey-publish-title">
                    Publikasikan Versi{" "}
                    {template.version}?
                  </h2>
                </div>
              </header>


              <div className="participant-modal__body">
                <p>
                  Setelah dipublikasikan,
                  versi ini tidak dapat
                  diedit langsung lagi.
                </p>

                <p>
                  Versi Published
                  sebelumnya akan menjadi
                  Archived, tetapi seluruh
                  data dan response lama
                  tetap tersimpan.
                </p>
              </div>


              <footer className="participant-modal__actions">
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={publishing}
                  onClick={() =>
                    setPublishConfirmOpen(
                      false
                    )
                  }
                >
                  Periksa Lagi
                </button>

                <button
                  className="button"
                  type="button"
                  disabled={publishing}
                  onClick={() =>
                    void publishTemplate()
                  }
                >
                  {publishing
                    ? "Mempublikasikan…"
                    : "Ya, Publish"}
                </button>
              </footer>
            </section>
          </div>,
          document.body
        )}
    </>
  );
}
