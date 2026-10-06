import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PublicLayout } from "../../layouts/PublicLayout";
import { useAutoDismiss } from "../../components/ui/useAutoDismiss";
import { ModalPortal } from "../../components/ui/ModalPortal";

type OptionKey = "A" | "B" | "C" | "D";
type Question = {
  id: string; position: number; text: string; imageUrl: string | null;
  options: Array<{ displayKey: OptionKey; originalKey: OptionKey; text: string }>;
};
type AttemptPayload = {
  attempt: { id: string; stage: string; status: string; deadlineAt: string; normalDeadlineAt: string; serverNow: string; revision: number; answers: Record<string, OptionKey>; score: number | null; passingScore: number };
  questions: Question[];
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { Accept: "application/json", "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "Permintaan tidak dapat diproses.");
  return payload;
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function AttemptPage() {
  const { slug = "", attemptId = "" } = useParams();
  const [payload, setPayload] = useState<AttemptPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [normalRemaining, setNormalRemaining] = useState<number | null>(null);
  const [oneMinuteDeadlineAt, setOneMinuteDeadlineAt] = useState<number | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  useAutoDismiss(message, setMessage);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const revisionRef = useRef(0);
  const serverOffsetRef = useRef(0);
  const loadedRef = useRef(false);
  const timeoutSubmittedRef = useRef(false);
  const identityRaw = sessionStorage.getItem(`bdi-participant:${slug}`);
  const participantId = identityRaw ? (JSON.parse(identityRaw) as { participantId?: string }).participantId ?? "" : "";
  const localKey = `bdi-attempt:${slug}:${participantId}:${attemptId}`;

  useEffect(() => {
    if (!participantId) { setError("Data peserta tidak ditemukan. Silakan kembali dan masukkan nama Anda."); return; }
    void requestJson<AttemptPayload>(`/api/public/training/${slug}/attempts/${attemptId}?participantId=${encodeURIComponent(participantId)}`)
      .then((data) => {
        const local = JSON.parse(localStorage.getItem(localKey) ?? "null") as { answers?: Record<string, OptionKey> } | null;
        setPayload(data); setAnswers({ ...data.attempt.answers, ...local?.answers });
        revisionRef.current = data.attempt.revision;
        serverOffsetRef.current = Date.parse(data.attempt.serverNow) - Date.now();
        if (data.attempt.status === "SUBMITTED") setResult(data.attempt.score);
        loadedRef.current = true;
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Tes tidak dapat dimuat."));
  }, [attemptId, localKey, participantId, slug]);

  useEffect(() => {
    if (!payload || payload.attempt.status !== "IN_PROGRESS" || result !== null) return;
    const update = () => {
      const serverNow = Date.now() + serverOffsetRef.current;
      setRemaining(Math.max(0, Math.ceil((Date.parse(payload.attempt.deadlineAt) - serverNow) / 1000)));
      setNormalRemaining(Math.max(0, Math.ceil((Date.parse(payload.attempt.normalDeadlineAt) - serverNow) / 1000)));
    };
    update(); const timer = window.setInterval(update, 1000); return () => window.clearInterval(timer);
  }, [payload, result]);

  useEffect(() => {
    if (!loadedRef.current || !payload || result !== null) return;
    localStorage.setItem(localKey, JSON.stringify({ answers }));
    const timer = window.setTimeout(() => {
      const revision = revisionRef.current + 1; revisionRef.current = revision;
      void requestJson<{ revision: number }>(`/api/public/training/${slug}/attempts/${attemptId}/draft`, {
        method: "PUT", body: JSON.stringify({ participantId, revision, answers }),
      }).then((data) => { revisionRef.current = Math.max(revisionRef.current, data.revision); setMessage("Jawaban tersimpan."); })
        .catch(() => setMessage("Koneksi terganggu. Jawaban tetap tersimpan di perangkat."));
    }, 1200);
    return () => window.clearTimeout(timer);
  // Retrying this effect after the browser comes back online makes the local
  // backup useful: it is sent to the same attempt and never creates more time.
  }, [answers, attemptId, localKey, participantId, payload, result, retryNonce, slug]);

  useEffect(() => {
    const retry = () => setRetryNonce((value) => value + 1);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  async function sendSubmission(mode: "NORMAL" | "TIMEOUT") {
    if (!payload || submitting || result !== null) return;
    setSubmitting(true); setError(null); setConfirming(false);
    try {
      const data = await requestJson<{ attempt: { status: string; score: number } }>(`/api/public/training/${slug}/attempts/${attemptId}/submit`, {
        method: "POST", body: JSON.stringify({ participantId, mode, answers }),
      });
      localStorage.removeItem(localKey); setResult(data.attempt.score); setMessage(null);
    } catch (reason) {
      if (mode === "TIMEOUT") timeoutSubmittedRef.current = false;
      setError(reason instanceof Error ? reason.message : "Jawaban belum dapat dikirim.");
    }
    finally { setSubmitting(false); }
  }

  useEffect(() => {
    if (!payload || remaining === null || !loadedRef.current || result !== null) return;
    if (remaining === 0 && !timeoutSubmittedRef.current) {
      timeoutSubmittedRef.current = true;
      void sendSubmission("TIMEOUT");
      return;
    }
  }, [attemptId, participantId, payload, remaining, result, slug]);

  function addOneMinute() {
    if (!payload) return;
    const serverNow = Date.now() + serverOffsetRef.current;
    const hardDeadline = Date.parse(payload.attempt.deadlineAt);
    if (serverNow >= hardDeadline) return;
    // This only changes the participant-facing countdown. The persisted server
    // deadline remains the authority and is never extended by this button.
    setOneMinuteDeadlineAt(Math.min(serverNow + 60_000, hardDeadline));
  }

  function requestSubmit() {
    if (!payload) return;
    const unanswered = payload.questions.filter((question) => !answers[question.id]);
    if (unanswered.length) {
      setError(`Masih ada ${unanswered.length} soal yang belum dijawab.`);
      setCurrent(payload.questions.findIndex((question) => question.id === unanswered[0]?.id));
      return;
    }
    setError(null); setConfirming(true);
  }

  if (error && !payload) return <PublicLayout><section className="entry-card"><p className="form-message is-error">{error}</p><Link className="button" to={`/t/${slug}`}>Kembali</Link></section></PublicLayout>;
  if (!payload) return <PublicLayout><section className="entry-card"><p>Memuat tes…</p></section></PublicLayout>;
  if (result !== null) {
    const isPre = payload.attempt.stage === "PRE";
    const passed = result >= payload.attempt.passingScore;
    const stageLabel = payload.attempt.stage === "PRE" ? "Pre-Test" : payload.attempt.stage === "POST" ? "Post-Test" : payload.attempt.stage.replace("_", " ").replace("REMEDIAL", "Remedial");
    return <PublicLayout><section className="entry-card result-card"><div className="entry-card__eyebrow">{stageLabel} selesai</div><h1>Nilai Anda</h1><strong className="result-score">{result}</strong>{!isPre && <p className={`result-status ${passed ? "is-passed" : "is-failed"}`}>Status: {passed ? "LULUS" : "BELUM LULUS"}</p>}<p>Jawaban telah dikirim dan tidak dapat diubah.</p><Link className="button" to={`/t/${slug}`}>Kembali ke pelatihan</Link></section></PublicLayout>;
  }
  const question = payload.questions[current];
  if (!question) return <PublicLayout><section className="entry-card"><p className="form-message is-error">Soal tidak tersedia.</p></section></PublicLayout>;

  const mainTimeFinished = normalRemaining !== null && normalRemaining === 0;
  const oneMinuteRemaining = oneMinuteDeadlineAt === null ? 0 : Math.max(0, Math.ceil((oneMinuteDeadlineAt - (Date.now() + serverOffsetRef.current)) / 1000));
  const showingOneMinute = mainTimeFinished && oneMinuteRemaining > 0;
  const displayedRemaining = mainTimeFinished ? oneMinuteRemaining : normalRemaining ?? 0;

  return <PublicLayout><section className="test-shell">
    <header className="test-header"><div><span>{payload.attempt.stage.replace("_", " ")}</span><strong>Soal {current + 1} dari {payload.questions.length}</strong></div><div className={`test-timer ${showingOneMinute ? "is-critical" : ""}`} aria-label="Sisa waktu pengerjaan">{formatTime(displayedRemaining)}</div></header>
    <div className="test-progress"><span style={{ width: `${((current + 1) / payload.questions.length) * 100}%` }} /></div>
    {mainTimeFinished && (showingOneMinute ? <div className="test-time-warning is-critical" role="status"><strong>WAKTU HAMPIR HABIS.</strong><span>SEGERA SELESAIKAN SOAL YANG BELUM DIJAWAB.</span></div> : <div className="test-time-warning" role="status"><strong>WAKTU PENGERJAAN TELAH HABIS.</strong><span>Periksa soal yang belum dijawab, lalu tambahkan waktu 1 menit untuk menyelesaikannya.</span><button type="button" className="button" disabled={(remaining ?? 0) === 0} onClick={addOneMinute}>TAMBAH WAKTU 1 MENIT</button></div>)}
    {error && <p className="form-message is-error" role="alert">{error}</p>}
    <article className="question-card"><p className="question-number">Pertanyaan {current + 1}</p><h1>{question.text}</h1>{question.imageUrl && <figure className="test-question-figure"><img className="test-question-image" src={question.imageUrl} alt="Gambar pertanyaan" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.nextElementSibling?.removeAttribute("hidden"); }} /><figcaption hidden>Gambar soal tidak dapat dimuat. Silakan hubungi panitia.</figcaption></figure>}
      <div className="answer-options">{question.options.map((option) => <label className={answers[question.id] === option.originalKey ? "is-selected" : ""} key={option.originalKey}><input type="radio" name={question.id} checked={answers[question.id] === option.originalKey} onChange={() => { setAnswers((currentAnswers) => ({ ...currentAnswers, [question.id]: option.originalKey })); setError(null); setMessage(null); }} /><span className="answer-key">{option.displayKey}</span><span>{option.text}</span></label>)}</div>
    </article>
    <div className="test-actions"><button className="button button--secondary" disabled={current === 0} onClick={() => setCurrent((index) => Math.max(0, index - 1))}>Sebelumnya</button>{current < payload.questions.length - 1 ? <button className="button" onClick={() => setCurrent((index) => Math.min(payload.questions.length - 1, index + 1))}>Berikutnya</button> : <button className="button" onClick={requestSubmit}>Kirim jawaban</button>}</div>
    <nav className="question-nav" aria-label="Navigasi soal">{payload.questions.map((item, index) => <button className={`${index === current ? "is-current" : ""} ${answers[item.id] ? "is-answered" : ""}`} key={item.id} onClick={() => setCurrent(index)} aria-label={`Soal ${index + 1}`}>{index + 1}</button>)}</nav>
    {message && <p className="autosave-message" aria-live="polite">{message}</p>}
    {confirming && <ModalPortal onClose={() => setConfirming(false)} blocked={submitting}><section className="submit-modal" role="dialog" aria-modal="true" aria-labelledby="submit-title"><button type="button" className="participant-modal__close submit-modal__close" aria-label="Tutup konfirmasi" disabled={submitting} onClick={() => setConfirming(false)}>×</button><h2 id="submit-title">Kirim jawaban?</h2><p>Apakah Anda yakin ingin mengirim jawaban? Jawaban tidak dapat diubah setelah dikirim.</p><div className="test-actions"><button className="button button--secondary" onClick={() => setConfirming(false)}>BATAL</button><button className="button" disabled={submitting} onClick={() => void sendSubmission("NORMAL")}>{submitting ? "Mengirim…" : "KIRIM JAWABAN"}</button></div></section></ModalPortal>}
  </section></PublicLayout>;
}
