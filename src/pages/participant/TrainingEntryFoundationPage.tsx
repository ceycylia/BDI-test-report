import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PublicLayout } from "../../layouts/PublicLayout";
import { nextPostStage, type AttemptStage } from "../../../worker/domain/attempts/progression";
import { formatDateForDisplay } from "../../features/dates/date-format";

type EntryData = {
  training: { id: string; name: string; questionCount: number; durationMinutes: number; startDate: string; endDate: string; status: string; preOpen: boolean; postOpen: boolean };
  batches: Array<{ id: string; number: number; name: string }>;
};

type Identity = {
  participant: { id: string; name: string };
  batch: { id: string; name: string };
  training: { id: string; name: string; questionCount: number; durationMinutes: number; passingScore: number };
  availability: { preOpen: boolean; postOpen: boolean; attempts: Array<{ stage: AttemptStage; status: string; score: number | null }> };
};

async function publicJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...init?.headers },
  });
  const payload = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "Permintaan tidak dapat diproses.");
  return payload;
}

export function TrainingEntryFoundationPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<EntryData | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [name, setName] = useState("");
  const [nik, setNik] = useState("");
  const [batchId, setBatchId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void publicJson<EntryData>(`/api/public/training/${slug}`)
      .then((payload) => { setData(payload); setBatchId(payload.batches[0]?.id ?? ""); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Pelatihan tidak dapat dimuat."));
  }, [slug]);

  async function identify(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const result = await publicJson<Identity>(`/api/public/training/${slug}/identify`, {
        method: "POST", body: JSON.stringify({ name, nik, batchId }),
      });
      sessionStorage.setItem(`bdi-participant:${slug}`, JSON.stringify({ participantId: result.participant.id, batchId: result.batch.id }));
      setIdentity(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Data peserta tidak dapat diperiksa.");
    } finally { setBusy(false); }
  }

  async function startTest(stage: AttemptStage) {
    if (!identity) return;
    setBusy(true); setError(null);
    try {
      const result = await publicJson<{ attempt: { id: string } }>(`/api/public/training/${slug}/attempts/start`, {
        method: "POST", body: JSON.stringify({ participantId: identity.participant.id, batchId: identity.batch.id, stage }),
      });
      navigate(`/t/${slug}/attempt/${result.attempt.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Tes tidak dapat dimulai."); }
    finally { setBusy(false); }
  }

  return (
    <PublicLayout>
      <section className="entry-card" aria-labelledby="training-title">
        <div className="entry-card__eyebrow">Pelatihan BDI</div>
        <h1 id="training-title">{data?.training.name ?? "Memuat pelatihan…"}</h1>
        {data && <p className="entry-card__lead">{data.training.questionCount} soal · 15 menit<br />Periode {formatDateForDisplay(data.training.startDate)} sampai {formatDateForDisplay(data.training.endDate)}</p>}
        {error && <p className="form-message is-error" role="alert">{error}</p>}
        {data && !identity && <form className="participant-entry-form" onSubmit={(event) => void identify(event)}>
          <label>Nama Lengkap<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Masukkan nama lengkap" required minLength={2} /></label>
          <label>NIK<input value={nik} onChange={(event) => setNik(event.target.value)} inputMode="numeric" autoComplete="off" placeholder="Masukkan NIK sesuai pendaftaran" required minLength={3} /></label>
          <label>Pilih Angkatan<select value={batchId} onChange={(event) => setBatchId(event.target.value)} required>{data.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select></label>
          <button className="button participant-primary-button" disabled={busy || !batchId}>{busy ? "Memeriksa…" : "LANJUTKAN"}</button>
          {!data.training.preOpen && !data.training.postOpen && <p className="availability-note">Tes belum dibuka. Silakan hubungi admin pelatihan.</p>}
        </form>}
        {identity && <div className="participant-confirmation">
          <p className="section-label">Data peserta</p><h2>{identity.participant.name}</h2>
          <dl><div><dt>Angkatan</dt><dd>{identity.batch.name}</dd></div><div><dt>Jumlah soal</dt><dd>{identity.training.questionCount}</dd></div><div><dt>Durasi</dt><dd>15 menit</dd></div></dl>
          {(() => {
            const pre = identity.availability.attempts.find((attempt) => attempt.stage === "PRE");
            if (pre?.status === "IN_PROGRESS") return <button className="button participant-primary-button" disabled={busy} onClick={() => void startTest("PRE")}>{busy ? "Menyiapkan…" : "LANJUTKAN PRE-TEST"}</button>;
            if (!pre && identity.availability.preOpen) return <button className="button participant-primary-button" disabled={busy} onClick={() => void startTest("PRE")}>{busy ? "Menyiapkan…" : "MULAI PRE-TEST"}</button>;
            if (pre?.status === "SUBMITTED") {
              const stage = nextPostStage(identity.availability.attempts, identity.training.passingScore);
              const existing = stage ? identity.availability.attempts.find((attempt) => attempt.stage === stage) : undefined;
              if (stage && (identity.availability.postOpen || existing?.status === "IN_PROGRESS")) {
                const label = stage === "POST" ? "POST-TEST" : stage.replace("_", " ");
                return <button className="button participant-primary-button" disabled={busy} onClick={() => void startTest(stage)}>{busy ? "Menyiapkan…" : `${existing?.status === "IN_PROGRESS" ? "LANJUTKAN" : "MULAI"} ${label}`}</button>;
              }
              if (!stage) return <p className="availability-note">Seluruh tahap Post-Test sudah selesai.</p>;
            }
            return <p className="availability-note">Tes berikutnya belum dibuka.</p>;
          })()}
        </div>}
      </section>
    </PublicLayout>
  );
}
