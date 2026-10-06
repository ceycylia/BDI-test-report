import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarClock, Clock3 } from "lucide-react";
import { DateTimeInput } from "../../components/ui/DateTimeInput";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { adminMutation, adminQuery, AdminApiError } from "../../features/admin-auth/admin-api";
import { formatDateTimeForApi } from "../../features/dates/date-format";
import type { QuestionBankSummary } from "../../features/question-banks/types";
import { ActiveYearIndicator, useActiveYear, withActiveYear } from "../../features/active-year/ActiveYearProvider";

type Catalog = {
  trainings: Array<{ id: string; name: string }>;
  cohorts: Array<{ id: string; training_id: string; name: string; status: string; start_date: string; end_date: string }>;
};

type Draft = {
  trainingId: string; materialId: string; cohortId: string; passingScore: number;
  preMode: ScheduleMode; postMode: ScheduleMode;
  preStartAt: string; preEndAt: string; postStartAt: string; postEndAt: string;
};
type ScheduleMode = "OPEN_NOW" | "SCHEDULED";

const initialDraft: Draft = {
  trainingId: "", materialId: "", cohortId: "", passingScore: 75,
  preMode: "SCHEDULED", postMode: "SCHEDULED",
  preStartAt: "", preEndAt: "", postStartAt: "", postEndAt: "",
};

export function TrainingCreatePage() {
  const navigate = useNavigate();
  const { activeYear } = useActiveYear();
  const [draft, setDraft] = useState(initialDraft);
  const [catalog, setCatalog] = useState<Catalog>({ trainings: [], cohorts: [] });
  const [banks, setBanks] = useState<QuestionBankSummary[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      adminQuery<Catalog>(withActiveYear("/api/admin/participants/catalog", activeYear)),
      adminQuery<{ banks: QuestionBankSummary[] }>("/api/admin/banks"),
    ]).then(([catalogPayload, bankPayload]) => {
      setCatalog(catalogPayload);
      setBanks(bankPayload.banks.filter((bank) => bank.materialId));
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Data Test tidak dapat dimuat."));
  }, [activeYear]);

  const materials = useMemo(() => {
    const unique = new Map<string, QuestionBankSummary>();
    for (const bank of banks) {
      if (bank.trainingId !== draft.trainingId || !bank.materialId) continue;
      const current = unique.get(bank.materialId);
      if (!current || (!current.isActive && bank.isActive)) unique.set(bank.materialId, bank);
    }
    return [...unique.values()];
  }, [banks, draft.trainingId]);
  const cohorts = useMemo(
    () => catalog.cohorts.filter((cohort) => cohort.training_id === draft.trainingId && cohort.status === "ACTIVE"),
    [catalog.cohorts, draft.trainingId],
  );
  const selectedMaterial = materials.find((bank) => bank.materialId === draft.materialId);
  const update = <Key extends keyof Draft>(key: Key, value: Draft[Key]) => setDraft((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedCohort = catalog.cohorts.find((cohort) => cohort.id === draft.cohortId);
    const cohortYear = Number(selectedCohort?.start_date.slice(0, 4));
    if (selectedCohort && cohortYear !== activeYear) {
      setError(`Tanggal pelaksanaan angkatan berada pada tahun ${cohortYear}, sedangkan Tahun Aktif adalah ${activeYear}. Pilih Tahun Aktif atau angkatan yang sesuai.`);
      return;
    }
    function schedulePayload(mode: ScheduleMode, startValue: string, endValue: string, label: string) {
      if (mode === "OPEN_NOW") return { status: "OPEN_NOW" as const };
      const startAt = formatDateTimeForApi(startValue);
      const endAt = formatDateTimeForApi(endValue);
      if (!startAt || !endAt) throw new Error(`Lengkapi tanggal dan jam buka/tutup ${label}.`);
      if (Date.parse(endAt) <= Date.parse(startAt)) throw new Error(`Waktu tutup ${label} harus setelah waktu buka.`);
      return { status: "SCHEDULED" as const, startAt, endAt };
    }
    let pre: ReturnType<typeof schedulePayload>;
    let post: ReturnType<typeof schedulePayload>;
    try {
      pre = schedulePayload(draft.preMode, draft.preStartAt, draft.preEndAt, "Pre-Test");
      post = schedulePayload(draft.postMode, draft.postStartAt, draft.postEndAt, "Post-Test");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pengaturan waktu Test tidak valid.");
      return;
    }
    setSubmitting(true); setError(null);
    try {
      const payload = await adminMutation<{ session: { id: string } }>("/api/admin/training", {
        method: "POST",
        body: JSON.stringify({
          trainingId: draft.trainingId, materialId: draft.materialId, cohortId: draft.cohortId,
          activeYear,
          passingScore: Number(draft.passingScore),
          pre,
          post,
        }),
      });
      navigate(`/admin/pelatihan/${payload.session.id}`, { replace: true });
    } catch (reason) {
      setError(reason instanceof AdminApiError ? reason.message : "Test tidak dapat dibuat.");
    } finally { setSubmitting(false); }
  }

  return <>
    <header className="admin-page-header"><div><Link className="back-link" to="/admin/pelatihan">← Pelatihan/Test</Link><h1>Buat Test</h1><p>Pilih materi dan angkatan, kemudian tentukan jadwal link Pre-Test dan Post-Test.</p><ActiveYearIndicator /></div></header>
    {error && <p className="form-message is-error" role="alert">{error}</p>}
    <form className="panel training-form test-create-form" onSubmit={(event) => void submit(event)}>
      <fieldset className="test-create-section"><legend><span>01</span> Informasi Test</legend><p className="test-create-section__hint">Pilih pelatihan, materi yang memiliki Bank Soal, serta angkatan peserta.</p><div className="form-grid test-create-form__grid">
        <label>Pelatihan<SearchableSelect required value={draft.trainingId} placeholder="Ketik atau pilih pelatihan" options={catalog.trainings.map((training) => ({ value: training.id, label: training.name }))} onValueChange={(trainingId) => setDraft((current) => ({ ...current, trainingId, materialId: "", cohortId: "" }))} /></label>
        <label>Materi<select required disabled={!draft.trainingId} value={draft.materialId} onChange={(event) => update("materialId", event.target.value)}><option value="">Pilih materi</option>{materials.map((bank) => <option key={bank.materialId!} value={bank.materialId!}>{bank.materialName} ({bank.activeQuestionCount + bank.inactiveQuestionCount} soal)</option>)}</select></label>
        <label>Angkatan<select required disabled={!draft.trainingId} value={draft.cohortId} onChange={(event) => update("cohortId", event.target.value)}><option value="">Pilih angkatan</option>{cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></label>
        <label>Passing Grade<input type="number" min={0} max={100} step="0.01" required value={draft.passingScore} onChange={(event) => update("passingScore", Number(event.target.value))} /></label>
      </div>{draft.trainingId && !materials.length && <p className="form-message is-error">Pelatihan ini belum mempunyai materi dengan Bank Soal.</p>}{draft.trainingId && !cohorts.length && <p className="form-message is-error">Pelatihan ini belum mempunyai angkatan aktif.</p>}</fieldset>
      <div className="fixed-test-rule"><Clock3 /><div><strong>Durasi pengerjaan otomatis</strong><span>15 menit untuk setiap tes. Remedial maksimal 3 kali.</span></div></div>
      <section className="test-schedule-section" aria-labelledby="test-schedule-title"><div className="test-schedule-section__heading"><span>02</span><div><h2 id="test-schedule-title">Jadwal Pelaksanaan</h2><p>Pre-Test dan Post-Test dapat memakai mode akses yang berbeda.</p></div></div><div className="test-schedule-grid">
        <fieldset><legend><CalendarClock /> Pre-Test</legend><ScheduleModeControl value={draft.preMode} onChange={(value) => update("preMode", value)} label="Pre-Test" />{draft.preMode === "SCHEDULED" ? <div className="test-schedule-fields"><label>Tanggal dan jam buka<DateTimeInput required value={draft.preStartAt} onValueChange={(value) => update("preStartAt", value)} aria-label="Tanggal buka Pre-Test" /></label><label>Tanggal dan jam tutup<DateTimeInput required value={draft.preEndAt} onValueChange={(value) => update("preEndAt", value)} aria-label="Tanggal tutup Pre-Test" /></label></div> : <p className="test-schedule-open-note">Pre-Test langsung terbuka setelah disimpan dan tetap terbuka sampai ditutup manual.</p>}</fieldset>
        <fieldset><legend><CalendarClock /> Post-Test</legend><ScheduleModeControl value={draft.postMode} onChange={(value) => update("postMode", value)} label="Post-Test" />{draft.postMode === "SCHEDULED" ? <div className="test-schedule-fields"><label>Tanggal dan jam buka<DateTimeInput required value={draft.postStartAt} onValueChange={(value) => update("postStartAt", value)} aria-label="Tanggal buka Post-Test" /></label><label>Tanggal dan jam tutup<DateTimeInput required value={draft.postEndAt} onValueChange={(value) => update("postEndAt", value)} aria-label="Tanggal tutup Post-Test" /></label></div> : <p className="test-schedule-open-note">Post-Test langsung terbuka setelah disimpan dan tetap terbuka sampai ditutup manual.</p>}</fieldset>
      </div></section>
      {selectedMaterial && <p className="test-bank-note">Bank Soal mengikuti materi <strong>{selectedMaterial.materialName}</strong> dan menggunakan {selectedMaterial.activeQuestionCount + selectedMaterial.inactiveQuestionCount} soal.</p>}
      <div className="form-actions test-create-form__actions"><Link className="button button--secondary" to="/admin/pelatihan">Batal</Link><button className="button" type="submit" disabled={submitting || !draft.trainingId || !draft.materialId || !draft.cohortId}>{submitting ? "Menyimpan…" : "Simpan Test"}</button></div>
    </form>
  </>;
}

function ScheduleModeControl({ value, onChange, label }: { value: ScheduleMode; onChange: (value: ScheduleMode) => void; label: string }) {
  return <div className="schedule-mode-control" role="group" aria-label={`Mode akses ${label}`}>
    <button type="button" className={value === "OPEN_NOW" ? "is-active" : ""} aria-pressed={value === "OPEN_NOW"} onClick={() => onChange("OPEN_NOW")}>Buka Sekarang</button>
    <button type="button" className={value === "SCHEDULED" ? "is-active" : ""} aria-pressed={value === "SCHEDULED"} onClick={() => onChange("SCHEDULED")}>Set Jadwal</button>
  </div>;
}
