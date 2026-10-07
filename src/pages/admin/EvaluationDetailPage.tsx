import { ClipboardCopy, Download, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { DateTimeInput } from "../../components/ui/DateTimeInput";
import { ModalPortal } from "../../components/ui/ModalPortal";
import { SearchInput } from "../../components/ui/SearchInput";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { AdminApiError, adminMutation, adminQuery } from "../../features/admin-auth/admin-api";
import { ActiveYearIndicator, useActiveYear, withActiveYear } from "../../features/active-year/ActiveYearProvider";
import { formatDateTimeForApi, formatDateTimeForDisplay } from "../../features/dates/date-format";

type Status = "NOT_OPEN" | "OPEN" | "FINISHED";
type Campaign = {
  id: string; slug: string; training: { id: string; name: string }; template: { id: string; name: string; version: number };
  cohorts: Array<{ id: string; name: string; startDate: string; endDate: string }>;
  schedule: { mode: "MANUAL" | "SCHEDULED"; manualOpen: boolean; opensAt: string | null; closesAt: string | null };
  status: Status; totalParticipants: number; respondentCount: number;
};
type Results = {
  totalParticipants: number; respondentCount: number; responsePercentage: number; overallValue: number | null;
  sections: Array<{ id: string; code: string; title: string; value: number | null }>;
  indicators: Array<{ no: number; sectionCode: string; sectionTitle: string; questionId: string; indicator: string; value: number | null; responseCount: number; distribution: Array<{ value: number; count: number }> }>;
  singleChoice: Array<{ sectionTitle: string; questionId: string; question: string; responseCount: number; options: Array<{ label: string; count: number; percentage: number }> }>;
  comments: Array<{ sectionTitle: string; questionId: string; question: string; entries: Array<{ participantName: string; cohortName: string; text: string }> }>;
  participants: Array<{ id: string; name: string; nik: string; cohortId: string; cohortName: string; status: "SUBMITTED" | "NOT_SUBMITTED"; submittedAt: string | null }>;
};
type ScheduleDraft = { status: "OPEN_NOW" | "SCHEDULED" | "CLOSED"; opensAt: string; closesAt: string };

const statusLabels: Record<Status, string> = { NOT_OPEN: "Belum Dibuka", OPEN: "Sedang Berlangsung", FINISHED: "Selesai" };
const percent = (value: number | null) => value === null ? "-" : `${value.toFixed(2).replace(".", ",")}%`;

export function EvaluationDetailPage() {
  const { campaignId = "" } = useParams();
  const { activeYear } = useActiveYear();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [cohortId, setCohortId] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantStatus, setParticipantStatus] = useState("");
  const [schedule, setSchedule] = useState<ScheduleDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const path = withActiveYear(`/api/admin/survey-campaigns/${campaignId}/results`, activeYear);
      const query = cohortId ? `${path}&cohortId=${encodeURIComponent(cohortId)}` : path;
      const payload = await adminQuery<{ campaign: Campaign; results: Results }>(query);
      setCampaign(payload.campaign); setResults(payload.results); setError(null);
    } catch (reason) { setError(reason instanceof AdminApiError ? reason.message : "Hasil Evaluasi tidak dapat dimuat."); }
  }, [activeYear, campaignId, cohortId]);

  useEffect(() => { void load(); }, [load]);

  const participantRows = useMemo(() => {
    const needle = participantSearch.trim().toLocaleLowerCase("id");
    return (results?.participants ?? []).filter((item) => (!needle || `${item.name} ${item.nik}`.toLocaleLowerCase("id").includes(needle)) && (!participantStatus || item.status === participantStatus));
  }, [participantSearch, participantStatus, results]);

  async function applySchedule(input: { status: ScheduleDraft["status"]; opensAt?: string; closesAt?: string }) {
    setBusy(true); setError(null);
    try {
      await adminMutation(withActiveYear(`/api/admin/survey-campaigns/${campaignId}/schedule`, activeYear), { method: "PUT", body: JSON.stringify(input) });
      setSchedule(null); setNotice(input.status === "CLOSED" ? "Evaluasi berhasil ditutup." : "Pengaturan Evaluasi berhasil disimpan."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pengaturan Evaluasi tidak dapat disimpan."); }
    finally { setBusy(false); }
  }

  async function saveSchedule(event: FormEvent) {
    event.preventDefault(); if (!schedule) return;
    if (schedule.status !== "SCHEDULED") return void applySchedule({ status: schedule.status });
    const opensAt = formatDateTimeForApi(schedule.opensAt); const closesAt = formatDateTimeForApi(schedule.closesAt);
    if (!opensAt || !closesAt || Date.parse(closesAt) <= Date.parse(opensAt)) { setError("Waktu tutup harus setelah waktu buka."); return; }
    await applySchedule({ status: "SCHEDULED", opensAt, closesAt });
  }

  async function copyLink() {
    if (!campaign) return;
    await navigator.clipboard.writeText(`${window.location.origin}/e/${campaign.slug}`); setNotice("Link Evaluasi berhasil disalin.");
  }

  if (!campaign || !results) return <>{error ? <p className="form-message is-error">{error}</p> : <p className="muted">Memuat hasil Evaluasi…</p>}</>;
  const exportPath = withActiveYear(`/api/admin/survey-campaigns/${campaign.id}/export`, activeYear);
  const exportUrl = cohortId ? `${exportPath}&cohortId=${encodeURIComponent(cohortId)}` : exportPath;

  return <>
    <header className="admin-page-header"><div><Link className="back-link" to="/admin/evaluasi">← Evaluasi</Link><h1>{campaign.training.name}</h1><p>{campaign.cohorts.map((item) => item.name).join(" & ")} · {campaign.template.name} Versi {campaign.template.version}</p><ActiveYearIndicator /></div><span className={`status-badge evaluation-status-${campaign.status.toLowerCase()}`}>{statusLabels[campaign.status]}</span></header>
    {notice && <p className="form-message is-success" role="status">{notice}</p>}{error && <p className="form-message is-error" role="alert">{error}</p>}
    <section className="panel evaluation-detail-controls"><div><span>Link Evaluasi</span><code>{window.location.origin}/e/{campaign.slug}</code></div><div className="button-row"><button className="button button--secondary" onClick={() => void copyLink()}><ClipboardCopy /> Salin</button><button className="button button--secondary" onClick={() => { setError(null); setSchedule({ status: campaign.schedule.mode === "SCHEDULED" ? "SCHEDULED" : campaign.status === "OPEN" ? "OPEN_NOW" : "CLOSED", opensAt: campaign.schedule.opensAt ? formatDateTimeForDisplay(campaign.schedule.opensAt) : "", closesAt: campaign.schedule.closesAt ? formatDateTimeForDisplay(campaign.schedule.closesAt) : "" }); }}>Edit Jadwal</button>{campaign.status === "OPEN" ? <button className="button button--danger" disabled={busy} onClick={() => void applySchedule({ status: "CLOSED" })}>Tutup Evaluasi</button> : <button className="button" disabled={busy} onClick={() => void applySchedule({ status: "OPEN_NOW" })}>{campaign.status === "FINISHED" ? "Buka Kembali" : "Buka Sekarang"}</button>}</div></section>
    <nav className="evaluation-cohort-tabs" aria-label="Filter hasil per Angkatan"><button className={!cohortId ? "is-active" : ""} onClick={() => setCohortId("")}>Gabungan</button>{campaign.cohorts.map((cohort) => <button key={cohort.id} className={cohortId === cohort.id ? "is-active" : ""} onClick={() => setCohortId(cohort.id)}>{cohort.name}</button>)}</nav>
    <section className="evaluation-summary-grid"><article className="panel"><span>Total Peserta</span><strong>{results.totalParticipants}</strong></article><article className="panel"><span>Sudah Mengisi</span><strong>{results.respondentCount}</strong></article><article className="panel"><span>Belum Mengisi</span><strong>{results.totalParticipants - results.respondentCount}</strong></article><article className="panel"><span>Persentase Pengisian</span><strong>{percent(results.responsePercentage)}</strong></article><article className="panel evaluation-summary-grid__overall"><span>Nilai Keseluruhan Evaluasi</span><strong>{percent(results.overallValue)}</strong></article></section>
    <section className="panel"><div className="panel-heading"><div><p className="section-label">Ringkasan</p><h2>Nilai per Bagian</h2></div><a className="button button--secondary" href={exportUrl} download><Download /> Export Hasil Evaluasi</a></div><div className="evaluation-section-chart">{results.sections.map((section) => <div key={section.id}><div><strong>{section.code}. {section.title}</strong><span>{percent(section.value)}</span></div><div className="evaluation-section-chart__track"><span style={{ width: `${Math.max(0, Math.min(100, section.value ?? 0))}%` }} /></div></div>)}</div></section>
    <section className="panel"><div className="panel-heading"><div><p className="section-label">Skala 1–4</p><h2>Rincian Nilai Indikator</h2></div></div><div className="responsive-table evaluation-indicator-table"><table><colgroup><col className="evaluation-col-number" /><col className="evaluation-col-section" /><col /><col className="evaluation-col-value" /><col className="evaluation-col-distribution" /></colgroup><thead><tr><th>No</th><th>Bagian</th><th>Indikator Penilaian</th><th>Nilai</th><th>Distribusi</th></tr></thead><tbody>{results.indicators.map((item) => <tr key={item.questionId}><td data-label="No">{item.no}</td><td data-label="Bagian"><span>{item.sectionCode}. {item.sectionTitle}</span></td><td data-label="Indikator"><strong>{item.indicator}</strong></td><td data-label="Nilai"><strong>{percent(item.value)}</strong></td><td data-label="Distribusi"><div className="evaluation-distribution-chips">{item.distribution.map((entry) => <span key={entry.value}>{entry.value}: <strong>{entry.count}</strong></span>)}</div></td></tr>)}</tbody></table></div></section>
    {results.singleChoice.map((group) => <section className="panel evaluation-distribution" key={group.questionId}><p className="section-label">{group.sectionTitle}</p><h2>{group.question}</h2><div className="responsive-table evaluation-choice-table"><table><thead><tr><th>Pilihan</th><th>Jumlah</th><th>Persentase</th></tr></thead><tbody>{group.options.map((option) => <tr key={option.label}><td data-label="Pilihan">{option.label}</td><td data-label="Jumlah">{option.count}</td><td data-label="Persentase">{option.percentage.toFixed(1).replace(".", ",")}%</td></tr>)}</tbody></table></div></section>)}
    <section className="panel"><div className="panel-heading"><div><p className="section-label">Jawaban Teks</p><h2>Komentar & Saran</h2></div></div><div className="evaluation-comments">{results.comments.map((group) => <article key={group.questionId}><h3>{group.question}</h3><small>{group.sectionTitle}</small>{group.entries.length ? <ul>{group.entries.map((entry, index) => <li key={`${entry.participantName}-${index}`}><p>{entry.text}</p><span>{entry.participantName} · {entry.cohortName}</span></li>)}</ul> : <p className="muted">Belum ada komentar.</p>}</article>)}</div></section>
    <section className="panel"><div className="panel-heading"><div><p className="section-label">Peserta</p><h2>Status Pengisian</h2></div></div><div className="evaluation-participant-filters"><label>Cari Nama/NIK<SearchInput value={participantSearch} onValueChange={setParticipantSearch} placeholder="Nama atau NIK" /></label><label>Status<SearchableSelect value={participantStatus} placeholder="Semua status" options={[{ value: "SUBMITTED", label: "Sudah Mengisi" }, { value: "NOT_SUBMITTED", label: "Belum Mengisi" }]} onValueChange={setParticipantStatus} /></label></div><div className="responsive-table evaluation-participant-table"><table><thead><tr><th>Nama</th><th>NIK</th><th>Angkatan</th><th>Status</th><th>Waktu Submit</th></tr></thead><tbody>{participantRows.map((participant) => <tr key={participant.id}><td data-label="Nama">{participant.name}</td><td data-label="NIK">{participant.nik}</td><td data-label="Angkatan">{participant.cohortName}</td><td data-label="Status"><span className={`status-badge ${participant.status === "SUBMITTED" ? "is-active" : ""}`}>{participant.status === "SUBMITTED" ? "Sudah Mengisi" : "Belum Mengisi"}</span></td><td data-label="Waktu Submit">{participant.submittedAt ? formatDateTimeForDisplay(participant.submittedAt) : "—"}</td></tr>)}</tbody></table></div></section>
    {schedule && <ModalPortal onClose={() => setSchedule(null)} blocked={busy}><section className="participant-modal schedule-editor-modal" role="dialog" aria-modal="true" aria-labelledby="evaluation-schedule-title"><header className="participant-modal__header"><div><p className="section-label">Evaluasi</p><h2 id="evaluation-schedule-title">Edit Jadwal Evaluasi</h2></div><button className="participant-modal__close" type="button" aria-label="Tutup" onClick={() => setSchedule(null)}><X /></button></header><form className="participant-modal__form form-stack" onSubmit={(event) => void saveSchedule(event)}>{error && <p className="form-message is-error" role="alert">{error}</p>}<label>Status<select value={schedule.status} onChange={(event) => setSchedule((current) => current ? { ...current, status: event.target.value as ScheduleDraft["status"] } : current)}><option value="SCHEDULED">Set Jadwal</option><option value="OPEN_NOW">Buka Sekarang</option><option value="CLOSED">Tutup</option></select></label>{schedule.status === "SCHEDULED" && <div className="schedule-editor-fields"><label>Tanggal/Jam Buka<DateTimeInput required value={schedule.opensAt} onValueChange={(value) => setSchedule((current) => current ? { ...current, opensAt: value } : current)} /></label><label>Tanggal/Jam Tutup<DateTimeInput required value={schedule.closesAt} onValueChange={(value) => setSchedule((current) => current ? { ...current, closesAt: value } : current)} /></label></div>}<footer className="participant-modal__actions"><button type="button" className="button button--secondary" onClick={() => setSchedule(null)}>Batal</button><button className="button" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button></footer></form></section></ModalPortal>}
  </>;
}
