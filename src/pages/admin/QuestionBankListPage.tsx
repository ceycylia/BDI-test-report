import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { adminMutation, adminQuery, AdminApiError } from "../../features/admin-auth/admin-api";
import type { QuestionBankSummary } from "../../features/question-banks/types";

export function QuestionBankListPage() {
  const [banks, setBanks] = useState<QuestionBankSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<{trainings: Array<{id:string;name:string}>;materials:Array<{id:string;training_id:string;name:string;bank_id:string|null}>}>({trainings:[],materials:[]});
  const [trainingId, setTrainingId] = useState("");

  const loadBanks = async () => {
    const payload = await adminQuery<{ banks: QuestionBankSummary[] }>("/api/admin/banks");
    setBanks(payload.banks);
  };

  useEffect(() => {
    void loadBanks()
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Bank Soal tidak dapat dimuat."),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { void adminQuery<typeof catalog>("/api/admin/participants/catalog").then(setCatalog).catch(() => undefined); }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSubmitting(true);
    setError(null);

    try {
      await adminMutation("/api/admin/banks", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description"),
          materialId: form.get("materialId"),
        }),
      });
      formElement.reset();
      await loadBanks();
    } catch (reason) {
      setError(reason instanceof AdminApiError ? reason.message : "Bank Soal tidak dapat dibuat.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="section-label">Bank Soal</p>
          <h1>Kelola Bank Soal</h1>
        </div>
      </header>

      <div className="admin-two-column bank-page-layout">
        <section className="panel" aria-labelledby="bank-list-title">
          <h2 id="bank-list-title">Daftar Bank Soal</h2>
          {loading && <p className="muted">Memuat Bank Soal…</p>}
          {!loading && banks.length === 0 && (
            <div className="empty-state">
              <strong>Belum ada Bank Soal</strong>
              <p>Buat Bank Soal sesuai materi atau jenis pelatihan.</p>
            </div>
          )}
          <div className="bank-list">
            {banks.map((bank) => (
              <article className="bank-list__item" key={bank.id}>
                <div className="bank-list__content">
                  <div className="bank-list__title-row">
                    <h3>{bank.name}</h3>
                    <span className={bank.isActive ? "status-badge is-active" : "status-badge"}>
                      {bank.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  {bank.description && <p>{bank.description}</p>}
                  {bank.materialName && <p><strong>{bank.trainingName}</strong> · {bank.materialName}</p>}
                  <div className="bank-list__meta">
                    <span>{bank.activeQuestionCount} soal aktif</span>
                    <span>{bank.inactiveQuestionCount} nonaktif</span>
                  </div>
                </div>
                <Link className="button button--secondary" to={`/admin/bank-soal/${bank.id}`}>
                  Buka
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="panel" aria-labelledby="create-bank-title">
          <h2 id="create-bank-title">Bank Soal Baru</h2>
          <form className="form-stack" onSubmit={(event) => void handleCreate(event)}>
            <label>Pelatihan<select required value={trainingId} onChange={(event)=>setTrainingId(event.target.value)}><option value="">Pilih pelatihan</option>{catalog.trainings.filter(t=>catalog.materials.some(m=>m.training_id===t.id&&!m.bank_id)).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label>Materi<select name="materialId" required><option value="">Pilih materi</option>{catalog.materials.filter(m=>m.training_id===trainingId&&!m.bank_id).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
            <label>
              Nama Bank Soal
              <input name="name" required minLength={2} maxLength={160} />
            </label>
            <label>
              Deskripsi
              <textarea name="description" rows={4} maxLength={1000} />
            </label>
            {error && <p className="form-message is-error">{error}</p>}
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? "Menyimpan…" : "+ Bank Soal Baru"}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
