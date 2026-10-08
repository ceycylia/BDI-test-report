import { ClipboardCopy, ClipboardList, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DateTimeInput } from "../../components/ui/DateTimeInput";
import { ModalPortal } from "../../components/ui/ModalPortal";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { SearchInput } from "../../components/ui/SearchInput";
import { AdminApiError, adminMutation, adminQuery } from "../../features/admin-auth/admin-api";
import { ActiveYearIndicator, useActiveYear, withActiveYear } from "../../features/active-year/ActiveYearProvider";
import { formatDateTimeForApi, formatDateTimeForDisplay } from "../../features/dates/date-format";
import { SurveyTemplateListPage } from "./SurveyTemplateListPage";

type EvaluationStatus = "NOT_OPEN" | "OPEN" | "FINISHED";
type Campaign = {
  id: string; slug: string; training: { id: string; name: string }; template: { id: string; name: string; version: number };
  cohorts: Array<{ id: string; name: string; startDate: string; endDate: string }>;
  schedule: { mode: "MANUAL" | "SCHEDULED"; manualOpen: boolean; opensAt: string | null; closesAt: string | null };
  status: EvaluationStatus; totalParticipants: number; respondentCount: number;
};
type Catalog = {
  trainings: Array<{ id: string; name: string }>;
  cohorts: Array<{ id: string; trainingId: string; name: string; startDate: string; endDate: string; hasCampaign: boolean }>;
  templates: Array<{ id: string; name: string; version: number }>;
};
type CreateDraft = { trainingId: string; cohortIds: string[]; templateId: string; mode: "OPEN_NOW" | "SCHEDULED"; opensAt: string; closesAt: string };

const emptyDraft: CreateDraft = { trainingId: "", cohortIds: [], templateId: "", mode: "OPEN_NOW", opensAt: "", closesAt: "" };
const statusLabels: Record<EvaluationStatus, string> = { NOT_OPEN: "Belum Dibuka", OPEN: "Sedang Berlangsung", FINISHED: "Selesai" };

export function EvaluationPage() {
  const { activeYear } = useActiveYear();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "templates" ? "templates" : "campaigns";
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [catalog, setCatalog] = useState<Catalog>({ trainings: [], cohorts: [], templates: [] });
  const [search, setSearch] = useState("");
  const [trainingId, setTrainingId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState<CreateDraft>(emptyDraft);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [list, options] = await Promise.all([
        adminQuery<{ campaigns: Campaign[] }>(withActiveYear("/api/admin/survey-campaigns", activeYear)),
        adminQuery<Catalog>(withActiveYear("/api/admin/survey-campaigns/catalog", activeYear)),
      ]);
      setCampaigns(list.campaigns); setCatalog(options);
    } catch (reason) {
      setError(reason instanceof AdminApiError ? reason.message : "Pelaksanaan Evaluasi tidak dapat dimuat.");
    } finally { setLoading(false); }
  }, [activeYear]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setTrainingId(""); setCohortId(""); setSearch(""); setStatus(""); }, [activeYear]);

  const filterCohorts = useMemo(() => catalog.cohorts.filter((cohort) => !trainingId || cohort.trainingId === trainingId), [catalog.cohorts, trainingId]);
  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("id");
    return campaigns.filter((campaign) => {
      const haystack = `${campaign.training.name} ${campaign.cohorts.map((cohort) => cohort.name).join(" ")}`.toLocaleLowerCase("id");
      return (!needle || haystack.includes(needle)) && (!trainingId || campaign.training.id === trainingId) && (!cohortId || campaign.cohorts.some((cohort) => cohort.id === cohortId)) && (!status || campaign.status === status);
    });
  }, [campaigns, cohortId, search, status, trainingId]);

  const availableDraftCohorts = catalog.cohorts.filter((cohort) => cohort.trainingId === draft.trainingId);
  const scheduledOpensAt = draft.mode === "SCHEDULED" ? formatDateTimeForApi(draft.opensAt) : null;
  const scheduledClosesAt = draft.mode === "SCHEDULED" ? formatDateTimeForApi(draft.closesAt) : null;
  const scheduleIncomplete = draft.mode === "SCHEDULED" && (!scheduledOpensAt || !scheduledClosesAt);
  const scheduleInvalid = draft.mode === "SCHEDULED" && scheduledOpensAt !== null && scheduledClosesAt !== null && Date.parse(scheduledClosesAt) <= Date.parse(scheduledOpensAt);

  async function createCampaign(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const opensAt = draft.mode === "SCHEDULED" ? formatDateTimeForApi(draft.opensAt) : null;
      const closesAt = draft.mode === "SCHEDULED" ? formatDateTimeForApi(draft.closesAt) : null;
      if (draft.mode === "SCHEDULED" && (!opensAt || !closesAt || Date.parse(closesAt) <= Date.parse(opensAt))) throw new Error("Waktu tutup harus setelah waktu buka.");
      await adminMutation("/api/admin/survey-campaigns", { method: "POST", body: JSON.stringify({ trainingId: draft.trainingId, cohortIds: draft.cohortIds, templateId: draft.templateId, activeYear, mode: draft.mode, opensAt, closesAt }) });
      setCreateOpen(false); setDraft(emptyDraft); setNotice("Pelaksanaan Evaluasi berhasil dibuat."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pelaksanaan Evaluasi tidak dapat dibuat."); }
    finally { setBusy(false); }
  }

  async function copyLink(slug: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/e/${slug}`);
    setNotice("Link Evaluasi berhasil disalin.");
  }

  return <>
    <header className="admin-page-header"><div><p className="section-label">Evaluasi Pelatihan</p><h1>Evaluasi</h1><p className="muted">Kelola pelaksanaan dan Template Evaluasi peserta.</p><ActiveYearIndicator /></div>{tab === "campaigns" && <div className="page-header-actions"><button className="button" onClick={() => { setError(null); setDraft(emptyDraft); setCreateOpen(true); }}><Plus /> Buat Evaluasi</button></div>}</header>
    <nav className="section-tabs" aria-label="Bagian Evaluasi"><button className={tab === "campaigns" ? "is-active" : ""} onClick={() => setParams({})}>Pelaksanaan Evaluasi</button><button className={tab === "templates" ? "is-active" : ""} onClick={() => setParams({ tab: "templates" })}>Template Evaluasi</button></nav>
    {notice && <p className="form-message is-success" role="status">{notice}</p>}
    {error && <p className="form-message is-error" role="alert">{error}</p>}
    {tab === "templates" ? <SurveyTemplateListPage embedded onTemplatesChanged={load} /> : <>
      <section className="panel evaluation-filters">
        <label>Cari Evaluasi<SearchInput value={search} onValueChange={setSearch} placeholder="Nama pelatihan atau angkatan" /></label>
        <label>Pelatihan<SearchableSelect value={trainingId} placeholder="Semua pelatihan" options={catalog.trainings.map((item) => ({ value: item.id, label: item.name }))} onValueChange={(value) => { setTrainingId(value); setCohortId(""); }} /></label>
        <label>Angkatan<SearchableSelect disabled={!trainingId} value={cohortId} placeholder={trainingId ? "Semua angkatan" : "Pilih pelatihan terlebih dahulu"} options={filterCohorts.map((item) => ({ value: item.id, label: item.name }))} onValueChange={setCohortId} /></label>
        <label>Status<SearchableSelect value={status} placeholder="Semua status" options={[{ value: "NOT_OPEN", label: "Belum Dibuka" }, { value: "OPEN", label: "Sedang Berlangsung" }, { value: "FINISHED", label: "Selesai" }]} onValueChange={setStatus} /></label>
      </section>
      {loading ? <p className="muted">Memuat Pelaksanaan Evaluasi…</p> : visible.length ? <section className="evaluation-campaign-list">{visible.map((campaign) => <article className="panel evaluation-campaign-card" key={campaign.id}><div className="evaluation-campaign-card__main"><div className="evaluation-campaign-card__title"><h2>{campaign.training.name}</h2><span className={`status-badge evaluation-status-${campaign.status.toLowerCase()}`}>{statusLabels[campaign.status]}</span></div><p><strong>Angkatan:</strong> {campaign.cohorts.map((item) => item.name).join(" & ")}</p><p><strong>Template:</strong> {campaign.template.name} · Versi {campaign.template.version}</p>{campaign.schedule.mode === "SCHEDULED" && <small>{formatDateTimeForDisplay(campaign.schedule.opensAt)} – {formatDateTimeForDisplay(campaign.schedule.closesAt)}</small>}<strong>{campaign.respondentCount} / {campaign.totalParticipants} peserta</strong></div><div className="evaluation-campaign-card__actions"><button className="button button--secondary" onClick={() => void copyLink(campaign.slug)}><ClipboardCopy /> Salin Link</button><Link className="button" to={`/admin/evaluasi/pelaksanaan/${campaign.id}`}>Buka</Link></div></article>)}</section> : <section className="panel empty-state"><ClipboardList /><strong>Belum ada Pelaksanaan Evaluasi</strong><p>Buat Evaluasi untuk Pelatihan dan Angkatan pada Tahun Aktif ini.</p></section>}
    </>}

    {createOpen && <ModalPortal onClose={() => setCreateOpen(false)} blocked={busy}><section className="participant-modal evaluation-create-modal" role="dialog" aria-modal="true" aria-labelledby="create-evaluation-title"><header className="participant-modal__header"><div><p className="section-label">Pelaksanaan Evaluasi</p><h2 id="create-evaluation-title">Buat Evaluasi</h2><p>Pilih Pelatihan, satu atau beberapa Angkatan, dan Template Published.</p></div><button className="participant-modal__close" type="button" aria-label="Tutup" onClick={() => setCreateOpen(false)}><X /></button></header><form className="participant-modal__form form-stack" onSubmit={(event) => void createCampaign(event)}>{error && <p className="form-message is-error" role="alert">{error}</p>}
      <label>Pelatihan<SearchableSelect required value={draft.trainingId} placeholder="Ketik atau pilih pelatihan" options={catalog.trainings.map((item) => ({ value: item.id, label: item.name }))} onValueChange={(value) => setDraft((current) => ({ ...current, trainingId: value, cohortIds: [] }))} /></label>
      <fieldset className="evaluation-cohort-picker"><legend>Angkatan</legend>{!draft.trainingId ? <p className="muted">Pilih Pelatihan terlebih dahulu.</p> : availableDraftCohorts.length ? availableDraftCohorts.map((cohort) => <label className={cohort.hasCampaign ? "is-disabled" : ""} key={cohort.id}><input type="checkbox" disabled={cohort.hasCampaign} checked={draft.cohortIds.includes(cohort.id)} onChange={(event) => setDraft((current) => ({ ...current, cohortIds: event.target.checked ? [...current.cohortIds, cohort.id] : current.cohortIds.filter((id) => id !== cohort.id) }))} /><span><strong>{cohort.name}</strong>{cohort.hasCampaign && <small>Sudah memiliki Evaluasi</small>}</span></label>) : <p className="muted">Belum ada Angkatan pada Pelatihan ini.</p>}</fieldset>
      <label>Template Evaluasi<SearchableSelect required value={draft.templateId} placeholder="Pilih Template Published" options={catalog.templates.map((item) => ({ value: item.id, label: `${item.name} · Versi ${item.version}` }))} onValueChange={(value) => setDraft((current) => ({ ...current, templateId: value }))} /></label>
      <fieldset className="schedule-mode-control"><legend>Mode buka</legend><button type="button" className={draft.mode === "OPEN_NOW" ? "is-active" : ""} onClick={() => setDraft((current) => ({ ...current, mode: "OPEN_NOW" }))}>Buka Sekarang</button><button type="button" className={draft.mode === "SCHEDULED" ? "is-active" : ""} onClick={() => setDraft((current) => ({ ...current, mode: "SCHEDULED" }))}>Set Jadwal</button></fieldset>
      {draft.mode === "SCHEDULED" && <><div className="schedule-editor-fields evaluation-schedule-fields"><label>Tanggal/Jam Buka<DateTimeInput required value={draft.opensAt} aria-label="Tanggal dan jam buka Evaluasi" onValueChange={(value) => setDraft((current) => ({ ...current, opensAt: value }))} /></label><label>Tanggal/Jam Tutup<DateTimeInput required value={draft.closesAt} aria-label="Tanggal dan jam tutup Evaluasi" onValueChange={(value) => setDraft((current) => ({ ...current, closesAt: value }))} /></label></div>{scheduleInvalid && <p className="form-message is-error" role="alert">Waktu tutup harus setelah waktu buka.</p>}</>}
      <footer className="participant-modal__actions"><button type="button" className="button button--secondary" onClick={() => setCreateOpen(false)}>Batal</button><button className="button" disabled={busy || !draft.trainingId || !draft.templateId || !draft.cohortIds.length || scheduleIncomplete || scheduleInvalid}>{busy ? "Menyimpan…" : "Buat Evaluasi"}</button></footer>
    </form></section></ModalPortal>}
  </>;
}
