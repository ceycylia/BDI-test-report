import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PublicLayout } from "../../layouts/PublicLayout";
import type { AttemptStage } from "../../../worker/domain/attempts/progression";
import { formatDateForDisplay } from "../../features/dates/date-format";
import { readRememberedParticipant, rememberParticipant, rememberedBatchId } from "../../features/participant-entry/remembered-participant";
import { participantTestStatus, type ParticipantTestStatus } from "../../features/participant-entry/test-entry-status";
import { useAutoDismiss } from "../../components/ui/useAutoDismiss";

type EntryData = {
  training: {
    id: string; name: string; questionCount: number; durationMinutes: number;
    startDate: string; endDate: string; status: string; preOpen: boolean; postOpen: boolean;
    postMode: "MANUAL" | "SCHEDULED"; postStartAt: string | null; postEndAt: string | null;
  };
  batches: Array<{ id: string; number: number; name: string; cohortId: string | null }>;
};

type Identity = {
  participant: { id: string; name: string };
  batch: { id: string; name: string; cohortId: string };
  training: {
    id: string; name: string; questionCount: number; durationMinutes: number; passingScore: number;
    postMode: "MANUAL" | "SCHEDULED"; postStartAt: string | null; postEndAt: string | null;
  };
  availability: { preOpen: boolean; postOpen: boolean; attempts: Array<{ stage: AttemptStage; status: string; score: number | null }> };
};

function stageLabel(stage: AttemptStage) {
  if (stage === "PRE") return "PRE-TEST";
  if (stage === "POST") return "POST-TEST";
  return stage.replace("REMEDIAL_", "REMEDIAL ");
}

function scheduledDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)} WIB`;
}

function statusCopy(status: ParticipantTestStatus, identity: Identity) {
  const participant = identity.participant.name;
  const material = identity.training.name;
  switch (status.kind) {
    case "PRE_START": return [`${participant} belum mengerjakan Pre-Test untuk ${material}.`];
    case "PRE_CONTINUE": return [`${participant} memiliki Pre-Test yang belum selesai untuk ${material}.`];
    case "PRE_NOT_OPEN": return [`Pre-Test untuk ${material} belum dibuka.`];
    case "POST_SCHEDULED": return [
      `${participant} sudah menyelesaikan Pre-Test untuk ${material}.`,
      `Post-Test dapat dimulai pada ${scheduledDateTime(identity.training.postStartAt)}.`,
    ];
    case "POST_NOT_OPEN": return status.stage && status.stage !== "POST"
      ? [`${participant} sudah menyelesaikan Pre-Test untuk ${material}.`, `${stageLabel(status.stage)} belum dibuka oleh panitia.`]
      : [`${participant} sudah menyelesaikan Pre-Test untuk ${material}.`, "Post-Test belum dibuka oleh panitia."];
    case "STAGE_START": return status.stage === "POST"
      ? [`${participant} sudah menyelesaikan Pre-Test untuk ${material}.`, "Post-Test sudah dapat dimulai."]
      : [`Nilai ${participant} untuk ${material} belum memenuhi passing grade.`, `${status.stage ? stageLabel(status.stage) : "Remedial"} sudah dapat dimulai.`];
    case "STAGE_CONTINUE": return [`${participant} memiliki ${status.stage ? stageLabel(status.stage) : "tes"} yang belum selesai untuk ${material}.`];
    case "PASSED": return [`${participant} sudah menyelesaikan tes untuk ${material}.`, "Status: LULUS."];
    case "FAILED": return [`${participant} sudah menyelesaikan seluruh tahap tes untuk ${material}.`, "Status: TIDAK LULUS."];
  }
}

function actionLabel(status: ParticipantTestStatus) {
  if (!status.stage) return "";
  const prefix = status.kind === "PRE_CONTINUE" || status.kind === "STAGE_CONTINUE" ? "LANJUTKAN" : "MULAI";
  return `${prefix} ${stageLabel(status.stage)}`;
}

async function publicJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...init?.headers },
  });
  const payload = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? (response.status === 404 ? "Link pelatihan atau data peserta tidak ditemukan." : response.status === 401 || response.status === 403 ? "Anda tidak memiliki akses untuk melanjutkan." : response.status >= 500 ? "Terjadi gangguan pada sistem. Silakan coba kembali." : "Permintaan tidak dapat diproses."));
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
  useAutoDismiss(error, setError);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const remembered = readRememberedParticipant(window.localStorage);
    setIdentity(null);
    setName(remembered?.name ?? "");
    setNik(remembered?.nik ?? "");
    setError(null);
    void publicJson<EntryData>(`/api/public/training/${slug}`)
      .then((payload) => {
        setData(payload);
        const rememberedBatch = rememberedBatchId(payload.batches, remembered);
        setBatchId(remembered ? rememberedBatch ?? "" : payload.batches[0]?.id ?? "");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Pelatihan tidak dapat dimuat."));
  }, [slug]);

  async function identify(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const result = await publicJson<Identity>(`/api/public/training/${slug}/identify`, {
        method: "POST", body: JSON.stringify({ name, nik, batchId }),
      });
      setName(result.participant.name);
      rememberParticipant(window.localStorage, {
        name: result.participant.name,
        nik,
        cohortId: result.batch.cohortId,
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

  const testStatus = identity ? participantTestStatus({
    attempts: identity.availability.attempts,
    passingScore: identity.training.passingScore,
    preOpen: identity.availability.preOpen,
    postOpen: identity.availability.postOpen,
    postMode: identity.training.postMode,
    postStartAt: identity.training.postStartAt,
  }) : null;

  return (
    <PublicLayout>
      <section className="entry-card" aria-labelledby="training-title">
        <Link className="participant-home-back" to="/" aria-label="Kembali ke menu utama peserta">← Kembali</Link>
        <div className="entry-card__eyebrow">Pelatihan BDI</div>
        <h1 id="training-title">{data?.training.name ?? "Memuat pelatihan…"}</h1>
        {data && <p className="entry-card__lead">{data.training.questionCount} soal · {data.training.durationMinutes} menit<br />Periode {formatDateForDisplay(data.training.startDate)} sampai {formatDateForDisplay(data.training.endDate)}</p>}
        {error && <p className="form-message is-error" role="alert">{error}</p>}
        {data && !identity && <form className="participant-entry-form" autoComplete="off" onSubmit={(event) => void identify(event)}>
          <label>Nama Lengkap<input name="participantName" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Masukkan nama lengkap" required minLength={2} maxLength={150} /></label>
          <label>NIK<input name="participantNik" value={nik} onChange={(event) => setNik(event.target.value.replace(/\D/gu, "").slice(0, 40))} inputMode="numeric" pattern="[0-9]+" autoComplete="off" placeholder="Masukkan NIK sesuai pendaftaran" required minLength={3} maxLength={40} /></label>
          <label>Pilih Angkatan<select value={batchId} onChange={(event) => setBatchId(event.target.value)} required><option value="" disabled>Pilih angkatan</option>{data.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select></label>
          <button className="button participant-primary-button" disabled={busy || !batchId}>{busy ? "Memeriksa…" : "LANJUTKAN"}</button>
          {!data.training.preOpen && !data.training.postOpen && <p className="availability-note">Tes belum dibuka. Silakan hubungi admin pelatihan.</p>}
        </form>}
        {identity && <div className="participant-confirmation">
          <p className="section-label">Data peserta</p><h2>{identity.participant.name}</h2>
          <dl><div><dt>Angkatan</dt><dd>{identity.batch.name}</dd></div><div><dt>Jumlah soal</dt><dd>{identity.training.questionCount}</dd></div><div><dt>Durasi</dt><dd>{identity.training.durationMinutes} menit</dd></div></dl>
          {testStatus && <div className={`participant-test-status is-${testStatus.kind === "PASSED" ? "success" : testStatus.kind === "FAILED" ? "danger" : "info"}`} role="status">
            <strong>Status {identity.training.name}</strong>
            {statusCopy(testStatus, identity).map((line) => <p key={line}>{line}</p>)}
          </div>}
          {testStatus?.stage && ["PRE_START", "PRE_CONTINUE", "STAGE_START", "STAGE_CONTINUE"].includes(testStatus.kind) && <button className="button participant-primary-button" disabled={busy} onClick={() => void startTest(testStatus.stage!)}>{busy ? "Menyiapkan…" : actionLabel(testStatus)}</button>}
        </div>}
      </section>
    </PublicLayout>
  );
}
