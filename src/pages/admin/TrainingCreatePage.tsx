import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarClock, Clock3 } from "lucide-react";
import { DateTimeInput } from "../../components/ui/DateTimeInput";
import { adminMutation, adminQuery, AdminApiError } from "../../features/admin-auth/admin-api";
import { formatDateTimeForApi } from "../../features/dates/date-format";
import type { QuestionBankSummary } from "../../features/question-banks/types";

type Catalog = {
  trainings: Array<{ id: string; name: string }>;
  cohorts: Array<{ id: string; training_id: string; name: string; status: string }>;
};

type Draft = {
  trainingId: string; materialId: string; cohortId: string; passingScore: number;
  preStartAt: string; preEndAt: string; postStartAt: string; postEndAt: string;
};

const initialDraft: Draft = {
  trainingId: "", materialId: "", cohortId: "", passingScore: 75,
  preStartAt: "", preEndAt: "", postStartAt: "", postEndAt: "",
};

export function TrainingCreatePage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(initialDraft);
  const [catalog, setCatalog] = useState<Catalog>({ trainings: [], cohorts: [] });
  const [banks, setBanks] = useState<QuestionBankSummary[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      adminQuery<Catalog>("/api/admin/participants/catalog"),
      adminQuery<{ banks: QuestionBankSummary[] }>("/api/admin/banks"),
    ]).then(([catalogPayload, bankPayload]) => {
      setCatalog(catalogPayload);
      setBanks(bankPayload.banks.filter((bank) => bank.isActive && bank.materialId));
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Data Test tidak dapat dimuat."));
  }, []);

  const materials = useMemo(() => {
    const unique = new Map<string, QuestionBankSummary>();
    for (const bank of banks) if (bank.trainingId === draft.trainingId && bank.materialId) unique.set(bank.materialId, bank);
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
    const preStartAt = formatDateTimeForApi(draft.preStartAt);
    const preEndAt = formatDateTimeForApi(draft.preEndAt);
    const postStartAt = formatDateTimeForApi(draft.postStartAt);
    const postEndAt = formatDateTimeForApi(draft.postEndAt);
    if (!preStartAt || !preEndAt || !postStartAt || !postEndAt) {
      setError("Lengkapi seluruh jadwal buka dan tutup Test.");
      return;
    }
    setSubmitting(true); setError(null);
    try {
      const payload = await adminMutation<{ session: { id: string } }>("/api/admin/training", {
        method: "POST",
        body: JSON.stringify({
          trainingId: draft.trainingId, materialId: draft.materialId, cohortId: draft.cohortId,
          passingScore: Number(draft.passingScore),
          pre: { startAt: preStartAt, endAt: preEndAt },
          post: { startAt: postStartAt, endAt: postEndAt },
        }),
      });
      navigate(`/admin/pelatihan/${payload.session.id}`, { replace: true });
    } catch (reason) {
      setError(reason instanceof AdminApiError ? reason.message : "Test tidak dapat dibuat.");
    } finally { setSubmitting(false); }
  }

  return <>
    <header className="admin-page-header"><div><Link className="back-link" to="/admin/pelatihan">← Pelatihan/Test</Link><h1>Buat Test</h1><p>Pilih materi dan angkatan, kemudian tentukan jadwal link Pre-Test dan Post-Test.</p></div></header>
    {error && <p className="form-message is-error" role="alert">{error}</p>}
    <form className="panel training-form test-create-form" onSubmit={(event) => void submit(event)}>
      <fieldset><legend>Informasi Test</legend><div className="form-grid">
        <label>Pelatihan<select required value={draft.trainingId} onChange={(event) => setDraft((current) => ({ ...current, trainingId: event.target.value, materialId: "", cohortId: "" }))}><option value="">Pilih pelatihan</option>{catalog.trainings.map((training) => <option key={training.id} value={training.id}>{training.name}</option>)}</select></label>
        <label>Materi<select required disabled={!draft.trainingId} value={draft.materialId} onChange={(event) => update("materialId", event.target.value)}><option value="">Pilih materi</option>{materials.map((bank) => <option key={bank.materialId!} value={bank.materialId!}>{bank.materialName} ({bank.activeQuestionCount} soal)</option>)}</select></label>
        <label>Angkatan<select required disabled={!draft.trainingId} value={draft.cohortId} onChange={(event) => update("cohortId", event.target.value)}><option value="">Pilih angkatan</option>{cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></label>
        <label>Passing Grade<input type="number" min={0} max={100} step="0.01" required value={draft.passingScore} onChange={(event) => update("passingScore", Number(event.target.value))} /></label>
      </div>{draft.trainingId && !materials.length && <p className="form-message is-error">Pelatihan ini belum mempunyai materi dengan Bank Soal aktif.</p>}{draft.trainingId && !cohorts.length && <p className="form-message is-error">Pelatihan ini belum mempunyai angkatan aktif.</p>}</fieldset>
      <div className="fixed-test-rule"><Clock3 /><div><strong>Durasi pengerjaan otomatis</strong><span>15 menit. Remedial maksimal 3 kali.</span></div></div>
      <div className="test-schedule-grid">
        <fieldset><legend><CalendarClock /> Pre-Test</legend><label>Tanggal/Jam Buka<DateTimeInput required value={draft.preStartAt} onValueChange={(value) => update("preStartAt", value)} /></label><label>Tanggal/Jam Tutup<DateTimeInput required value={draft.preEndAt} onValueChange={(value) => update("preEndAt", value)} /></label></fieldset>
        <fieldset><legend><CalendarClock /> Post-Test</legend><label>Tanggal/Jam Buka<DateTimeInput required value={draft.postStartAt} onValueChange={(value) => update("postStartAt", value)} /></label><label>Tanggal/Jam Tutup<DateTimeInput required value={draft.postEndAt} onValueChange={(value) => update("postEndAt", value)} /></label></fieldset>
      </div>
      {selectedMaterial && <p className="test-bank-note">Bank Soal mengikuti materi <strong>{selectedMaterial.materialName}</strong> dan menggunakan {selectedMaterial.activeQuestionCount} soal aktif.</p>}
      <div className="form-actions"><Link className="button button--secondary" to="/admin/pelatihan">Batal</Link><button className="button" type="submit" disabled={submitting || !draft.trainingId || !draft.materialId || !draft.cohortId}>{submitting ? "Menyimpan…" : "Simpan Test"}</button></div>
    </form>
  </>;
}
