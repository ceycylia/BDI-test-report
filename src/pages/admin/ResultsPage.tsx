import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminQuery } from "../../features/admin-auth/admin-api";

type ResultRow = {
  id: string; name: string; batch_id: string; batch_name: string; training_id: string; training_name: string;
  pre_score: number | null; post_score: number | null; remedial_1_score: number | null;
  remedial_2_score: number | null; remedial_3_score: number | null; final_post_score: number | null;
  result_status: "LULUS" | "BELUM_LULUS" | "BELUM_POST";
};

export function ResultsPage() {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [allRows, setAllRows] = useState<ResultRow[]>([]);
  const [search, setSearch] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = (query = "") => adminQuery<{ results: ResultRow[] }>(`/api/admin/results${query}`).then((data) => setRows(data.results));
  useEffect(() => { void adminQuery<{ results: ResultRow[] }>("/api/admin/results").then((data) => { setRows(data.results); setAllRows(data.results); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Hasil tidak dapat dimuat.")); }, []);
  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (sessionId) params.set("sessionId", sessionId);
    if (batchId) params.set("batchId", batchId);
    if (status) params.set("status", status);
    const timer = window.setTimeout(() => { void load(params.size ? `?${params}` : "").catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Filter gagal diterapkan.")); }, 250);
    return () => window.clearTimeout(timer);
  }, [search, sessionId, batchId, status]);

  const trainings = useMemo(() => [...new Map(allRows.map((row) => [row.training_id, row.training_name])).entries()], [allRows]);
  const batches = useMemo(() => [...new Map(allRows.filter((row) => !sessionId || row.training_id === sessionId).map((row) => [row.batch_id, row.batch_name])).entries()], [allRows, sessionId]);
  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (sessionId) params.set("sessionId", sessionId);
    if (batchId) params.set("batchId", batchId);
    if (status) params.set("status", status);
    return `/api/admin/results/export${params.size ? `?${params}` : ""}`;
  }, [search, sessionId, batchId, status]);

  return <>
    <header className="admin-page-header"><div><p className="section-label">Hasil</p><h1>Hasil peserta</h1></div><a className="button" href={exportUrl} download>Export Excel</a></header>
    <section className="panel result-filters"><label>Cari nama<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nama peserta" /></label><label>Pelatihan<select value={sessionId} onChange={(event) => { setSessionId(event.target.value); setBatchId(""); }}><option value="">Semua</option>{trainings.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Angkatan<select value={batchId} onChange={(event) => setBatchId(event.target.value)}><option value="">Semua</option>{batches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Semua</option><option value="LULUS">Lulus</option><option value="BELUM_LULUS">Belum lulus</option><option value="BELUM_POST">Belum Post</option></select></label></section>
    {error && <p className="form-message is-error">{error}</p>}
    <section className="results-list">{rows.map((row) => <article className="panel result-row" key={row.id}><div><p className="section-label">{row.training_name} · {row.batch_name}</p><h2>{row.name}</h2><span className={`status-badge result-${row.result_status.toLowerCase()}`}>{row.result_status.replaceAll("_", " ")}</span></div><dl><div><dt>Pre</dt><dd>{row.pre_score ?? "—"}</dd></div><div><dt>Post</dt><dd>{row.post_score ?? "—"}</dd></div><div><dt>Rem 1</dt><dd>{row.remedial_1_score ?? "—"}</dd></div><div><dt>Rem 2</dt><dd>{row.remedial_2_score ?? "—"}</dd></div><div><dt>Rem 3</dt><dd>{row.remedial_3_score ?? "—"}</dd></div><div><dt>Final Post</dt><dd>{row.final_post_score ?? "—"}</dd></div></dl><Link className="button button--secondary" to={`/admin/hasil/${row.id}`}>Lihat detail</Link></article>)}</section>
    {!rows.length && <p className="muted">Belum ada peserta yang sesuai filter.</p>}
  </>;
}
