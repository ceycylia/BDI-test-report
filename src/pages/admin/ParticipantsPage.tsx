import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Award, BookOpenText, CalendarDays, Download, Eye, FileSpreadsheet, GraduationCap, Image, Layers3, Plus, Trash2, Upload, UserPlus, Users, X } from "lucide-react";
import { adminDownload, adminMutation, adminQuery, adminUpload, AdminApiError } from "../../features/admin-auth/admin-api";
import { addDays, formatCohortDate, generateCohorts, type GeneratedCohort } from "../../features/cohorts/bulk-cohort";
import { useAutoDismiss } from "../../components/ui/useAutoDismiss";
import { DateInput } from "../../components/ui/DateInput";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { SearchInput } from "../../components/ui/SearchInput";
import { ConfirmDeleteModal } from "../../components/ui/ConfirmDeleteModal";
import { IconActionButton, StatusIcon } from "../../components/ui/IconActionButton";
import { ModalPortal } from "../../components/ui/ModalPortal";
import { ADMIN_PAGE_SIZE, Pagination, type PaginationMeta } from "../../components/ui/Pagination";
import { formatDateForDisplay } from "../../features/dates/date-format";
import { ActiveYearIndicator, useActiveYear, withActiveYear } from "../../features/active-year/ActiveYearProvider";
import { optimizeImage } from "../../features/media/optimize-image";

type Training = { id: string; name: string; is_active: number; material_count: number; total_jp: number };
type Material = { id: string; training_id: string; training_name: string; name: string; jp: number; sort_order: number; bank_id: string | null; bank_name: string | null };
type Cohort = { id: string; training_id: string; training_name: string; name: string; start_date: string; end_date: string; status: string; participant_count: number };
type Participant = { id: string; training_id: string; cohort_id: string; name: string; nik_masked: string; birth_place: string; birth_date: string; address: string | null; photo_key: string | null; is_active: number; training_name: string; cohort_name: string };
type Certificate = { participant_id: string; name: string; nik_masked: string; training_id: string; training_name: string; cohort_id: string; cohort_name: string; graduation_status: string; certificate_id: string | null; certificate_number: string | null; certificate_status: string | null; completion_letter_id: string | null; completion_letter_number: string | null };
type Catalog = { trainings: Training[]; materials: Material[]; cohorts: Cohort[] };
type ImportRow = { row: number; name: string; nik: string; birthPlace: string; birthDate: string; address: string; errors: string[] };
type CertificateSettings = { certificate_prefix: string; signer_name: string; signer_title: string; signer_nip: string; issue_place: string; issue_date: string; signature_key?: string | null };
const emptyCertificateSettings: CertificateSettings = { certificate_prefix: "", signer_name: "", signer_title: "", signer_nip: "", issue_place: "", issue_date: "", signature_key: null };
type BulkDocumentNumberEntry = { participantId: string; certificateNumber?: string; completionLetterNumber?: string };
type BulkNumberMode = "overwrite" | "empty";
type DocumentNumberKind = "certificate" | "letter";
type ParticipantFilters = { year: number; trainingId?: string; cohortId?: string; status?: boolean; search?: string };
const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function documentNumberPeriod(issueDate: string) {
  const match = issueDate.match(/^(\d{4})-(\d{2})-/u);
  if (match) return `${romanMonths[Number(match[2]) - 1]}/${match[1]}`;
  const now = new Date();
  return `${romanMonths[now.getMonth()]}/${now.getFullYear()}`;
}

function sequenceNumber(start: string, index: number) {
  return (BigInt(start) + BigInt(index)).toString().padStart(start.length, "0");
}

function fullDocumentNumber(kind: "certificate" | "letter", number: string, issueDate: string) {
  const institution = kind === "certificate" ? "BPSDMI/BDI-Medan" : "BDI-Medan";
  return `B/${number}/${institution}/DL/${documentNumberPeriod(issueDate)}`;
}

function applyDocumentNumberFormat(format: string, number: string) {
  return format.replaceAll("[isi nomor]", number).trim();
}
type DeleteTarget =
  | { kind: "training"; training: Training }
  | { kind: "material"; material: Material }
  | { kind: "cohort"; cohort: Cohort }
  | { kind: "participants"; filters: ParticipantFilters; count: number; filterDescription: string };

const tabs = [
  { id: "data", label: "Data Peserta", icon: Users },
  { id: "cohorts", label: "Angkatan", icon: Layers3 },
  { id: "certificate-workspace", label: "Sertifikat", icon: Award },
] as const;

export function ParticipantsPage() {
  const { activeYear } = useActiveYear();
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [participantPage, setParticipantPage] = useState(1);
  const [participantPagination, setParticipantPagination] = useState<PaginationMeta>({ page: 1, limit: ADMIN_PAGE_SIZE, total: 0, totalPages: 1 });
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [cohortRows, setCohortRows] = useState<Cohort[]>([]);
  const [cohortPage, setCohortPage] = useState(1);
  const [cohortPagination, setCohortPagination] = useState<PaginationMeta>({ page: 1, limit: ADMIN_PAGE_SIZE, total: 0, totalPages: 1 });
  const [cohortsLoading, setCohortsLoading] = useState(false);
  const participantRequestRef = useRef(0);
  const [message, setMessage] = useState<string | null>(null);
  useAutoDismiss(message, setMessage);
  const [error, setError] = useState<string | null>(null);
  useAutoDismiss(error, setError);
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
  const [certificateSettings, setCertificateSettings] = useState<CertificateSettings>(emptyCertificateSettings);
  const [certificateNumbers, setCertificateNumbers] = useState<Record<string, string>>({});
  const [showBulkCohortForm, setShowBulkCohortForm] = useState(false);
  const [bulkCohortTrainingId, setBulkCohortTrainingId] = useState("");
  const [bulkCohortForm, setBulkCohortForm] = useState({ startNumber: 1, count: 1, firstStartDate: "", durationDays: 7 });
  const [cohortPreview, setCohortPreview] = useState<GeneratedCohort[]>([]);
  const [editingCohortRow, setEditingCohortRow] = useState<string | null>(null);
  const [selectedCohortDetail, setSelectedCohortDetail] = useState<string | null>(null);
  const [editingExistingCohort, setEditingExistingCohort] = useState<Cohort | null>(null);
  const [savingCohorts, setSavingCohorts] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletingRecord, setDeletingRecord] = useState(false);

  const loadSupportingData = useCallback(async () => {
    setCatalog(await adminQuery<Catalog>(withActiveYear("/api/admin/participants/catalog", activeYear)));
  }, [activeYear]);

  const loadCertificates = useCallback(async () => {
    const result = await adminQuery<{ certificates: Certificate[] }>(withActiveYear("/api/admin/participants/certificates", activeYear));
    setCertificates(result.certificates);
  }, [activeYear]);

  const loadParticipants = useCallback(async () => {
    const requestId = participantRequestRef.current + 1;
    participantRequestRef.current = requestId;
    setParticipantsLoading(true);
    const query = new URLSearchParams({
      year: String(activeYear),
      page: String(participantPage),
      limit: String(ADMIN_PAGE_SIZE),
    });
    if (listTrainingId) query.set("trainingId", listTrainingId);
    if (listCohortId) query.set("cohortId", listCohortId);
    if (listStatus) query.set("status", listStatus);
    if (debouncedSearch.trim()) query.set("search", debouncedSearch.trim());
    try {
      const result = await adminQuery<{ participants: Participant[]; pagination: PaginationMeta }>(`/api/admin/participants/participants?${query.toString()}`);
      if (requestId !== participantRequestRef.current) return;
      if (participantPage > result.pagination.totalPages) {
        setParticipantPage(result.pagination.totalPages);
        return;
      }
      setParticipants(result.participants);
      setParticipantPagination(result.pagination);
    } finally {
      if (requestId === participantRequestRef.current) setParticipantsLoading(false);
    }
  }, [activeYear, debouncedSearch, listCohortId, listStatus, listTrainingId, participantPage]);

  const loadCohorts = useCallback(async (requestedPage = cohortPage) => {
    setCohortsLoading(true);
    try {
      const result = await adminQuery<{ cohorts: Cohort[]; pagination: PaginationMeta }>(withActiveYear(`/api/admin/participants/catalog/cohorts?page=${requestedPage}&limit=${ADMIN_PAGE_SIZE}`, activeYear));
      if (requestedPage > result.pagination.totalPages) { setCohortPage(result.pagination.totalPages); return; }
      setCohortRows(result.cohorts); setCohortPagination(result.pagination);
    } finally { setCohortsLoading(false); }
  }, [activeYear, cohortPage]);

  const load = useCallback(async () => {
    await Promise.all([loadSupportingData(), loadParticipants(), ...(tab === "certificate-workspace" || tab === "certificates" ? [loadCertificates()] : [])]);
  }, [loadCertificates, loadParticipants, loadSupportingData, tab]);
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
    if (target === "cohort") void loadCohorts();
  };

  useEffect(() => {
    setTrainingId(""); setCohortId(""); setListTrainingId(""); setListCohortId(""); setCertificateTrainingId(""); setCertificateCohort("");
    setListStatus(""); setSearch(""); setDebouncedSearch(""); setParticipantPage(1);
    void loadSupportingData().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Data tidak dapat dimuat."));
  }, [activeYear, loadSupportingData]);
  useEffect(() => {
    if (tab === "certificate-workspace" || tab === "certificates") {
      void loadCertificates().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Data sertifikat tidak dapat dimuat."));
    }
  }, [loadCertificates, tab]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setParticipantPage(1);
      setDebouncedSearch(search);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    void loadParticipants().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Data peserta tidak dapat dimuat."));
  }, [loadParticipants]);
  useEffect(() => { void loadCohorts().catch((reason: unknown) => fail(reason, "cohort")); }, [loadCohorts]);
  useEffect(() => {
    void adminQuery<{ settings: CertificateSettings }>("/api/admin/participants/certificate-settings").then((result) => setCertificateSettings(result.settings)).catch(fail);
  }, []);

  const cohorts = useMemo(() => catalog.cohorts.filter((cohort) => !trainingId || cohort.training_id === trainingId), [catalog, trainingId]);
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
    setDeletingRecord(true);
    try {
      await adminMutation(`/api/admin/participants/trainings/${training.id}`, { method: "DELETE", body: "{}" });
      setDeleteTarget(null);
      report("Pelatihan dihapus. Seluruh data historis tetap disimpan.");
    } catch (processError) { setDeleteTarget(null); fail(processError); }
    finally { setDeletingRecord(false); }
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
    setDeletingRecord(true);
    try { await adminMutation(`/api/admin/participants/materials/${material.id}`, { method: "DELETE", body: "{}" }); setDeleteTarget(null); report("Materi dihapus.", "material"); } catch (processError) { setDeleteTarget(null); fail(processError, "material"); }
    finally { setDeletingRecord(false); }
  }
  async function toggleCohort(cohort: Cohort) {
    try { await adminMutation(`/api/admin/participants/cohorts/${cohort.id}`, { method: "PUT", body: JSON.stringify({ trainingId: cohort.training_id, name: cohort.name, startDate: cohort.start_date, endDate: cohort.end_date, status: cohort.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }) }); report("Status angkatan diperbarui.", "cohort"); } catch (processError) { fail(processError, "cohort"); }
  }
  async function deleteCohort(cohort: Cohort) {
    setDeletingRecord(true);
    try {
      await adminMutation(`/api/admin/participants/cohorts/${cohort.id}`, { method: "DELETE", body: "{}" });
      setSelectedCohortDetail((id) => id === cohort.id ? null : id);
      setEditingExistingCohort((current) => current?.id === cohort.id ? null : current);
      setDeleteTarget(null);
      report("Angkatan berhasil dihapus.", "cohort");
    } catch (processError) { setDeleteTarget(null); fail(processError, "cohort"); }
    finally { setDeletingRecord(false); }
  }
  function editCohort(cohort: Cohort) { setEditingExistingCohort(cohort); }
  function resetBulkCohortForm() {
    setCohortPreview([]);
    setEditingCohortRow(null);
    setBulkCohortTrainingId("");
    setBulkCohortForm({ startNumber: 1, count: 1, firstStartDate: "", durationDays: 7 });
  }
  function previewBulkCohorts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNoticeTarget("cohort"); setMessage(null); setError(null);
    if (!bulkCohortTrainingId) return setError("Pelatihan wajib dipilih.");
    if (bulkCohortForm.startNumber < 1) return setError("Mulai dari angkatan minimal 1.");
    if (bulkCohortForm.count < 1) return setError("Jumlah angkatan minimal 1.");
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
    setCohortPreview((rows) => rows.map((row) => row.clientId === clientId ? { ...row, ...changes, ...(changes.startDate ? { endDate: addDays(changes.startDate, bulkCohortForm.durationDays - 1) } : {}) } : row));
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
    const differentYear = cohortPreview.find((row) => Number(row.startDate.slice(0, 4)) !== activeYear);
    if (differentYear) return setError(`Tanggal mulai ${differentYear.name} berada pada tahun ${differentYear.startDate.slice(0, 4)}, sedangkan Tahun Aktif adalah ${activeYear}. Ubah Tahun Aktif atau tanggal pelaksanaan sebelum menyimpan.`);
    setSavingCohorts(true);
    try {
      const result = await adminMutation<{ created: number }>("/api/admin/participants/cohorts/bulk", { method: "POST", body: JSON.stringify({ activeYear, trainingId: bulkCohortTrainingId, cohorts: cohortPreview.map(({ name, startDate, endDate, status }) => ({ name, startDate, endDate, status })) }) });
      resetBulkCohortForm(); setShowBulkCohortForm(false); report(`${result.created} angkatan berhasil disimpan.`, "cohort");
    } catch (processError) { fail(processError, "cohort"); }
    finally { setSavingCohorts(false); }
  }
  async function createParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    try {
      const participant = await adminMutation<{ id: string }>("/api/admin/participants/participants", { method: "POST", body: JSON.stringify({ trainingId: form.get("trainingId"), cohortId: form.get("cohortId"), name: form.get("name"), nik: form.get("nik"), birthPlace: form.get("birthPlace"), birthDate: form.get("birthDate"), address: form.get("address"), isActive: true }) });
      const photo = form.get("photo"); if (photo instanceof File && photo.size) { const upload = new FormData(); upload.set("photo", await optimizeImage(photo)); await adminUpload(`/api/admin/participants/participants/${participant.id}/photo`, upload); }
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
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      await adminMutation("/api/admin/participants/certificate-settings", { method: "PUT", body: JSON.stringify({ signerName: certificateSettings.signer_name, signerTitle: certificateSettings.signer_title, signerNip: certificateSettings.signer_nip, issuePlace: certificateSettings.issue_place }) });
      const assets = new FormData(); for (const field of ["signature", "stamp", "frontTemplate", "backTemplate"]) { const file = form.get(field); if (file instanceof File && file.size) assets.set(field, file); }
      if ([...assets.keys()].length) await adminUpload("/api/admin/participants/certificate-settings/assets", assets);
      report("Pengaturan sertifikat global disimpan dan berlaku untuk seluruh pelatihan.");
    } catch (processError) { fail(processError); }
  }
  async function generateAll() {
    if (!certificateTrainingId || !certificateCohort) return setError("Pilih pelatihan dan angkatan untuk generate sertifikat.");
    try { const result = await adminMutation<{ generated: number }>("/api/admin/participants/certificates/generate-all", { method: "POST", body: JSON.stringify({ trainingId: certificateTrainingId, cohortId: certificateCohort, side: "BOTH" }) }); report(`${result.generated} sertifikat peserta lulus berhasil dibuat.`); } catch (processError) { fail(processError); }
  }
  function requestDeleteFilteredParticipants() {
    if (!participantPagination.total) return setError("Tidak ada peserta pada hasil filter yang dapat dihapus.");
    const filterDescription = [
      listTrainingId ? "pelatihan terpilih" : null,
      listCohortId ? "angkatan terpilih" : null,
      listStatus ? `status ${listStatus === "true" ? "aktif" : "nonaktif"}` : null,
      debouncedSearch ? `pencarian “${debouncedSearch}”` : null,
    ].filter(Boolean).join(", ");
    setDeleteTarget({
      kind: "participants",
      filters: {
        year: activeYear,
        trainingId: listTrainingId || undefined,
        cohortId: listCohortId || undefined,
        status: listStatus ? listStatus === "true" : undefined,
        search: debouncedSearch.trim() || undefined,
      },
      count: participantPagination.total,
      filterDescription,
    });
  }
  async function deleteFilteredParticipants(filters: ParticipantFilters) {
    setDeletingParticipants(true);
    try {
      const result = await adminMutation<{ deleted: number }>("/api/admin/participants/participants/bulk", {
        method: "DELETE",
        body: JSON.stringify({ filters }),
      });
      setSelectedParticipant(null);
      setDeleteTarget(null);
      report(`${result.deleted} data peserta beserta riwayatnya berhasil dihapus.`);
    } catch (processError) {
      setDeleteTarget(null);
      fail(processError);
    } finally {
      setDeletingParticipants(false);
    }
  }

  return <>
    <header className="admin-page-header participant-page-header">
      <div><p className="section-label">Peserta</p><h1>Pengelolaan peserta & sertifikat</h1><ActiveYearIndicator /></div>
      {tab === "data" && <div className="page-header-actions"><button type="button" className="button" onClick={() => setParticipantCreateOpen(true)}><Plus /> Tambah Peserta</button><button type="button" className="button button--secondary" onClick={() => setParticipantImportOpen(true)}><FileSpreadsheet /> Upload Peserta</button></div>}
    </header>
    <nav className="participant-tabs" aria-label="Menu peserta">{tabs.map((item) => { const Icon = item.icon; return <button type="button" key={item.id} className={tab === item.id ? "is-active" : ""} onClick={() => setTab(item.id)}><Icon />{item.label}</button>; })}</nav>
    {noticeTarget === "global" && message && <p className="form-message is-success">{message}</p>}{noticeTarget === "global" && error && <p className="form-message is-error">{error}</p>}

    {tab === "data" && <>
      <section className="panel participant-data-panel">
        <div className="panel-heading"><div><p className="section-label">Terdaftar</p><h2>Data Peserta</h2></div><div className="participant-table-actions"><span className="status-badge is-active">{participantPagination.total} peserta</span><button type="button" className="button danger-button button--small" disabled={!participantPagination.total || deletingParticipants} onClick={requestDeleteFilteredParticipants}><Trash2 />{deletingParticipants ? "Menghapus..." : "Hapus Hasil Filter"}</button></div></div>
        <div className="participant-list-filters">
          <label className="filter-search"><span>Cari nama</span><SearchInput value={search} onValueChange={setSearch} placeholder="Cari nama peserta" /></label>
          <label>Pelatihan<SearchableSelect value={listTrainingId} placeholder="Semua pelatihan" options={catalog.trainings.map((training) => ({ value: training.id, label: training.name }))} onValueChange={(value) => { setParticipantPage(1); setListTrainingId(value); setListCohortId(""); }} /></label>
          <label>Angkatan<select value={listCohortId} onChange={(event) => { setParticipantPage(1); setListCohortId(event.target.value); }}><option value="">Semua Angkatan</option>{catalog.cohorts.filter((cohort) => !listTrainingId || cohort.training_id === listTrainingId).map((cohort) => <option value={cohort.id} key={cohort.id}>{cohort.name}</option>)}</select></label>
          <label>Status<select value={listStatus} onChange={(event) => { setParticipantPage(1); setListStatus(event.target.value); }}><option value="">Semua Status</option><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label>
        </div>
        <div className="data-table-wrap">
          <table className="clean-table participant-table">
            <thead><tr><th>No</th><th>Nama Lengkap</th><th>NIK</th><th>Pelatihan</th><th>Angkatan</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>{participants.map((participant, index) => <tr key={participant.id} className={selectedParticipant === participant.id ? "is-selected" : ""}>
              <td>{(participantPagination.page - 1) * participantPagination.limit + index + 1}</td>
              <td><span className="participant-identity"><span className="participant-avatar">{participant.photo_key ? <img loading="lazy" decoding="async" src={`/api/admin/participants/participants/${participant.id}/photo`} alt="" /> : <Image />}</span><span><strong>{participant.name}</strong><small>{participant.birth_place}, {formatDateForDisplay(participant.birth_date)}</small></span></span></td>
              <td>{participant.nik_masked}</td>
              <td><span className="participant-training-name" title={participant.training_name}>{participant.training_name}</span></td>
              <td>{participant.cohort_name}</td>
              <td><StatusIcon active={Boolean(participant.is_active)} /></td>
              <td><IconActionButton action="edit" label={`Edit Peserta ${participant.name}`} onClick={() => setSelectedParticipant(participant.id)} /></td>
            </tr>)}</tbody>
          </table>
          {participantsLoading && !participants.length ? <div className="empty-state">Memuat peserta…</div> : !participants.length && <div className="empty-state">Tidak ada peserta yang sesuai pencarian atau filter.</div>}
        </div>
        <Pagination pagination={participantPagination} itemLabel="peserta" loading={participantsLoading} onPageChange={setParticipantPage} />
      </section>
      {selectedParticipant && <ParticipantEditor id={selectedParticipant} activeYear={activeYear} catalog={catalog} onCancel={() => setSelectedParticipant(null)} onSaved={() => { setSelectedParticipant(null); report("Data peserta diperbarui."); }} onError={fail} />}
      {participantCreateOpen && <ModalPortal onClose={() => setParticipantCreateOpen(false)}><section className="participant-modal" role="dialog" aria-modal="true" aria-labelledby="add-participant-title">
        <header className="participant-modal__header"><div><p className="section-label">Peserta baru</p><h2 id="add-participant-title">Tambah Peserta</h2><p>Isi data peserta untuk pelatihan dan angkatan yang dipilih.</p></div><button type="button" className="participant-modal__close" aria-label="Tutup tambah peserta" onClick={() => setParticipantCreateOpen(false)}><X /></button></header>
        <form className="participant-modal__form form-stack" onSubmit={(event) => void createParticipant(event)}><div className="participant-modal__grid"><label>Nama Lengkap<input name="name" required autoFocus /></label><TrainingCohortFields catalog={catalog} /><label>NIK<input name="nik" required inputMode="numeric" /></label><label>Tempat Lahir<input name="birthPlace" required /></label><label>Tanggal Lahir<DateInput name="birthDate" required /></label><label>Status<select value="active" disabled><option value="active">Aktif</option></select></label><label className="participant-modal__address">Alamat<textarea name="address" required rows={3} placeholder="Alamat lengkap peserta" /></label><label className="participant-modal__photo">Foto Peserta<span className="file-field"><Image /><input name="photo" type="file" accept="image/jpeg,image/png" /></span></label></div><footer className="participant-modal__actions"><button type="button" className="button button--secondary" onClick={() => setParticipantCreateOpen(false)}>Batal</button><button className="button"><UserPlus /> Simpan Peserta</button></footer></form>
      </section></ModalPortal>}
      {participantImportOpen && <ModalPortal onClose={closeParticipantImport} blocked={previewing || importing}><section className="participant-modal certificate-modal" role="dialog" aria-modal="true" aria-labelledby="import-participant-title">
        <header className="participant-modal__header"><div><p className="section-label">Import Excel</p><h2 id="import-participant-title">Upload Peserta</h2><p>Unggah file Excel lalu periksa data pada preview sebelum diimpor.</p></div><button type="button" className="participant-modal__close" aria-label="Tutup upload peserta" onClick={closeParticipantImport}><X /></button></header>
        <div className="participant-modal__form form-stack"><div className="panel-heading"><div className="panel-title-with-icon"><span className="heading-icon"><FileSpreadsheet /></span><div><p className="section-label">Template</p><h3>Siapkan file peserta</h3></div></div><a className="button button--secondary button--small" href="/api/admin/participants/participants-template"><Download /> Download template</a></div>
        <div className="import-step-grid">
          <label><span>1. Pilih Pelatihan</span><SearchableSelect value={trainingId} placeholder="Ketik atau pilih pelatihan" options={catalog.trainings.map((training) => ({ value: training.id, label: training.name }))} onValueChange={(value) => { setTrainingId(value); setCohortId(""); resetImportPreview(); }} /></label>
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
        {previewReady && <section className="import-preview-section"><div className="import-preview-heading"><div><p className="section-label">Hasil Preview</p><h3>{preview.length} data peserta ditemukan</h3></div><span className={preview.some((row) => row.errors.length) ? "status-badge is-danger" : "status-badge is-active"}>{preview.filter((row) => row.errors.length).length ? `${preview.filter((row) => row.errors.length).length} data perlu diperbaiki` : "Seluruh data valid"}</span></div><div className="data-table-wrap"><table className="clean-table import-preview-table"><thead><tr><th>No</th><th>Nama Lengkap</th><th>NIK</th><th>Tempat Lahir</th><th>Tanggal Lahir</th><th>Alamat</th><th>Status Validasi</th></tr></thead><tbody>{preview.map((row, index) => <tr key={row.row} className={row.errors.length ? "is-invalid" : ""}><td>{index + 1}</td><td>{row.name || "—"}</td><td>{row.nik || "—"}</td><td>{row.birthPlace || "—"}</td><td>{formatDateForDisplay(row.birthDate)}</td><td>{row.address || "—"}</td><td>{row.errors.length ? <span className="validation-errors">{row.errors.map((rowError) => <span key={rowError}>{rowError}</span>)}</span> : <span className="status-badge is-active">Valid</span>}</td></tr>)}</tbody></table></div><div className="import-submit-row"><p>Foto peserta dapat diunggah terpisah setelah proses import selesai.</p><button type="button" className="button" disabled={!preview.length || preview.some((row) => row.errors.length) || importing} onClick={() => void importRows()}><Upload /> {importing ? "Mengimpor..." : `Import Peserta (${preview.length})`}</button></div></section>}
        </div></section></ModalPortal>}
    </>}

    {tab === "master" && <div className="master-catalog-layout">
      <section className="panel master-training-panel"><div className="panel-heading"><div><h2>Nama Pelatihan</h2></div></div><form className="form-stack inline-create" onSubmit={(event) => void createTraining(event)}><label>Nama<input name="name" required /></label><button className="button"><Plus /> Tambah Pelatihan</button></form><div className="training-master-list">{catalog.trainings.map((training) => <article key={training.id} className="training-master-card"><span className="training-master-icon"><GraduationCap /></span><div className="training-master-copy"><strong>{training.name}</strong><small>{training.material_count} materi · {training.total_jp} JP</small></div><StatusIcon active={Boolean(training.is_active)} /><div className="row-actions"><IconActionButton action="edit" label={`Edit Pelatihan ${training.name}`} onClick={() => void editTraining(training)} /><IconActionButton action={training.is_active ? "inactive" : "active"} label={training.is_active ? `Nonaktifkan Pelatihan ${training.name}` : `Aktifkan Pelatihan ${training.name}`} onClick={() => void toggleTraining(training)} /><IconActionButton action="delete" label={`Hapus Pelatihan ${training.name}`} onClick={() => setDeleteTarget({ kind: "training", training })} /></div></article>)}</div></section>
      {noticeTarget === "material" && message && <p className="form-message is-success material-notice">{message}</p>}{noticeTarget === "material" && error && <p className="form-message is-error material-notice">{error}</p>}
      <section className="panel master-material-panel"><div className="panel-heading"><div><p className="section-label">Kurikulum</p><h2>Materi Pelatihan</h2></div></div><form className="form-stack material-create-form" onSubmit={(event) => void createMaterial(event)}><label>Pelatihan<TrainingSelect name="trainingId" trainings={catalog.trainings} /></label><label>Nama Materi<input name="name" required /></label><div className="form-grid"><label>Jumlah JP<input name="jp" type="number" min="1" required /></label><label>Urutan<input name="sortOrder" type="number" min="1" required /></label></div><button className="button"><Plus /> Tambah Materi</button></form><label className="material-training-filter">Filter Pelatihan<SearchableSelect value={materialTrainingId} placeholder="Semua pelatihan" options={catalog.trainings.map((training) => ({ value: training.id, label: training.name }))} onValueChange={setMaterialTrainingId} /></label><div className="data-table-wrap material-table-wrap"><table className="clean-table"><thead><tr><th>No</th><th>Nama Materi</th><th>JP</th><th>Urutan</th><th>Aksi</th></tr></thead><tbody>{filteredMaterials.map((material, index) => <tr key={material.id}><td>{index + 1}</td><td><strong>{material.name}</strong><small>{material.training_name}{material.bank_name ? ` · Bank: ${material.bank_name}` : ""}</small></td><td>{material.jp}</td><td>{material.sort_order}</td><td><div className="row-actions"><IconActionButton action="edit" label={`Edit Materi ${material.name}`} onClick={() => void editMaterial(material)} />{!material.bank_id && <IconActionButton action="delete" label={`Hapus Materi ${material.name}`} onClick={() => setDeleteTarget({ kind: "material", material })} />}</div></td></tr>)}</tbody></table>{!filteredMaterials.length && <div className="empty-state">Belum ada materi untuk pelatihan ini.</div>}</div></section>
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
        <div className="cohort-generator__heading"><span className="heading-icon"><CalendarDays /></span><div><h3>Generate Angkatan Massal</h3><p>Isi data angkatan, periksa preview, lalu simpan seluruh angkatan sekaligus.</p></div></div>
        <form className="cohort-generator-form" onSubmit={previewBulkCohorts}>
          <label>Pelatihan<SearchableSelect required value={bulkCohortTrainingId} placeholder="Ketik atau pilih pelatihan" options={catalog.trainings.filter((training) => training.is_active).map((training) => ({ value: training.id, label: training.name }))} onValueChange={(value) => { setBulkCohortTrainingId(value); setCohortPreview([]); }} /></label>
          <label>Mulai dari Angkatan<input type="number" min="1" value={bulkCohortForm.startNumber} onChange={(event) => { setBulkCohortForm((value) => ({ ...value, startNumber: Number(event.target.value) })); setCohortPreview([]); }} /></label>
          <label>Jumlah Angkatan<input type="number" min="1" max="100" value={bulkCohortForm.count} onChange={(event) => { setBulkCohortForm((value) => ({ ...value, count: Number(event.target.value) })); setCohortPreview([]); }} /></label>
          <label>Tanggal Mulai Angkatan<DateInput required value={bulkCohortForm.firstStartDate} onValueChange={(date) => { setBulkCohortForm((value) => ({ ...value, firstStartDate: date })); setCohortPreview([]); }} /></label>
          <label><span>Durasi Pelatihan <small>(hari)</small></span><input type="number" min="1" max="365" value={bulkCohortForm.durationDays} onChange={(event) => { const durationDays = Number(event.target.value); setBulkCohortForm((value) => ({ ...value, durationDays })); setCohortPreview((rows) => rows.map((row) => ({ ...row, endDate: addDays(row.startDate, durationDays - 1) }))); }} /></label>
          <div className="cohort-generator-form__action"><button className="button" type="submit"><Eye /> Preview Angkatan</button></div>
        </form>

        {cohortPreview.length > 0 && <div className="cohort-preview">
          <div className="cohort-preview__heading"><div><p className="section-label">Preview</p><h3>{cohortPreview.length} angkatan siap dibuat</h3></div><p>Ubah nama, tanggal mulai, atau status jika diperlukan.</p></div>
          <div className="data-table-wrap"><table className="clean-table cohort-preview-table"><thead><tr><th>Angkatan</th><th>Tanggal Mulai</th><th>Tanggal Selesai</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{cohortPreview.map((row) => {
            const isEditing = editingCohortRow === row.clientId;
            return <tr key={row.clientId}><td>{isEditing ? <input aria-label="Nama angkatan" value={row.name} onChange={(event) => updatePreviewCohort(row.clientId, { name: event.target.value })} /> : <strong>{row.name}</strong>}</td><td>{isEditing ? <DateInput aria-label="Tanggal mulai" value={row.startDate} onValueChange={(date) => updatePreviewCohort(row.clientId, { startDate: date })} /> : formatCohortDate(row.startDate)}</td><td>{isEditing ? <input aria-label="Tanggal selesai otomatis" value={formatCohortDate(row.endDate)} readOnly /> : formatCohortDate(row.endDate)}</td><td>{isEditing ? <select aria-label="Status angkatan" value={row.status} onChange={(event) => updatePreviewCohort(row.clientId, { status: event.target.value as GeneratedCohort["status"] })}><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option><option value="COMPLETED">Selesai</option></select> : row.status === "COMPLETED" ? <span className="status-badge is-complete">Selesai</span> : <StatusIcon active={row.status === "ACTIVE"} />}</td><td>{isEditing ? <button type="button" className="button button--secondary button--small" onClick={() => setEditingCohortRow(null)}>Selesai</button> : <IconActionButton action="edit" label={`Edit Angkatan ${row.name}`} onClick={() => setEditingCohortRow(row.clientId)} />}</td></tr>;
          })}</tbody></table></div>
          <div className="cohort-preview__save"><p>Data belum disimpan ke database sampai tombol ini ditekan.</p><button type="button" className="button" disabled={savingCohorts || Boolean(editingCohortRow)} onClick={() => void saveBulkCohorts()}>{savingCohorts ? "Menyimpan..." : `Simpan ${cohortPreview.length} Angkatan`}</button></div>
        </div>}
      </div>}

      <div className="data-table-wrap cohort-list-wrap">
        <table className="clean-table cohort-list-table">
          <thead><tr><th>Angkatan</th><th>Pelatihan</th><th>Periode</th><th>Jumlah Peserta</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>{cohortRows.map((cohort) => <tr key={cohort.id}>
            <td><strong>{cohort.name}</strong></td>
            <td><span className="cohort-training-name" title={cohort.training_name}>{cohort.training_name}</span></td>
            <td>{formatCohortDate(cohort.start_date)} – {formatCohortDate(cohort.end_date)}</td>
            <td>{cohort.participant_count} peserta</td>
            <td>{cohort.status === "COMPLETED" ? <span className="status-badge is-complete">Selesai</span> : <StatusIcon active={cohort.status === "ACTIVE"} />}</td>
            <td><div className="row-actions"><IconActionButton action="edit" label={`Edit Angkatan ${cohort.name}`} onClick={() => void editCohort(cohort)} /><IconActionButton action={cohort.status === "ACTIVE" ? "inactive" : "active"} label={cohort.status === "ACTIVE" ? `Nonaktifkan Angkatan ${cohort.name}` : `Aktifkan Angkatan ${cohort.name}`} onClick={() => void toggleCohort(cohort)} /><IconActionButton action="delete" label={`Hapus Angkatan ${cohort.name}`} onClick={() => setDeleteTarget({ kind: "cohort", cohort })} /><IconActionButton action="detail" label={`Lihat Detail Angkatan ${cohort.name}`} onClick={() => setSelectedCohortDetail(cohort.id)} /></div></td>
          </tr>)}</tbody>
        </table>
        {!cohortsLoading && !cohortRows.length && <div className="empty-state">Belum ada angkatan. Gunakan “Buat Banyak Angkatan” untuk memulai.</div>}
      </div>
      <Pagination pagination={cohortPagination} itemLabel="angkatan" loading={cohortsLoading} onPageChange={setCohortPage} />

      {selectedCohortDetail && (() => {
        const cohort = catalog.cohorts.find((item) => item.id === selectedCohortDetail);
        return cohort ? <ModalPortal onClose={() => setSelectedCohortDetail(null)}>
          <section className="participant-modal cohort-detail-modal" role="dialog" aria-modal="true" aria-labelledby="cohort-detail-title">
            <header className="participant-modal__header">
              <div><p className="section-label">Detail Angkatan</p><h2 id="cohort-detail-title">{cohort.name}</h2></div>
              <button type="button" className="participant-modal__close" aria-label="Tutup detail angkatan" onClick={() => setSelectedCohortDetail(null)}><X /></button>
            </header>
            <div className="cohort-detail-modal__body"><dl><div><dt>Pelatihan</dt><dd>{cohort.training_name}</dd></div><div><dt>Periode</dt><dd>{formatCohortDate(cohort.start_date)} – {formatCohortDate(cohort.end_date)}</dd></div><div><dt>Peserta</dt><dd>{cohort.participant_count} peserta</dd></div><div><dt>Status</dt><dd>{cohort.status === "ACTIVE" ? "Aktif" : cohort.status === "INACTIVE" ? "Nonaktif" : "Selesai"}</dd></div></dl></div>
            <footer className="participant-modal__actions"><button type="button" className="button button--secondary" onClick={() => setSelectedCohortDetail(null)}>Tutup</button></footer>
          </section>
        </ModalPortal> : null;
      })()}
      {editingExistingCohort && <CohortEditor cohort={editingExistingCohort} activeYear={activeYear} onCancel={() => setEditingExistingCohort(null)} onSaved={() => { setEditingExistingCohort(null); report("Angkatan diperbarui.", "cohort"); }} onError={(reason) => fail(reason, "cohort")} />}
    </section>}

      {tab === "certificate-workspace" && <CertificateWorkspace catalog={catalog} />}

      {tab === "certificates" && <><section className="panel certificate-settings"><div className="panel-heading"><div><p className="section-label">Pengaturan Global</p><h2>Overlay sertifikat cetak</h2><p>Pengaturan ini berlaku untuk seluruh pelatihan. Tanggal penerbitan otomatis memakai tanggal terakhir diklat.</p></div></div><form className="form-grid" onSubmit={(event) => void saveCertificateSettings(event)}><label>Tempat Penerbitan<input value={certificateSettings.issue_place} onChange={(event) => setCertificateSettings((value) => ({ ...value, issue_place: event.target.value }))} /></label><label>Pejabat Penandatangan<input value={certificateSettings.signer_name} onChange={(event) => setCertificateSettings((value) => ({ ...value, signer_name: event.target.value }))} /></label><label>Jabatan<input value={certificateSettings.signer_title} onChange={(event) => setCertificateSettings((value) => ({ ...value, signer_title: event.target.value }))} /></label><label>NIP<input value={certificateSettings.signer_nip} onChange={(event) => setCertificateSettings((value) => ({ ...value, signer_nip: event.target.value }))} /></label><label>Tanda tangan PNG transparan<input name="signature" type="file" accept="image/png" /></label><div className="form-actions"><button className="button">Simpan Pengaturan Global</button><button type="button" className="button button--secondary" onClick={() => void generateAll()}>Generate Semua Peserta Angkatan</button></div></form></section>
      <section className="panel certificate-list-panel"><div className="panel-heading"><div><p className="section-label">PDF siap cetak</p><h2>Sertifikat Peserta</h2><p>Print: A4, Landscape, Scale 100% / Actual Size. Jangan gunakan Fit to Page.</p></div></div><div className="certificate-filters"><label>Pelatihan<select value={certificateTrainingId} onChange={(event) => { setCertificateTrainingId(event.target.value); setCertificateCohort(""); }}><option value="">Semua Pelatihan</option>{catalog.trainings.map((training) => <option value={training.id} key={training.id}>{training.name}</option>)}</select></label><label>Angkatan<select value={certificateCohort} onChange={(event) => setCertificateCohort(event.target.value)}><option value="">Semua Angkatan</option>{catalog.cohorts.filter((cohort) => !certificateTrainingId || cohort.training_id === certificateTrainingId).map((cohort) => <option value={cohort.id} key={cohort.id}>{cohort.name}</option>)}</select></label><label>Status<select value={certificateStatus} onChange={(event) => setCertificateStatus(event.target.value)}><option value="">Semua Status</option><option value="LULUS">Lulus</option><option value="BELUM_LULUS">Belum Lulus</option><option value="READY">Siap Generate</option></select></label></div><div className="data-table-wrap"><table className="clean-table"><thead><tr><th>Nama Peserta</th><th>NIK</th><th>Status</th><th>Nomor Sertifikat Resmi</th><th>Aksi</th></tr></thead><tbody>{filteredCertificates.map((participant) => <tr key={participant.participant_id}><td><strong>{participant.name}</strong><small>{participant.training_name} · {participant.cohort_name}</small></td><td>{participant.nik_masked}</td><td><span className={participant.graduation_status === "LULUS" ? "status-badge is-active" : "status-badge is-danger"}>{participant.graduation_status === "LULUS" ? "Lulus" : "Belum Lulus"}</span></td><td>{participant.graduation_status === "LULUS" && <div className="row-actions"><input aria-label={`Nomor sertifikat ${participant.name}`} value={certificateNumbers[participant.participant_id] ?? participant.certificate_number ?? ""} onChange={(event) => setCertificateNumbers((current) => ({ ...current, [participant.participant_id]: event.target.value }))} placeholder="Nomor resmi BDI" /><button className="button button--secondary button--small" onClick={() => void saveCertificateNumber(participant)}>Simpan Nomor</button></div>}</td><td>{participant.graduation_status === "LULUS" && <div className="row-actions"><button className="button button--secondary button--small" onClick={() => void generateCert(participant, "FRONT")}>Generate Depan</button><button className="button button--secondary button--small" onClick={() => void generateCert(participant, "BACK")}>Generate Belakang</button>{participant.certificate_id && <><a className="text-button" target="_blank" rel="noreferrer" href={`/api/admin/participants/certificates/${participant.certificate_id}/preview?side=FRONT`}>Preview Depan</a><a className="text-button" target="_blank" rel="noreferrer" href={`/api/admin/participants/certificates/${participant.certificate_id}/pdf?side=FRONT`}>Download Depan</a><a className="text-button" target="_blank" rel="noreferrer" href={`/api/admin/participants/certificates/${participant.certificate_id}/pdf?side=BACK`}>Download Belakang</a></>}</div>}</td></tr>)}</tbody></table></div></section></>}

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title={deleteTarget?.kind === "training" ? "Hapus Pelatihan?" : deleteTarget?.kind === "material" ? "Hapus Materi?" : deleteTarget?.kind === "cohort" ? "Hapus Angkatan?" : "Hapus Peserta?"}
        itemName={deleteTarget?.kind === "training" ? deleteTarget.training.name : deleteTarget?.kind === "material" ? deleteTarget.material.name : deleteTarget?.kind === "cohort" ? deleteTarget.cohort.name : deleteTarget?.kind === "participants" ? `${deleteTarget.count} peserta` : undefined}
        description={deleteTarget?.kind === "training" ? "Data peserta, angkatan, materi, hasil tes, dan sertifikat yang pernah menggunakan pelatihan ini tetap disimpan." : deleteTarget?.kind === "material" ? "Materi akan dihapus dari daftar pelatihan." : deleteTarget?.kind === "cohort" ? `Pelatihan: ${deleteTarget.cohort.training_name}. Angkatan yang sudah digunakan oleh peserta atau pelaksanaan tes tidak dapat dihapus.` : deleteTarget?.kind === "participants" ? `Seluruh riwayat tes dan sertifikat peserta${deleteTarget.filterDescription ? ` berdasarkan ${deleteTarget.filterDescription}` : " yang sedang ditampilkan"} juga akan dihapus. Tindakan ini tidak dapat dibatalkan.` : undefined}
        busy={deleteTarget?.kind === "participants" ? deletingParticipants : deletingRecord}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.kind === "training") void deleteTraining(deleteTarget.training);
          else if (deleteTarget?.kind === "material") void deleteMaterial(deleteTarget.material);
          else if (deleteTarget?.kind === "cohort") void deleteCohort(deleteTarget.cohort);
          else if (deleteTarget?.kind === "participants") void deleteFilteredParticipants(deleteTarget.filters);
        }}
      />
  </>;
}

function CertificateWorkspace({ catalog }: { catalog: Catalog }) {
  const { activeYear } = useActiveYear();
  const [trainingId, setTrainingId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [settings, setSettings] = useState<CertificateSettings>(emptyCertificateSettings);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [letterNumbers, setLetterNumbers] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preview, setPreview] = useState<Certificate | null>(null);
  const [letterPreview, setLetterPreview] = useState<Certificate | null>(null);
  const [previewSide, setPreviewSide] = useState<"FRONT" | "BACK">("FRONT");
  const [downloading, setDownloading] = useState<"certificates" | "letters" | null>(null);
  const [certificateStart, setCertificateStart] = useState("");
  const [letterStart, setLetterStart] = useState("");
  const [certificateNumberFormat, setCertificateNumberFormat] = useState("");
  const [letterNumberFormat, setLetterNumberFormat] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false);
  const [numberingTarget, setNumberingTarget] = useState<DocumentNumberKind | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Certificate[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: ADMIN_PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const timers = useRef<Record<string, number>>({});
  const previousIssueDate = useRef("");
  useAutoDismiss(success, setSuccess);
  useAutoDismiss(error, setError);

  const cohorts = catalog.cohorts.filter((cohort) => !trainingId || cohort.training_id === trainingId);
  const issueDate = cohorts.find((cohort) => cohort.id === cohortId)?.end_date ?? "";
  const loadRows = useCallback(async (requestedPage = page) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ year: String(activeYear), page: String(requestedPage), limit: String(ADMIN_PAGE_SIZE) });
      if (trainingId) query.set("trainingId", trainingId);
      if (cohortId) query.set("cohortId", cohortId);
      const result = await adminQuery<{ certificates: Certificate[]; pagination: PaginationMeta }>(`/api/admin/participants/certificates?${query}`);
      if (requestedPage > result.pagination.totalPages) { setPage(result.pagination.totalPages); return; }
      setRows(result.certificates); setPagination(result.pagination);
    } finally { setLoading(false); }
  }, [activeYear, cohortId, page, trainingId]);

  useEffect(() => { void loadRows().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Dokumen peserta tidak dapat dimuat.")); }, [loadRows]);
  useEffect(() => { setPage(1); }, [activeYear, cohortId, trainingId]);

  useEffect(() => {
    void adminQuery<{ settings: CertificateSettings }>("/api/admin/participants/certificate-settings")
      .then((result) => {
        setSettings(result.settings);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Pengaturan sertifikat tidak dapat dimuat."));
  }, []);
  useEffect(() => () => Object.values(timers.current).forEach((timer) => window.clearTimeout(timer)), []);
  useEffect(() => {
    const previousDate = previousIssueDate.current;
    setCertificateNumberFormat((current) => !current || current === fullDocumentNumber("certificate", "[isi nomor]", previousDate)
      ? fullDocumentNumber("certificate", "[isi nomor]", issueDate)
      : current);
    setLetterNumberFormat((current) => !current || current === fullDocumentNumber("letter", "[isi nomor]", previousDate)
      ? fullDocumentNumber("letter", "[isi nomor]", issueDate)
      : current);
    previousIssueDate.current = issueDate;
  }, [issueDate]);

  async function persistNumber(certificate: Certificate, number = numbers[certificate.participant_id] ?? certificate.certificate_number ?? "") {
    const certificateNumber = number.trim();
    if (!certificateNumber) return false;
    const key = `certificate-${certificate.participant_id}`;
    window.clearTimeout(timers.current[key]);
    setSavingKey(key); setError(null);
    try {
      await adminMutation(`/api/admin/participants/certificates/${certificate.participant_id}/number`, { method: "PUT", body: JSON.stringify({ certificateNumber }) });
      await loadRows();
      return true;
    } catch (reason) {
      setError(reason instanceof AdminApiError ? reason.message : "Nomor sertifikat tidak dapat disimpan.");
      return false;
    } finally { setSavingKey(null); }
  }
  function updateNumber(certificate: Certificate, value: string) {
    setNumbers((current) => ({ ...current, [certificate.participant_id]: value }));
    const key = `certificate-${certificate.participant_id}`;
    window.clearTimeout(timers.current[key]);
    timers.current[key] = window.setTimeout(() => { void persistNumber(certificate, value); }, 700);
  }
  async function persistLetterNumber(certificate: Certificate, number = letterNumbers[certificate.participant_id] ?? certificate.completion_letter_number ?? "") {
    const completionLetterNumber = number.trim();
    if (!completionLetterNumber) return false;
    const key = `letter-${certificate.participant_id}`;
    window.clearTimeout(timers.current[key]);
    setSavingKey(key); setError(null);
    try {
      await adminMutation(`/api/admin/participants/completion-letters/${certificate.participant_id}/number`, { method: "PUT", body: JSON.stringify({ completionLetterNumber }) });
      await loadRows();
      return true;
    } catch (reason) {
      setError(reason instanceof AdminApiError ? reason.message : "Nomor surat tidak dapat disimpan.");
      return false;
    } finally { setSavingKey(null); }
  }
  function updateLetterNumber(certificate: Certificate, value: string) {
    setLetterNumbers((current) => ({ ...current, [certificate.participant_id]: value }));
    const key = `letter-${certificate.participant_id}`;
    window.clearTimeout(timers.current[key]);
    timers.current[key] = window.setTimeout(() => { void persistLetterNumber(certificate, value); }, 700);
  }
  async function openPreview(certificate: Certificate) {
    const number = numbers[certificate.participant_id] ?? certificate.certificate_number ?? "";
    if (number.trim()) await persistNumber(certificate, number);
    setPreview({ ...certificate, certificate_number: number.trim() || null }); setPreviewSide("FRONT");
  }
  async function openLetterPreview(certificate: Certificate) {
    const number = letterNumbers[certificate.participant_id] ?? certificate.completion_letter_number ?? "";
    if (number.trim()) await persistLetterNumber(certificate, number);
    setLetterPreview({ ...certificate, completion_letter_number: number.trim() || null });
  }
  function existingCertificateNumber(certificate: Certificate) {
    return (numbers[certificate.participant_id] ?? certificate.certificate_number ?? "").trim();
  }
  function existingLetterNumber(certificate: Certificate) {
    return (letterNumbers[certificate.participant_id] ?? certificate.completion_letter_number ?? "").trim();
  }
  function validateBulkNumberInput(target: DocumentNumberKind) {
    const isCertificate = target === "certificate";
    const startNumber = isCertificate ? certificateStart : letterStart;
    const format = isCertificate ? certificateNumberFormat : letterNumberFormat;
    const label = isCertificate ? "Sertifikat" : "Surat";
    if (!/^\d+$/u.test(startNumber)) {
      setError(`Nomor awal ${label} wajib berupa angka.`);
      return false;
    }
    if (!format.includes("[isi nomor]")) {
      setError(`Format Nomor ${label} wajib memuat penanda [isi nomor].`);
      return false;
    }
    if (!issueDate) {
      setError("Tanggal selesai angkatan belum tersedia.");
      return false;
    }
    return true;
  }
  async function loadNumberingTargets() {
    const query = new URLSearchParams({ year: String(activeYear) });
    if (trainingId) query.set("trainingId", trainingId);
    if (cohortId) query.set("cohortId", cohortId);
    const result = await adminQuery<{ certificates: Certificate[] }>(`/api/admin/participants/certificates/numbering-targets?${query}`);
    return result.certificates.filter((certificate) => certificate.graduation_status === "LULUS");
  }
  async function requestBulkNumbering(target: DocumentNumberKind) {
    setError(null); setSuccess(null);
    if (!trainingId) { setError("Pilih pelatihan terlebih dahulu."); return; }
    if (!validateBulkNumberInput(target)) return;
    setBulkSaving(true);
    try {
      const passedRows = await loadNumberingTargets();
      if (!passedRows.length) { setError("Tidak ada peserta lulus pada hasil filter yang dapat diberi nomor."); return; }
      setNumberingTarget(target);
      const hasExistingNumber = target === "certificate"
        ? passedRows.some(existingCertificateNumber)
        : passedRows.some(existingLetterNumber);
      if (hasExistingNumber) {
        setOverwriteConfirmOpen(true);
        return;
      }
      await applyBulkNumbers("overwrite", target, passedRows);
    } catch (reason) {
      setError(reason instanceof AdminApiError ? reason.message : "Peserta lulus tidak dapat dimuat.");
    } finally { setBulkSaving(false); }
  }
  async function applyBulkNumbers(mode: BulkNumberMode, target = numberingTarget, targets?: Certificate[]) {
    setOverwriteConfirmOpen(false);
    if (!target || !validateBulkNumberInput(target)) return;
    let passedRows: Certificate[];
    try {
      passedRows = targets ?? await loadNumberingTargets();
    } catch (reason) {
      setError(reason instanceof AdminApiError ? reason.message : "Peserta lulus tidak dapat dimuat.");
      return;
    }
    if (!passedRows.length) { setError("Tidak ada peserta lulus pada hasil filter yang dapat diberi nomor."); return; }
    const entries: BulkDocumentNumberEntry[] = [];
    const nextNumbers = { ...numbers };
    const nextLetterNumbers = { ...letterNumbers };
    passedRows.forEach((certificate, index) => {
      const entry: BulkDocumentNumberEntry = { participantId: certificate.participant_id };
      if (target === "certificate" && (mode === "overwrite" || !existingCertificateNumber(certificate))) {
        entry.certificateNumber = applyDocumentNumberFormat(certificateNumberFormat, sequenceNumber(certificateStart, index));
        nextNumbers[certificate.participant_id] = entry.certificateNumber;
      }
      if (target === "letter" && (mode === "overwrite" || !existingLetterNumber(certificate))) {
        entry.completionLetterNumber = applyDocumentNumberFormat(letterNumberFormat, sequenceNumber(letterStart, index));
        nextLetterNumbers[certificate.participant_id] = entry.completionLetterNumber;
      }
      if (entry.certificateNumber || entry.completionLetterNumber) entries.push(entry);
    });
    if (!entries.length) {
      setSuccess("Seluruh nomor pada peserta lulus sudah terisi.");
      return;
    }
    const previousNumbers = numbers;
    const previousLetterNumbers = letterNumbers;
    passedRows.forEach((certificate) => window.clearTimeout(timers.current[`${target}-${certificate.participant_id}`]));
    setNumbers(nextNumbers); setLetterNumbers(nextLetterNumbers); setBulkSaving(true); setError(null);
    try {
      const result = await adminMutation<{ participantsUpdated: number; numbersUpdated: number }>(
        "/api/admin/participants/document-numbers/bulk",
        { method: "PUT", body: JSON.stringify({ entries }) }
      );
      setSuccess(`${result.numbersUpdated} nomor ${target === "certificate" ? "sertifikat" : "surat"} berhasil diterapkan ke ${result.participantsUpdated} peserta.`);
      await loadRows();
    } catch (reason) {
      setNumbers(previousNumbers); setLetterNumbers(previousLetterNumbers);
      setError(reason instanceof AdminApiError ? reason.message : "Nomor dokumen tidak dapat diterapkan.");
    } finally {
      setBulkSaving(false);
      setNumberingTarget(null);
    }
  }
  async function downloadAll(kind: "certificates" | "letters") {
    if (!trainingId || !cohortId) { setError("Pilih pelatihan dan angkatan terlebih dahulu."); return; }
    setDownloading(kind); setError(null);
    try {
      const endpoint = kind === "certificates" ? "/api/admin/participants/certificates/download-all" : "/api/admin/participants/completion-letters/download-all";
      const archive = await adminDownload(endpoint, { method: "POST", body: JSON.stringify({ trainingId, cohortId }) });
      const url = URL.createObjectURL(archive); const link = document.createElement("a");
      link.href = url; link.download = kind === "certificates" ? "sertifikat-bdi.zip" : "surat-keterangan-bdi.zip"; link.click(); URL.revokeObjectURL(url);
      await loadRows();
    } catch (reason) { setError(reason instanceof AdminApiError ? reason.message : "Arsip dokumen tidak dapat dibuat."); }
    finally { setDownloading(null); }
  }

  return <section className="panel certificate-workspace">
    <header className="certificate-workspace__header"><div><p className="section-label">Dokumen Kelulusan</p><h2>Sertifikat & Surat Keterangan</h2><p>Sertifikat menggunakan A4 Landscape; Surat Keterangan menggunakan A4 Portrait.</p></div><button type="button" className="button button--secondary" onClick={() => setSettingsOpen(true)}>Pengaturan Sertifikat</button></header>
    <div className="certificate-workspace__filters"><label>Pelatihan<SearchableSelect value={trainingId} placeholder="Ketik atau pilih pelatihan" options={catalog.trainings.map((training) => ({ value: training.id, label: training.name }))} onValueChange={(value) => { setTrainingId(value); setCohortId(""); }} /></label><label>Angkatan<select value={cohortId} disabled={!trainingId} onChange={(event) => setCohortId(event.target.value)}><option value="">Pilih angkatan</option>{cohorts.map((cohort) => <option value={cohort.id} key={cohort.id}>{cohort.name}</option>)}</select></label></div>
    <section className="certificate-number-bulk"><div className="certificate-number-bulk__rows"><div className="certificate-number-bulk__row"><label>Format Nomor Sertifikat<input value={certificateNumberFormat} onChange={(event) => setCertificateNumberFormat(event.target.value)} placeholder={fullDocumentNumber("certificate", "[isi nomor]", issueDate)} /></label><label>Nomor Awal Sertifikat<input value={certificateStart} onChange={(event) => setCertificateStart(event.target.value.replace(/\D/gu, ""))} inputMode="numeric" placeholder="Contoh: 1237" /></label><button type="button" className="button" disabled={!trainingId || bulkSaving} onClick={() => void requestBulkNumbering("certificate")}>{bulkSaving && numberingTarget === "certificate" ? "Menerapkan…" : "Terapkan"}</button></div><div className="certificate-number-bulk__row"><label>Format Nomor Surat<input value={letterNumberFormat} onChange={(event) => setLetterNumberFormat(event.target.value)} placeholder={fullDocumentNumber("letter", "[isi nomor]", issueDate)} /></label><label>Nomor Awal Surat<input value={letterStart} onChange={(event) => setLetterStart(event.target.value.replace(/\D/gu, ""))} inputMode="numeric" placeholder="Contoh: 0456" /></label><button type="button" className="button" disabled={!trainingId || bulkSaving} onClick={() => void requestBulkNumbering("letter")}>{bulkSaving && numberingTarget === "letter" ? "Menerapkan…" : "Terapkan"}</button></div></div></section>
    {success && <p className="form-message is-success" role="status">{success}</p>}
    {error && <p className="form-message is-error" role="alert">{error}</p>}
    <div className="data-table-wrap"><table className="clean-table certificate-workspace__table certificate-document-table"><thead><tr><th>Nama Peserta</th><th>Status</th><th>Nomor Sertifikat</th><th>Nomor Surat</th><th>Aksi</th></tr></thead><tbody>{rows.map((certificate) => <tr key={certificate.participant_id}><td><strong>{certificate.name}</strong><small>{certificate.training_name} · {certificate.cohort_name}</small></td><td><span className={certificate.graduation_status === "LULUS" ? "status-badge is-active" : "status-badge is-danger"}>{certificate.graduation_status === "LULUS" ? "Lulus" : "Belum lulus"}</span></td><td>{certificate.graduation_status === "LULUS" ? <><input aria-label={`Nomor sertifikat ${certificate.name}`} value={numbers[certificate.participant_id] ?? certificate.certificate_number ?? ""} onChange={(event) => updateNumber(certificate, event.target.value)} onBlur={() => void persistNumber(certificate)} placeholder={fullDocumentNumber("certificate", "[isi nomor]", issueDate)} />{savingKey === `certificate-${certificate.participant_id}` && <small className="certificate-autosave">Menyimpan…</small>}</> : "—"}</td><td>{certificate.graduation_status === "LULUS" ? <><input aria-label={`Nomor surat ${certificate.name}`} value={letterNumbers[certificate.participant_id] ?? certificate.completion_letter_number ?? ""} onChange={(event) => updateLetterNumber(certificate, event.target.value)} onBlur={() => void persistLetterNumber(certificate)} placeholder={fullDocumentNumber("letter", "[isi nomor]", issueDate)} />{savingKey === `letter-${certificate.participant_id}` && <small className="certificate-autosave">Menyimpan…</small>}</> : "—"}</td><td>{certificate.graduation_status === "LULUS" ? <div className="certificate-document-actions"><button type="button" className="button button--secondary button--small" onClick={() => void openPreview(certificate)}>Preview Sertifikat</button><button type="button" className="button button--secondary button--small" onClick={() => void openLetterPreview(certificate)}>Preview Surat</button></div> : "—"}</td></tr>)}</tbody></table>{trainingId && cohortId && !rows.length && <p className="empty-state">Belum ada peserta pada angkatan ini.</p>}</div>
    <Pagination pagination={pagination} itemLabel="peserta" loading={loading} onPageChange={setPage} />
    <footer className="certificate-workspace__footer certificate-workspace__footer--documents"><p>Pilih pelatihan dan angkatan untuk mengunduh dokumen peserta lulus yang memiliki nomor resmi.</p><div className="certificate-batch-actions"><button type="button" className="button button--secondary" disabled={!trainingId || !cohortId || Boolean(downloading)} onClick={() => void downloadAll("certificates")}><Download />{downloading === "certificates" ? "Menyiapkan…" : "Download Semua Sertifikat"}</button><button type="button" className="button button--secondary" disabled={!trainingId || !cohortId || Boolean(downloading)} onClick={() => void downloadAll("letters")}><Download />{downloading === "letters" ? "Menyiapkan…" : "Download Semua Surat Keterangan"}</button></div></footer>
    {settingsOpen && <CertificateSettingsModal settings={settings} onChange={setSettings} onSaved={() => setSuccess("Pengaturan sertifikat global berhasil disimpan.")} onClose={() => setSettingsOpen(false)} />}
    {preview && <CertificatePreviewModal certificate={preview} side={previewSide} onSideChange={setPreviewSide} onClose={() => setPreview(null)} />}
    {letterPreview && <CompletionLetterPreviewModal certificate={letterPreview} onClose={() => setLetterPreview(null)} />}
    {overwriteConfirmOpen && <NumberOverwriteModal busy={bulkSaving} onCancel={() => { setOverwriteConfirmOpen(false); setNumberingTarget(null); }} onOverwrite={() => void applyBulkNumbers("overwrite")} onFillEmpty={() => void applyBulkNumbers("empty")} />}
  </section>;
}

function NumberOverwriteModal({ busy, onCancel, onOverwrite, onFillEmpty }: { busy: boolean; onCancel: () => void; onOverwrite: () => void; onFillEmpty: () => void }) {
  return <ModalPortal onClose={onCancel} blocked={busy}><section className="participant-modal number-overwrite-modal" role="dialog" aria-modal="true" aria-labelledby="number-overwrite-title"><header className="participant-modal__header"><div><p className="section-label">Konfirmasi Penomoran</p><h2 id="number-overwrite-title">Sebagian nomor sudah terisi</h2><p>Timpa nomor existing?</p></div><button type="button" className="participant-modal__close" aria-label="Tutup konfirmasi" disabled={busy} onClick={onCancel}><X /></button></header><div className="number-overwrite-modal__body"><p>Pilih apakah seluruh nomor peserta lulus akan dibuat ulang atau hanya mengisi field yang masih kosong.</p></div><footer className="participant-modal__actions"><button type="button" className="button button--secondary" disabled={busy} onClick={onCancel}>Batal</button><button type="button" className="button" disabled={busy} onClick={onFillEmpty}>Isi yang masih kosong saja</button><button type="button" className="button button--secondary" disabled={busy} onClick={onOverwrite}>Timpa</button></footer></section></ModalPortal>;
}

function CertificateSettingsModal({ settings, onChange, onSaved, onClose }: { settings: CertificateSettings; onChange: (settings: CertificateSettings) => void; onSaved: () => void; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("signature");
    if (file instanceof File && file.size && (!["image/png", "image/jpeg"].includes(file.type) || file.size > 8_000_000)) {
      setError("Tanda tangan harus berupa file PNG atau JPG maksimal 8 MB.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await adminMutation("/api/admin/participants/certificate-settings", {
        method: "PUT",
        body: JSON.stringify({
          signerName: settings.signer_name.trim(),
          signerTitle: settings.signer_title.trim(),
          signerNip: settings.signer_nip.trim(),
          issuePlace: settings.issue_place.trim(),
        }),
      });
      if (file instanceof File && file.size) {
        const assets = new FormData();
        assets.set("signature", file);
        await adminUpload("/api/admin/participants/certificate-settings/assets", assets);
      }
      const latest = await adminQuery<{ settings: CertificateSettings }>("/api/admin/participants/certificate-settings");
      onChange(latest.settings);
      onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pengaturan sertifikat gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }
  return <ModalPortal onClose={onClose} blocked={saving}><section className="participant-modal certificate-modal" role="dialog" aria-modal="true" aria-labelledby="certificate-settings-title"><header className="participant-modal__header"><div><p className="section-label">Pengaturan Global</p><h2 id="certificate-settings-title">Pengaturan Sertifikat</h2><p>Berlaku otomatis untuk seluruh pelatihan. Tanggal sertifikat mengikuti tanggal terakhir diklat.</p></div><button type="button" className="participant-modal__close" aria-label="Tutup pengaturan sertifikat" disabled={saving} onClick={onClose}><X /></button></header><form className="participant-modal__form certificate-settings-form" onSubmit={(event) => void submit(event)}><div className="participant-modal__grid"><label>Tempat penerbitan<input value={settings.issue_place} onChange={(event) => onChange({ ...settings, issue_place: event.target.value })} /></label><label>Nama pejabat<input value={settings.signer_name} onChange={(event) => onChange({ ...settings, signer_name: event.target.value })} /></label><label>Jabatan<input value={settings.signer_title} onChange={(event) => onChange({ ...settings, signer_title: event.target.value })} /></label><label>NIP<input value={settings.signer_nip} onChange={(event) => onChange({ ...settings, signer_nip: event.target.value })} /></label><label>Tanda tangan (PNG/JPG)<input name="signature" type="file" accept="image/png,image/jpeg" disabled={saving} />{settings.signature_key ? <span className="certificate-signature-preview"><img src={`/api/admin/participants/certificate-settings/signature?v=${encodeURIComponent(settings.signature_key)}`} alt="Tanda tangan yang tersimpan" /><small>Tanda tangan sudah tersimpan. Pilih file baru hanya jika ingin menggantinya.</small></span> : <small>Belum ada tanda tangan tersimpan.</small>}</label></div>{error && <p className="form-message is-error" role="alert">{error}</p>}<footer className="participant-modal__actions"><button type="button" className="button button--secondary" disabled={saving} onClick={onClose}>Batal</button><button type="submit" className="button" disabled={saving}>{saving ? "Menyimpan…" : "Simpan Pengaturan Global"}</button></footer></form></section></ModalPortal>;
}

function CertificatePreviewModal({ certificate, side, onSideChange, onClose }: { certificate: Certificate; side: "FRONT" | "BACK"; onSideChange: (side: "FRONT" | "BACK") => void; onClose: () => void }) {
  const [warning, setWarning] = useState<string | null>(null);
  const previewVersion = useRef(Date.now()).current;
  const previewUrl = `/api/admin/participants/certificates/preview-participant/${certificate.participant_id}?side=${side}&v=${previewVersion}`;
  function download() { if (!certificate.certificate_id || !certificate.certificate_number) { setWarning("Isi nomor sertifikat resmi terlebih dahulu."); return; } window.open(`/api/admin/participants/certificates/${certificate.certificate_id}/download`, "_blank", "noopener,noreferrer"); }
  return <ModalPortal onClose={onClose}><section className="participant-modal certificate-preview-modal" role="dialog" aria-modal="true" aria-labelledby="certificate-preview-title"><header className="participant-modal__header"><div><p className="section-label">Preview Sertifikat</p><h2 id="certificate-preview-title">{certificate.name}</h2></div><button type="button" className="participant-modal__close" aria-label="Tutup preview sertifikat" onClick={onClose}><X /></button></header><div className="certificate-preview-tabs"><button type="button" className={side === "FRONT" ? "is-active" : ""} onClick={() => onSideChange("FRONT")}>DEPAN</button><button type="button" className={side === "BACK" ? "is-active" : ""} onClick={() => onSideChange("BACK")}>BELAKANG</button></div><div className="certificate-preview-frame"><iframe key={side} title={`Preview sertifikat ${side === "FRONT" ? "depan" : "belakang"}`} src={previewUrl} /></div>{warning && <p className="form-message is-error" role="alert">{warning}</p>}<footer className="participant-modal__actions"><button type="button" className="button" onClick={download}>Download Sertifikat</button></footer></section></ModalPortal>;
}

function CompletionLetterPreviewModal({ certificate, onClose }: { certificate: Certificate; onClose: () => void }) {
  const [warning, setWarning] = useState<string | null>(null);
  const previewVersion = useRef(Date.now()).current;
  const previewUrl = `/api/admin/participants/completion-letters/preview-participant/${certificate.participant_id}?v=${previewVersion}`;
  function download() {
    if (!certificate.completion_letter_number) {
      setWarning("Isi nomor surat resmi terlebih dahulu.");
      return;
    }
    window.open(`/api/admin/participants/completion-letters/${certificate.participant_id}/download`, "_blank", "noopener,noreferrer");
  }
  return <ModalPortal onClose={onClose}><section className="participant-modal certificate-preview-modal completion-letter-preview-modal" role="dialog" aria-modal="true" aria-labelledby="completion-letter-preview-title"><header className="participant-modal__header"><div><p className="section-label">Preview Surat Keterangan</p><h2 id="completion-letter-preview-title">{certificate.name}</h2></div><button type="button" className="participant-modal__close" aria-label="Tutup preview surat keterangan" onClick={onClose}><X /></button></header><div className="certificate-preview-frame"><iframe title="Preview surat keterangan" src={previewUrl} /></div>{warning && <p className="form-message is-error" role="alert">{warning}</p>}<footer className="participant-modal__actions"><button type="button" className="button" onClick={download}>Download Surat Keterangan</button></footer></section></ModalPortal>;
}

function CohortEditor({ cohort, activeYear, onCancel, onSaved, onError }: { cohort: Cohort; activeYear: number; onCancel: () => void; onSaved: () => void; onError: (reason: unknown) => void }) {
  const [name, setName] = useState(cohort.name);
  const [startDate, setStartDate] = useState(cohort.start_date);
  const [endDate, setEndDate] = useState(cohort.end_date);
  const [status, setStatus] = useState(cohort.status);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (Number(startDate.slice(0, 4)) !== activeYear) { onError(new AdminApiError(`Tanggal mulai berada pada tahun ${startDate.slice(0, 4)}, sedangkan Tahun Aktif adalah ${activeYear}. Ubah Tahun Aktif atau tanggal pelaksanaan sebelum menyimpan.`, 422, "YEAR_MISMATCH")); return; } try { await adminMutation(`/api/admin/participants/cohorts/${cohort.id}`, { method: "PUT", body: JSON.stringify({ activeYear, trainingId: cohort.training_id, name, startDate, endDate, status }) }); onSaved(); } catch (reason) { onError(reason); } }
  return <ModalPortal onClose={onCancel}><section className="participant-modal cohort-edit-modal" role="dialog" aria-modal="true" aria-labelledby="cohort-edit-title"><header className="participant-modal__header"><div><p className="section-label">Edit Angkatan</p><h2 id="cohort-edit-title">{cohort.name}</h2></div><button type="button" className="participant-modal__close" aria-label="Tutup edit angkatan" onClick={onCancel}><X /></button></header><form onSubmit={(event) => void submit(event)}><div className="cohort-edit-modal__grid"><label>Nama Angkatan<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option><option value="COMPLETED">Selesai</option></select></label><label>Tanggal Mulai<DateInput required value={startDate} onValueChange={setStartDate} /></label><label>Tanggal Selesai<DateInput required value={endDate} min={startDate} onValueChange={setEndDate} /></label></div><footer className="participant-modal__actions"><button type="button" className="button button--secondary" onClick={onCancel}>Batal</button><button className="button">Simpan Perubahan</button></footer></form></section></ModalPortal>;
}

function TrainingSelect({ name, trainings }: { name: string; trainings: Training[] }) {
  return <SearchableSelect name={name} required placeholder="Ketik atau pilih pelatihan" options={trainings.filter((training) => training.is_active).map((training) => ({ value: training.id, label: training.name }))} />;
}

function TrainingCohortFields({ catalog }: { catalog: Catalog }) {
  const [id, setId] = useState("");
  return <><label>Pelatihan<SearchableSelect name="trainingId" required value={id} placeholder="Ketik atau pilih pelatihan" options={catalog.trainings.filter((training) => training.is_active).map((training) => ({ value: training.id, label: training.name }))} onValueChange={setId} /></label><label>Angkatan<select name="cohortId" required><option value="">Pilih angkatan</option>{catalog.cohorts.filter((cohort) => cohort.training_id === id && cohort.status === "ACTIVE").map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></label></>;
}

function ParticipantEditor({ id, activeYear, catalog, onCancel, onSaved, onError }: { id: string; activeYear: number; catalog: Catalog; onCancel: () => void; onSaved: () => void; onError: (error: unknown) => void }) {
  const [person, setPerson] = useState<any>(null);
  const [trainingId, setTrainingId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [photoName, setPhotoName] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void adminQuery<{ participant: any }>(withActiveYear(`/api/admin/participants/participants/${id}`, activeYear)).then((result) => setPerson(result.participant)).catch(onError); }, [activeYear, id]);
  useEffect(() => { if (person) { setTrainingId(person.training_id); setCohortId(person.cohort_id); } }, [person]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      await adminMutation(`/api/admin/participants/participants/${id}`, { method: "PUT", body: JSON.stringify({ trainingId, cohortId, name: form.get("name"), nik: form.get("nik"), birthPlace: form.get("birthPlace"), birthDate: form.get("birthDate"), address: form.get("address"), isActive: form.get("isActive") === "on" }) });
      const photo = form.get("photo"); if (photo instanceof File && photo.size) { const upload = new FormData(); upload.set("photo", await optimizeImage(photo)); await adminUpload(`/api/admin/participants/participants/${id}/photo`, upload); }
      onSaved();
    } catch (processError) { onError(processError); }
  }
  const availableCohorts = catalog.cohorts.filter((cohort) => cohort.training_id === trainingId);
  const modal = <ModalPortal onClose={onCancel}>
    {!person ? <section className="participant-modal participant-modal--loading" role="dialog" aria-modal="true" aria-label="Memuat data peserta"><button type="button" className="participant-modal__close" aria-label="Tutup edit peserta" onClick={onCancel}><X /></button><p className="muted">Memuat data peserta…</p></section> : <section className="participant-modal" role="dialog" aria-modal="true" aria-labelledby="participant-modal-title"><header className="participant-modal__header"><div><p className="section-label">Edit Peserta</p><h2 id="participant-modal-title">{person.name}</h2></div><button type="button" className="participant-modal__close" aria-label="Tutup edit peserta" onClick={onCancel}><X /></button></header><form className="participant-modal__form" onSubmit={(event) => void submit(event)}><div className="participant-modal__grid"><label>Nama Lengkap<input name="name" defaultValue={person.name} required /></label><label>NIK Lengkap<input name="nik" defaultValue={person.nik} required inputMode="numeric" /></label><label>Tempat Lahir<input name="birthPlace" defaultValue={person.birth_place} required /></label><label>Tanggal Lahir<DateInput name="birthDate" defaultValue={person.birth_date} required /></label><label>Pelatihan<SearchableSelect required value={trainingId} placeholder="Ketik atau pilih pelatihan" options={catalog.trainings.map((training) => ({ value: training.id, label: training.name }))} onValueChange={(value) => { setTrainingId(value); setCohortId(""); }} /></label><label>Angkatan<select required value={cohortId} onChange={(event) => setCohortId(event.target.value)} disabled={!trainingId}><option value="">Pilih angkatan</option>{availableCohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></label><label className="participant-modal__address">Alamat<textarea name="address" defaultValue={person.address ?? ""} required rows={3} placeholder="Alamat lengkap peserta" /></label><label className="participant-modal__photo">Foto Peserta<span className="participant-photo-picker"><span className="participant-photo-picker__preview">{person.photo_key ? <img src={`/api/admin/participants/participants/${id}/photo`} alt="Foto peserta saat ini" /> : <Image />}</span><span className="participant-photo-picker__copy"><strong>{photoName || "Foto 3 × 4"}</strong><small>JPG atau PNG, maksimal 5 MB. Tampilan akan menyesuaikan rasio 3:4.</small><button type="button" className="button button--secondary button--small" onClick={() => photoInputRef.current?.click()}>{photoName ? "Ganti Foto" : "Pilih Foto"}</button></span><input ref={photoInputRef} className="visually-hidden-file" name="photo" type="file" accept="image/jpeg,image/png" onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? "")} /></span></label><label className="toggle-row participant-modal__status"><input name="isActive" type="checkbox" defaultChecked={person.is_active === 1} /><span>Status Aktif</span></label></div><footer className="participant-modal__actions"><button type="button" className="button button--secondary" onClick={onCancel}>Batal</button><button className="button"><UserPlus /> Simpan Perubahan</button></footer></form></section>}
  </ModalPortal>;
  return modal;
}
