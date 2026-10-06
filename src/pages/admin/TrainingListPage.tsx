import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SearchInput } from "../../components/ui/SearchInput";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { adminQuery } from "../../features/admin-auth/admin-api";
import { formatDateForDisplay } from "../../features/dates/date-format";
import type { TrainingSummary } from "../../features/training/types";
import { ActiveYearIndicator, useActiveYear, withActiveYear } from "../../features/active-year/ActiveYearProvider";

const scheduleLabels: Record<TrainingSummary["scheduleStatus"], string> = {
  NOT_OPEN: "Belum Dibuka",
  ONGOING: "Sedang Berlangsung",
  FINISHED: "Selesai",
};

export function TrainingListPage() {
  const { activeYear } = useActiveYear();
  const [sessions, setSessions] = useState<TrainingSummary[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [trainingId, setTrainingId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [scheduleStatus, setScheduleStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    async function loadSessions() {
      try {
        const payload = await adminQuery<{ sessions: TrainingSummary[] }>(withActiveYear("/api/admin/training", activeYear));
        if (!mounted) return;
        setSessions(payload.sessions);
        setError(null);
      } catch (reason) {
        if (mounted) setError(reason instanceof Error ? reason.message : "Pelatihan tidak dapat dimuat.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadSessions();
    const interval = window.setInterval(() => void loadSessions(), 60_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [activeYear]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim().toLocaleLowerCase("id")), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const trainingOptions = useMemo(() => [...new Map(
    sessions.filter((session) => session.trainingId).map((session) => [
      session.trainingId,
      { value: session.trainingId, label: session.trainingName },
    ] as const),
  ).values()], [sessions]);

  const materialOptions = useMemo(() => [...new Map(
    sessions
      .filter((session) => session.trainingId === trainingId && session.materialId)
      .map((session) => [session.materialId, { value: session.materialId, label: session.materialName }] as const),
  ).values()], [sessions, trainingId]);

  const cohortOptions = useMemo(() => [...new Map(
    sessions
      .filter((session) => session.trainingId === trainingId)
      .flatMap((session) => session.cohorts)
      .map((cohort) => [cohort.id, { value: cohort.id, label: cohort.name }] as const),
  ).values()], [sessions, trainingId]);

  const filteredSessions = useMemo(() => sessions.filter((session) => {
    if (trainingId && session.trainingId !== trainingId) return false;
    if (materialId && session.materialId !== materialId) return false;
    if (cohortId && !session.cohorts.some((cohort) => cohort.id === cohortId)) return false;
    if (scheduleStatus && session.scheduleStatus !== scheduleStatus) return false;
    if (!debouncedSearch) return true;
    return [
      session.materialName,
      session.trainingName,
      ...session.cohorts.map((cohort) => cohort.name),
    ].some((value) => value.toLocaleLowerCase("id").includes(debouncedSearch));
  }), [cohortId, debouncedSearch, materialId, scheduleStatus, sessions, trainingId]);

  const hasFilters = Boolean(search || trainingId || materialId || cohortId || scheduleStatus);

  return (
    <>
      <header className="admin-page-header">
        <div><p className="section-label">Tes & Hasil</p><h1>Pelaksanaan Tes</h1><ActiveYearIndicator /></div>
        <div className="page-header-actions"><Link className="button" to="/admin/pelatihan/baru">+ Buat Test</Link></div>
      </header>
      <nav className="catalog-tabs test-result-tabs" aria-label="Bagian tes dan hasil"><Link className="is-active" to="/admin/pelatihan" aria-current="page">Pelaksanaan Tes</Link><Link to="/admin/hasil">Lihat Hasil</Link></nav>
      <section className="panel test-execution-filters" aria-label="Filter pelaksanaan tes">
        <label>Cari Test<SearchInput value={search} onValueChange={setSearch} placeholder="Materi, pelatihan, atau angkatan" /></label>
        <label>Pelatihan<SearchableSelect value={trainingId} placeholder="Semua pelatihan" options={trainingOptions} onValueChange={(value) => { setTrainingId(value); setMaterialId(""); setCohortId(""); }} /></label>
        <label>Materi<SearchableSelect disabled={!trainingId} value={materialId} placeholder={trainingId ? "Semua materi" : "Pilih pelatihan terlebih dahulu"} options={materialOptions} onValueChange={setMaterialId} /></label>
        <label>Angkatan<SearchableSelect disabled={!trainingId} value={cohortId} placeholder={trainingId ? "Semua angkatan" : "Pilih pelatihan terlebih dahulu"} options={cohortOptions} onValueChange={setCohortId} /></label>
        <label>Status/Jadwal<SearchableSelect value={scheduleStatus} placeholder="Semua status" options={[
          { value: "NOT_OPEN", label: "Belum Dibuka" },
          { value: "ONGOING", label: "Sedang Berlangsung" },
          { value: "FINISHED", label: "Selesai" },
        ]} onValueChange={setScheduleStatus} /></label>
      </section>
      {error && <p className="form-message is-error">{error}</p>}
      {loading && <p className="muted">Memuat pelatihan…</p>}
      {!loading && sessions.length === 0 && (
        <div className="empty-state admin-empty"><strong>Belum ada Test pada tahun {activeYear}</strong><p>Buat Test berdasarkan materi, angkatan, jadwal, dan passing grade.</p></div>
      )}
      {!loading && sessions.length > 0 && filteredSessions.length === 0 && (
        <div className="empty-state admin-empty"><strong>Test tidak ditemukan</strong><p>{hasFilters ? "Ubah atau hapus pencarian dan filter yang digunakan." : "Belum ada data yang dapat ditampilkan."}</p></div>
      )}
      <div className="training-list">
        {filteredSessions.map((session) => (
          <article className="training-list__item" key={session.id}>
            <div className="training-list__content">
              <div className="bank-list__title-row">
                <h2>{session.materialName}</h2>
                <span className={`status-badge schedule-status-${session.scheduleStatus.toLowerCase()}`}>{scheduleLabels[session.scheduleStatus]}</span>
              </div>
              <p>{session.trainingName}{session.cohorts.length ? ` · ${session.cohorts.map((cohort) => cohort.name).join(", ")}` : ""}</p>
              <span>{session.questionCount} soal · 15 menit · {formatDateForDisplay(session.trainingStartDate)} – {formatDateForDisplay(session.trainingEndDate)}</span>
            </div>
            <Link className="button button--secondary" to={`/admin/pelatihan/${session.id}`}>Buka</Link>
          </article>
        ))}
      </div>
    </>
  );
}
