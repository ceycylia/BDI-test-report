import { Download, FileText, Upload, X } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  adminMutation,
  adminUpload,
  AdminApiError,
} from "../../features/admin-auth/admin-api";
import {
  imageDataUrlToFile,
  readDocxQuestions,
} from "../../features/docx-import/read-docx";
import type { ParsedImportQuestion } from "../../features/docx-import/parser-core";
import { downloadQuestionTemplate } from "../../features/docx-import/template";
import { ModalPortal } from "../../components/ui/ModalPortal";

type QuestionImportModalProps = {
  bankId: string;
  onClose: () => void;
  onImported: (count: number) => void | Promise<void>;
};

export function QuestionImportModal({
  bankId,
  onClose,
  onImported,
}: QuestionImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<ParsedImportQuestion[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidCount = questions.filter((question) => question.errors.length > 0).length;
  const canImport = questions.length > 0 && invalidCount === 0 && !importing;
  const busy = parsing || importing;

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setQuestions([]);
    setWarnings([]);
    setError(null);
  }

  async function previewFile() {
    if (!selectedFile) return;
    setParsing(true);
    setError(null);
    setQuestions([]);
    setWarnings([]);

    try {
      const result = await readDocxQuestions(selectedFile);
      setQuestions(result.questions);
      setWarnings(result.warnings);
      if (result.questions.length === 0) {
        setError("Tidak ada blok SOAL yang dikenali. Gunakan template Word resmi.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Berkas Word tidak dapat dibaca.");
    } finally {
      setParsing(false);
    }
  }

  async function uploadQuestionImage(
    question: ParsedImportQuestion,
    index: number,
  ): Promise<string | null> {
    if (!question.image) return null;
    const form = new FormData();
    form.set("image", imageDataUrlToFile(question.image, index + 1));
    const payload = await adminUpload<{ imageKey: string }>(
      `/api/admin/banks/${bankId}/images`,
      form,
    );
    return payload.imageKey;
  }

  async function handleImport() {
    if (!canImport) return;
    setImporting(true);
    setError(null);

    try {
      const imageKeys = await Promise.all(
        questions.map((question, index) => uploadQuestionImage(question, index)),
      );
      const payload = questions.map((question, index) => ({
        questionText: question.questionText,
        imageKey: imageKeys[index] ?? null,
        optionA: question.optionA,
        optionB: question.optionB,
        optionC: question.optionC,
        optionD: question.optionD,
        correctOptionKey: question.correctOptionKey,
      }));

      await adminMutation(`/api/admin/banks/${bankId}/import`, {
        method: "POST",
        body: JSON.stringify({ questions: payload }),
      });
      await onImported(questions.length);
    } catch (reason) {
      setError(
        reason instanceof AdminApiError
          ? reason.message
          : "Import gagal. Tidak ada soal yang ditambahkan.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <ModalPortal onClose={onClose} blocked={busy}>
      <section
        className="participant-modal question-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-import-title"
      >
        <header className="participant-modal__header">
          <div>
            <p className="section-label">Bank Soal</p>
            <h2 id="question-import-title">Import Soal dari Word</h2>
            <p>Gunakan berkas .docx sesuai template. Maksimal 15 MB.</p>
          </div>
          <button
            type="button"
            className="participant-modal__close"
            aria-label="Tutup import soal"
            disabled={busy}
            onClick={onClose}
          >
            <X />
          </button>
        </header>

        <div className="question-import-modal__content">
          <div className="template-download-row">
            <div>
              <strong>Belum memiliki template?</strong>
              <span>Unduh template resmi, lalu isi soal sesuai format yang tersedia.</span>
            </div>
            <button
              className="button button--secondary button--small"
              type="button"
              onClick={() => void downloadQuestionTemplate()}
            >
              <Download /> Download Template Word
            </button>
          </div>

          <label className="question-import-modal__file">
            File soal (.docx)
            <span className="file-field">
              <FileText />
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFile}
                disabled={busy}
              />
            </span>
            {selectedFile && <small>{selectedFile.name}</small>}
          </label>

          {error && <p className="form-message is-error" role="alert">{error}</p>}
          {warnings.length > 0 && <div className="form-message import-warning">
            Word memberi {warnings.length} peringatan saat membaca dokumen. Periksa preview dengan teliti.
          </div>}

          {questions.length > 0 && <section className="import-preview-section" aria-labelledby="question-preview-title">
            <div className="import-preview-heading">
              <div>
                <p className="section-label">Preview</p>
                <h3 id="question-preview-title">{questions.length} blok soal ditemukan</h3>
              </div>
              <span className={invalidCount === 0 ? "status-badge is-active" : "status-badge is-danger"}>
                {invalidCount === 0 ? "Semua valid" : `${invalidCount} perlu diperbaiki`}
              </span>
            </div>

            <div className="import-question-list">
              {questions.map((question, index) => <article className="question-card" key={`${question.sourceNumber ?? "unknown"}-${index}`}>
                <div className="question-card__header">
                  <strong>Soal {question.sourceNumber ?? index + 1}</strong>
                  <span className={question.errors.length === 0 ? "status-badge is-active" : "status-badge is-danger"}>
                    {question.errors.length === 0 ? "Valid" : "Error"}
                  </span>
                </div>
                {question.errors.length > 0 && <ul className="import-errors">
                  {question.errors.map((item) => <li key={item}>{item}</li>)}
                </ul>}
                <p className="question-card__text">{question.questionText || "Pertanyaan belum terbaca."}</p>
                {question.image && <img className="question-card__image" src={question.image.dataUrl} alt={`Gambar soal ${question.sourceNumber ?? index + 1}`} />}
                <ol className="option-list">
                  {(["A", "B", "C", "D"] as const).map((key) => <li className={question.correctOptionKey === key ? "is-correct" : ""} key={key}>
                    <strong>{key}.</strong> {question[`option${key}`] || "—"}
                  </li>)}
                </ol>
                <p className="import-key">Kunci: <strong>{question.correctOptionKey ?? "—"}</strong></p>
              </article>)}
            </div>
          </section>}

        </div>
        <footer className="participant-modal__actions question-import-modal__footer">
          <button
            type="button"
            className="button button--secondary"
            disabled={busy}
            onClick={onClose}
          >
            Batal
          </button>
          {questions.length === 0 ? <button
            type="button"
            className="button"
            disabled={!selectedFile || parsing}
            onClick={() => void previewFile()}
          >
            <FileText /> {parsing ? "Membaca…" : "Preview File"}
          </button> : <button
            type="button"
            className="button"
            disabled={!canImport}
            onClick={() => void handleImport()}
          >
            <Upload /> {importing ? "Mengimport…" : `Import ${questions.length} Soal`}
          </button>}
        </footer>
      </section>
    </ModalPortal>
  );
}

export function QuestionImportPage() {
  const { bankId = "" } = useParams();
  const navigate = useNavigate();
  const close = () => navigate(`/admin/bank-soal/${bankId}`, { replace: true });

  return <QuestionImportModal
    bankId={bankId}
    onClose={close}
    onImported={(count) => navigate(`/admin/bank-soal/${bankId}`, {
      replace: true,
      state: { message: `${count} soal berhasil diimport.` },
    })}
  />;
}
