import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Download, Eye, X } from "lucide-react";
import { adminMutation, adminQuery } from "../../features/admin-auth/admin-api";
import type { PackageOverlap, TrainingBatch, TrainingDetail, TrainingPackage } from "../../features/training/types";
import { useAutoDismiss } from "../../components/ui/useAutoDismiss";
import { formatDateTimeForApi, formatDateTimeForDisplay } from "../../features/dates/date-format";
import { DateTimeInput } from "../../components/ui/DateTimeInput";
import { ModalPortal } from "../../components/ui/ModalPortal";
import { ActiveYearIndicator, useActiveYear, withActiveYear } from "../../features/active-year/ActiveYearProvider";

type ScheduleStatus = "SCHEDULED" | "OPEN_NOW" | "CLOSED";
type ScheduleEditor = { stage: "PRE" | "POST"; status: ScheduleStatus; startAt: string; endAt: string };
type PackageGenerator = { regenerate: boolean; questionCount: string };
type GeneratedQuestion = { id: string; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option_key: string };
const scheduleStatusLabels: Record<TrainingDetail["scheduleStatus"], string> = {
  NOT_OPEN: "Belum Dibuka",
  ONGOING: "Sedang Berlangsung",
  FINISHED: "Selesai",
};

export function TrainingDetailPage() {
  const { sessionId = "" } = useParams();
  const { activeYear } = useActiveYear();
  const navigate = useNavigate();
  const [session, setSession] = useState<TrainingDetail | null>(null);
  const [batches, setBatches] = useState<TrainingBatch[]>([]);
  const [packages, setPackages] = useState<TrainingPackage[]>([]);
  const [overlaps, setOverlaps] = useState<PackageOverlap[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useAutoDismiss(message, setMessage);
  const [busy, setBusy] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState<{ name: string; participantCount: number; attemptCount: number; answerCount: number } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [scheduleEditor, setScheduleEditor] = useState<ScheduleEditor | null>(null);
  const [packageGenerator, setPackageGenerator] = useState<PackageGenerator | null>(null);
  const [questionViewer, setQuestionViewer] = useState<{ batchName: string; questions: GeneratedQuestion[] } | null>(null);

  type DetailPayload = { session: TrainingDetail; batches: TrainingBatch[]; packages: TrainingPackage[]; overlaps: PackageOverlap[] };

  function applyPayload(payload: DetailPayload) {
    setSession(payload.session);
    setBatches(payload.batches);
    setPackages(payload.packages);
    setOverlaps(payload.overlaps);
  }

  async function reload() {
    applyPayload(await adminQuery<DetailPayload>(withActiveYear(`/api/admin/training/${sessionId}`, activeYear)));
  }

  useEffect(() => {
    void adminQuery<DetailPayload>(withActiveYear(`/api/admin/training/${sessionId}`, activeYear))
      .then(applyPayload)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Pelatihan tidak dapat dimuat."));
  }, [activeYear, sessionId]);

  async function generatePackages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!packageGenerator || !session) return;
    const questionCount = Number(packageGenerator.questionCount);
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > session.availableQuestionCount) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const payload = await adminMutation<{ packages: TrainingPackage[]; overlaps: PackageOverlap[] }>(
        `/api/admin/training/${sessionId}/generate-packages`, { method: "POST", body: JSON.stringify({ questionCount }) },
      );
      setPackages(payload.packages); setOverlaps(payload.overlaps);
      await reload();
      setPackageGenerator(null);
      setMessage("Paket dan empat layout ujian berhasil dibuat dan langsung siap digunakan sesuai jadwal Test.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Paket gagal dibuat."); }
    finally { setBusy(false); }
  }

  async function viewGeneratedQuestions(batchId: string, batchName: string) {
    try {
      const payload = await adminQuery<{ questions: GeneratedQuestion[] }>(`/api/admin/training/${sessionId}/packages/${batchId}/questions`);
      setQuestionViewer({ batchName, questions: payload.questions });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Soal tidak dapat dimuat."); }
  }

  function downloadGeneratedQuestions() {
    if (!questionViewer) return;
    const rows = [["No", "Soal", "Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D", "Jawaban benar"], ...questionViewer.questions.map((question, index) => [String(index + 1), question.question_text, question.option_a, question.option_b, question.option_c, question.option_d, question.correct_option_key])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/gu, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `soal-${questionViewer.batchName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  async function setStage(stage: "PRE" | "POST", open: boolean) {
    setBusy(true); setError(null); setMessage(null);
    try {
      await adminMutation(`/api/admin/training/${sessionId}/manual-stage`, {
        method: "POST", body: JSON.stringify({ stage, open }),
      });
      await reload();
      setMessage(`${stage === "PRE" ? "Pre-Test" : "Post-Test"} berhasil ${open ? "dibuka" : "ditutup"}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pengaturan tes gagal disimpan."); }
    finally { setBusy(false); }
  }

  function editSchedule(stage: "PRE" | "POST") {
    if (!session) return;
    const schedule = stage === "PRE" ? session.pre : session.post;
    setScheduleEditor({
      stage,
      status: schedule.mode === "SCHEDULED" ? "SCHEDULED" : schedule.manualOpen ? "OPEN_NOW" : "CLOSED",
      startAt: schedule.startAt ? formatDateTimeForDisplay(schedule.startAt) : "",
      endAt: schedule.endAt ? formatDateTimeForDisplay(schedule.endAt) : "",
    });
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scheduleEditor) return;
    const startAt = formatDateTimeForApi(scheduleEditor.startAt);
    const endAt = formatDateTimeForApi(scheduleEditor.endAt);
    if (scheduleEditor.status === "SCHEDULED" && (!startAt || !endAt || Date.parse(endAt) <= Date.parse(startAt))) {
      setError("Waktu tutup harus setelah waktu buka dan seluruh tanggal/jam harus valid.");
      return;
    }
    setBusy(true); setError(null);
    try {
      await adminMutation(`/api/admin/training/${sessionId}/schedule`, {
        method: "PUT",
        body: JSON.stringify(scheduleEditor.status === "SCHEDULED"
          ? { stage: scheduleEditor.stage, status: scheduleEditor.status, startAt, endAt }
          : { stage: scheduleEditor.stage, status: scheduleEditor.status }),
      });
      await reload();
      setScheduleEditor(null);
      setMessage(`${scheduleEditor.stage === "PRE" ? "Jadwal Pre-Test" : "Jadwal Post-Test"} berhasil diperbarui.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Jadwal Test gagal disimpan."); }
    finally { setBusy(false); }
  }

  async function loadDeleteImpact() {
    try { const data = await adminQuery<{ impact: { name: string; participantCount: number; attemptCount: number; answerCount: number } }>(`/api/admin/training/${sessionId}/delete-preview`); setDeleteImpact(data.impact); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Dampak penghapusan tidak dapat dimuat."); }
  }

  async function removeTraining() {
    if (!deleteImpact) return;
    setBusy(true); setError(null);
    try {
      await adminMutation(`/api/admin/training/${sessionId}`, { method: "DELETE", body: JSON.stringify({ confirmationName: deleteConfirmation }) });
      navigate("/admin/pelatihan", { replace: true });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pelatihan gagal dihapus."); setBusy(false); }
  }

  if (error && !session) return <p className="form-message is-error">{error}</p>;
  if (!session) return <p className="muted">Memuat pelatihan…</p>;
  const selectedQuestionCount = Number(packageGenerator?.questionCount ?? "");
  const packageCountError = packageGenerator && (!Number.isInteger(selectedQuestionCount) || selectedQuestionCount < 1)
    ? "Jumlah soal minimal 1."
    : packageGenerator && selectedQuestionCount > session.availableQuestionCount
      ? `Jumlah soal tidak boleh melebihi ${session.availableQuestionCount} soal yang tersedia.`
      : null;
  const hasGeneratedPackages = packages.some((item) => item.questionIds.length);

  return <>
    <header className="admin-page-header"><div><Link className="back-link" to="/admin/pelatihan">← Pelaksanaan Tes</Link><h1>{session.materialName}</h1><p className="muted">Pelatihan: {session.trainingName}{session.cohorts.length ? ` · ${session.cohorts.map((cohort) => cohort.name).join(", ")}` : ""}</p><ActiveYearIndicator /></div><span className={`status-badge schedule-status-${session.scheduleStatus.toLowerCase()}`}>{scheduleStatusLabels[session.scheduleStatus]}</span></header>
    <section className="training-overview-grid">
      <article className="panel"><span>Bank Soal</span><strong>{session.bankName}</strong></article>
      <article className="panel"><span>Jumlah soal</span><strong>{session.questionCount}</strong></article>
      <article className="panel"><span>Durasi</span><strong>{session.durationMinutes} menit</strong></article>
      <article className="panel"><span>Passing grade</span><strong>{session.passingScore}</strong></article>
    </section>
    {error && <p className="form-message is-error">{error}</p>}
    {message && <p className="form-message is-success">{message}</p>}
    <section className="panel training-batches"><div className="package-heading"><div><p className="section-label">Angkatan</p><h2>Paket soal</h2></div>
      {session.status !== "COMPLETED" && <div className="button-row"><button className="button button--secondary" disabled={busy} onClick={() => setPackageGenerator({ regenerate: hasGeneratedPackages, questionCount: String(Math.min(10, session.availableQuestionCount)) })}>{hasGeneratedPackages ? "Regenerate paket" : "Generate paket"}</button></div>}</div>
      {batches.map((batch) => { const item = packages.find((entry) => entry.batchId === batch.id); return <article key={batch.id}><div><strong>{batch.name}</strong><span>{item?.questionIds.length ? `${item.questionIds.length} soal · ${item.layoutCount}/4 layout` : "Paket belum dibuat"}</span></div>{item?.questionIds.length ? <div className="button-row"><button type="button" className="button button--secondary button--small" onClick={() => void viewGeneratedQuestions(batch.id, batch.name)}><Eye />Lihat soal</button></div> : null}</article>; })}
      {overlaps.length > 0 && packages.every((item) => item.questionIds.length > 0) && <div className="overlap-list"><h3>Overlap antarangkatan</h3>{overlaps.map((item) => { const left = packages.find((entry) => entry.batchId === item.leftBatchId); const right = packages.find((entry) => entry.batchId === item.rightBatchId); return <p key={`${item.leftBatchId}-${item.rightBatchId}`}><span>{left?.batchName} ↔ {right?.batchName}</span><strong>{item.count} soal</strong></p>; })}</div>}
    </section>
    {packageGenerator && <ModalPortal onClose={() => setPackageGenerator(null)} blocked={busy}><section className="participant-modal package-generator-modal" role="dialog" aria-modal="true" aria-labelledby="package-generator-title"><header className="participant-modal__header"><div><p className="section-label">Paket Soal</p><h2 id="package-generator-title">{packageGenerator.regenerate ? "Regenerate Paket Soal" : "Generate Paket Soal"}</h2><p>Tentukan jumlah soal untuk setiap paket angkatan.</p></div><button type="button" className="participant-modal__close" aria-label="Tutup generate paket soal" disabled={busy} onClick={() => setPackageGenerator(null)}><X /></button></header><form className="participant-modal__form package-generator-form" onSubmit={(event) => void generatePackages(event)}><label>Jumlah soal per paket<input type="number" min="1" max={session.availableQuestionCount} step="1" inputMode="numeric" required autoFocus value={packageGenerator.questionCount} onChange={(event) => setPackageGenerator((current) => current ? { ...current, questionCount: event.target.value } : current)} /></label><p className="package-generator-availability">Tersedia <strong>{session.availableQuestionCount}</strong> soal</p>{packageGenerator.regenerate && <p className="package-generator-warning">Paket existing untuk seluruh angkatan akan dibuat ulang dengan jumlah soal ini.</p>}{packageCountError && <p className="form-message is-error" role="alert">{packageCountError}</p>}<footer className="participant-modal__actions"><button type="button" className="button button--secondary" disabled={busy} onClick={() => setPackageGenerator(null)}>Batal</button><button className="button" disabled={busy || Boolean(packageCountError)}>{busy ? "Membuat paket…" : "Generate Paket"}</button></footer></form></section></ModalPortal>}
    {questionViewer && <ModalPortal onClose={() => setQuestionViewer(null)}><section className="participant-modal question-viewer-modal" role="dialog" aria-modal="true" aria-labelledby="question-viewer-title"><header className="participant-modal__header"><div><p className="section-label">Paket Soal</p><h2 id="question-viewer-title">{questionViewer.batchName} · {questionViewer.questions.length} soal</h2><p>Soal yang benar-benar dipilih saat generate paket.</p></div><button type="button" className="participant-modal__close" aria-label="Tutup daftar soal" onClick={() => setQuestionViewer(null)}><X /></button></header><div className="question-viewer-list">{questionViewer.questions.map((question, index) => <article key={question.id}><strong>{index + 1}. {question.question_text}</strong><ol type="A"><li>{question.option_a}</li><li>{question.option_b}</li><li>{question.option_c}</li><li>{question.option_d}</li></ol><small>Kunci jawaban: {question.correct_option_key}</small></article>)}</div><footer className="participant-modal__actions"><button type="button" className="button" onClick={downloadGeneratedQuestions}><Download />Download {questionViewer.questions.length} soal</button></footer></section></ModalPortal>}
    <section className="schedule-control-grid">
      {(["PRE", "POST"] as const).map((stage) => {
        const schedule = stage === "PRE" ? session.pre : session.post;
        const statusLabel = schedule.mode === "SCHEDULED" ? "Terjadwal" : schedule.manualOpen ? "Buka Sekarang" : "Tutup";
        return <article className="panel" key={stage}><span>{stage === "PRE" ? "Pre-Test" : "Post-Test"}</span><strong>{statusLabel}</strong>{schedule.mode === "SCHEDULED" && <small>{formatDateTimeForDisplay(schedule.startAt)} – {formatDateTimeForDisplay(schedule.endAt)}</small>}<button className="button button--secondary" disabled={busy} onClick={() => editSchedule(stage)}>Edit Jadwal</button></article>;
      })}
    </section>
    {scheduleEditor && <ModalPortal onClose={() => setScheduleEditor(null)} blocked={busy}><section className="participant-modal schedule-editor-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-editor-title"><header className="participant-modal__header"><div><p className="section-label">Pengaturan Link Test</p><h2 id="schedule-editor-title">Edit Jadwal {scheduleEditor.stage === "PRE" ? "Pre-Test" : "Post-Test"}</h2></div><button type="button" className="participant-modal__close" aria-label="Tutup edit jadwal" disabled={busy} onClick={() => setScheduleEditor(null)}><X /></button></header><form className="participant-modal__form" onSubmit={(event) => void saveSchedule(event)}><label>Status<select value={scheduleEditor.status} onChange={(event) => setScheduleEditor((current) => current ? { ...current, status: event.target.value as ScheduleStatus } : current)}><option value="SCHEDULED">Terjadwal</option><option value="OPEN_NOW">Buka Sekarang</option><option value="CLOSED">Tutup</option></select></label>{scheduleEditor.status === "SCHEDULED" && <div className="schedule-editor-fields"><label>Tanggal/Jam Buka<DateTimeInput required value={scheduleEditor.startAt} onValueChange={(value) => setScheduleEditor((current) => current ? { ...current, startAt: value } : current)} aria-label="Tanggal dan jam buka" /></label><label>Tanggal/Jam Tutup<DateTimeInput required value={scheduleEditor.endAt} onValueChange={(value) => setScheduleEditor((current) => current ? { ...current, endAt: value } : current)} aria-label="Tanggal dan jam tutup" /></label></div>}<p className="muted">Perubahan ini hanya mengatur link untuk memulai. Attempt peserta yang sudah berjalan tetap berlangsung sampai deadline-nya.</p><footer className="participant-modal__actions"><button type="button" className="button button--secondary" disabled={busy} onClick={() => setScheduleEditor(null)}>Batal</button><button className="button" disabled={busy}>{busy ? "Menyimpan…" : "Simpan Jadwal"}</button></footer></form></section></ModalPortal>}
    <section className="panel public-link-panel"><div><span>Link peserta</span><code>{window.location.origin}/t/{session.slug}</code></div></section>
    <section className="panel danger-zone"><div><p className="section-label">Penghapusan data</p><h2>Hapus pelatihan dan seluruh hasil</h2><p>Bank Soal, gambar R2, dan statistik penggunaan soal tetap dipertahankan.</p></div>{!deleteImpact ? <button className="button danger-button" onClick={() => void loadDeleteImpact()}>Tinjau penghapusan</button> : <div className="delete-confirmation"><p><strong>{deleteImpact.participantCount}</strong> peserta, <strong>{deleteImpact.attemptCount}</strong> attempt, dan <strong>{deleteImpact.answerCount}</strong> detail jawaban akan dihapus dan tidak dapat dikembalikan.</p><label>Ketik <strong>{deleteImpact.name}</strong><input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label><div className="button-row"><button className="button button--secondary" onClick={() => { setDeleteImpact(null); setDeleteConfirmation(""); }}>Batal</button><button className="button danger-button" disabled={busy || deleteConfirmation !== deleteImpact.name} onClick={() => void removeTraining()}>Hapus seluruh data</button></div></div>}</section>
  </>;
}
