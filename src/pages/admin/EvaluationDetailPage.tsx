import { ClipboardCopy, Download, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { EvaluationReportChart } from "../../components/evaluation/EvaluationReportChart";
import { DateTimeInput } from "../../components/ui/DateTimeInput";
import { ModalPortal } from "../../components/ui/ModalPortal";
import { IconActionButton } from "../../components/ui/IconActionButton";
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

function formatCohortList(names: string[]) {
  if (!names.length) return "";
  const cohortNumbers = names.map((name) => name.match(/^Angkatan\s+(.+)$/i)?.[1] ?? null);
  const parts = cohortNumbers.every((value): value is string => value !== null) ? cohortNumbers : names;
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} dan ${parts.at(-1)}`;
  return cohortNumbers.every((value) => value !== null) ? `Angkatan ${list}` : list;
}

function chartFileName(names: string[]) {
  const cohortPart = names
    .map((name) => name.replace(/^Angkatan\s+/i, ""))
    .join("-")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLocaleLowerCase("id");
  return `hasil-evaluasi${cohortPart ? `-angkatan-${cohortPart}` : ""}.png`;
}

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
  const chartRef = useRef<SVGSVGElement>(null);
  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const path = withActiveYear(`/api/admin/survey-campaigns/${campaignId}/results`, activeYear);
      const query = cohortId ? `${path}&cohortId=${encodeURIComponent(cohortId)}` : path;
      const payload = await adminQuery<{ campaign: Campaign; results: Results }>(query);
      if (sequence !== loadSequence.current) return;
      setCampaign(payload.campaign); setResults(payload.results); setError(null);
    } catch (reason) {
      if (sequence !== loadSequence.current) return;
      setError(reason instanceof AdminApiError ? reason.message : "Hasil Evaluasi tidak dapat dimuat.");
    }
  }, [activeYear, campaignId, cohortId]);

  useEffect(() => { void load(); }, [load]);

  const participantRows = useMemo(() => {
    const needle = participantSearch.trim().toLocaleLowerCase("id");
    return (results?.participants ?? []).filter((item) => (!needle || `${item.name} ${item.nik}`.toLocaleLowerCase("id").includes(needle)) && (!participantStatus || item.status === participantStatus));
  }, [participantSearch, participantStatus, results]);
  const scheduledOpensAt = schedule?.status === "SCHEDULED" ? formatDateTimeForApi(schedule.opensAt) : null;
  const scheduledClosesAt = schedule?.status === "SCHEDULED" ? formatDateTimeForApi(schedule.closesAt) : null;
  const scheduleIncomplete = schedule?.status === "SCHEDULED" && (!scheduledOpensAt || !scheduledClosesAt);
  const scheduleInvalid = schedule?.status === "SCHEDULED" && scheduledOpensAt !== null && scheduledClosesAt !== null && Date.parse(scheduledClosesAt) <= Date.parse(scheduledOpensAt);

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

  function selectCohort(nextCohortId: string) {
    if (nextCohortId === cohortId) return;
    setResults(null);
    setCohortId(nextCohortId);
  }

  async function downloadChart(fileName: string) {
    const chart = chartRef.current;
    if (!chart) return;
    setError(null);
    let sourceUrl = "";
    try {
      const clone = chart.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("width", "950");
      clone.setAttribute("height", "480");
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const source = new XMLSerializer().serializeToString(clone);
      sourceUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Chart tidak dapat dirender."));
        image.src = sourceUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1900;
      canvas.height = 960;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas tidak tersedia.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG tidak dapat dibuat.")), "image/png"));
      const downloadUrl = URL.createObjectURL(png);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chart tidak dapat diunduh.");
    } finally {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    }
  }

  if (!campaign || !results) return <>{error ? <p className="form-message is-error">{error}</p> : <p className="muted">Memuat hasil Evaluasi…</p>}</>;
  const selectedCohorts = cohortId ? campaign.cohorts.filter((item) => item.id === cohortId) : campaign.cohorts;
  const selectedCohortNames = selectedCohorts.map((item) => item.name);
  const cohortLabel = formatCohortList(selectedCohortNames);
  const chartTitle = `Hasil Evaluasi Penyelenggaraan Pelatihan Vokasi${cohortLabel ? ` ${cohortLabel}` : ""}`;
  const wordPath = withActiveYear(`/api/admin/survey-campaigns/${campaign.id}/export-word`, activeYear);
  const wordUrl = cohortId ? `${wordPath}&cohortId=${encodeURIComponent(cohortId)}` : wordPath;

  return <>
    <header className="admin-page-header"><div><Link className="back-link" to="/admin/evaluasi">← Evaluasi</Link><h1>{campaign.training.name}</h1><p>{campaign.cohorts.map((item) => item.name).join(" & ")} · {campaign.template.name} Versi {campaign.template.version}</p><ActiveYearIndicator /></div><div className="page-header-actions evaluation-result-actions"><span className={`status-badge evaluation-status-${campaign.status.toLowerCase()}`}>{statusLabels[campaign.status]}</span><button className="button button--secondary" type="button" onClick={() => void downloadChart(chartFileName(selectedCohortNames))}><Download /> Download Chart</button><a className="button" href={wordUrl} download><Download /> Export Hasil Evaluasi</a></div></header>
    <div hidden aria-hidden="true"><EvaluationReportChart ref={chartRef} title={chartTitle} sections={results.sections} /></div>
    {notice && <p className="form-message is-success" role="status">{notice}</p>}{error && <p className="form-message is-error" role="alert">{error}</p>}
    <section className="panel evaluation-detail-controls"><div><span>Link Evaluasi</span><code>{window.location.origin}/e/{campaign.slug}</code></div><div className="button-row"><button className="button button--secondary" onClick={() => void copyLink()}><ClipboardCopy /> Salin</button><IconActionButton action="edit" label="Edit Jadwal Evaluasi" onClick={() => { setError(null); setSchedule({ status: campaign.schedule.mode === "SCHEDULED" ? "SCHEDULED" : campaign.status === "OPEN" ? "OPEN_NOW" : "CLOSED", opensAt: campaign.schedule.opensAt ? formatDateTimeForDisplay(campaign.schedule.opensAt) : "", closesAt: campaign.schedule.closesAt ? formatDateTimeForDisplay(campaign.schedule.closesAt) : "" }); }} />{campaign.status === "OPEN" ? <button className="button button--danger" disabled={busy} onClick={() => void applySchedule({ status: "CLOSED" })}>Tutup Evaluasi</button> : <button className="button" disabled={busy} onClick={() => void applySchedule({ status: "OPEN_NOW" })}>{campaign.status === "FINISHED" ? "Buka Kembali" : "Buka Sekarang"}</button>}</div></section>
    <nav className="evaluation-cohort-tabs" aria-label="Filter hasil per Angkatan"><button className={!cohortId ? "is-active" : ""} onClick={() => selectCohort("")}>Gabungan</button>{campaign.cohorts.map((cohort) => <button key={cohort.id} className={cohortId === cohort.id ? "is-active" : ""} onClick={() => selectCohort(cohort.id)}>{cohort.name}</button>)}</nav>
    <section className="evaluation-summary-grid"><article className="panel"><span>Total Peserta</span><strong>{results.totalParticipants}</strong></article><article className="panel"><span>Sudah Mengisi</span><strong>{results.respondentCount}</strong></article><article className="panel"><span>Belum Mengisi</span><strong>{results.totalParticipants - results.respondentCount}</strong></article><article className="panel"><span>Persentase Pengisian</span><strong>{percent(results.responsePercentage)}</strong></article><article className="panel evaluation-summary-grid__overall"><span>Nilai Keseluruhan Evaluasi</span><strong>{percent(results.overallValue)}</strong></article></section>
    <section className="panel evaluation-report-table-panel"><div className="panel-heading"><div><p className="section-label">Skala 1–4</p><h2>Rincian Nilai Indikator</h2></div></div><div className="evaluation-result-table evaluation-report-table"><table><colgroup><col className="evaluation-report-table__number" /><col className="evaluation-report-table__section" /><col /><col className="evaluation-report-table__value" /><col className="evaluation-report-table__score" /><col className="evaluation-report-table__score" /><col className="evaluation-report-table__score" /><col className="evaluation-report-table__score" /></colgroup><thead><tr><th rowSpan={2}>No.</th><th rowSpan={2}>Bagian</th><th rowSpan={2}>Indikator Penilaian</th><th rowSpan={2}>Nilai</th><th className="evaluation-report-table__distribution-heading" colSpan={4}>Distribusi</th></tr><tr className="evaluation-report-table__score-headings"><th>1</th><th>2</th><th>3</th><th>4</th></tr></thead><tbody>{results.indicators.map((item) => <tr key={item.questionId}><td>{item.no}</td><td>{item.sectionCode}. {item.sectionTitle}</td><td>{item.indicator}</td><td>{percent(item.value)}</td>{[1, 2, 3, 4].map((score) => <td className="evaluation-report-table__score-cell" key={score}>{item.distribution.find((entry) => entry.value === score)?.count ?? 0}</td>)}</tr>)}</tbody></table></div></section>
    {results.singleChoice.map((group) => <section className="panel evaluation-distribution" key={group.questionId}><p className="section-label">{group.sectionTitle}</p><h2>{group.question}</h2><div className="evaluation-result-table evaluation-choice-table"><table><colgroup><col /><col className="evaluation-choice-table__count" /><col className="evaluation-choice-table__percentage" /></colgroup><thead><tr><th>Pilihan</th><th>Jumlah</th><th>Persentase</th></tr></thead><tbody>{group.options.map((option) => <tr key={option.label}><td>{option.label}</td><td>{option.count}</td><td>{option.percentage.toFixed(1).replace(".", ",")}%</td></tr>)}</tbody></table></div></section>)}
    <section className="panel"><div className="panel-heading"><div><p className="section-label">Jawaban Teks</p><h2>Komentar & Saran</h2></div></div><div className="evaluation-comments">{results.comments.map((group) => <article key={group.questionId}><h3>{group.question}</h3><small>{group.sectionTitle}</small>{group.entries.length ? <ul>{group.entries.map((entry, index) => <li key={`${entry.participantName}-${index}`}><p>{entry.text}</p><span>{entry.participantName} · {entry.cohortName}</span></li>)}</ul> : <p className="muted">Belum ada komentar.</p>}</article>)}</div></section>
    <section className="panel"><div className="panel-heading"><div><p className="section-label">Peserta</p><h2>Status Pengisian</h2></div></div><div className="evaluation-participant-filters"><label>Cari Nama/NIK<SearchInput value={participantSearch} onValueChange={setParticipantSearch} placeholder="Nama atau NIK" /></label><label>Status<SearchableSelect value={participantStatus} placeholder="Semua status" options={[{ value: "SUBMITTED", label: "Sudah Mengisi" }, { value: "NOT_SUBMITTED", label: "Belum Mengisi" }]} onValueChange={setParticipantStatus} /></label></div><div className="evaluation-result-table evaluation-participant-table"><table><colgroup><col className="evaluation-participant-table__name" /><col className="evaluation-participant-table__nik" /><col className="evaluation-participant-table__cohort" /><col className="evaluation-participant-table__status" /><col className="evaluation-participant-table__submitted" /></colgroup><thead><tr><th>Nama</th><th>NIK</th><th>Angkatan</th><th>Status</th><th>Waktu Submit</th></tr></thead><tbody>{participantRows.map((participant) => <tr key={participant.id}><td>{participant.name}</td><td>{participant.nik}</td><td>{participant.cohortName}</td><td><span className={`status-badge ${participant.status === "SUBMITTED" ? "is-active" : ""}`}>{participant.status === "SUBMITTED" ? "Sudah Mengisi" : "Belum Mengisi"}</span></td><td>{participant.submittedAt ? formatDateTimeForDisplay(participant.submittedAt) : "—"}</td></tr>)}</tbody></table></div></section>
    {schedule && <ModalPortal onClose={() => setSchedule(null)} blocked={busy}>
      <section className="participant-modal schedule-editor-modal evaluation-schedule-modal" role="dialog" aria-modal="true" aria-labelledby="evaluation-schedule-title">
        <header className="participant-modal__header"><div><p className="section-label">Evaluasi</p><h2 id="evaluation-schedule-title">Edit Jadwal Evaluasi</h2></div><button className="participant-modal__close" type="button" aria-label="Tutup" disabled={busy} onClick={() => setSchedule(null)}><X /></button></header>
        <form className="participant-modal__form form-stack" onSubmit={(event) => void saveSchedule(event)}>
          {error && <p className="form-message is-error" role="alert">{error}</p>}
          <fieldset className="schedule-mode-control evaluation-schedule-mode"><legend>Mode buka</legend>
            <button type="button" className={schedule.status === "OPEN_NOW" ? "is-active" : ""} onClick={() => setSchedule((current) => current ? { ...current, status: "OPEN_NOW" } : current)}>Buka Sekarang</button>
            <button type="button" className={schedule.status === "SCHEDULED" ? "is-active" : ""} onClick={() => setSchedule((current) => current ? { ...current, status: "SCHEDULED" } : current)}>Set Jadwal</button>
            <button type="button" className={schedule.status === "CLOSED" ? "is-active" : ""} onClick={() => setSchedule((current) => current ? { ...current, status: "CLOSED" } : current)}>Tutup</button>
          </fieldset>
          {schedule.status === "SCHEDULED" && <>
            <div className="schedule-editor-fields evaluation-schedule-fields">
              <label>Tanggal/Jam Buka<DateTimeInput required value={schedule.opensAt} aria-label="Tanggal dan jam buka Evaluasi" onValueChange={(value) => setSchedule((current) => current ? { ...current, opensAt: value } : current)} /></label>
              <label>Tanggal/Jam Tutup<DateTimeInput required value={schedule.closesAt} aria-label="Tanggal dan jam tutup Evaluasi" onValueChange={(value) => setSchedule((current) => current ? { ...current, closesAt: value } : current)} /></label>
            </div>
            {scheduleInvalid && <p className="form-message is-error" role="alert">Waktu tutup harus setelah waktu buka.</p>}
          </>}
          <footer className="participant-modal__actions"><button type="button" className="button button--secondary" disabled={busy} onClick={() => setSchedule(null)}>Batal</button><button className="button" disabled={busy || Boolean(scheduleIncomplete) || Boolean(scheduleInvalid)}>{busy ? "Menyimpan…" : "Simpan"}</button></footer>
        </form>
      </section>
    </ModalPortal>}
  </>;
}
