import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminQuery } from "../../features/admin-auth/admin-api";
import type { TrainingSummary } from "../../features/training/types";
import { formatDateForDisplay } from "../../features/dates/date-format";

export function TrainingListPage() {
  const [sessions, setSessions] = useState<TrainingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void adminQuery<{ sessions: TrainingSummary[] }>("/api/admin/training")
      .then((payload) => setSessions(payload.sessions))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Pelatihan tidak dapat dimuat."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <header className="admin-page-header">
        <div><p className="section-label">Tes & Hasil</p><h1>Pelaksanaan Tes</h1></div>
        <div className="page-header-actions"><Link className="button" to="/admin/pelatihan/baru">+ Buat Test</Link></div>
      </header>
      <nav className="catalog-tabs test-result-tabs" aria-label="Bagian tes dan hasil"><Link className="is-active" to="/admin/pelatihan" aria-current="page">Pelaksanaan Tes</Link><Link to="/admin/hasil">Lihat Hasil</Link></nav>
      {error && <p className="form-message is-error">{error}</p>}
      {loading && <p className="muted">Memuat pelatihan…</p>}
      {!loading && sessions.length === 0 && (
        <div className="empty-state admin-empty"><strong>Belum ada Test</strong><p>Buat Test berdasarkan materi, angkatan, jadwal, dan passing grade.</p></div>
      )}
      <div className="training-list">
        {sessions.map((session) => (
          <article className="training-list__item" key={session.id}>
            <div>
              <div className="bank-list__title-row">
                <h2>{session.name}</h2>
                <span className={`status-badge status-${session.status.toLowerCase()}`}>{session.status}</span>
              </div>
              <p>{session.bankName} · {session.questionCount} soal · 15 menit</p>
              <span>{formatDateForDisplay(session.trainingStartDate)} – {formatDateForDisplay(session.trainingEndDate)}</span>
            </div>
            <Link className="button button--secondary" to={`/admin/pelatihan/${session.id}`}>Buka</Link>
          </article>
        ))}
      </div>
    </>
  );
}
