import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Award, BookOpenText, CalendarDays, Download, Eye, FileSpreadsheet, GraduationCap, Image, Layers3, Pencil, Plus, Search, Trash2, Upload, UserPlus, Users, X } from "lucide-react";
import { adminDownload, adminMutation, adminQuery, adminUpload, AdminApiError } from "../../features/admin-auth/admin-api";
import { formatCohortDate, generateCohorts, type GeneratedCohort } from "../../features/cohorts/bulk-cohort";
import { useAutoDismiss } from "../../components/ui/useAutoDismiss";
import { DateInput } from "../../components/ui/DateInput";
import { formatDateForDisplay } from "../../features/dates/date-format";

type Training = { id: string; name: string; is_active: number; material_count: number; total_jp: number };
type Material = { id: string; training_id: string; training_name: string; name: string; jp: number; sort_order: number; bank_id: string | null; bank_name: string | null };
type Cohort = { id: string; training_id: string; training_name: string; name: string; start_date: string; end_date: string; status: string; participant_count: number };
type Participant = { id: string; training_id: string; cohort_id: string; name: string; nik_masked: string; birth_place: string; birth_date: string; photo_key: string | null; is_active: number; training_name: string; cohort_name: string };
type Certificate = { participant_id: string; name: string; nik_masked: string; training_id: string; training_name: string; cohort_id: string; cohort_name: string; graduation_status: string; certificate_id: string | null; certificate_number: string | null; certificate_status: string | null };
type Catalog = { trainings: Training[]; materials: Material[]; cohorts: Cohort[] };
type ImportRow = { row: number; name: string; nik: string; birthPlace: string; birthDate: string; errors: string[] };
type CertificateSettings = { certificate_prefix: string; signer_name: string; signer_title: string; signer_nip: string; issue_place: string; issue_date: string; offset_x_mm: number; offset_y_mm: number };

const tabs = [
  { id: "data", label: "Data Peserta", icon: Users },
  { id: "cohorts", label: "Angkatan", icon: Layers3 },
  { id: "certificate-workspace", label: "Sertifikat", icon: Award },
] as const;

export function ParticipantsPage() {
  // "master" is retained only while this legacy in-file section is phased out;
  // it is no longer reachable from the participant navigation.
  const [tab, setTab] = useState<(typeof tabs)[number]["id"] | "certificates" | "master">("data");
  const [catalog, setCatalog] = useState<Catalog>({ trainings: [], materials: [], cohorts: [] });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [trainingId, setTrainingId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [listTrainingId, setListTrainingId] = useState("");
  const [materialTrainingId, setMaterialTrainingId] = useState("");
  const [listCohortId, setListCohortId] = useState("");
  const [listStatus, setListStatus] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  useAutoDismiss(message, setMessage);
  const [error, setError] = useState<string | null>(null);
  const [noticeTarget, setNoticeTarget] = useState<"global" | "material" | "cohort">("global");
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [participantCreateOpen, setParticipantCreateOpen] = useState(false);
  const [participantImportOpen, setParticipantImportOpen] = useState(false);
  const [certificateTrainingId, setCertificateTrainingId] = useState("");
  const [certificateCohort, setCertificateCohort] = useState("");
  const [certificateStatus, setCertificateStatus] = useState("");
  const [deletingParticipants, setDeletingParticipants] = useState(false);
  const [certificateSettings, setCertificateSettings] = useState<CertificateSettings>({ certificate_prefix: "", signer_name: "", signer_title: "", signer_nip: "", issue_place: "", issue_date: "", offset_x_mm: 0, offset_y_mm: 0 });
  const [certificateNumbers, setCertificateNumbers] = useState<Record<string, string>>({});
  const [showBulkCohortForm, setShowBulkCohortForm] = useState(false);
  const [bulkCohortTrainingId, setBulkCohortTrainingId] = useState("");
  const [bulkCohortForm, setBulkCohortForm] = useState({ startNumber: 1, count: 1, cohortsPerPeriod: 1, firstStartDate: "", durationDays: 7 });
  const [cohortPreview, setCohortPreview] = useState<GeneratedCohort[]>([]);
  const [editingCohortRow, setEditingCohortRow] = useState<string | null>(null);
  const [selectedCohortDetail, setSelectedCohortDetail] = useState<string | null>(null);
  const [editingExistingCohort, setEditingExistingCohort] = useState<Cohort | null>(null);
  const [savingCohorts, setSavingCohorts] = useState(false);

  const load = async () => {
    const [cat, people, certs] = await Promise.all([
      adminQuery<Catalog>("/api/admin/participants/catalog"),
      adminQuery<{ participants: Participant[] }>("/api/admin/participants/participants"),
      adminQuery<{ certificates: Certificate[] }>("/api/admin/participants/certificates"),
    ]);
    setCatalog(cat); setParticipants(people.participants); setCertificates(certs.certificates);
  };
  function fail(processError: unknown, target: "global" | "material" | "cohort" = "global") {
    setNoticeTarget(target);
    setMessage(null);
    setError(processError instanceof AdminApiError ? processError.message : "Data tidak dapat diproses.");
  }
  const report = (text: string, target: "global" | "material" | "cohort" = "global") => {
    setNoticeTarget(target);
    setMessage(text);
    setError(null);
    void load();
  };

  useEffect(() => { void load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Data tidak dapat dimuat.")); }, []);
  useEffect(() => {
    if (!certificateTrainingId) {
      setCertificateSettings({ certificate_prefix: "", signer_name: "", signer_title: "", signer_nip: "", issue_place: "", issue_date: "", offset_x_mm: 0, offset_y_mm: 0 });
      return;
    }
    void adminQuery<{ settings: CertificateSettings }>(`/api/admin/participants/certificate-settings/${certificateTrainingId}`).then((result) => setCertificateSettings(result.settings)).catch(fail);
  }, [certificateTrainingId]);

  const cohorts = useMemo(() => catalog.cohorts.filter((cohort) => !trainingId || cohort.training_id === trainingId), [catalog, trainingId]);
  const filteredParticipants = useMemo(() => participants.filter((participant) =>
    (!listTrainingId || participant.training_id === listTrainingId) &&
    (!listCohortId || participant.cohort_id === listCohortId) &&
    (!listStatus || String(Boolean(participant.is_active)) === listStatus) &&
    (!search || participant.name.toLocaleLowerCase("id").includes(search.toLocaleLowerCase("id")))),
  [participants, listTrainingId, listCohortId, listStatus, search]);
  const filteredCertificates = useMemo(() => certificates.filter((participant) =>
    (!certificateTrainingId || participant.training_id === certificateTrainingId) &&
    (!certificateCohort || participant.cohort_id === certificateCohort) &&
    (!certificateStatus || (certificateStatus === "READY" ? participant.graduation_status === "LULUS" && !participant.certificate_id : participant.graduation_status === certificateStatus))),
  [certificates, certificateTrainingId, certificateCohort, certificateStatus]);
  const filteredMaterials = useMemo(() => catalog.materials.filter((material) => !materialTrainingId || material.training_id === materialTrainingId), [catalog.materials, materialTrainingId]);

  async function createTraining(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    try { await adminMutation("/api/admin/participants/trainings", { method: "POST", body: JSON.stringify({ name: form.get("name"), isActive: true }) }); formElement.reset(); report("Pelatihan ditambahkan."); } catch (processError) { fail(processError); }
  }
  async function createMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    try { await adminMutation("/api/admin/participants/materials", { method: "POST", body: JSON.stringify({ trainingId: form.get("trainingId"), name: form.get("name"), jp: Number(form.get("jp")), sortOrder: Number(form.get("sortOrder")) }) }); formElement.reset(); report("Materi ditambahkan.", "material"); } catch (processError) { fail(processError, "material"); }
  }
  async function toggleTraining(training: Training) {
    try { await adminMutation(`/api/admin/participants/trainings/${training.id}`, { method: "PUT", body: JSON.stringify({ name: training.name, isActive: !training.is_active }) }); report("Status pelatihan diperbarui."); } catch (processError) { fail(processError); }
  }
  async function deleteTraining(training: Training) {
    const confirmed = window.confirm(`Hapus pelatihan “${training.name}” dari master data?\n\nData peserta, angkatan, materi, hasil tes, dan sertifikat yang pernah menggunakan pelatihan ini tetap disimpan.`);
    if (!confirmed) return;
    try {
      await adminMutation(`/api/admin/participants/trainings/${training.id}`, { method: "DELETE", body: "{}" });
      report("Pelatihan dihapus. Seluruh data historis tetap disimpan.");
    } catch (processError) { fail(processError); }
  }
  async function editTraining(training: Training) {
    const name = window.prompt("Nama pelatihan", training.name)?.trim(); if (!name) return;
    try { await adminMutation(`/api/admin/participants/trainings/${training.id}`, { method: "PUT", body: JSON.stringify({ name, isActive: Boolean(training.is_active) }) }); report("Pelatihan diperbarui."); } catch (processError) { fail(processError); }
  }
  async function editMaterial(material: Material) {
    const name = window.prompt("Nama materi", material.name)?.trim(); if (!name) return;
    const jp = Number(window.prompt("Jumlah JP", String(material.jp))); const sortOrder = Number(window.prompt("Urutan materi", String(material.sort_order)));
    try { await adminMutation(`/api/admin/participants/materials/${material.id}`, { method: "PUT", body: JSON.stringify({ trainingId: material.training_id, name, jp, sortOrder }) }); report("Materi diperbarui.", "material"); } catch (processError) { fail(processError, "material"); }
  }
  async function deleteMaterial(material: Material) {
    try { await adminMutation(`/api/admin/participants/materials/${material.id}`, { method: "DELETE", body: "{}" }); report("Materi dihapus.", "material"); } catch (processError) { fail(processError, "material"); }
  }
  async function toggleCohort(cohort: Cohort) {
    try { await adminMutation(`/api/admin/participants/cohorts/${cohort.id}`, { method: "PUT", body: JSON.stringify({ trainingId: cohort.training_id, name: cohort.name, startDate: cohort.start_date, endDate: cohort.end_date, status: cohort.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }) }); report("Status angkatan diperbarui.", "cohort"); } catch (processError) { fail(processError, "cohort"); }
  }
  function editCohort(cohort: Cohort) { setEditingExistingCohort(cohort); }
  function resetBulkCohortForm() {
    setCohortPreview([]);
    setEditingCohortRow(null);
    setBulkCohortTrainingId("");
    setBulkCohortForm({ startNumber: 1, count: 1, cohortsPerPeriod: 1, firstStartDate: "", durationDays: 7 });
  }
  function previewBulkCohorts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNoticeTarget("cohort"); setMessage(null); setError(null);
    if (!bulkCohortTrainingId) return setError("Pelatihan wajib dipilih.");
    if (bulkCohortForm.startNumber < 1) return setError("Mulai dari angkatan minimal 1.");
    if (bulkCohortForm.count < 1) return setError("Jumlah angkatan minimal 1.");
    if (bulkCohortForm.cohortsPerPeriod < 1) return setError("Angkatan per periode minimal 1.");
    if (bulkCohortForm.cohortsPerPeriod > bulkCohortForm.count) return setError("Angkatan per periode tidak boleh lebih besar dari jumlah angkatan.");
    if (!bulkCohortForm.firstStartDate) return setError("Tanggal mulai periode pertama wajib diisi.");
    if (bulkCohortForm.durationDays < 1) return setError("Durasi pelatihan minimal 1 hari.");
    const rows = generateCohorts(bulkCohortForm);
    setCohortPreview(rows);
    const existingNames = new Set(catalog.cohorts.filter((cohort) => cohort.training_id === bulkCohortTrainingId).map((cohort) => cohort.name.trim().toLocaleLowerCase("id")));
    const duplicate = rows.find((row) => existingNames.has(row.name.toLocaleLowerCase("id")));
    if (duplicate) setError(`${duplicate.name} sudah terdaftar pada pelatihan ini. Edit nama pada baris preview sebelum menyimpan.`);
  }
  function updatePreviewCohort(clientId: string, changes: Partial<GeneratedCohort>) {
    setError(null);
    setCohortPreview((rows) => rows.map((row) => row.clientId === clientId ? { ...row, ...changes } : row));
  }
  async function saveBulkCohorts() {
    setNoticeTarget("cohort"); setMessage(null); setError(null);
    if (!bulkCohortTrainingId || !cohortPreview.length) return setError("Buat preview angkatan terlebih dahulu.");
    const normalizedNames = cohortPreview.map((row) => row.name.trim().toLocaleLowerCase("id"));
    const duplicateName = normalizedNames.find((name, index) => normalizedNames.indexOf(name) !== index);
    const duplicateInPreview = duplicateName ? cohortPreview.find((row) => row.name.trim().toLocaleLowerCase("id") === duplicateName) : undefined;
    if (duplicateInPreview) return setError(`Nama ${duplicateInPreview.name} muncul lebih dari sekali pada preview.`);
    const existingNames = new Set(catalog.cohorts.filter((cohort) => cohort.training_id === bulkCohortTrainingId).map((cohort) => cohort.name.trim().toLocaleLowerCase("id")));
    const duplicateExisting = cohortPreview.find((row) => existingNames.has(row.name.trim().toLocaleLowerCase("id")));
    if (duplicateExisting) return setError(`${duplicateExisting.name} sudah terdaftar pada pelatihan ini.`);
    const invalid = cohortPreview.find((row) => !row.name.trim() || !row.startDate || !row.endDate || row.endDate < row.startDate);
    if (invalid) return setError(`Periksa kembali nama dan periode ${invalid.name || "angkatan"}.`);
    setSavingCohorts(true);
    try {
      const result = await adminMutation<{ created: number }>("/api/admin/participants/cohorts/bulk", { method: "POST", body: JSON.stringify({ trainingId: bulkCohortTrainingId, cohorts: cohortPreview.map(({ name, startDate, endDate, status }) => ({ name, startDate, endDate, status })) }) });
      resetBulkCohortForm(); setShowBulkCohortForm(false); report(`${result.created} angkatan berhasil disimpan.`, "cohort");
    } catch (processError) { fail(processError, "cohort"); }
    finally { setSavingCohorts(false); }
  }
  async function createParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    try {
      const participant = await adminMutation<{ id: string }>("/api/admin/participants/participants", { method: "POST", body: JSON.stringify({ trainingId: form.get("trainingId"), cohortId: form.get("cohortId"), name: form.get("name"), nik: form.get("nik"), birthPlace: form.get("birthPlace"), birthDate: form.get("birthDate"), isActive: true }) });
      const photo = form.get("photo"); if (photo instanceof File && photo.size) { const upload = new FormData(); upload.set("photo", photo); await adminUpload(`/api/admin/participants/participants/${participant.id}/photo`, upload); }
      formElement.reset(); setParticipantCreateOpen(false); report("Peserta terdaftar.");
    } catch (processError) { fail(processError); }
  }
  function resetImportPreview() {
    setPreview([]);
    setPreviewReady(false);
  }
  function closeParticipantImport() {
    setParticipantImportOpen(false); setTrainingId(""); setCohortId(""); setImportFile(null); resetImportPreview();
  }
  function selectImportFile(file: File | null) {
    setImportFile(file);
    resetImportPreview();
    setError(null);
  }
  async function previewImport() {
    if (!trainingId || !cohortId || !importFile) return setError("Pilih pelatihan, angkatan, dan file Excel terlebih dahulu.");
    const form = new FormData(); form.set("file", importFile); form.set("trainingId", trainingId); form.set("cohortId", cohortId);
    setPreviewing(true);
    try {
      const result = await adminUpload<{ rows: ImportRow[] }>("/api/admin/participants/participants/import-preview", form);
      setPreview(result.rows); setPreviewReady(true); setError(null);
      if (!result.rows.length) setError("File Excel tidak berisi data peserta.");
    } catch (processError) { resetImportPreview(); fail(processError); }
    finally { setPreviewing(false); }
  }
  async function importRows() {
    if (!trainingId || !cohortId || !previewReady || !preview.length) return setError("Lakukan preview data terlebih dahulu.");
    if (preview.some((row) => row.errors.length)) return setError("Perbaiki baris yang belum valid sebelum import.");
    setImporting(true);
    try {
      const result = await adminMutation<{ imported: number }>("/api/admin/participants/participants/import", { method: "POST", body: JSON.stringify({ trainingId, cohortId, rows: preview }) });
      if (importFileRef.current) importFileRef.current.value = "";
      closeParticipantImport(); report(`${result.imported} peserta berhasil diimport.`);
    } catch (processError) { fail(processError); }
    finally { setImporting(false); }
  }
  async function generateCert(participant: Certificate, side: "FRONT" | "BACK") {
    try { await adminMutation(`/api/admin/participants/certificates/${participant.participant_id}/generate`, { method: "POST", body: JSON.stringify({ side }) }); report(`PDF sertifikat ${side === "FRONT" ? "depan" : "belakang"} berhasil dibuat.`); } catch (processError) { fail(processError); }
  }
  async function saveCertificateNumber(participant: Certificate) {
    const certificateNumber = (certificateNumbers[participant.participant_id] ?? participant.certificate_number ?? "").trim();
    if (!certificateNumber) return setError("Nomor sertifikat resmi wajib diisi.");
    try { await adminMutation(`/api/admin/participants/certificates/${participant.participant_id}/number`, { method: "PUT", body: JSON.stringify({ certificateNumber }) }); report("Nomor sertifikat disimpan."); } catch (processError) { fail(processError); }
  }
  async function saveCertificateSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const id = String(form.get("trainingId") ?? "");
    try {
      await adminMutation(`/api/admin/participants/certificate-settings/${id}`, { method: "PUT", body: JSON.stringify({ signerName: certificateSettings.signer_name, signerTitle: certificateSettings.signer_title, signerNip: certificateSettings.signer_nip, issuePlace: certificateSettings.issue_place, offsetXmm: Number(certificateSettings.offset_x_mm), offsetYmm: Number(certificateSettings.offset_y_mm) }) });
      const assets = new FormData(); for (const field of ["signature", "stamp", "frontTemplate", "backTemplate"]) { const file = form.get(field); if (file instanceof File && file.size) assets.set(field, file); }
      if ([...assets.keys()].length) await adminUpload(`/api/admin/participants/certificate-settings/${id}/assets`, assets);
      report("Pengaturan sertifikat disimpan.");
    } catch (processError) { fail(processError); }
  }
  async function generateAll() {
    if (!certificateTrainingId || !certificateCohort) return setError("Pilih pelatihan dan angkatan untuk generate sertifikat.");
    try { const result = await adminMutation<{ generated: number }>("/api/admin/participants/certificates/generate-all", { method: "POST", body: JSON.stringify({ trainingId: certificateTrainingId, cohortId: certificateCohort, side: "BOTH" }) }); report(`${result.generated} sertifikat peserta lulus berhasil dibuat.`); } catch (processError) { fail(processError); }
  }
  async function deleteFilteredParticipants() {
    if (!filteredParticipants.length) return setError("Tidak ada peserta pada hasil filter yang dapat dihapus.");
    const filterDescription = [
      listTrainingId ? "pelatihan terpilih" : null,
      listCohortId ? "angkatan terpilih" : null,
      listStatus ? `status ${listStatus === "true" ? "aktif" : "nonaktif"}` : null,
      search ? `pencarian “${search}”` : null,
    ].filter(Boolean).join(", ");
    const confirmed = window.confirm(`Hapus permanen ${filteredParticipants.length} peserta${filterDescription ? ` berdasarkan ${filterDescription}` : " yang sedang ditampilkan"}?\n\nSeluruh riwayat tes dan sertifikat peserta tersebut juga akan dihapus. Tindakan ini tidak dapat dibatalkan.`);
    if (!confirmed) return;
    setDeletingParticipants(true);
    try {
      const result = await adminMutation<{ deleted: number }>("/api/admin/participants/participants/bulk", {
        method: "DELETE",
        body: JSON.stringify({ participantIds: filteredParticipants.map((participant) => participant.id) }),
      });
      setSelectedParticipant(null);
      report(`${result.deleted} data peserta beserta riwayatnya berhasil dihapus.`);
    } catch (processError) {
      fail(processError);
    } finally {
      setDeletingParticipants(false);
    }
  }

  return <>
    <header className="admin-page-header participant-page-header">
      <div><p className="section-label">Peserta</p><h1>Pengelolaan peserta & sertifikat</h1></div>
      {tab === "data" && <div className="page-header-actions"><button type="button" className="button" onClick={() => setParticipantCreateOpen(true)}><Plus /> Tambah Peserta</button><button type="button" className="button button--secondary" onClick={() => setParticipantImportOpen(true)}><FileSpreadsheet /> Upload Peserta</button></div>}
    </header>
    <nav className="participant-tabs" aria-label="Menu peserta">{tabs.map((item) => { const Icon = item.icon; return <button type="button" key={item.id} className={tab === item.id ? "is-active" : ""} onClick={() => setTab(item.id)}><Icon />{item.label}</button>; })}</nav>
    {noticeTarget === "global" && message && <p className="form-message is-success">{message}</p>}{noticeTarget === "global" && error && <p className="form-message is-error">{error}</p>}

    {tab === "data" && <>
      <section className="panel participant-data-panel">
        <div className="panel-heading"><div><p className="section-label">Terdaftar</p><h2>Data Peserta</h2></div><div className="participant-table-actions"><span className="status-badge is-active">{filteredParticipants.length} peserta</span><button type="button" className="button danger-button button--small" disabled={!filteredParticipants.length || deletingParticipants} onClick={() => void deleteFilteredParticipants()}><Trash2 />{deletingParticipants ? "Menghapus..." : "Hapus Hasil Filter"}</button></div></div>
        <div className="participant-list-filters">
          <label className="filter-search"><span>Cari nama</span><span className="input-with-icon"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama peserta" /></span></label>
          <label>Pelatihan<select value={listTrainingId} onChange={(event) => { setListTrainingId(event.target.value); setListCohortId(""); }}><option value="">Semua Pelatihan</option>{catalog.trainings.map((training) => <option value={training.id} key={training.id}>{training.name}</option>)}</select></label>
          <label>Angkatan<select value={listCohortId} onChange={(event) => setListCohortId(event.target.value)}><option value="">Semua Angkatan</option>{catalog.cohorts.filter((cohort) => !listTrainingId || cohort.training_id === listTrainingId).map((cohort) => <option value={cohort.id} key={cohort.id}>{cohort.name}</option>)}</select></label>
          <label>Status<select value={listStatus} onChange={(event) => setListStatus(event.target.value)}><option value="">Semua Status</option><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label>
        </div>
        <div className="data-table-wrap"><table className="clean-table participant-table"><thead><tr><th>No</th><th>Nama Lengkap</th><th>NIK</th><th>Pelatihan</th><th>Angkatan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{filteredParticipants.map((participant, index) => <tr key={participant.id} className={selectedParticipant === participant.id ? "is-selected" : ""}><td>{index + 1}</td><td><span className="participant-identity"><span className="participant-avatar">{participant.photo_key ? <img src={`/api/admin/participants/participants/${participant.id}/photo`} alt="" /> : <Image />}</span><span><strong>{participant.name}</strong><small>{participant.birth_place}, {formatDateForDisplay(participant.birth_date)}</small></span></span></td><td>{participant.nik_masked}</td><td>{participant.training_name}</td><td>{participant.cohort_name}</td><td><span className={participant.is_active ? "status-badge is-active" : "status-badge"}>{participant.is_active ? "Aktif" : "Nonaktif"}</span></td><td><button type="button" className="button button--secondary button--small" onClick={() => setSelectedParticipant(participant.id)}><Eye /> Lihat</button></td></tr>)}</tbody></table>{!filteredParticipants.length && <div className="empty-state">Belum ada peserta terdaftar.</div>}</div>
        <p className="table-summary">Menampilkan {filteredParticipants.length} dari {participants.length} peserta</p>
      </section>
      {selectedParticipant && <ParticipantEditor id={selectedParticipant} catalog={catalog} onCancel={() => setSelectedParticipant(null)} onSaved={() => { setSelectedParticipant(null); report("Data peserta diperbarui."); }} onError={fail} />}
      {participantCreateOpen && <div className="modal-backdrop participant-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setParticipantCreateOpen(false); }}><section className="participant-modal" role="dialog" aria-modal="true" aria-labelledby="add-participant-title">
        <header className="participant-modal__header"><div><p className="section-label">Peserta baru</p><h2 id="add-participant-title">Tambah Peserta</h2><p>Isi data peserta untuk pelatihan dan angkatan yang dipilih.</p></div><button type="button" className="participant-modal__close" aria-label="Tutup tambah peserta" onClick={() => setParticipantCreateOpen(false)}><X /></button></header>
        <form className="participant-modal__form form-stack" onSubmit={(event) => void createParticipant(event)}><div className="participant-modal__grid"><label>Nama Lengkap<input name="name" required autoFocus /></label><TrainingCohortFields catalog={catalog} /><label>NIK<input name="nik" required inputMode="numeric" /></label><label>Tempat Lahir<input name="birthPlace" required /></label><label>Tanggal Lahir<DateInput name="birthDate" required /></label><label>Status<select value="active" disabled><option value="active">Aktif</option></select></label><label className="participant-modal__photo">Foto Peserta<span className="file-field"><Image /><input name="photo" type="file" accept="image/jpeg,image/png" /></span></label></div><footer className="participant-modal__actions"><button type="button" className="button button--secondary" onClick={() => setParticipantCreateOpen(false)}>Batal</button><button className="button"><UserPlus /> Simpan Peserta</button></footer></form>
      </section></div>}
      {participantImportOpen && <div className="modal-backdrop participant-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeParticipantImport(); }}><section className="participant-modal certificate-modal" role="dialog" aria-modal="true" aria-labelledby="import-participant-title">
        <header className="participant-modal__header"><div><p className="section-label">Import Excel</p><h2 id="import-participant-title">Upload Peserta</h2><p>Unggah file Excel lalu periksa data pada preview sebelum diimpor.</p></div><button type="button" className="participant-modal__close" aria-label="Tutup upload peserta" onClick={closeParticipantImport}><X /></button></header>
        <div className="participant-modal__form form-stack"><div className="panel-heading"><div className="panel-title-with-icon"><span className="heading-icon"><FileSpreadsheet /></span><div><p className="section-label">Template</p><h3>Siapkan file peserta</h3></div></div><a className="button button--secondary button--small" href="/api/admin/participants/participants-template"><Download /> Download template</a></div>
        <div className="import-step-grid">
          <label><span>1. Pilih Pelatihan</span><select value={trainingId} onChange={(event) => { setTrainingId(event.target.value); setCohortId(""); resetImportPreview(); }}><option value="">Pilih pelatihan</option>{catalog.trainings.map((training) => <option value={training.id} key={training.id}>{training.name}</option>)}</select></label>
          <label><span>2. Pilih Angkatan</span><select value={cohortId} disabled={!trainingId} onChange={(event) => { setCohortId(event.target.value); resetImportPreview(); }}><option value="">Pilih angkatan</option>{cohorts.map((cohort) => <option value={cohort.id} key={cohort.id}>{cohort.name}</option>)}</select></label>
          <div className="import-file-control">
            <span className="import-field-label">3. Pilih File Excel</span>
            <div className={importFile ? "modern-file-picker has-file" : "modern-file-picker"}>
              <span className="modern-file-picker__icon"><FileSpreadsheet /></span>
              <span className="modern-file-picker__copy"><strong>{importFile?.name ?? "Pilih file Excel"}</strong><small>{importFile ? `${(importFile.size / 1024 / 1024).toFixed(2)} MB` : ".xlsx atau .xls, maksimal 8 MB"}</small></span>
              <button type="button" className="button button--secondary button--small" onClick={() => importFileRef.current?.click()}>{importFile ? "Ganti File" : "Pilih File"}</button>
              <input ref={importFileRef} className="visually-hidden-file" type="file" accept=".xlsx,.xls" onChange={(event) => selectImportFile(event.target.files?.[0] ?? null)} />
            </div>
          </div>
        </div>
        <div className="import-preview-action"><button type="button" className="button" disabled={!trainingId || !cohortId || !importFile || previewing} onClick={() => void previewImport()}><Eye /> {previewing ? "Membaca Data..." : "Preview Data"}</button></div>
        {previewReady && <section className="import-preview-section"><div className="import-preview-heading"><div><p className="section-label">Hasil Preview</p><h3>{preview.length} data peserta ditemukan</h3></div><span className={preview.some((row) => row.errors.length) ? "status-badge is-danger" : "status-badge is-active"}>{preview.filter((row) => row.errors.length).length ? `${preview.filter((row) => row.errors.length).length} data perlu diperbaiki` : "Seluruh data valid"}</span></div><div className="data-table-wrap"><table className="clean-table import-preview-table"><thead><tr><th>No</th><th>Nama Lengkap</th><th>NIK</th><th>Tempat Lahir</th><th>Tanggal Lahir</th><th>Status Validasi</th></tr></thead><tbody>{preview.map((row, index) => <tr key={row.row} className={row.errors.length ? "is-invalid" : ""}><td>{index + 1}</td><td>{row.name || "—"}</td><td>{row.nik || "—"}</td><td>{row.birthPlace || "—"}</td><td>{formatDateForDisplay(row.birthDate)}</td><td>{row.errors.length ? <span className="validation-errors">{row.errors.map((rowError) => <span key={rowError}>{rowError}</span>)}</span> : <span className="status-badge is-active">Valid</span>}</td></tr>)}</tbody></table></div><div className="import-submit-row"><p>Foto peserta dapat diunggah terpisah setelah proses import selesai.</p><button type="button" className="button" disabled={!preview.length || preview.some((row) => row.errors.length) || importing} onClick={() => void importRows()}><Upload /> {importing ? "Mengimpor..." : `Import Peserta (${preview.length})`}</button></div></section>}
        </div></section></div>}
    </>}

    {tab === "master" && <div className="master-catalog-layout">
      <section className="panel master-training-panel"><div className="panel-heading"><div><h2>Nama Pelatihan</h2></div></div><form className="form-stack inline-create" onSubmit={(event) => void createTraining(event)}><label>Nama<input name="name" required /></label><button className="button"><Plus /> Tambah Pelatihan</button></form><div className="training-master-list">{catalog.trainings.map((training) => <article key={training.id} className="training-master-card"><span className="training-master-icon"><GraduationCap /></span><div className="training-master-copy"><strong>{training.name}</strong><small>{training.material_count} materi · {training.total_jp} JP</small></div><span className={training.is_active ? "status-badge is-active" : "status-badge"}>{training.is_active ? "Aktif" : "Nonaktif"}</span><div className="row-actions"><button type="button" className="button button--secondary button--small" onClick={() => void editTraining(training)}><Pencil /> Edit</button><button type="button" className="text-button" onClick={() => void toggleTraining(training)}>{training.is_active ? "Nonaktifkan" : "Aktifkan"}</button><button type="button" className="text-button is-danger" onClick={() => void deleteTraining(training)}><Trash2 /> Hapus</button></div></article>)}</div></section>
      {noticeTarget === "material" && message && <p className="form-message is-success material-notice">{message}</p>}{noticeTarget === "material" && error && <p className="form-message is-error material-notice">{error}</p>}
      <section className="panel master-material-panel"><div className="panel-heading"><div><p className="section-label">Kurikulum</p><h2>Materi Pelatihan</h2></div></div><form className="form-stack material-create-form" onSubmit={(event) => void createMaterial(event)}><label>Pelatihan<TrainingSelect name="trainingId" trainings={catalog.trainings} /></label><label>Nama Materi<input name="name" required /></label><div className="form-grid"><label>Jumlah JP<input name="jp" type="number" min="1" required /></label><label>Urutan<input name="sortOrder" type="number" min="1" required /></label></div><button className="button"><Plus /> Tambah Materi</button></form><label className="material-training-filter">Filter Pelatihan<select value={materialTrainingId} onChange={(event) => setMaterialTrainingId(event.target.value)}><option value="">Semua Pelatihan</option>{catalog.trainings.map((training) => <option value={training.id} key={training.id}>{training.name}</option>)}</select></label><div className="data-table-wrap material-table-wrap"><table className="clean-table"><thead><tr><th>No</th><th>Nama Materi</th><th>JP</th><th>Urutan</th><th>Aksi</th></tr></thead><tbody>{filteredMaterials.map((material, index) => <tr key={material.id}><td>{index + 1}</td><td><strong>{material.name}</strong><small>{material.training_name}{material.bank_name ? ` · Bank: ${material.bank_name}` : ""}</small></td><td>{material.jp}</td><td>{material.sort_order}</td><td><div className="row-actions"><button type="button" className="text-button" onClick={() => void editMaterial(material)}>Edit</button>{!material.bank_id && <button type="button" className="text-button is-danger" onClick={() => void deleteMaterial(material)}>Hapus</button>}</div></td></tr>)}</tbody></table>{!filteredMaterials.length && <div className="empty-state">Belum ada materi untuk pelatihan ini.</div>}</div></section>
    </div>}

    {tab === "cohorts" && <section className="panel cohort-management-panel">
      <div className="panel-heading cohort-management-heading">
        <div><p className="section-label">Angkatan</p><h2>Daftar Angkatan</h2><p className="panel-description">Kelola periode dan status angkatan untuk setiap pelatihan.</p></div>
        <button type="button" className={showBulkCohortForm ? "button button--secondary" : "button"} onClick={() => { if (showBulkCohortForm) resetBulkCohortForm(); setShowBulkCohortForm((visible) => !visible); setError(null); setMessage(null); }}>
          {showBulkCohortForm ? <X /> : <Plus />}{showBulkCohortForm ? "Tutup Form" : "Buat Banyak Angkatan"}
        </button>
      </div>

      {noticeTarget === "cohort" && message && <p className="form-message is-success cohort-notice">{message}</p>}
      {noticeTarget === "cohort" && error && <p className="form-message is-error cohort-notice">{error}</p>}

      {showBulkCohortForm && <div className="cohort-generator">
        <div className="cohort-generator__heading"><span className="heading-icon"><CalendarDays /></span><div><h3>Generate Angkatan Massal</h3><p>Isi pola periode, periksa preview, lalu simpan seluruh angkatan sekaligus.</p></div></div>
        <form className="cohort-generator-form" onSubmit={previewBulkCohorts}>
          <label>Pelatihan<select required value={bulkCohortTrainingId} onChange={(event) => { setBulkCohortTrainingId(event.target.value); setCohortPreview([]); }}><option value="">Pilih pelatihan</option>{catalog.trainings.filter((training) => training.is_active).map((training) => <option key={training.id} value={training.id}>{training.name}</option>)}</select></label>
          <label>Mulai dari Angkatan<input type="number" min="1" value={bulkCohortForm.startNumber} onChange={(event) => { setBulkCohortForm((value) => ({ ...value, startNumber: Number(event.target.value) })); setCohortPreview([]); }} /></label>
          <label>Jumlah Angkatan<input type="number" min="1" max="100" value={bulkCohortForm.count} onChange={(event) => { setBulkCohortForm((value) => ({ ...value, count: Number(event.target.value) })); setCohortPreview([]); }} /></label>
          <label>Angkatan per Periode<input type="number" min="1" max={Math.max(1, bulkCohortForm.count)} value={bulkCohortForm.cohortsPerPeriod} onChange={(event) => { setBulkCohortForm((value) => ({ ...value, cohortsPerPeriod: Number(event.target.value) })); setCohortPreview([]); }} /></label>
          <label>Tanggal Mulai Periode Pertama<DateInput required value={bulkCohortForm.firstStartDate} onValueChange={(date) => { setBulkCohortForm((value) => ({ ...value, firstStartDate: date })); setCohortPreview([]); }} /></label>
          <label>Durasi Pelatihan <small>(hari)</small><input type="number" min="1" max="365" value={bulkCohortForm.durationDays} onChange={(event) => { setBulkCohortForm((value) => ({ ...value, durationDays: Number(event.target.value) })); setCohortPreview([]); }} /></label>
          <div className="cohort-generator-form__action"><button className="button" type="submit"><Eye /> Preview Angkatan</button></div>
        </form>

        {cohortPreview.length > 0 && <div className="cohort-preview">
          <div className="cohort-preview__heading"><div><p className="section-label">Preview</p><h3>{cohortPreview.length} angkatan siap dibuat</h3></div><p>Gunakan Edit jika salah satu angkatan memiliki tanggal khusus.</p></div>
          <div className="data-table-wrap"><table className="clean-table cohort-preview-table"><thead><tr><th>Angkatan</th><th>Tanggal Mulai</th><th>Tanggal Selesai</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{cohortPreview.map((row) => {
            const isEditing = editingCohortRow === row.clientId;
            return <tr key={row.clientId}><td>{isEditing ? <input aria-label="Nama angkatan" value={row.name} onChange={(event) => updatePreviewCohort(row.clientId, { name: event.target.value })} /> : <strong>{row.name}</strong>}</td><td>{isEditing ? <DateInput aria-label="Tanggal mulai" value={row.startDate} onValueChange={(date) => updatePreviewCohort(row.clientId, { startDate: date })} /> : formatCohortDate(row.startDate)}</td><td>{isEditing ? <DateInput aria-label="Tanggal selesai" value={row.endDate} onValueChange={(date) => updatePreviewCohort(row.clientId, { endDate: date })} /> : formatCohortDate(row.endDate)}</td><td>{isEditing ? <select aria-label="Status angkatan" value={row.status} onChange={(event) => updatePreviewCohort(row.clientId, { status: event.target.value as GeneratedCohort["status"] })}><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option><option value="COMPLETED">Selesai</option></select> : <span className={row.status === "ACTIVE" ? "status-badge is-active" : "status-badge"}>{row.status === "ACTIVE" ? "Aktif" : row.status === "INACTIVE" ? "Nonaktif" : "Selesai"}</span>}</td><td><button type="button" className="text-button" onClick={() => setEditingCohortRow(isEditing ? null : row.clientId)}>{isEditing ? "Selesai" : "Edit"}</button></td></tr>;
          })}</tbody></table></div>
          <div className="cohort-preview__save"><p>Data belum disimpan ke database sampai tombol ini ditekan.</p><button type="button" className="button" disabled={savingCohorts || Boolean(editingCohortRow)} onClick={() => void saveBulkCohorts()}>{savingCohorts ? "Menyimpan..." : `Simpan ${cohortPreview.length} Angkatan`}</button></div>
        </div>}
      </div>}

      <div className="data-table-wrap cohort-list-wrap"><table className="clean-table cohort-list-table"><thead><tr><th>Angkatan</th><th>Pelatihan</th><th>Periode</th><th>Jumlah Peserta</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{catalog.cohorts.map((cohort) => <tr key={cohort.id}><td><strong>{cohort.name}</strong></td><td>{cohort.training_name}</td><td>{formatCohortDate(cohort.start_date)} – {formatCohortDate(cohort.end_date)}</td><td>{cohort.participant_count} peserta</td><td><span className={cohort.status === "ACTIVE" ? "status-badge is-active" : cohort.status === "COMPLETED" ? "status-badge is-complete" : "status-badge"}>{cohort.status === "ACTIVE" ? "Aktif" : cohort.status === "INACTIVE" ? "Nonaktif" : "Selesai"}</span></td><td><div className="row-actions"><button type="button" className="text-button" onClick={() => void editCohort(cohort)}>Edit</button><button type="button" className="text-button" onClick={() => void toggleCohort(cohort)}>{cohort.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}</button><button type="button" className="text-button" onClick={() => setSelectedCohortDetail((id) => id === cohort.id ? null : cohort.id)}>Detail</button></div></td></tr>)}</tbody></table>{!catalog.cohorts.length && <div className="empty-state">Belum ada angkatan. Gunakan “Buat Banyak Angkatan” untuk memulai.</div>}</div>

      {selectedCohortDetail && (() => { const cohort = catalog.cohorts.find((item) => item.id === selectedCohortDetail); return cohort ? <div className="cohort-detail-card"><div><p className="section-label">Detail Angkatan</p><h3>{cohort.name}</h3></div><dl><div><dt>Pelatihan</dt><dd>{cohort.training_name}</dd></div><div><dt>Periode</dt><dd>{formatCohortDate(cohort.start_date)} – {formatCohortDate(cohort.end_date)}</dd></div><div><dt>Peserta</dt><dd>{cohort.participant_count} peserta</dd></div><div><dt>Status</dt><dd>{cohort.status === "ACTIVE" ? "Aktif" : cohort.status === "INACTIVE" ? "Nonaktif" : "Selesai"}</dd></div></dl><button type="button" className="text-button" onClick={() => setSelectedCohortDetail(null)}>Tutup detail</button></div> : null; })()}
      {editingExistingCohort && <CohortEditor cohort={editingExistingCohort} onCancel={() => setEditingExistingCohort(null)} onSaved={() => { setEditingExistingCohort(null); report("Angkatan diperbarui.", "cohort"); }} onError={(reason) => fail(reason, "cohort")} />}
    </section>}

      {tab === "certificate-workspace" && <CertificateWorkspace catalog={catalog} certificates={certificates} onRefresh={load} />}

      {tab === "certificates" && <><section className="panel certificate-settings"><div className="panel-heading"><div><p className="section-label">Pengaturan</p><h2>Overlay sertifikat cetak</h2><p>PDF hanya mencetak data, foto, tabel, tanda tangan, dan stempel di atas kertas sertifikat pre-printed.</p></div></div><form className="form-grid" onSubmit={(event) => void saveCertificateSettings(event)}><label>Pelatihan<select name="trainingId" required value={certificateTrainingId} onChange={(event) => { setCertificateTrainingId(event.target.value); setCertificateCohort(""); }}><option value="">Pilih pelatihan</option>{catalog.trainings.map((training) => <option value={training.id} key={training.id}>{training.name}</option>)}</select></label><label>Tempat Penerbitan<input value={certificateSettings.issue_place} onChange={(event) => setCertificateSettings((value) => ({ ...value, issue_place: event.target.value }))} /></label><label>Pejabat Penandatangan<input value={certificateSettings.signer_name} onChange={(event) => setCertificateSettings((value) => ({ ...value, signer_name: event.target.value }))} /></label><label>Jabatan<input value={certificateSettings.signer_title} onChange={(event) => setCertificateSettings((value) => ({ ...value, signer_title: event.target.value }))} /></label><label>NIP<input value={certificateSettings.signer_nip} onChange={(event) => setCertificateSettings((value) => ({ ...value, signer_nip: event.target.value }))} /></label><label>Offset Horizontal (mm)<input type="number" min="-20" max="20" step="0.1" value={certificateSettings.offset_x_mm} onChange={(event) => setCertificateSettings((value) => ({ ...value, offset_x_mm: Number(event.target.value) }))} /></label><label>Offset Vertikal (mm)<input type="number" min="-20" max="20" step="0.1" value={certificateSettings.offset_y_mm} onChange={(event) => setCertificateSettings((value) => ({ ...value, offset_y_mm: Number(event.target.value) }))} /></label><label>Tanda tangan PNG transparan<input name="signature" type="file" accept="image/png" /></label><label>Stempel PNG transparan <small>(opsional)</small><input name="stamp" type="file" accept="image/png" /></label><label>Scan depan untuk preview <small>(opsional)</small><input name="frontTemplate" type="file" accept="image/png,image/jpeg" /></label><label>Scan belakang untuk preview <small>(opsional)</small><input name="backTemplate" type="file" accept="image/png,image/jpeg" /></label><div className="form-actions"><button className="button">Simpan Pengaturan</button><button type="button" className="button button--secondary" onClick={() => void generateAll()}>Generate Semua Peserta Angkatan</button></div></form></section>
      <section className="panel certificate-list-panel"><div className="panel-heading"><div><p className="section-label">PDF siap cetak</p><h2>Sertifikat Peserta</h2><p>Print: A4, Landscape, Scale 100% / Actual Size. Jangan gunakan Fit to Page.</p></div></div><div className="certificate-filters"><label>Pelatihan<select value={certificateTrainingId} onChange={(event) => { setCertificateTrainingId(event.target.value); setCertificateCohort(""); }}><option value="">Semua Pelatihan</option>{catalog.trainings.map((training) => <option value={training.id} key={training.id}>{training.name}</option>)}</select></label><label>Angkatan<select value={certificateCohort} onChange={(event) => setCertificateCohort(event.target.value)}><option value="">Semua Angkatan</option>{catalog.cohorts.filter((cohort) => !certificateTrainingId || cohort.training_id === certificateTrainingId).map((cohort) => <option value={cohort.id} key={cohort.id}>{cohort.name}</option>)}</select></label><label>Status<select value={certificateStatus} onChange={(event) => setCertificateStatus(event.target.value)}><option value="">Semua Status</option><option value="LULUS">Lulus</option><option value="BELUM_LULUS">Belum Lulus</option><option value="READY">Siap Generate</option></select></label></div><div className="data-table-wrap"><table className="clean-table"><thead><tr><th>Nama Peserta</th><th>NIK</th><th>Status</th><th>Nomor Sertifikat Resmi</th><th>Aksi</th></tr></thead><tbody>{filteredCertificates.map((participant) => <tr key={participant.participant_id}><td><strong>{participant.name}</strong><small>{participant.training_name} · {participant.cohort_name}</small></td><td>{participant.nik_masked}</td><td><span className={participant.graduation_status === "LULUS" ? "status-badge is-active" : "status-badge is-danger"}>{participant.graduation_status === "LULUS" ? "Lulus" : "Belum Lulus"}</span></td><td>{participant.graduation_status === "LULUS" && <div className="row-actions"><input aria-label={`Nomor sertifikat ${participant.name}`} value={certificateNumbers[participant.participant_id] ?? participant.certificate_number ?? ""} onChange={(event) => setCertificateNumbers((current) => ({ ...current, [participant.participant_id]: event.target.value }))} placeholder="Nomor resmi BDI" /><button className="button button--secondary button--small" onClick={() => void saveCertificateNumber(participant)}>Simpan Nomor</button></div>}</td><td>{participant.graduation_status === "LULUS" && <div className="row-actions"><button className="button button--secondary button--small" onClick={() => void generateCert(participant, "FRONT")}>Generate Depan</button><button className="button button--secondary button--small" onClick={() => void generateCert(participant, "BACK")}>Generate Belakang</button>{participant.certificate_id && <><a className="text-button" target="_blank" rel="noreferrer" href={`/api/admin/participants/certificates/${participant.certificate_id}/preview?side=FRONT`}>Preview Depan</a><a className="text-button" target="_blank" rel="noreferrer" href={`/api/admin/participants/certificates/${participant.certificate_id}/pdf?side=FRONT`}>Download Depan</a><a className="text-button" target="_blank" rel="noreferrer" href={`/api/admin/participants/certificates/${participant.certificate_id}/pdf?side=BACK`}>Download Belakang</a></>}</div>}</td></tr>)}</tbody></table></div></section></>}
  </>;
}

function CertificateWorkspace({ catalog, certificates, onRefresh }: { catalog: Catalog; certificates: Certificate[]; onRefresh: () => Promise<void> }) {
  const [trainingId, setTrainingId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [settings, setSettings] = useState<CertificateSettings>({ certificate_prefix: "", signer_name: "", signer_title: "", signer_nip: "", issue_place: "", issue_date: "", offset_x_mm: 0, offset_y_mm: 0 });
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preview, setPreview] = useState<Certificate | null>(null);
  const [previewSide, setPreviewSide] = useState<"FRONT" | "BACK">("FRONT");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<Record<string, number>>({});

  const cohorts = catalog.cohorts.filter((cohort) => !trainingId || cohort.training_id === trainingId);
  const rows = certificates.filter((certificate) => (!trainingId || certificate.training_id === trainingId) && (!cohortId || certificate.cohort_id === cohortId));

  useEffect(() => {
    if (!trainingId) return;
    void adminQuery<{ settings: CertificateSettings }>(`/api/admin/participants/certificate-settings/${trainingId}`)
      .then((result) => setSettings(result.settings))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Pengaturan sertifikat tidak dapat dimuat."));
  }, [trainingId]);
  useEffect(() => () => Object.values(timers.current).forEach((timer) => window.clearTimeout(timer)), []);

  async function persistNumber(certificate: Certificate, number = numbers[certificate.participant_id] ?? certificate.certificate_number ?? "") {
    const certificateNumber = number.trim();
    if (!certificateNumber) return false;
    window.clearTimeout(timers.current[certificate.participant_id]);
    setSavingId(certificate.participant_id); setError(null);
    try {
      await adminMutation(`/api/admin/participants/certificates/${certificate.participant_id}/number`, { method: "PUT", body: JSON.stringify({ certificateNumber }) });
      await onRefresh();
      return true;
    } catch (reason) {
      setError(reason instanceof AdminApiError ? reason.message : "Nomor sertifikat tidak dapat disimpan.");
      return false;
    } finally { setSavingId(null); }
  }
  function updateNumber(certificate: Certificate, value: string) {
    setNumbers((current) => ({ ...current, [certificate.participant_id]: value }));
    window.clearTimeout(timers.current[certificate.participant_id]);
    timers.current[certificate.participant_id] = window.setTimeout(() => { void persistNumber(certificate, value); }, 700);
  }
  async function openPreview(certificate: Certificate) {
    const number = numbers[certificate.participant_id] ?? certificate.certificate_number ?? "";
    if (number.trim()) await persistNumber(certificate, number);
    setPreview({ ...certificate, certificate_number: number.trim() || null }); setPreviewSide("FRONT");
  }
  async function downloadAll() {
    if (!trainingId || !cohortId) { setError("Pilih pelatihan dan angkatan terlebih dahulu."); return; }
    setDownloading(true); setError(null);
    try {
      const archive = await adminDownload("/api/admin/participants/certificates/download-all", { method: "POST", body: JSON.stringify({ trainingId, cohortId }) });
      const url = URL.createObjectURL(archive); const link = document.createElement("a");
      link.href = url; link.download = "sertifikat-bdi.zip"; link.click(); URL.revokeObjectURL(url);
      await onRefresh();
    } catch (reason) { setError(reason instanceof AdminApiError ? reason.message : "Arsip sertifikat tidak dapat dibuat."); }
    finally { setDownloading(false); }
  }

  return <section className="panel certificate-workspace">
    <header className="certificate-workspace__header"><div><p className="section-label">Sertifikat</p><h2>Sertifikat kelulusan</h2><p>Print: A4, Landscape, Scale 100% / Actual Size. Jangan gunakan Fit to Page.</p></div><button type="button" className="button button--secondary" onClick={() => setSettingsOpen(true)}>Pengaturan Sertifikat</button></header>
    <div className="certificate-workspace__filters"><label>Pelatihan<select value={trainingId} onChange={(event) => { setTrainingId(event.target.value); setCohortId(""); }}><option value="">Pilih pelatihan</option>{catalog.trainings.map((training) => <option value={training.id} key={training.id}>{training.name}</option>)}</select></label><label>Angkatan<select value={cohortId} disabled={!trainingId} onChange={(event) => setCohortId(event.target.value)}><option value="">Pilih angkatan</option>{cohorts.map((cohort) => <option value={cohort.id} key={cohort.id}>{cohort.name}</option>)}</select></label></div>
    {error && <p className="form-message is-error" role="alert">{error}</p>}
    <div className="data-table-wrap"><table className="clean-table certificate-workspace__table"><thead><tr><th>Nama Peserta</th><th>Status</th><th>Nomor Sertifikat</th><th>Aksi</th></tr></thead><tbody>{rows.map((certificate) => <tr key={certificate.participant_id}><td><strong>{certificate.name}</strong><small>{certificate.training_name} · {certificate.cohort_name}</small></td><td><span className={certificate.graduation_status === "LULUS" ? "status-badge is-active" : "status-badge is-danger"}>{certificate.graduation_status === "LULUS" ? "Lulus" : "Belum lulus"}</span></td><td>{certificate.graduation_status === "LULUS" ? <input aria-label={`Nomor sertifikat ${certificate.name}`} value={numbers[certificate.participant_id] ?? certificate.certificate_number ?? ""} onChange={(event) => updateNumber(certificate, event.target.value)} onBlur={() => void persistNumber(certificate)} placeholder="Nomor resmi BDI" /> : "—"}{savingId === certificate.participant_id && <small className="certificate-autosave">Menyimpan…</small>}</td><td>{certificate.graduation_status === "LULUS" ? <button type="button" className="button button--secondary button--small" onClick={() => void openPreview(certificate)}>Preview</button> : "—"}</td></tr>)}</tbody></table>{trainingId && cohortId && !rows.length && <p className="empty-state">Belum ada peserta pada angkatan ini.</p>}</div>
    <footer className="certificate-workspace__footer"><p>Arsip berisi PDF depan dan belakang setiap peserta lulus yang memiliki nomor sertifikat resmi.</p><button type="button" className="button" disabled={!trainingId || !cohortId || downloading} onClick={() => void downloadAll()}><Download />{downloading ? "Menyiapkan arsip…" : "Download Semua Sertifikat"}</button></footer>
    {settingsOpen && <CertificateSettingsModal catalog={catalog} trainingId={trainingId} onTrainingChange={(id) => { setTrainingId(id); setCohortId(""); }} settings={settings} onChange={setSettings} onSaved={onRefresh} onClose={() => setSettingsOpen(false)} />}
    {preview && <CertificatePreviewModal certificate={preview} side={previewSide} onSideChange={setPreviewSide} onClose={() => setPreview(null)} />}
  </section>;
}

function CertificateSettingsModal({ catalog, trainingId, onTrainingChange, settings, onChange, onSaved, onClose }: { catalog: Catalog; trainingId: string; onTrainingChange: (id: string) => void; settings: CertificateSettings; onChange: (settings: CertificateSettings) => void; onSaved: () => Promise<void>; onClose: () => void }) {
  useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previous; }; }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await adminMutation(`/api/admin/participants/certificate-settings/${trainingId}`, { method: "PUT", body: JSON.stringify({ signerName: settings.signer_name, signerTitle: settings.signer_title, signerNip: settings.signer_nip, issuePlace: settings.issue_place, issueDate: settings.issue_date, offsetXmm: Number(settings.offset_x_mm), offsetYmm: Number(settings.offset_y_mm) }) });
    const assets = new FormData(); for (const field of ["signature", "stamp", "frontTemplate", "backTemplate"]) { const file = form.get(field); if (file instanceof File && file.size) assets.set(field, file); }
    if ([...assets.keys()].length) await adminUpload(`/api/admin/participants/certificate-settings/${trainingId}/assets`, assets);
    await onSaved(); onClose();
  }
  return createPortal(<div className="modal-backdrop participant-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="participant-modal certificate-modal" role="dialog" aria-modal="true" aria-labelledby="certificate-settings-title"><header className="participant-modal__header"><div><p className="section-label">Pengaturan</p><h2 id="certificate-settings-title">Pengaturan Sertifikat</h2></div><button type="button" className="participant-modal__close" aria-label="Tutup pengaturan sertifikat" onClick={onClose}><X /></button></header><form className="participant-modal__form certificate-settings-form" onSubmit={(event) => void submit(event)}><div className="participant-modal__grid"><label>Pelatihan<select required value={trainingId} onChange={(event) => onTrainingChange(event.target.value)}><option value="">Pilih pelatihan</option>{catalog.trainings.map((training) => <option value={training.id} key={training.id}>{training.name}</option>)}</select></label><label>Tempat penerbitan<input value={settings.issue_place} onChange={(event) => onChange({ ...settings, issue_place: event.target.value })} /></label><label>Tanggal penerbitan<DateInput required value={settings.issue_date} onValueChange={(issue_date) => onChange({ ...settings, issue_date })} /></label><label>Nama pejabat<input value={settings.signer_name} onChange={(event) => onChange({ ...settings, signer_name: event.target.value })} /></label><label>Jabatan<input value={settings.signer_title} onChange={(event) => onChange({ ...settings, signer_title: event.target.value })} /></label><label>NIP<input value={settings.signer_nip} onChange={(event) => onChange({ ...settings, signer_nip: event.target.value })} /></label><label>Offset X (mm)<input type="number" min="-20" max="20" step="0.1" value={settings.offset_x_mm} onChange={(event) => onChange({ ...settings, offset_x_mm: Number(event.target.value) })} /></label><label>Offset Y (mm)<input type="number" min="-20" max="20" step="0.1" value={settings.offset_y_mm} onChange={(event) => onChange({ ...settings, offset_y_mm: Number(event.target.value) })} /></label><label>Tanda tangan PNG<input name="signature" type="file" accept="image/png" /></label><label>Stempel PNG<input name="stamp" type="file" accept="image/png" /></label><label>Background depan preview<input name="frontTemplate" type="file" accept="image/png,image/jpeg" /></label><label>Background belakang preview<input name="backTemplate" type="file" accept="image/png,image/jpeg" /></label></div><footer className="participant-modal__actions"><button type="button" className="button button--secondary" onClick={onClose}>Batal</button><button className="button" disabled={!trainingId}>Simpan Pengaturan</button></footer></form></section></div>, document.body);
}

function CertificatePreviewModal({ certificate, side, onSideChange, onClose }: { certificate: Certificate; side: "FRONT" | "BACK"; onSideChange: (side: "FRONT" | "BACK") => void; onClose: () => void }) {
  useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previous; }; }, []);
  const [warning, setWarning] = useState<string | null>(null);
  const previewUrl = `/api/admin/participants/certificates/preview-participant/${certificate.participant_id}?side=${side}`;
  function download() { if (!certificate.certificate_id || !certificate.certificate_number) { setWarning("Isi nomor sertifikat resmi terlebih dahulu."); return; } window.open(`/api/admin/participants/certificates/${certificate.certificate_id}/download`, "_blank", "noopener,noreferrer"); }
  return createPortal(<div className="modal-backdrop participant-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="participant-modal certificate-preview-modal" role="dialog" aria-modal="true" aria-labelledby="certificate-preview-title"><header className="participant-modal__header"><div><p className="section-label">Preview Sertifikat</p><h2 id="certificate-preview-title">{certificate.name}</h2></div><button type="button" className="participant-modal__close" aria-label="Tutup preview sertifikat" onClick={onClose}><X /></button></header><div className="certificate-preview-tabs"><button type="button" className={side === "FRONT" ? "is-active" : ""} onClick={() => onSideChange("FRONT")}>DEPAN</button><button type="button" className={side === "BACK" ? "is-active" : ""} onClick={() => onSideChange("BACK")}>BELAKANG</button></div><div className="certificate-preview-frame"><iframe key={side} title={`Preview sertifikat ${side === "FRONT" ? "depan" : "belakang"}`} src={previewUrl} /></div>{warning && <p className="form-message is-error" role="alert">{warning}</p>}<footer className="participant-modal__actions"><button type="button" className="button" onClick={download}>Download Sertifikat</button></footer></section></div>, document.body);
}

function CohortEditor({ cohort, onCancel, onSaved, onError }: { cohort: Cohort; onCancel: () => void; onSaved: () => void; onError: (reason: unknown) => void }) {
  const [name, setName] = useState(cohort.name);
  const [startDate, setStartDate] = useState(cohort.start_date);
  const [endDate, setEndDate] = useState(cohort.end_date);
  const [status, setStatus] = useState(cohort.status);
  useEffect(() => { const previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previousOverflow; }; }, []);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); try { await adminMutation(`/api/admin/participants/cohorts/${cohort.id}`, { method: "PUT", body: JSON.stringify({ trainingId: cohort.training_id, name, startDate, endDate, status }) }); onSaved(); } catch (reason) { onError(reason); } }
  return createPortal(<div className="modal-backdrop participant-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><section className="cohort-edit-modal" role="dialog" aria-modal="true" aria-labelledby="cohort-edit-title"><header className="participant-modal__header"><div><p className="section-label">Edit Angkatan</p><h2 id="cohort-edit-title">{cohort.name}</h2></div><button type="button" className="participant-modal__close" aria-label="Tutup edit angkatan" onClick={onCancel}><X /></button></header><form onSubmit={(event) => void submit(event)}><div className="cohort-edit-modal__grid"><label>Nama Angkatan<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option><option value="COMPLETED">Selesai</option></select></label><label>Tanggal Mulai<DateInput required value={startDate} onValueChange={setStartDate} /></label><label>Tanggal Selesai<DateInput required value={endDate} min={startDate} onValueChange={setEndDate} /></label></div><footer className="participant-modal__actions"><button type="button" className="button button--secondary" onClick={onCancel}>Batal</button><button className="button">Simpan Perubahan</button></footer></form></section></div>, document.body);
}

function TrainingSelect({ name, trainings }: { name: string; trainings: Training[] }) {
  return <select name={name} required><option value="">Pilih pelatihan</option>{trainings.filter((training) => training.is_active).map((training) => <option value={training.id} key={training.id}>{training.name}</option>)}</select>;
}

function TrainingCohortFields({ catalog }: { catalog: Catalog }) {
  const [id, setId] = useState("");
  return <><label>Pelatihan<select name="trainingId" required value={id} onChange={(event) => setId(event.target.value)}><option value="">Pilih pelatihan</option>{catalog.trainings.filter((training) => training.is_active).map((training) => <option key={training.id} value={training.id}>{training.name}</option>)}</select></label><label>Angkatan<select name="cohortId" required><option value="">Pilih angkatan</option>{catalog.cohorts.filter((cohort) => cohort.training_id === id && cohort.status === "ACTIVE").map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></label></>;
}

function ParticipantEditor({ id, catalog, onCancel, onSaved, onError }: { id: string; catalog: Catalog; onCancel: () => void; onSaved: () => void; onError: (error: unknown) => void }) {
  const [person, setPerson] = useState<any>(null);
  const [trainingId, setTrainingId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [photoName, setPhotoName] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void adminQuery<{ participant: any }>(`/api/admin/participants/participants/${id}`).then((result) => setPerson(result.participant)).catch(onError); }, [id]);
  useEffect(() => { if (person) { setTrainingId(person.training_id); setCohortId(person.cohort_id); } }, [person]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => { document.body.style.overflow = previousOverflow; document.body.style.paddingRight = previousPaddingRight; };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      await adminMutation(`/api/admin/participants/participants/${id}`, { method: "PUT", body: JSON.stringify({ trainingId, cohortId, name: form.get("name"), nik: form.get("nik"), birthPlace: form.get("birthPlace"), birthDate: form.get("birthDate"), isActive: form.get("isActive") === "on" }) });
      const photo = form.get("photo"); if (photo instanceof File && photo.size) { const upload = new FormData(); upload.set("photo", photo); await adminUpload(`/api/admin/participants/participants/${id}/photo`, upload); }
      onSaved();
    } catch (processError) { onError(processError); }
  }
  const availableCohorts = catalog.cohorts.filter((cohort) => cohort.training_id === trainingId);
  const modal = <div className="modal-backdrop participant-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    {!person ? <section className="participant-modal participant-modal--loading" role="dialog" aria-modal="true" aria-label="Memuat detail peserta"><button type="button" className="participant-modal__close" aria-label="Tutup detail peserta" onClick={onCancel}><X /></button><p className="muted">Memuat detail peserta…</p></section> : <section className="participant-modal" role="dialog" aria-modal="true" aria-labelledby="participant-modal-title"><header className="participant-modal__header"><div><p className="section-label">Detail Peserta</p><h2 id="participant-modal-title">{person.name}</h2></div><button type="button" className="participant-modal__close" aria-label="Tutup detail peserta" onClick={onCancel}><X /></button></header><form className="participant-modal__form" onSubmit={(event) => void submit(event)}><div className="participant-modal__grid"><label>Nama Lengkap<input name="name" defaultValue={person.name} required /></label><label>NIK Lengkap<input name="nik" defaultValue={person.nik} required inputMode="numeric" /></label><label>Tempat Lahir<input name="birthPlace" defaultValue={person.birth_place} required /></label><label>Tanggal Lahir<DateInput name="birthDate" defaultValue={person.birth_date} required /></label><label>Pelatihan<select required value={trainingId} onChange={(event) => { setTrainingId(event.target.value); setCohortId(""); }}><option value="">Pilih pelatihan</option>{catalog.trainings.map((training) => <option key={training.id} value={training.id}>{training.name}</option>)}</select></label><label>Angkatan<select required value={cohortId} onChange={(event) => setCohortId(event.target.value)} disabled={!trainingId}><option value="">Pilih angkatan</option>{availableCohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></label><label className="participant-modal__photo">Foto Peserta<span className="participant-photo-picker"><span className="participant-photo-picker__preview">{person.photo_key ? <img src={`/api/admin/participants/participants/${id}/photo`} alt="Foto peserta saat ini" /> : <Image />}</span><span className="participant-photo-picker__copy"><strong>{photoName || "Foto 3 × 4"}</strong><small>JPG atau PNG, maksimal 5 MB. Tampilan akan menyesuaikan rasio 3:4.</small><button type="button" className="button button--secondary button--small" onClick={() => photoInputRef.current?.click()}>{photoName ? "Ganti Foto" : "Pilih Foto"}</button></span><input ref={photoInputRef} className="visually-hidden-file" name="photo" type="file" accept="image/jpeg,image/png" onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? "")} /></span></label><label className="toggle-row participant-modal__status"><input name="isActive" type="checkbox" defaultChecked={person.is_active === 1} /><span>Status Aktif</span></label></div><footer className="participant-modal__actions"><button type="button" className="button button--secondary" onClick={onCancel}>Batal</button><button className="button"><UserPlus /> Simpan Perubahan</button></footer></form></section>}
  </div>;
  return createPortal(modal, document.body);
}
