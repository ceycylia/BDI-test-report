import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import { adminMutation, adminQuery } from "../../features/admin-auth/admin-api";
import type { PackageOverlap, TrainingBatch, TrainingDetail, TrainingPackage } from "../../features/training/types";
import { useAutoDismiss } from "../../components/ui/useAutoDismiss";
import { formatDateTimeForApi, formatDateTimeForDisplay } from "../../features/dates/date-format";
import { DateTimeInput } from "../../components/ui/DateTimeInput";

type ScheduleStatus = "SCHEDULED" | "OPEN_NOW" | "CLOSED";
type ScheduleEditor = { stage: "PRE" | "POST"; status: ScheduleStatus; startAt: string; endAt: string };

export function TrainingDetailPage() {
  const { sessionId = "" } = useParams();
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
  const scheduleModalOpen = Boolean(scheduleEditor);

  type DetailPayload = { session: TrainingDetail; batches: TrainingBatch[]; packages: TrainingPackage[]; overlaps: PackageOverlap[] };

  function applyPayload(payload: DetailPayload) {
    setSession(payload.session);
    setBatches(payload.batches);
    setPackages(payload.packages);
    setOverlaps(payload.overlaps);
  }

  async function reload() {
    applyPayload(await adminQuery<DetailPayload>(`/api/admin/training/${sessionId}`));
  }

  useEffect(() => {
    void adminQuery<DetailPayload>(`/api/admin/training/${sessionId}`)
      .then(applyPayload)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Pelatihan tidak dapat dimuat."));
  }, [sessionId]);

  useEffect(() => {
    if (!scheduleModalOpen) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      overflow: body.style.overflow, position: body.style.position, top: body.style.top,
      width: body.style.width, paddingRight: body.style.paddingRight,
    };
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.paddingRight = previous.paddingRight;
      window.scrollTo(0, scrollY);
    };
  }, [scheduleModalOpen]);

  async function generatePackages() {
    setBusy(true); setError(null); setMessage(null);
    try {
      const payload = await adminMutation<{ packages: TrainingPackage[]; overlaps: PackageOverlap[] }>(
        `/api/admin/training/${sessionId}/generate-packages`, { method: "POST", body: "{}" },
      );
      setPackages(payload.packages); setOverlaps(payload.overlaps);
      await reload();
      setMessage("Paket dan lima layout ujian untuk setiap angkatan berhasil dibuat.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Paket gagal dibuat."); }
    finally { setBusy(false); }
  }

  async function activate() {
    setBusy(true); setError(null); setMessage(null);
    try {
      await adminMutation(`/api/admin/training/${sessionId}/activate`, { method: "POST", body: "{}" });
      await reload();
      setMessage("Pelatihan aktif. Paket soal kini terkunci.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pelatihan gagal diaktifkan."); }
    finally { setBusy(false); }
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

  return <>
    <header className="admin-page-header"><div><Link className="back-link" to="/admin/pelatihan">← Pelatihan</Link><h1>{session.name}</h1></div><span className={`status-badge status-${session.status.toLowerCase()}`}>{session.status}</span></header>
    <section className="training-overview-grid">
      <article className="panel"><span>Bank Soal</span><strong>{session.bankName}</strong></article>
      <article className="panel"><span>Jumlah soal</span><strong>{session.questionCount}</strong></article>
      <article className="panel"><span>Durasi</span><strong>15 menit</strong></article>
      <article className="panel"><span>Passing grade</span><strong>{session.passingScore}</strong></article>
    </section>
    {error && <p className="form-message is-error">{error}</p>}
    {message && <p className="form-message is-success">{message}</p>}
    <section className="panel training-batches"><div className="package-heading"><div><p className="section-label">Angkatan</p><h2>Paket soal</h2></div>
      {session.status === "DRAFT" && <div className="button-row"><button className="button button--secondary" disabled={busy} onClick={() => void generatePackages()}>{packages.some((item) => item.questionIds.length) ? "Regenerate paket" : "Generate paket"}</button><button className="button" disabled={busy || !packages.length || packages.some((item) => item.questionIds.length !== session.questionCount || item.layoutCount !== 5)} onClick={() => void activate()}>Aktifkan pelatihan</button></div>}</div>
      {batches.map((batch) => { const item = packages.find((entry) => entry.batchId === batch.id); return <article key={batch.id}><div><strong>{batch.name}</strong><span>{item?.questionIds.length ? `${item.questionIds.length} soal · ${item.layoutCount}/5 layout` : "Paket belum dibuat"}</span></div>{item?.questionIds.length ? <ol className="question-id-list">{item.questionIds.map((id) => <li key={id}><code>{id}</code></li>)}</ol> : null}</article>; })}
      {overlaps.length > 0 && packages.every((item) => item.questionIds.length > 0) && <div className="overlap-list"><h3>Overlap antarangkatan</h3>{overlaps.map((item) => { const left = packages.find((entry) => entry.batchId === item.leftBatchId); const right = packages.find((entry) => entry.batchId === item.rightBatchId); return <p key={`${item.leftBatchId}-${item.rightBatchId}`}><span>{left?.batchName} ↔ {right?.batchName}</span><strong>{item.count} soal</strong></p>; })}</div>}
    </section>
    <section className="schedule-control-grid">
      {(["PRE", "POST"] as const).map((stage) => {
        const schedule = stage === "PRE" ? session.pre : session.post;
        const statusLabel = schedule.mode === "SCHEDULED" ? "Terjadwal" : schedule.manualOpen ? "Buka Sekarang" : "Tutup";
        return <article className="panel" key={stage}><span>{stage === "PRE" ? "Pre-Test" : "Post-Test"}</span><strong>{statusLabel}</strong>{schedule.mode === "SCHEDULED" && <small>{formatDateTimeForDisplay(schedule.startAt)} – {formatDateTimeForDisplay(schedule.endAt)}</small>}<button className="button button--secondary" disabled={busy} onClick={() => editSchedule(stage)}>Edit Jadwal</button></article>;
      })}
    </section>
    {scheduleEditor && createPortal(<div className="modal-backdrop participant-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setScheduleEditor(null); }}><section className="participant-modal schedule-editor-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-editor-title"><header className="participant-modal__header"><div><p className="section-label">Pengaturan Link Test</p><h2 id="schedule-editor-title">Edit Jadwal {scheduleEditor.stage === "PRE" ? "Pre-Test" : "Post-Test"}</h2></div><button type="button" className="participant-modal__close" aria-label="Tutup edit jadwal" disabled={busy} onClick={() => setScheduleEditor(null)}><X /></button></header><form className="participant-modal__form" onSubmit={(event) => void saveSchedule(event)}><label>Status<select value={scheduleEditor.status} onChange={(event) => setScheduleEditor((current) => current ? { ...current, status: event.target.value as ScheduleStatus } : current)}><option value="SCHEDULED">Terjadwal</option><option value="OPEN_NOW">Buka Sekarang</option><option value="CLOSED">Tutup</option></select></label>{scheduleEditor.status === "SCHEDULED" && <div className="schedule-editor-fields"><label>Tanggal/Jam Buka<DateTimeInput required value={scheduleEditor.startAt} onValueChange={(value) => setScheduleEditor((current) => current ? { ...current, startAt: value } : current)} aria-label="Tanggal dan jam buka" /></label><label>Tanggal/Jam Tutup<DateTimeInput required value={scheduleEditor.endAt} onValueChange={(value) => setScheduleEditor((current) => current ? { ...current, endAt: value } : current)} aria-label="Tanggal dan jam tutup" /></label></div>}<p className="muted">Perubahan ini hanya mengatur link untuk memulai. Attempt peserta yang sudah berjalan tetap berlangsung sampai deadline-nya.</p><footer className="participant-modal__actions"><button type="button" className="button button--secondary" disabled={busy} onClick={() => setScheduleEditor(null)}>Batal</button><button className="button" disabled={busy}>{busy ? "Menyimpan…" : "Simpan Jadwal"}</button></footer></form></section></div>, document.body)}
    <section className="panel public-link-panel"><div><span>Link peserta</span><code>{window.location.origin}/t/{session.slug}</code></div></section>
    <section className="panel danger-zone"><div><p className="section-label">Penghapusan data</p><h2>Hapus pelatihan dan seluruh hasil</h2><p>Bank Soal, gambar R2, dan statistik penggunaan soal tetap dipertahankan.</p></div>{!deleteImpact ? <button className="button danger-button" onClick={() => void loadDeleteImpact()}>Tinjau penghapusan</button> : <div className="delete-confirmation"><p><strong>{deleteImpact.participantCount}</strong> peserta, <strong>{deleteImpact.attemptCount}</strong> attempt, dan <strong>{deleteImpact.answerCount}</strong> detail jawaban akan dihapus dan tidak dapat dikembalikan.</p><label>Ketik <strong>{deleteImpact.name}</strong><input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label><div className="button-row"><button className="button button--secondary" onClick={() => { setDeleteImpact(null); setDeleteConfirmation(""); }}>Batal</button><button className="button danger-button" disabled={busy || deleteConfirmation !== deleteImpact.name} onClick={() => void removeTraining()}>Hapus seluruh data</button></div></div>}</section>
  </>;
}
