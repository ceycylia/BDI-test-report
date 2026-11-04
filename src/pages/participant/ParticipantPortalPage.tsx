import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { dashboardStageCards, type DashboardTest, type DashboardStageCard } from "../../features/participant-entry/dashboard-stages";
import { readRememberedParticipant, rememberParticipant } from "../../features/participant-entry/remembered-participant";
import { PublicLayout } from "../../layouts/PublicLayout";

type Cohort = { id: string; training_id: string; name: string; training_name: string; funding_source: string };
type Dashboard = { participant: { name: string; nik: string }; training: { id: string; name: string }; cohort: { id: string; name: string }; tests: DashboardTest[] };
type InitialState = { trainingId?: string; cohortId?: string; name?: string; nik?: string; autoOpen?: boolean } | null;
const stageNames = { PRE: "Pre-Test", POST: "Post-Test", REMEDIAL_1: "Remedial 1", REMEDIAL_2: "Remedial 2" } as const;

export function ParticipantPortalPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initial = location.state as InitialState;
  const remembered = readRememberedParticipant(window.localStorage);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [cohortId, setCohortId] = useState(initial?.cohortId ?? remembered?.cohortId ?? "");
  const [name, setName] = useState(initial?.name ?? remembered?.name ?? "");
  const [nik, setNik] = useState(initial?.nik ?? remembered?.nik ?? "");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedCohort = useMemo(() => cohorts.find((cohort) => cohort.id === cohortId), [cohorts, cohortId]);

  useEffect(() => {
    let active = true;
    void fetch("/api/public/participants/catalog")
      .then(async (response) => {
        if (!response.ok) throw new Error("Daftar Angkatan tidak dapat dimuat.");
        const data = await response.json() as { cohorts: Cohort[] };
        if (active) setCohorts(data.cohorts);
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Daftar Angkatan tidak dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function openDashboard(target: { cohortId: string; name: string; nik: string }, silent = false) {
    const cohort = cohorts.find((item) => item.id === target.cohortId);
    if (!cohort) { if (!silent) setError("Pilih Angkatan yang sesuai."); return; }
    if (!silent) setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/public/participants/dashboard", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ trainingId: cohort.training_id, cohortId: target.cohortId, name: target.name, nik: target.nik }),
      });
      const data = await response.json() as Dashboard & { error?: { message?: string } };
      if (!response.ok || !data.participant) throw new Error(data.error?.message ?? "Data peserta tidak dapat dimuat.");
      setDashboard(data);
      setName(data.participant.name);
      setNik(data.participant.nik);
      rememberParticipant(window.localStorage, { name: data.participant.name, nik: data.participant.nik, cohortId: target.cohortId });
    } catch (reason) { if (!silent) setError(reason instanceof Error ? reason.message : "Data peserta tidak dapat dimuat."); }
    finally { if (!silent) setBusy(false); }
  }

  useEffect(() => {
    if (!cohorts.length || !initial?.autoOpen || !initial.cohortId || !initial.name || !initial.nik) return;
    void openDashboard({ cohortId: initial.cohortId, name: initial.name, nik: initial.nik });
    navigate(location.pathname, { replace: true, state: null });
  }, [cohorts]);

  useEffect(() => {
    if (!dashboard) return;
    const refresh = () => void openDashboard({ cohortId: dashboard.cohort.id, name: dashboard.participant.name, nik: dashboard.participant.nik }, true);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [dashboard?.cohort.id, dashboard?.participant.nik, cohorts]);

  async function start(test: DashboardTest, card: DashboardStageCard) {
    if (busy || (card.state !== "ready" && card.state !== "remedial")) return;
    setBusy(true); setError("");
    try {
      sessionStorage.setItem(`bdi-participant:${test.slug}`, JSON.stringify({ participantId: test.participantId, batchId: test.batchId }));
      sessionStorage.setItem(`bdi-dashboard-return:${test.slug}`, "1");
      const response = await fetch(`/api/public/training/${encodeURIComponent(test.slug)}/attempts/start`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ participantId: test.participantId, batchId: test.batchId, stage: card.stage }),
      });
      const data = await response.json() as { attempt?: { id: string }; error?: { message?: string } };
      if (!response.ok || !data.attempt) throw new Error(data.error?.message ?? "Tes belum dapat dimulai.");
      navigate(`/t/${test.slug}/attempt/${data.attempt.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Tes belum dapat dimulai."); }
    finally { setBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void openDashboard({ cohortId, name, nik });
  }

  return <PublicLayout><section className="entry-card participant-portal-card">
    <Link className="participant-home-back" to="/">← Halaman utama</Link>
    <p className="entry-card__eyebrow">Dashboard Peserta</p>
    <h1>Ujian Mata Diklat</h1>
    {loading && <p>Memuat Angkatan…</p>}
    {error && <p className="form-message is-error" role="alert">{error}</p>}
    {!loading && <form className="participant-entry-form participant-portal-form" onSubmit={submit}>
      <label>Pelatihan dan Angkatan<select required value={cohortId} onChange={(event) => { setCohortId(event.target.value); setDashboard(null); }}><option value="">Pilih pelatihan dan angkatan</option>{cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.training_name} — {cohort.name} ({cohort.funding_source === "PNBP" ? "PNBP" : "Rupiah Murni"})</option>)}</select></label>
      <label>Nama Lengkap<input required minLength={2} maxLength={150} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>NIK<input required minLength={3} maxLength={40} inputMode="numeric" pattern="[0-9]+" value={nik} onChange={(event) => setNik(event.target.value.replace(/\D/gu, "").slice(0, 40))} /></label>
      <button className="button participant-primary-button" disabled={busy || !selectedCohort}>{busy ? "Memuat…" : "Lanjutkan"}</button>
    </form>}
    {dashboard && <div className="participant-dashboard-results"><h2>{dashboard.participant.name}</h2><p>{dashboard.training.name} · {dashboard.cohort.name}</p>
      {!dashboard.tests.length && <p>Belum ada tes untuk Angkatan ini.</p>}
      {dashboard.tests.map((test) => <section className="participant-dashboard-material" key={test.sessionId}><h3>{test.materialName}</h3><div className="participant-dashboard-stages">{dashboardStageCards(test).map((card) => <button type="button" key={card.stage} className={`participant-dashboard-stage is-${card.state}`} disabled={busy || (card.state !== "ready" && card.state !== "remedial")} onClick={() => void start(test, card)}><strong>{stageNames[card.stage as keyof typeof stageNames] ?? card.stage}</strong><span>{card.label}</span></button>)}</div></section>)}
    </div>}
  </section></PublicLayout>;
}
