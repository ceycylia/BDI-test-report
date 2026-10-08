import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SearchInput } from "../../components/ui/SearchInput";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { adminQuery } from "../../features/admin-auth/admin-api";
import { formatDateForDisplay } from "../../features/dates/date-format";
import type { TrainingSummary } from "../../features/training/types";
import { ActiveYearIndicator, useActiveYear, withActiveYear } from "../../features/active-year/ActiveYearProvider";
import { ADMIN_PAGE_SIZE, Pagination, type PaginationMeta } from "../../components/ui/Pagination";

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
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: ADMIN_PAGE_SIZE, total: 0, totalPages: 1 });
  const [catalog, setCatalog] = useState<{ trainings: Array<{ id: string; name: string }>; materials: Array<{ id: string; training_id: string; name: string }>; cohorts: Array<{ id: string; training_id: string; name: string }> }>({ trainings: [], materials: [], cohorts: [] });

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    async function loadSessions() {
      try {
        const query = new URLSearchParams({ year: String(activeYear), page: String(page), limit: String(ADMIN_PAGE_SIZE) });
        if (debouncedSearch) query.set("search", debouncedSearch);
        if (trainingId) query.set("trainingId", trainingId);
        if (materialId) query.set("materialId", materialId);
        if (cohortId) query.set("cohortId", cohortId);
        if (scheduleStatus) query.set("scheduleStatus", scheduleStatus);
        const payload = await adminQuery<{ sessions: TrainingSummary[]; pagination: PaginationMeta }>(`/api/admin/training?${query}`);
        if (!mounted) return;
        if (page > payload.pagination.totalPages) { setPage(payload.pagination.totalPages); return; }
        setSessions(payload.sessions);
        setPagination(payload.pagination);
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
  }, [activeYear, cohortId, debouncedSearch, materialId, page, scheduleStatus, trainingId]);

  useEffect(() => {
    void adminQuery<{ trainings: Array<{ id: string; name: string }>; materials: Array<{ id: string; training_id: string; name: string }>; cohorts: Array<{ id: string; training_id: string; name: string }> }>(withActiveYear("/api/admin/participants/catalog", activeYear)).then(setCatalog).catch(() => undefined);
  }, [activeYear]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim().toLocaleLowerCase("id")), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const trainingOptions = useMemo(() => catalog.trainings.map((training) => ({ value: training.id, label: training.name })), [catalog.trainings]);

  const materialOptions = useMemo(() => [...new Map(
    catalog.materials.filter((material) => material.training_id === trainingId).map((material) => [material.id, { value: material.id, label: material.name }] as const),
  ).values()], [catalog.materials, trainingId]);

  const cohortOptions = useMemo(() => [...new Map(
    catalog.cohorts.filter((cohort) => cohort.training_id === trainingId).map((cohort) => [cohort.id, { value: cohort.id, label: cohort.name }] as const),
  ).values()], [catalog.cohorts, trainingId]);

  useEffect(() => { setPage(1); }, [activeYear, cohortId, debouncedSearch, materialId, scheduleStatus, trainingId]);

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
      {!loading && sessions.length === 0 && !hasFilters && (
        <div className="empty-state admin-empty"><strong>Belum ada Test pada tahun {activeYear}</strong><p>Buat Test berdasarkan materi, angkatan, jadwal, dan passing grade.</p></div>
      )}
      {!loading && sessions.length === 0 && pagination.total === 0 && hasFilters && (
        <div className="empty-state admin-empty"><strong>Test tidak ditemukan</strong><p>{hasFilters ? "Ubah atau hapus pencarian dan filter yang digunakan." : "Belum ada data yang dapat ditampilkan."}</p></div>
      )}
      <div className="training-list">
        {sessions.map((session) => (
          <article className="training-list__item" key={session.id}>
            <div className="training-list__content">
              <div className="bank-list__title-row">
                <h2>{session.materialName}</h2>
                <span className={`status-badge schedule-status-${session.scheduleStatus.toLowerCase()}`}>{scheduleLabels[session.scheduleStatus]}</span>
              </div>
              <p>{session.trainingName}{session.cohorts.length ? ` · ${session.cohorts.map((cohort) => cohort.name).join(", ")}` : ""}</p>
              <span>{session.questionCount} soal · {session.durationMinutes} menit · {formatDateForDisplay(session.trainingStartDate)} – {formatDateForDisplay(session.trainingEndDate)}</span>
            </div>
            <Link className="button button--secondary" to={`/admin/pelatihan/${session.id}`}>Buka</Link>
          </article>
        ))}
      </div>
      <Pagination pagination={pagination} itemLabel="test" loading={loading} onPageChange={setPage} />
    </>
  );
}
