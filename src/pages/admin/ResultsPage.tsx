import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminQuery } from "../../features/admin-auth/admin-api";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { SearchInput } from "../../components/ui/SearchInput";
import { ActiveYearIndicator, useActiveYear, withActiveYear } from "../../features/active-year/ActiveYearProvider";
import { ADMIN_PAGE_SIZE, Pagination, type PaginationMeta } from "../../components/ui/Pagination";

type ResultRow = {
  id: string; name: string; batch_id: string; batch_name: string; training_id: string; training_name: string;
  material_id: string; material_name: string; cohort_id: string; cohort_name: string;
  pre_score: number | null; post_score: number | null; remedial_1_score: number | null;
  remedial_2_score: number | null; final_post_score: number | null; passing_score: number;
  result_status: "LULUS" | "BELUM_LULUS" | "BELUM_POST" | "BELUM_PRE" | "SEDANG_MENGERJAKAN";
};

type FilterOptions = {
  trainings: Array<{ id: string; name: string }>;
  materials: Array<{ id: string; training_id: string; name: string }>;
  cohorts: Array<{ id: string; training_id: string; name: string }>;
};

export function ResultsPage() {
  const { activeYear } = useActiveYear();
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ trainings: [], materials: [], cohorts: [] });
  const [search, setSearch] = useState("");
  const [trainingId, setTrainingId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: ADMIN_PAGE_SIZE, total: 0, totalPages: 1 });
  const [error, setError] = useState<string | null>(null);

  const load = (params: URLSearchParams, requestedPage = page) => {
    params.set("year", String(activeYear));
    params.set("page", String(requestedPage)); params.set("limit", String(ADMIN_PAGE_SIZE));
    return adminQuery<{ results: ResultRow[]; pagination: PaginationMeta }>(`/api/admin/results?${params}`).then((data) => { setRows(data.results); setPagination(data.pagination); });
  };
  useEffect(() => {
    setTrainingId(""); setMaterialId(""); setCohortId("");
    void Promise.all([
      adminQuery<{ results: ResultRow[]; pagination: PaginationMeta }>(withActiveYear(`/api/admin/results?page=1&limit=${ADMIN_PAGE_SIZE}`, activeYear)),
      adminQuery<FilterOptions>(withActiveYear("/api/admin/results/options", activeYear)),
    ]).then(([resultData, optionData]) => {
      setRows(resultData.results);
      setPagination(resultData.pagination);
      setFilterOptions(optionData);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Hasil tidak dapat dimuat."));
  }, [activeYear]);
  useEffect(() => { setPage(1); }, [search, trainingId, materialId, cohortId, status]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (trainingId) params.set("trainingId", trainingId);
    if (materialId) params.set("materialId", materialId);
    if (cohortId) params.set("cohortId", cohortId);
    if (status) params.set("status", status);
    const timer = window.setTimeout(() => { void load(params, page).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Filter gagal diterapkan.")); }, 250);
    return () => window.clearTimeout(timer);
  }, [activeYear, search, trainingId, materialId, cohortId, status, page]);

  const materials = useMemo(() => filterOptions.materials.filter((material) => material.training_id === trainingId), [filterOptions.materials, trainingId]);
  const cohorts = useMemo(() => filterOptions.cohorts.filter((cohort) => cohort.training_id === trainingId), [filterOptions.cohorts, trainingId]);
  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (trainingId) params.set("trainingId", trainingId);
    if (materialId) params.set("materialId", materialId);
    if (cohortId) params.set("cohortId", cohortId);
    if (status) params.set("status", status);
    params.set("year", String(activeYear));
    return `/api/admin/results/export?${params}`;
  }, [activeYear, search, trainingId, materialId, cohortId, status]);

  return <>
    <header className="admin-page-header"><div><p className="section-label">Tes & Hasil</p><h1>Hasil peserta</h1><ActiveYearIndicator /></div><div className="page-header-actions"><a className="button" href={exportUrl} download>Export Excel</a></div></header>
    <nav className="catalog-tabs test-result-tabs" aria-label="Bagian tes dan hasil"><Link to="/admin/pelatihan">Pelaksanaan Tes</Link><Link className="is-active" to="/admin/hasil" aria-current="page">Lihat Hasil</Link></nav>
    <section className="panel result-filters"><label>Cari nama<SearchInput value={search} onValueChange={setSearch} placeholder="Nama peserta" /></label><label>Pelatihan<SearchableSelect value={trainingId} placeholder="Semua pelatihan" options={filterOptions.trainings.map((training) => ({ value: training.id, label: training.name }))} onValueChange={(value) => { setTrainingId(value); setMaterialId(""); setCohortId(""); }} /></label><label>Materi<SearchableSelect disabled={!trainingId} value={materialId} placeholder={trainingId ? "Semua materi" : "Pilih pelatihan terlebih dahulu"} options={materials.map((material) => ({ value: material.id, label: material.name }))} onValueChange={setMaterialId} /></label><label>Angkatan<SearchableSelect disabled={!trainingId} value={cohortId} placeholder={trainingId ? "Semua angkatan" : "Pilih pelatihan terlebih dahulu"} options={cohorts.map((cohort) => ({ value: cohort.id, label: cohort.name }))} onValueChange={setCohortId} /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Semua</option><option value="LULUS">Lulus</option><option value="BELUM_LULUS">Belum lulus</option><option value="BELUM_POST">Belum mulai Post-Test</option><option value="BELUM_PRE">Belum mulai Pre-Test</option><option value="SEDANG_MENGERJAKAN">Sedang mengerjakan</option></select></label></section>
    {error && <p className="form-message is-error">{error}</p>}
    <div className="results-table-wrap"><table className="results-table"><thead><tr><th>Peserta</th><th>Pelatihan · Materi · Angkatan</th><th>Status</th><th>Pre</th><th>Post</th><th>Rem 1</th><th>Rem 2</th><th>Final</th><th>Aksi</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.training_name}<small>{row.material_name} · {row.cohort_name}</small></td><td><span className={`status-badge result-${row.result_status.toLowerCase()}`}>{row.result_status.replaceAll("_", " ")}</span></td><td>{row.pre_score ?? "—"}</td><td>{row.post_score ?? "—"}</td><td>{row.remedial_1_score ?? "—"}</td><td>{row.remedial_2_score ?? "—"}</td><td><strong>{row.final_post_score ?? "—"}</strong></td><td><Link className="button button--secondary" to={`/admin/hasil/${row.id}`}>Detail</Link></td></tr>)}</tbody></table></div>
    {!rows.length && <p className="muted">Belum ada peserta yang sesuai filter.</p>}
    <Pagination pagination={pagination} itemLabel="hasil peserta" onPageChange={setPage} />
  </>;
}
