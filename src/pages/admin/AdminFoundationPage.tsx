import { BookOpenText, CalendarDays, CheckCircle2, ChevronRight, CircleX, Clock3, FilePenLine, FileQuestion, GraduationCap, UserRound, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDateForDisplay } from "../../features/dates/date-format";
import { adminQuery } from "../../features/admin-auth/admin-api";
import { useAdminAuth } from "../../features/admin-auth/AuthProvider";
import type { TrainingSummary } from "../../features/training/types";
import { ActiveYearIndicator, useActiveYear, withActiveYear } from "../../features/active-year/ActiveYearProvider";

const metricCards = [
  { key: "trainings", label: "Pelatihan", note: "Pelatihan yang dijalankan", tone: "blue", icon: GraduationCap, to: "/admin/pelatihan" },
  { key: "tests", label: "Test", note: "Pelaksanaan test terdaftar", tone: "teal", icon: FileQuestion, to: "/admin/pelatihan" },
  { key: "participants", label: "Peserta", note: "Peserta pada tahun aktif", tone: "violet", icon: Users, to: "/admin/peserta" },
  { key: "passed", label: "Lulus", note: "Peserta yang dinyatakan lulus", tone: "green", icon: CheckCircle2, to: "/admin/hasil" },
  { key: "not_passed", label: "Belum Lulus", note: "Peserta dengan hasil belum lulus", tone: "red", icon: CircleX, to: "/admin/hasil" },
  { key: "certificates", label: "Sertifikat", note: "Sertifikat peserta tersimpan", tone: "orange", icon: BookOpenText, to: "/admin/peserta" },
] as const;

type DashboardActivity = {
  type: string;
  subject: string;
  detail: string;
  occurredAt: string;
};

const activityConfig: Record<string, { label: string; tone: string; icon: typeof UserRound }> = {
  ATTEMPT_STARTED: { label: "Peserta memulai tes", tone: "blue", icon: UserRound },
  ATTEMPT_SUBMITTED: { label: "Peserta menyelesaikan tes", tone: "violet", icon: FileQuestion },
  PARTICIPANT_PASSED: { label: "Peserta lulus", tone: "green", icon: CheckCircle2 },
  TRAINING_ACTIVATED: { label: "Pelatihan diaktifkan", tone: "blue", icon: GraduationCap },
  BANK_UPDATED: { label: "Bank soal diperbarui", tone: "orange", icon: FilePenLine },
};
const defaultActivityConfig = { label: "Aktivitas tes", tone: "violet", icon: FileQuestion };

function parseDatabaseDate(value: string) {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}

function relativeTime(value: string, now: Date) {
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - parseDatabaseDate(value).getTime()) / 60_000));
  if (elapsedMinutes < 1) return "baru saja";
  if (elapsedMinutes < 60) return `${elapsedMinutes} menit yang lalu`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `${hours} jam yang lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari yang lalu`;
}

export function AdminFoundationPage() {
  const { admin } = useAdminAuth();
  const { activeYear, availableYears, setActiveYear } = useActiveYear();
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null);
  const [trainings, setTrainings] = useState<TrainingSummary[]>([]);
  const [activities, setActivities] = useState<DashboardActivity[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      try {
        const [dashboard, trainingData] = await Promise.all([
          adminQuery<{ metrics: Record<string, number>; activities: DashboardActivity[] }>(withActiveYear("/api/admin/dashboard", activeYear)),
          adminQuery<{ sessions: TrainingSummary[] }>(withActiveYear("/api/admin/training", activeYear)),
        ]);
        if (!active) return;
        setMetrics(dashboard.metrics);
        setActivities(dashboard.activities);
        setTrainings(trainingData.sessions.filter((item) => item.scheduleStatus === "ONGOING"));
        setError(null);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Ringkasan tidak dapat dimuat.");
      }
    }
    setError(null);
    void loadDashboard();
    const refreshTimer = window.setInterval(() => void loadDashboard(), 60_000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [activeYear]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const today = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(now);
  const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(now);
  const currentTime = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(now);

  return <>
    <header className="dashboard-header"><div><p className="section-label">Dashboard</p><h1>Ringkasan sistem tes</h1><p>Selamat datang, <strong>{admin?.name}</strong>! Berikut adalah ringkasan aktivitas sistem tes pelatihan.</p><ActiveYearIndicator /></div><div className="dashboard-header__tools"><label className="active-year-select"><span>Tahun Aktif</span><select value={activeYear} onChange={(event) => setActiveYear(Number(event.target.value))}>{availableYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label><div className="today-card"><CalendarDays /><span><small>Hari ini</small><strong>{today}</strong><em>{weekday}, {currentTime}</em></span></div></div></header>
    {error && <p className="form-message is-error">{error}</p>}
    <section className="metric-grid" aria-label="Ringkasan data">
      {metricCards.map(({ key, label, note, tone, icon: Icon, to }) => <Link to={to} className="metric-card" key={key}><span className={`metric-card__icon tone-${tone}`}><Icon /></span><span className="metric-card__copy"><strong>{metrics?.[key] ?? "—"}</strong><b>{label}</b><small>{note}</small></span><ChevronRight className="metric-card__arrow" /></Link>)}
    </section>
    <div className="dashboard-lower-grid">
      <section className="dashboard-section panel">
        <div className="dashboard-section__header"><div className="panel-heading"><span className="heading-icon"><GraduationCap /></span><div><h2>Pelatihan Aktif</h2><p>Daftar pelatihan yang sedang berlangsung saat ini.</p></div></div><Link className="button button--secondary button--small" to="/admin/pelatihan">Lihat Semua <ChevronRight /></Link></div>
        {trainings.length ? <div className="active-training-list">{trainings.map((training) => <Link to={`/admin/pelatihan/${training.id}`} className="active-training-item" key={training.id}><div><strong>{training.name}</strong><span><CalendarDays /> {formatDateForDisplay(training.trainingStartDate)} – {formatDateForDisplay(training.trainingEndDate)}</span><span><FileQuestion /> {training.questionCount} soal · {training.durationMinutes} menit</span></div><span className="status-badge is-active"><span className="status-dot" />Sedang Berlangsung</span><ChevronRight /></Link>)}</div> : <div className="empty-state compact"><GraduationCap /><strong>Tidak ada test yang sedang berlangsung</strong><p>Test akan tampil di sini ketika jadwalnya sedang dibuka.</p></div>}
      </section>
      <section className="activity-panel panel">
        <div className="panel-heading"><span className="heading-icon"><Clock3 /></span><div><h2>Aktivitas Terbaru</h2><p>Aktivitas hari ini, diperbarui otomatis.</p></div></div>
        {activities.length ? <div className="activity-list">{activities.map((activity, index) => { const config = activityConfig[activity.type] ?? defaultActivityConfig; const Icon = config.icon; return <article className="activity-item" key={`${activity.type}-${activity.occurredAt}-${index}`}><span className={`activity-item__icon tone-${config.tone}`}><Icon /></span><span className="activity-item__copy"><strong>{config.label}</strong><small>{activity.subject} · {activity.detail}</small></span><time dateTime={activity.occurredAt}>{relativeTime(activity.occurredAt, now)}</time></article>; })}</div> : <div className="activity-empty"><Clock3 /><p>Belum ada aktivitas hari ini.</p></div>}
      </section>
    </div>
  </>;
}
