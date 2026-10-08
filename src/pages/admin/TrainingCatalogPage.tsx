import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BookOpenText,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Pencil,
  Plus,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import {
  adminMutation,
  adminQuery,
  adminUpload,
  AdminApiError,
} from "../../features/admin-auth/admin-api";
import { useAutoDismiss } from "../../components/ui/useAutoDismiss";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { ConfirmDeleteModal } from "../../components/ui/ConfirmDeleteModal";
import { IconActionButton, StatusIcon } from "../../components/ui/IconActionButton";
import { ModalPortal } from "../../components/ui/ModalPortal";
import { ADMIN_PAGE_SIZE, Pagination, type PaginationMeta } from "../../components/ui/Pagination";

type Training = {
  id: string;
  name: string;
  is_active: number;
  material_count: number;
  total_jp: number;
};

type Material = {
  id: string;
  training_id: string;
  training_name: string;
  unit_code: string | null;
  name: string;
  jp: number;
  sort_order: number;
  bank_id: string | null;
  bank_name: string | null;
};

type Catalog = {
  trainings: Training[];
  materials: Material[];
  cohorts: unknown[];
};
type MaterialImportRow = {
  row: number;
  unitCode: string;
  name: string;
  jp: number;
  sortOrder: number;
  errors: string[];
};
type DeleteTarget =
  | { kind: "training"; training: Training }
  | { kind: "material"; material: Material };

export function TrainingCatalogPage() {
  const [catalog, setCatalog] = useState<Catalog>({
    trainings: [],
    materials: [],
    cohorts: [],
  });
  const [catalogTab, setCatalogTab] = useState<"trainings" | "materials">(
    "trainings"
  );
  const [materialTrainingQuery, setMaterialTrainingQuery] = useState("");
  const [trainingPage, setTrainingPage] = useState(1);
  const [trainingNameQuery, setTrainingNameQuery] = useState("");
  const [trainingStatus, setTrainingStatus] = useState("");
  const [materialPage, setMaterialPage] = useState(1);
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [materialImportOpen, setMaterialImportOpen] = useState(false);
  const [materialImportTrainingId, setMaterialImportTrainingId] = useState("");
  const [materialImportFile, setMaterialImportFile] = useState<File | null>(
    null
  );
  const [materialImportRows, setMaterialImportRows] = useState<
    MaterialImportRow[]
  >([]);
  const [importBusy, setImportBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [trainingRows, setTrainingRows] = useState<Training[]>([]);
  const [materialRows, setMaterialRows] = useState<Material[]>([]);
  const [trainingPagination, setTrainingPagination] = useState<PaginationMeta>({ page: 1, limit: ADMIN_PAGE_SIZE, total: 0, totalPages: 1 });
  const [materialPagination, setMaterialPagination] = useState<PaginationMeta>({ page: 1, limit: ADMIN_PAGE_SIZE, total: 0, totalPages: 1 });
  const [listLoading, setListLoading] = useState(false);
  useAutoDismiss(message, setMessage);

  const load = async () => {
    const result = await adminQuery<Catalog>("/api/admin/participants/catalog");
    setCatalog(result);
  };

  useEffect(() => {
    void load().catch((reason: unknown) =>
      setError(
        reason instanceof AdminApiError
          ? reason.message
          : "Data master tidak dapat dimuat."
      )
    );
  }, []);

  const loadTrainingRows = async (requestedPage = trainingPage) => {
    const query = new URLSearchParams({ page: String(requestedPage), limit: String(ADMIN_PAGE_SIZE) });
    if (trainingNameQuery.trim()) query.set("search", trainingNameQuery.trim());
    if (trainingStatus) query.set("status", trainingStatus);
    const result = await adminQuery<{ trainings: Training[]; pagination: PaginationMeta }>(`/api/admin/participants/catalog/trainings?${query}`);
    if (requestedPage > result.pagination.totalPages) { setTrainingPage(result.pagination.totalPages); return; }
    setTrainingRows(result.trainings); setTrainingPagination(result.pagination);
  };
  const loadMaterialRows = async (requestedPage = materialPage) => {
    const query = new URLSearchParams({ page: String(requestedPage), limit: String(ADMIN_PAGE_SIZE) });
    if (materialTrainingQuery.trim()) query.set("trainingSearch", materialTrainingQuery.trim());
    const result = await adminQuery<{ materials: Material[]; pagination: PaginationMeta }>(`/api/admin/participants/catalog/materials?${query}`);
    if (requestedPage > result.pagination.totalPages) { setMaterialPage(result.pagination.totalPages); return; }
    setMaterialRows(result.materials); setMaterialPagination(result.pagination);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setListLoading(true);
      void Promise.all([loadTrainingRows(trainingPage), loadMaterialRows(materialPage)]).catch(fail).finally(() => setListLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [trainingPage, materialPage, trainingNameQuery, trainingStatus, materialTrainingQuery]);

  const complete = (text: string) => {
    setMessage(text);
    setError(null);
    void load().catch((reason: unknown) =>
      setError(
        reason instanceof AdminApiError
          ? reason.message
          : "Data master tidak dapat dimuat."
      )
    );
    void Promise.all([loadTrainingRows(), loadMaterialRows()]).catch(fail);
  };

  const fail = (reason: unknown) => {
    setMessage(null);
    setError(
      reason instanceof AdminApiError
        ? reason.message
        : "Data tidak dapat diproses."
    );
  };

  async function createTraining(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await adminMutation("/api/admin/participants/trainings", {
        method: "POST",
        body: JSON.stringify({ name: form.get("name"), isActive: true }),
      });
      formElement.reset();
      setTrainingModalOpen(false);
      complete("Pelatihan ditambahkan.");
    } catch (reason) {
      fail(reason);
    }
  }

  async function createMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await adminMutation("/api/admin/participants/materials", {
        method: "POST",
        body: JSON.stringify({
          trainingId: form.get("trainingId"),
          unitCode: form.get("unitCode"),
          name: form.get("name"),
          jp: Number(form.get("jp")),
          sortOrder: Number(form.get("sortOrder")),
        }),
      });
      formElement.reset();
      setMaterialModalOpen(false);
      complete("Materi ditambahkan.");
    } catch (reason) {
      fail(reason);
    }
  }

  async function updateTraining(
    training: Training,
    change: Partial<Pick<Training, "name" | "is_active">>
  ) {
    try {
      await adminMutation(`/api/admin/participants/trainings/${training.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: change.name ?? training.name,
          isActive:
            change.is_active === undefined
              ? Boolean(training.is_active)
              : Boolean(change.is_active),
        }),
      });
      complete("Pelatihan diperbarui.");
    } catch (reason) {
      fail(reason);
    }
  }

  async function saveTrainingEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTraining) return;
    const form = new FormData(event.currentTarget);
    try {
      await adminMutation(
        `/api/admin/participants/trainings/${editingTraining.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: String(form.get("name") ?? "").trim(),
            isActive: form.get("isActive") === "on",
          }),
        }
      );
      setEditingTraining(null);
      complete("Pelatihan diperbarui.");
    } catch (reason) {
      fail(reason);
    }
  }

  async function deleteTraining(training: Training) {
    setDeleting(true);
    try {
      await adminMutation(`/api/admin/participants/trainings/${training.id}`, {
        method: "DELETE",
        body: "{}",
      });
      setDeleteTarget(null);
      complete("Pelatihan dihapus. Data historis tetap disimpan.");
    } catch (reason) {
      setDeleteTarget(null);
      fail(reason);
    } finally {
      setDeleting(false);
    }
  }

  async function saveMaterialEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingMaterial) return;
    const form = new FormData(event.currentTarget);
    try {
      await adminMutation(
        `/api/admin/participants/materials/${editingMaterial.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            trainingId: form.get("trainingId"),
            unitCode: form.get("unitCode"),
            name: form.get("name"),
            jp: Number(form.get("jp")),
            sortOrder: Number(form.get("sortOrder")),
          }),
        }
      );
      setEditingMaterial(null);
      complete("Materi diperbarui.");
    } catch (reason) {
      fail(reason);
    }
  }

  async function deleteMaterial(material: Material) {
    setDeleting(true);
    try {
      await adminMutation(`/api/admin/participants/materials/${material.id}`, {
        method: "DELETE",
        body: "{}",
      });
      setDeleteTarget(null);
      complete("Materi dihapus.");
    } catch (reason) {
      setDeleteTarget(null);
      fail(reason);
    } finally {
      setDeleting(false);
    }
  }

  function closeMaterialImport() {
    setMaterialImportOpen(false);
    setMaterialImportTrainingId("");
    setMaterialImportFile(null);
    setMaterialImportRows([]);
  }
  async function previewMaterialImport() {
    if (!materialImportTrainingId || !materialImportFile)
      return setError("Pilih pelatihan dan file template terlebih dahulu.");
    const form = new FormData();
    form.set("trainingId", materialImportTrainingId);
    form.set("file", materialImportFile);
    setImportBusy(true);
    setError(null);
    try {
      const result = await adminUpload<{ rows: MaterialImportRow[] }>(
        "/api/admin/participants/materials/import-preview",
        form
      );
      setMaterialImportRows(result.rows);
    } catch (reason) {
      fail(reason);
    } finally {
      setImportBusy(false);
    }
  }
  async function saveMaterialImport() {
    if (
      !materialImportRows.length ||
      materialImportRows.some((row) => row.errors.length)
    )
      return;
    setImportBusy(true);
    try {
      const result = await adminMutation<{ imported: number }>(
        "/api/admin/participants/materials/import",
        {
          method: "POST",
          body: JSON.stringify({
            trainingId: materialImportTrainingId,
            rows: materialImportRows,
          }),
        }
      );
      closeMaterialImport();
      complete(`${result.imported} materi berhasil diimpor.`);
    } catch (reason) {
      fail(reason);
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="section-label">Master data</p>
          <h1>Pelatihan & Materi</h1>
          <p className="page-description">
            Kelola struktur pelatihan dan materi sebelum membuat angkatan,
            peserta, atau pelaksanaan tes.
          </p>
        </div>
      </header>
      {message && <p className="form-message is-success">{message}</p>}
      {error && (
        <p className="form-message is-error" role="alert">
          {error}
        </p>
      )}
      <nav className="catalog-tabs" aria-label="Bagian master data">
        <button
          type="button"
          className={catalogTab === "trainings" ? "is-active" : ""}
          onClick={() => setCatalogTab("trainings")}
        >
          <GraduationCap /> Pelatihan <span>{catalog.trainings.length}</span>
        </button>
        <button
          type="button"
          className={catalogTab === "materials" ? "is-active" : ""}
          onClick={() => setCatalogTab("materials")}
        >
          <BookOpenText /> Kurikulum & Materi{" "}
          <span>{catalog.materials.length}</span>
        </button>
      </nav>
      <div className="master-catalog-layout">
        {catalogTab === "trainings" && (
          <section className="panel master-training-panel">
            <div className="panel-heading">
              <GraduationCap />
              <div>
                <p className="section-label">Master</p>
                <h2>Pelatihan</h2>
              </div>
              <button
                type="button"
                className="button button--small"
                onClick={() => setTrainingModalOpen(true)}
              >
                <Plus /> Tambah Pelatihan
              </button>
            </div>
            <div className="training-filter-bar">
              <div className="training-filter-bar__intro">
                <SlidersHorizontal />
                <div>
                  <strong>Filter pelatihan</strong>
                  <span>Temukan pelatihan berdasarkan nama atau status.</span>
                </div>
              </div>
              <div className="training-filter-bar__controls">
                <label className="training-status-filter">
                  <span>Nama Pelatihan</span>
                  <SearchableSelect
                    allowCustomValue
                    value={trainingNameQuery}
                    onValueChange={(value) => {
                      setTrainingNameQuery(value);
                      setTrainingPage(1);
                    }}
                    placeholder="Ketik atau pilih pelatihan"
                    options={catalog.trainings.map((training) => ({ value: training.name, label: training.name }))}
                  />
                </label>
                <label className="training-status-filter">
                  <span>Status</span>
                  <select
                    value={trainingStatus}
                    onChange={(event) => {
                      setTrainingStatus(event.target.value);
                      setTrainingPage(1);
                    }}
                  >
                    <option value="">Semua status</option>
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="training-master-list">
              {trainingRows.map((training) => (
                <article key={training.id} className="training-master-card">
                  <span className="training-master-icon">
                    <GraduationCap />
                  </span>
                  <div className="training-master-copy">
                    <strong>{training.name}</strong>
                    <small>
                      {training.material_count} materi · {training.total_jp} JP
                    </small>
                  </div>
                  <StatusIcon active={Boolean(training.is_active)} />
                  <div className="row-actions">
                    <IconActionButton action="edit" label={`Edit Pelatihan ${training.name}`} onClick={() => setEditingTraining(training)} />
                    <IconActionButton action={training.is_active ? "active" : "inactive"} label={training.is_active ? `Nonaktifkan Pelatihan ${training.name}` : `Aktifkan Pelatihan ${training.name}`} onClick={() => void updateTraining(training, { is_active: training.is_active ? 0 : 1 })} />
                    <IconActionButton action="delete" label={`Hapus Pelatihan ${training.name}`} onClick={() => setDeleteTarget({ kind: "training", training })} />
                  </div>
                </article>
              ))}
              {!trainingRows.length && (
                <p className="empty-state">
                  {trainingPagination.total
                    ? "Tidak ada pelatihan yang sesuai filter."
                    : "Belum ada pelatihan."}
                </p>
              )}
            </div>
            <Pagination pagination={trainingPagination} itemLabel="pelatihan" loading={listLoading} onPageChange={setTrainingPage} />
          </section>
        )}
        {catalogTab === "materials" && (
          <section className="panel master-material-panel">
            <div className="panel-heading">
              <BookOpenText />
              <div>
                <p className="section-label">Kurikulum</p>
                <h2>Materi Pelatihan</h2>
              </div>
              <div className="page-header-actions">
                <button
                  type="button"
                  className="button button--secondary button--small"
                  onClick={() => setMaterialImportOpen(true)}
                >
                  <Upload /> Upload File
                </button>
                <button
                  type="button"
                  className="button button--small"
                  onClick={() => setMaterialModalOpen(true)}
                >
                  <Plus /> Tambah Materi
                </button>
              </div>
            </div>
            <div className="material-filter-bar">
              <div className="material-filter-bar__intro">
                <SlidersHorizontal />
                <div>
                  <strong>Filter materi</strong>
                  <span>{materialPagination.total} materi ditemukan</span>
                </div>
              </div>
              <div className="material-filter-bar__controls">
                <label className="material-filter">
                  <span>Pelatihan</span>
                  <SearchableSelect
                    allowCustomValue
                    value={materialTrainingQuery}
                    onValueChange={(value) => {
                      setMaterialTrainingQuery(value);
                      setMaterialPage(1);
                    }}
                    placeholder="Ketik atau pilih pelatihan"
                    options={catalog.trainings.map((training) => ({ value: training.name, label: training.name }))}
                  />
                </label>
              </div>
            </div>
            <div className="data-table-wrap">
              <table className="clean-table">
                <thead>
                  <tr>
                    <th>Kode Unit</th>
                    <th>Materi</th>
                    <th>Pelatihan</th>
                    <th>JP</th>
                    <th>Urutan</th>
                    <th>Bank Soal</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {materialRows.map((material) => (
                    <tr key={material.id}>
                      <td>{material.unit_code || "—"}</td>
                      <td>
                        <strong>{material.name}</strong>
                      </td>
                      <td>{material.training_name}</td>
                      <td>{material.jp}</td>
                      <td>{material.sort_order}</td>
                      <td>{material.bank_name ?? "Belum ada"}</td>
                      <td>
                        <div className="row-actions">
                          <IconActionButton action="edit" label={`Edit Materi ${material.name}`} onClick={() => setEditingMaterial(material)} />
                          <IconActionButton action="delete" label={`Hapus Materi ${material.name}`} onClick={() => setDeleteTarget({ kind: "material", material })} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!materialRows.length && (
                <p className="empty-state">Belum ada materi.</p>
              )}
            </div>
            <Pagination pagination={materialPagination} itemLabel="materi" loading={listLoading} onPageChange={setMaterialPage} />
          </section>
        )}
      </div>
      {trainingModalOpen &&
          <ModalPortal onClose={() => setTrainingModalOpen(false)}>
            <section
              className="participant-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-training-title"
            >
              <header className="participant-modal__header">
                <div>
                  <p className="section-label">Master</p>
                  <h2 id="add-training-title">Tambah Pelatihan</h2>
                  <p>
                    Buat pelatihan terlebih dahulu sebelum menambahkan materi
                    dan angkatan.
                  </p>
                </div>

                <button
                  type="button"
                  className="participant-modal__close"
                  aria-label="Tutup"
                  onClick={() => setTrainingModalOpen(false)}
                >
                  ×
                </button>
              </header>

              <form
                className="participant-modal__form form-stack"
                onSubmit={(event) => void createTraining(event)}
              >
                <label>
                  Nama Pelatihan
                  <input name="name" required autoFocus />
                </label>

                <footer className="participant-modal__actions">
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setTrainingModalOpen(false)}
                  >
                    Batal
                  </button>

                  <button className="button">
                    <Plus />
                    Simpan Pelatihan
                  </button>
                </footer>
              </form>
            </section>
          </ModalPortal>}
      {materialModalOpen && <ModalPortal onClose={() => setMaterialModalOpen(false)}>
          <section
            className="participant-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-material-title"
          >
            <header className="participant-modal__header">
              <div>
                <p className="section-label">Kurikulum</p>
                <h2 id="add-material-title">Tambah Materi</h2>
                <p>Tambahkan materi ke pelatihan yang sudah tersedia.</p>
              </div>
              <button
                type="button"
                className="participant-modal__close"
                aria-label="Tutup"
                onClick={() => setMaterialModalOpen(false)}
              >
                ×
              </button>
            </header>
            <form
              className="participant-modal__form form-stack"
              onSubmit={(event) => void createMaterial(event)}
            >
              <label>
                Pelatihan
                <SearchableSelect name="trainingId" required autoFocus placeholder="Ketik atau pilih pelatihan" options={catalog.trainings.filter((item) => item.is_active).map((item) => ({ value: item.id, label: item.name }))} />
              </label>
              <label>
                Kode Unit <small>(opsional)</small>
                <input
                  name="unitCode"
                  maxLength={100}
                  placeholder="Contoh: MEK.PW12.211.00"
                />
              </label>
              <label>
                Nama Materi
                <input name="name" required />
              </label>
              <div className="form-grid">
                <label>
                  Jumlah JP
                  <input name="jp" type="number" min="1" required />
                </label>
                <label>
                  Urutan
                  <input name="sortOrder" type="number" min="1" required />
                </label>
              </div>
              <footer className="participant-modal__actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setMaterialModalOpen(false)}
                >
                  Batal
                </button>
                <button className="button">
                  <Plus /> Simpan Materi
                </button>
              </footer>
            </form>
          </section>
        </ModalPortal>}
      {editingTraining && <ModalPortal onClose={() => setEditingTraining(null)}>
          <section
            className="participant-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-training-title"
          >
            <header className="participant-modal__header">
              <div>
                <p className="section-label">Master</p>
                <h2 id="edit-training-title">Edit Pelatihan</h2>
                <p>Perbarui nama dan status pelatihan.</p>
              </div>
              <button
                type="button"
                className="participant-modal__close"
                aria-label="Tutup"
                onClick={() => setEditingTraining(null)}
              >
                ×
              </button>
            </header>
            <form
              className="participant-modal__form form-stack"
              onSubmit={(event) => void saveTrainingEdit(event)}
            >
              <label>
                Nama Pelatihan
                <input
                  name="name"
                  required
                  autoFocus
                  defaultValue={editingTraining.name}
                />
              </label>
              <label className="toggle-row">
                <input
                  name="isActive"
                  type="checkbox"
                  defaultChecked={Boolean(editingTraining.is_active)}
                />
                <span>Pelatihan aktif</span>
              </label>
              <footer className="participant-modal__actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setEditingTraining(null)}
                >
                  Batal
                </button>
                <button className="button">
                  <Pencil /> Simpan Perubahan
                </button>
              </footer>
            </form>
          </section>
        </ModalPortal>}
      {editingMaterial && <ModalPortal onClose={() => setEditingMaterial(null)}>
          <section
            className="participant-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-material-title"
          >
            <header className="participant-modal__header">
              <div>
                <p className="section-label">Kurikulum</p>
                <h2 id="edit-material-title">Edit Materi</h2>
                <p>Perbarui penempatan dan rincian materi pelatihan.</p>
              </div>
              <button
                type="button"
                className="participant-modal__close"
                aria-label="Tutup"
                onClick={() => setEditingMaterial(null)}
              >
                ×
              </button>
            </header>
            <form
              className="participant-modal__form form-stack"
              onSubmit={(event) => void saveMaterialEdit(event)}
            >
              <label>
                Pelatihan
                <select
                  name="trainingId"
                  required
                  defaultValue={editingMaterial.training_id}
                >
                  {catalog.trainings
                    .filter(
                      (item) =>
                        item.is_active ||
                        item.id === editingMaterial.training_id
                    )
                    .map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Kode Unit <small>(opsional)</small>
                <input
                  name="unitCode"
                  maxLength={100}
                  defaultValue={editingMaterial.unit_code ?? ""}
                  placeholder="Contoh: MEK.PW12.211.00"
                />
              </label>
              <label>
                Nama Materi
                <input
                  name="name"
                  required
                  autoFocus
                  defaultValue={editingMaterial.name}
                />
              </label>
              <div className="form-grid">
                <label>
                  Jumlah JP
                  <input
                    name="jp"
                    type="number"
                    min="1"
                    required
                    defaultValue={editingMaterial.jp}
                  />
                </label>
                <label>
                  Urutan
                  <input
                    name="sortOrder"
                    type="number"
                    min="1"
                    required
                    defaultValue={editingMaterial.sort_order}
                  />
                </label>
              </div>
              <footer className="participant-modal__actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setEditingMaterial(null)}
                >
                  Batal
                </button>
                <button className="button">
                  <Pencil /> Simpan Perubahan
                </button>
              </footer>
            </form>
          </section>
        </ModalPortal>}
      {materialImportOpen && <ModalPortal onClose={closeMaterialImport} blocked={importBusy}>
          <section
            className="participant-modal certificate-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-material-title"
          >
            <header className="participant-modal__header">
              <div>
                <p className="section-label">Kurikulum</p>
                <h2 id="import-material-title">Import Materi</h2>
                <p>
                  Gunakan template Excel dengan kolom Kode Unit, Nama Materi,
                  Jumlah JP, dan Urutan. Kode Unit boleh dikosongkan.
                </p>
              </div>
              <button
                type="button"
                className="participant-modal__close"
                aria-label="Tutup"
                onClick={closeMaterialImport}
              >
                ×
              </button>
            </header>
            <div className="participant-modal__form form-stack">
              <label>
                Pelatihan
                <SearchableSelect
                  value={materialImportTrainingId}
                  onValueChange={(value) => {
                    setMaterialImportTrainingId(value);
                    setMaterialImportRows([]);
                  }}
                  placeholder="Ketik atau pilih pelatihan"
                  required
                  options={catalog.trainings.filter((item) => item.is_active).map((item) => ({ value: item.id, label: item.name }))}
                />
              </label>
              <div className="template-download-row">
                <div>
                  <strong>Belum memiliki template?</strong>
                  <span>
                    Unduh contoh, isi data materi, lalu unggah kembali.
                  </span>
                </div>
                <a
                  className="button button--secondary button--small"
                  href="/Template-Import-Materi-BDI.xlsx"
                  download
                >
                  <Download /> Download Contoh Template
                </a>
              </div>
              <label>
                File template (.xlsx)
                <span className="file-field">
                  <FileSpreadsheet />
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(event) => {
                      setMaterialImportFile(event.target.files?.[0] ?? null);
                      setMaterialImportRows([]);
                    }}
                  />
                </span>
              </label>
              <div className="participant-modal__actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={closeMaterialImport}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={
                    !materialImportTrainingId ||
                    !materialImportFile ||
                    importBusy
                  }
                  onClick={() => void previewMaterialImport()}
                >
                  <FileSpreadsheet />{" "}
                  {importBusy ? "Memproses…" : "Preview File"}
                </button>
              </div>
              {materialImportRows.length > 0 && (
                <section className="import-preview-section">
                  <div className="import-preview-heading">
                    <div>
                      <p className="section-label">Preview</p>
                      <h3>{materialImportRows.length} materi ditemukan</h3>
                    </div>
                    <span
                      className={
                        materialImportRows.some((row) => row.errors.length)
                          ? "status-badge is-danger"
                          : "status-badge is-active"
                      }
                    >
                      {materialImportRows.some((row) => row.errors.length)
                        ? "Ada data perlu diperbaiki"
                        : "Seluruh data valid"}
                    </span>
                  </div>
                  <div className="data-table-wrap">
                    <table className="clean-table">
                      <thead>
                        <tr>
                          <th>Baris</th>
                          <th>Kode Unit</th>
                          <th>Nama Materi</th>
                          <th>JP</th>
                          <th>Urutan</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialImportRows.map((row) => (
                          <tr
                            key={row.row}
                            className={row.errors.length ? "is-invalid" : ""}
                          >
                            <td>{row.row}</td>
                            <td>{row.unitCode || "—"}</td>
                            <td>{row.name}</td>
                            <td>{row.jp}</td>
                            <td>{row.sortOrder}</td>
                            <td>
                              {row.errors.length
                                ? row.errors.join(" ")
                                : "Valid"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="participant-modal__actions">
                    <button
                      type="button"
                      className="button"
                      disabled={
                        importBusy ||
                        materialImportRows.some((row) => row.errors.length)
                      }
                      onClick={() => void saveMaterialImport()}
                    >
                      <Upload />{" "}
                      {importBusy
                        ? "Menyimpan…"
                        : `Import ${materialImportRows.length} Materi`}
                    </button>
                  </div>
                </section>
              )}
            </div>
          </section>
        </ModalPortal>}
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title={deleteTarget?.kind === "training" ? "Hapus Pelatihan?" : "Hapus Materi?"}
        itemName={deleteTarget?.kind === "training" ? deleteTarget.training.name : deleteTarget?.kind === "material" ? deleteTarget.material.name : undefined}
        description={deleteTarget?.kind === "training" ? "Pelatihan akan dihapus dari master data. Data historis yang pernah menggunakannya tetap disimpan." : "Materi akan dihapus dari daftar pelatihan. Materi yang sudah memiliki Bank Soal tetap mengikuti validasi yang berlaku."}
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.kind === "training") void deleteTraining(deleteTarget.training);
          else if (deleteTarget?.kind === "material") void deleteMaterial(deleteTarget.material);
        }}
      />
    </>
  );
}
