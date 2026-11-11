import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppMark } from "../../components/ui/AppMark";
import { dashboardStageCards, type DashboardTest, type DashboardStageCard } from "../../features/participant-entry/dashboard-stages";
import { readRememberedParticipant, rememberParticipant } from "../../features/participant-entry/remembered-participant";
import { PublicLayout } from "../../layouts/PublicLayout";

type DashboardGroup = {
  profileId: string;
  participantName: string;
  training: { id: string; name: string };
  cohort: { id: string; name: string };
  tests: DashboardTest[];
};

type Dashboard = {
  participant: { name: string; nik: string };
  groups: DashboardGroup[];
  nextRefreshAt: string | null;
};

type PortalLocationState = {
  prefill?: { name?: string; nik?: string };
  autoOpen?: boolean;
} | null;

const stageNames = {
  PRE: "Pre-Test",
  POST: "Post-Test",
  REMEDIAL_1: "Remedial 1",
  REMEDIAL_2: "Remedial 2",
} as const;

export function ParticipantPortalPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initial = location.state as PortalLocationState;
  const remembered = readRememberedParticipant(window.localStorage);
  const [name, setName] = useState(initial?.prefill?.name ?? remembered?.name ?? "");
  const [nik, setNik] = useState(initial?.prefill?.nik ?? remembered?.nik ?? "");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const autoOpened = useRef(false);

  async function openDashboard(target: { name: string; nik: string }, silent = false) {
    if (!silent) setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/public/participants/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(target),
      });
      const data = await response.json() as Dashboard & { error?: { message?: string } };
      if (!response.ok || !data.participant) {
        throw new Error(data.error?.message ?? "Data peserta tidak dapat dimuat.");
      }
      setDashboard(data);
      setName(data.participant.name);
      setNik(data.participant.nik);
      rememberParticipant(window.localStorage, {
        name: data.participant.name,
        nik: data.participant.nik,
      });
    } catch (reason) {
      if (!silent) {
        setDashboard(null);
        setError(reason instanceof Error ? reason.message : "Data peserta tidak dapat dimuat.");
      }
    } finally {
      if (!silent) setBusy(false);
    }
  }

  useEffect(() => {
    if (!initial?.autoOpen || autoOpened.current || !name || !nik) return;
    autoOpened.current = true;
    void openDashboard({ name, nik });
    navigate(location.pathname, { replace: true, state: null });
  }, [initial?.autoOpen, location.pathname, name, navigate, nik]);

  useEffect(() => {
    if (!dashboard) return;
    const refresh = () => {
      if (document.visibilityState === "visible") {
        void openDashboard({ name: dashboard.participant.name, nik: dashboard.participant.nik }, true);
      }
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [dashboard?.participant.nik]);

  useEffect(() => {
    if (!dashboard?.nextRefreshAt) return;
    const target = Date.parse(dashboard.nextRefreshAt);
    if (!Number.isFinite(target)) return;
    const delay = Math.max(0, Math.min(target - Date.now() + 300, 2_147_000_000));
    const timer = window.setTimeout(() => {
      void openDashboard({ name: dashboard.participant.name, nik: dashboard.participant.nik }, true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [dashboard?.nextRefreshAt, dashboard?.participant.nik]);

  async function start(test: DashboardTest, card: DashboardStageCard) {
    if (busy || (card.state !== "ready" && card.state !== "remedial")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/public/training/${encodeURIComponent(test.slug)}/attempts/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          profileId: test.profileId,
          participantId: test.participantId ?? undefined,
          batchId: test.batchId,
          stage: card.stage,
        }),
      });
      const data = await response.json() as {
        attempt?: { id: string; participantId: string };
        error?: { message?: string };
      };
      if (!response.ok || !data.attempt) {
        throw new Error(data.error?.message ?? "Tes belum dapat dimulai.");
      }
      sessionStorage.setItem(`bdi-participant:${test.slug}`, JSON.stringify({
        participantId: data.attempt.participantId,
        batchId: test.batchId,
      }));
      sessionStorage.setItem(`bdi-dashboard-return:${test.slug}`, "1");
      navigate(`/t/${test.slug}/attempt/${data.attempt.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Tes belum dapat dimulai.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void openDashboard({ name, nik });
  }

  if (!dashboard) {
    return <main className="admin-login-shell participant-login-shell">
      <section className="admin-login-card participant-login-card" aria-labelledby="participant-login-title">
        <div className="admin-login-brand"><AppMark compact /></div>
        <div className="admin-login-heading participant-login-heading">
          <h1 id="participant-login-title">Masuk Untuk Memulai Pre &amp; Post Test</h1>
        </div>
        <form className="admin-login-form" onSubmit={submit}>
          <label><span>Nama</span><input required minLength={2} maxLength={150} autoComplete="name" autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label><span>NIK</span><input required minLength={3} maxLength={40} inputMode="numeric" pattern="[0-9]+" value={nik} onChange={(event) => setNik(event.target.value.replace(/\D/gu, "").slice(0, 40))} /></label>
          {error && <p className="form-message is-error" role="alert">{error}</p>}
          <button className="button admin-login-submit" type="submit" disabled={busy}>{busy ? "Memeriksa…" : "Masuk"}</button>
        </form>
        <Link className="admin-login-back" to="/">← Kembali ke halaman utama</Link>
      </section>
    </main>;
  }

  return <PublicLayout>
    <section className="entry-card participant-portal-card participant-dashboard-card" aria-labelledby="participant-dashboard-title">
      <Link className="participant-home-back" to="/">← Halaman utama</Link>
      <p className="entry-card__eyebrow">Dashboard Peserta</p>
      <h1 id="participant-dashboard-title">{dashboard.participant.name}</h1>
      <p className="participant-dashboard-guide">Kerjakan semua tes yang tersedia. Tahap berikutnya akan muncul sesuai jadwal dan hasil Anda.</p>
      {error && <p className="form-message is-error" role="alert">{error}</p>}
      <div className="participant-dashboard-results">
        {dashboard.groups.map((group) => <section className="participant-dashboard-group" key={group.profileId}>
          <header className="participant-dashboard-group__header">
            <h2>{group.training.name}</h2>
            <p>{group.cohort.name}</p>
          </header>
          {!group.tests.length && <p className="participant-dashboard-empty">Belum ada tes yang tersedia untuk pelatihan dan angkatan ini.</p>}
          {group.tests.map((test) => <section className="participant-dashboard-material" key={test.sessionId}>
            <h3>{test.materialName}</h3>
            <div className="participant-dashboard-stages">
              {dashboardStageCards(test).map((card) => <button
                type="button"
                key={card.stage}
                className={`participant-dashboard-stage is-${card.state}`}
                disabled={busy || (card.state !== "ready" && card.state !== "remedial")}
                onClick={() => void start(test, card)}
              >
                <strong>{stageNames[card.stage as keyof typeof stageNames] ?? card.stage}</strong>
                <span>{card.label}</span>
              </button>)}
            </div>
          </section>)}
        </section>)}
      </div>
    </section>
  </PublicLayout>;
}
