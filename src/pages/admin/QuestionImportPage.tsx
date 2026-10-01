import { useState, type ChangeEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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

export function QuestionImportPage() {
  const { bankId = "" } = useParams();
  const navigate = useNavigate();
  const [fileName, setFileName] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ParsedImportQuestion[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidCount = questions.filter((question) => question.errors.length > 0).length;
  const canImport = questions.length > 0 && invalidCount === 0 && !importing;

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setError(null);
    setQuestions([]);
    setWarnings([]);
    setFileName(file.name);

    try {
      const result = await readDocxQuestions(file);
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
  };

  const uploadQuestionImage = async (
    question: ParsedImportQuestion,
    index: number,
  ): Promise<string | null> => {
    if (!question.image) return null;
    const form = new FormData();
    form.set("image", imageDataUrlToFile(question.image, index + 1));
    const payload = await adminUpload<{ imageKey: string }>(
      `/api/admin/banks/${bankId}/images`,
      form,
    );
    return payload.imageKey;
  };

  const handleImport = async () => {
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
      navigate(`/admin/bank-soal/${bankId}`, {
        replace: true,
        state: { message: `${questions.length} soal berhasil diimport.` },
      });
    } catch (reason) {
      setError(
        reason instanceof AdminApiError
          ? reason.message
          : "Import gagal. Tidak ada soal yang ditambahkan.",
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <header className="admin-page-header">
        <div>
          <Link className="back-link" to={`/admin/bank-soal/${bankId}`}>← Detail Bank Soal</Link>
          <h1>Import Soal dari Word</h1>
        </div>
        <button className="button button--secondary" type="button" onClick={() => void downloadQuestionTemplate()}>
          Download Template Word
        </button>
      </header>

      <section className="panel import-upload-panel" aria-labelledby="upload-word-title">
        <div>
          <h2 id="upload-word-title">Upload Soal Word</h2>
          <p className="muted">Gunakan berkas .docx sesuai template. Maksimal 15 MB.</p>
        </div>
        <label className="file-drop-field">
          <span>{parsing ? "Membaca berkas…" : fileName ?? "Pilih berkas .docx"}</span>
          <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => void handleFile(event)} disabled={parsing || importing} />
        </label>
      </section>

      {error && <p className="form-message is-error" role="alert">{error}</p>}
      {warnings.length > 0 && (
        <div className="form-message import-warning">
          Word memberi {warnings.length} peringatan saat membaca dokumen. Periksa preview dengan teliti.
        </div>
      )}

      {questions.length > 0 && (
        <section className="import-preview" aria-labelledby="preview-title">
          <div className="import-summary">
            <div>
              <p className="section-label">Preview</p>
              <h2 id="preview-title">{questions.length} blok soal ditemukan</h2>
            </div>
            <div className="button-row">
              <span className={invalidCount === 0 ? "status-badge is-active" : "status-badge is-error"}>
                {invalidCount === 0 ? "Semua valid" : `${invalidCount} perlu diperbaiki`}
              </span>
              <button className="button" type="button" disabled={!canImport} onClick={() => void handleImport()}>
                {importing ? "Mengimport…" : "Import ke Bank Soal"}
              </button>
            </div>
          </div>

          <div className="import-question-list">
            {questions.map((question, index) => (
              <article className="question-card" key={`${question.sourceNumber ?? "unknown"}-${index}`}>
                <div className="question-card__header">
                  <strong>Soal {question.sourceNumber ?? index + 1}</strong>
                  <span className={question.errors.length === 0 ? "status-badge is-active" : "status-badge is-error"}>
                    {question.errors.length === 0 ? "Valid" : "Error"}
                  </span>
                </div>
                {question.errors.length > 0 && (
                  <ul className="import-errors">
                    {question.errors.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
                <p className="question-card__text">{question.questionText || "Pertanyaan belum terbaca."}</p>
                {question.image && <img className="question-card__image" src={question.image.dataUrl} alt={`Gambar soal ${question.sourceNumber ?? index + 1}`} />}
                <ol className="option-list">
                  {(["A", "B", "C", "D"] as const).map((key) => (
                    <li className={question.correctOptionKey === key ? "is-correct" : ""} key={key}>
                      <strong>{key}.</strong> {question[`option${key}`] || "—"}
                    </li>
                  ))}
                </ol>
                <p className="import-key">Kunci: <strong>{question.correctOptionKey ?? "—"}</strong></p>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
