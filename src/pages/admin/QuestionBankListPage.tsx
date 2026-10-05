import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  adminMutation,
  adminQuery,
  AdminApiError,
} from "../../features/admin-auth/admin-api";
import type { QuestionBankSummary } from "../../features/question-banks/types";

export function QuestionBankListPage() {
  const [banks, setBanks] = useState<QuestionBankSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<{
    trainings: Array<{ id: string; name: string }>;
    materials: Array<{
      id: string;
      training_id: string;
      name: string;
      bank_id: string | null;
    }>;
  }>({ trainings: [], materials: [] });
  const [trainingId, setTrainingId] = useState("");
  const [trainingDropdownOpen, setTrainingDropdownOpen] = useState(false);
  const [materialId, setMaterialId] = useState("");
  const [materialDropdownOpen, setMaterialDropdownOpen] = useState(false);

  const selectedTraining = catalog.trainings.find(
    (training) => training.id === trainingId
  );

  const availableMaterials = catalog.materials.filter(
    (material) => material.training_id === trainingId && !material.bank_id
  );

  const selectedMaterial = availableMaterials.find(
    (material) => material.id === materialId
  );

  const loadBanks = async () => {
    const payload = await adminQuery<{ banks: QuestionBankSummary[] }>(
      "/api/admin/banks"
    );
    setBanks(payload.banks);
  };

  useEffect(() => {
    void loadBanks()
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Bank Soal tidak dapat dimuat."
        )
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    void adminQuery<typeof catalog>("/api/admin/participants/catalog")
      .then(setCatalog)
      .catch(() => undefined);
  }, []);

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
          materialId: form.get("materialId"),
        }),
      });
      formElement.reset();
      setTrainingId("");

      setTrainingDropdownOpen(false);
      setMaterialDropdownOpen(false);
      
      await loadBanks();
    } catch (reason) {
      setError(
        reason instanceof AdminApiError
          ? reason.message
          : "Bank Soal tidak dapat dibuat."
      );
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
                    <h3>{bank.trainingName ?? bank.name}</h3>
                    <span
                      className={
                        bank.isActive
                          ? "status-badge is-active"
                          : "status-badge"
                      }
                    >
                      {bank.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  {bank.materialName && <p>{bank.materialName}</p>}
                  <div className="bank-list__meta">
                    <span>{bank.activeQuestionCount} soal aktif</span>
                    <span>{bank.inactiveQuestionCount} nonaktif</span>
                  </div>
                </div>
                <Link
                  className="button button--secondary"
                  to={`/admin/bank-soal/${bank.id}`}
                >
                  Buka
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="panel" aria-labelledby="create-bank-title">
          <h2 id="create-bank-title">Bank Soal Baru</h2>
          <form
            className="form-stack"
            onSubmit={(event) => void handleCreate(event)}
          >
            <label>
              Pelatihan
              <div className="bank-training-select">
                <button
                  type="button"
                  className="bank-training-select__trigger"
                  onClick={() => setTrainingDropdownOpen((open) => !open)}
                  aria-expanded={trainingDropdownOpen}
                >
                  <span>{selectedTraining?.name ?? "Pilih pelatihan"}</span>

                  <span
                    className={`bank-training-select__chevron ${
                      trainingDropdownOpen ? "is-open" : ""
                    }`}
                  >
                    ▾
                  </span>
                </button>

                {trainingDropdownOpen && (
                  <div className="bank-training-select__menu">
                    {catalog.trainings
                      .filter((training) =>
                        catalog.materials.some(
                          (material) =>
                            material.training_id === training.id &&
                            !material.bank_id
                        )
                      )
                      .map((training) => (
                        <button
                          key={training.id}
                          type="button"
                          className="bank-training-select__option"
                          onClick={() => {
                            setTrainingId(training.id);

                            setMaterialId("");

                            setTrainingDropdownOpen(false);
                            setMaterialDropdownOpen(false);
                          }}
                        >
                          {training.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </label>
            <label>
              Materi
              <div className="bank-training-select">
                <button
                  type="button"
                  className="bank-training-select__trigger"
                  disabled={!trainingId}
                  onClick={() => setMaterialDropdownOpen((open) => !open)}
                  aria-expanded={materialDropdownOpen}
                >
                  <span>{selectedMaterial?.name ?? "Pilih materi"}</span>

                  <span
                    className={`bank-training-select__chevron ${
                      materialDropdownOpen ? "is-open" : ""
                    }`}
                  >
                    ▾
                  </span>
                </button>

                {materialDropdownOpen && trainingId && (
                  <div className="bank-training-select__menu">
                    {availableMaterials.length > 0 ? (
                      availableMaterials.map((material) => (
                        <button
                          key={material.id}
                          type="button"
                          className="bank-training-select__option"
                          onClick={() => {
                            setMaterialId(material.id);
                            setMaterialDropdownOpen(false);
                          }}
                        >
                          {material.name}
                        </button>
                      ))
                    ) : (
                      <div className="bank-training-select__empty">
                        Tidak ada materi tersedia.
                      </div>
                    )}
                  </div>
                )}

                <input type="hidden" name="materialId" value={materialId} />
              </div>
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
