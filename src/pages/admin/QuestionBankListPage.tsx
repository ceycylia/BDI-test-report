import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  adminMutation,
  adminQuery,
  AdminApiError,
} from "../../features/admin-auth/admin-api";
import type { QuestionBankSummary } from "../../features/question-banks/types";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { SearchInput } from "../../components/ui/SearchInput";

export function QuestionBankListPage() {
  const [banks, setBanks] = useState<QuestionBankSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<{
    trainings: Array<{ id: string; name: string; is_active: number }>;
    materials: Array<{
      id: string;
      training_id: string;
      name: string;
      bank_id: string | null;
    }>;
  }>({ trainings: [], materials: [] });
  const [trainingId, setTrainingId] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);

  const trainingMaterials = catalog.materials.filter(
    (material) => material.training_id === trainingId
  );
  const materialsWithBanks = new Set([
    ...catalog.materials.flatMap((material) => material.bank_id ? [material.id] : []),
    ...banks.flatMap((bank) => bank.materialId ? [bank.materialId] : []),
  ]);
  const selectedCreatableCount = selectedMaterialIds.filter(
    (id) => !materialsWithBanks.has(id)
  ).length;
  const allMaterialsHaveBanks =
    trainingMaterials.length > 0 &&
    trainingMaterials.every((material) => materialsWithBanks.has(material.id));
  const normalizedMaterialSearch = materialSearch.trim().toLocaleLowerCase("id");
  const filteredBanks = banks.filter((bank) =>
    (!trainingId || bank.trainingId === trainingId) &&
    (!normalizedMaterialSearch || (bank.materialName ?? bank.name)
      .toLocaleLowerCase("id")
      .includes(normalizedMaterialSearch))
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
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const result = await adminMutation<{
        createdCount: number;
        skippedCount: number;
      }>("/api/admin/banks/bulk", {
        method: "POST",
        body: JSON.stringify({
          trainingId,
          materialIds: selectedMaterialIds,
        }),
      });
      await loadBanks();
      setMessage(
        result.createdCount === 0
          ? "Seluruh materi yang dipilih sudah memiliki Bank Soal."
          : `${result.createdCount} bank soal berhasil dibuat${result.skippedCount > 0 ? `, ${result.skippedCount} materi dilewati karena sudah memiliki bank soal.` : "."}`
      );
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
          <div className="bank-list-toolbar">
            <div>
              <h2 id="bank-list-title">Daftar Bank Soal</h2>
              <p>{trainingId ? `${filteredBanks.length} bank soal pada pelatihan terpilih` : `${filteredBanks.length} bank soal ditampilkan`}</p>
            </div>
            <label>
              <span>Cari nama materi</span>
              <SearchInput
                value={materialSearch}
                onValueChange={setMaterialSearch}
                placeholder="Cari nama materi"
              />
            </label>
          </div>
          {loading && <p className="muted">Memuat Bank Soal…</p>}
          {!loading && banks.length === 0 && (
            <div className="empty-state">
              <strong>Belum ada Bank Soal</strong>
              <p>Buat Bank Soal sesuai materi atau jenis pelatihan.</p>
            </div>
          )}
          {!loading && banks.length > 0 && filteredBanks.length === 0 && (
            <div className="empty-state">
              <strong>Bank Soal tidak ditemukan</strong>
              <p>Ubah pilihan Pelatihan atau hapus pencarian nama materi.</p>
            </div>
          )}
          <div className="bank-list">
            {filteredBanks.map((bank) => (
              <article className="bank-list__item" key={bank.id}>
                <div className="bank-list__content">
                  <div className="bank-list__title-row">
                    <h3>{bank.materialName ?? bank.name}</h3>
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
                  {bank.trainingName && <p>{bank.trainingName}</p>}
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
              <SearchableSelect
                required
                placeholder="Ketik atau pilih pelatihan"
                value={trainingId}
                options={catalog.trainings.filter((training) => training.is_active === 1).map((training) => ({ value: training.id, label: training.name }))}
                onValueChange={(value) => {
                  setTrainingId(value);
                  setSelectedMaterialIds(catalog.materials.filter((material) => material.training_id === value).map((material) => material.id));
                  setError(null);
                  setMessage(null);
                }}
              />
            </label>
            {trainingId && trainingMaterials.length > 0 && <fieldset className="bank-material-picker">
              <legend>Materi</legend>
              <div className="bank-material-picker__header">
                <p>Centang materi yang akan dibuatkan Bank Soal.</p>
                <div className="bank-material-picker__actions">
                  <button type="button" className="text-button" onClick={() => setSelectedMaterialIds(trainingMaterials.map((material) => material.id))}>Pilih Semua</button>
                  <button type="button" className="text-button" onClick={() => setSelectedMaterialIds([])}>Batalkan Semua</button>
                </div>
              </div>
              <div className="bank-material-picker__list">
                {trainingMaterials.map((material) => {
                  const hasBank = materialsWithBanks.has(material.id);
                  return <label className="bank-material-option" key={material.id}>
                    <input
                      type="checkbox"
                      checked={selectedMaterialIds.includes(material.id)}
                      onChange={(event) => setSelectedMaterialIds((current) => event.target.checked ? [...current, material.id] : current.filter((id) => id !== material.id))}
                    />
                    <span><strong>{material.name}</strong>{hasBank && <small>Bank soal sudah tersedia · akan dilewati</small>}</span>
                  </label>;
                })}
              </div>
              <p className="bank-material-picker__summary">{selectedMaterialIds.length} dari {trainingMaterials.length} materi dipilih</p>
            </fieldset>}
            {trainingId && trainingMaterials.length === 0 && <div className="empty-state bank-material-empty"><strong>Belum ada materi</strong><p>Tambahkan materi pada pelatihan ini sebelum membuat Bank Soal.</p></div>}
            {allMaterialsHaveBanks && <p className="form-message is-success">Seluruh materi pada pelatihan ini sudah memiliki Bank Soal.</p>}
            {trainingId && trainingMaterials.length > 0 && selectedMaterialIds.length === 0 && <p className="form-message">Pilih minimal satu materi untuk dibuatkan Bank Soal.</p>}
            {message && <p className="form-message is-success" role="status">{message}</p>}
            {error && <p className="form-message is-error">{error}</p>}
            <button className="button" type="submit" disabled={submitting || !trainingId || trainingMaterials.length === 0 || selectedCreatableCount === 0}>
              {submitting ? "Menyimpan…" : "+ Buat Bank Soal Terpilih"}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
