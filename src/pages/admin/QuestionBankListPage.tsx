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
import { useAutoDismiss } from "../../components/ui/useAutoDismiss";
import { ADMIN_PAGE_SIZE, Pagination, type PaginationMeta } from "../../components/ui/Pagination";

export function QuestionBankListPage() {
  const [banks, setBanks] = useState<QuestionBankSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useAutoDismiss(error, setError);
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
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: ADMIN_PAGE_SIZE, total: 0, totalPages: 1 });

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
  const loadBanks = async (requestedPage = page) => {
    const query = new URLSearchParams({ page: String(requestedPage), limit: String(ADMIN_PAGE_SIZE) });
    if (trainingId) query.set("trainingId", trainingId);
    if (materialSearch.trim()) query.set("search", materialSearch.trim());
    const payload = await adminQuery<{ banks: QuestionBankSummary[]; pagination: PaginationMeta }>(
      `/api/admin/banks?${query}`
    );
    if (requestedPage > payload.pagination.totalPages) {
      setPage(payload.pagination.totalPages);
      return;
    }
    setBanks(payload.banks);
    setPagination(payload.pagination);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      void loadBanks(page)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Bank Soal tidak dapat dimuat."
        )
      )
      .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [page, trainingId, materialSearch]);
  useEffect(() => { setPage(1); }, [trainingId, materialSearch]);
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
      setPage(1);
      await loadBanks(1);
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
              <p>{pagination.total} bank soal ditemukan</p>
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
          {!loading && pagination.total === 0 && (trainingId || materialSearch.trim()) && (
            <div className="empty-state">
              <strong>Bank Soal tidak ditemukan</strong>
              <p>Ubah pilihan Pelatihan atau hapus pencarian nama materi.</p>
            </div>
          )}
          <div className="bank-list">
            {banks.map((bank) => (
              <article className="bank-list__item" key={bank.id}>
                <div className="bank-list__content">
                  <div className="bank-list__title-row">
                    <h3>{bank.materialName ?? bank.name}</h3>
                  </div>
                  {bank.trainingName && <p>{bank.trainingName}</p>}
                  <div className="bank-list__meta">
                    <span>{bank.activeQuestionCount + bank.inactiveQuestionCount} soal</span>
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
          <Pagination pagination={pagination} itemLabel="bank soal" loading={loading} onPageChange={setPage} />
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
            {trainingId && trainingMaterials.length > 0 && <div className="bank-material-picker" role="group" aria-labelledby="bank-material-picker-title">
              <div className="bank-material-picker__header">
                <strong id="bank-material-picker-title">Pilih Mata Diklat</strong>
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
              <p className="bank-material-picker__summary">{selectedMaterialIds.length} dari {trainingMaterials.length} mata diklat dipilih</p>
            </div>}
            {trainingId && trainingMaterials.length === 0 && <div className="empty-state bank-material-empty"><strong>Belum ada materi</strong><p>Tambahkan materi pada pelatihan ini sebelum membuat Bank Soal.</p></div>}
            {allMaterialsHaveBanks && <p className="form-message is-success">Seluruh materi pada pelatihan ini sudah memiliki Bank Soal.</p>}
            {trainingId && trainingMaterials.length > 0 && selectedMaterialIds.length === 0 && <p className="form-message">Pilih minimal satu materi untuk dibuatkan Bank Soal.</p>}
            {message && <p className="form-message is-success" role="status">{message}</p>}
            {error && <p className="form-message is-error" role="alert">{error}</p>}
            <button className="button" type="submit" disabled={submitting || !trainingId || trainingMaterials.length === 0 || selectedCreatableCount === 0}>
              {submitting ? "Menyimpan…" : "+ Buat Bank Soal Terpilih"}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
