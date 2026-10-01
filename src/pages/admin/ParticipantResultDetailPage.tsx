import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminMutation, adminQuery } from "../../features/admin-auth/admin-api";
import { useAutoDismiss } from "../../components/ui/useAutoDismiss";

type Participant = { id: string; name: string; batch_name: string; training_name: string; passing_score: number };
type Attempt = { id: string; stage: string; status: string; score: number | null; correct_count: number | null; wrong_count: number | null; started_at: string; submitted_at: string | null };
type Answer = { attempt_id: string; question_id: string; display_position: number; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option_key: string; selected_original_option_key: string | null; is_correct: number | null };
type Detail = { participant: Participant; attempts: Attempt[]; answers: Answer[] };

function optionText(answer: Answer, key: string | null) {
  if (!key) return "Tidak dijawab";
  return ({ A: answer.option_a, B: answer.option_b, C: answer.option_c, D: answer.option_d } as Record<string, string>)[key] ?? "—";
}

export function ParticipantResultDetailPage() {
  const { participantId = "" } = useParams();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useAutoDismiss(message, setMessage);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const load = () => adminQuery<Detail>(`/api/admin/results/participants/${participantId}`).then((data) => { setDetail(data); setName(data.participant.name); });
  useEffect(() => { void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Detail peserta tidak dapat dimuat.")); }, [participantId]);
  const answerGroups = useMemo(() => new Map(detail?.attempts.map((attempt) => [attempt.id, detail.answers.filter((answer) => answer.attempt_id === attempt.id)]) ?? []), [detail]);

  async function saveName() {
    setError(null); setMessage(null);
    try { await adminMutation(`/api/admin/results/participants/${participantId}/name`, { method: "PUT", body: JSON.stringify({ name }) }); await load(); setMessage("Nama peserta diperbarui."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Nama gagal diperbarui."); }
  }
  async function resetAttempt(attemptId: string) {
    const reason = window.prompt("Alasan reset attempt (opsional):", "Kendala teknis")?.trim() || null;
    setError(null); setMessage(null);
    try { await adminMutation(`/api/admin/results/participants/${participantId}/attempts/${attemptId}/reset`, { method: "POST", body: JSON.stringify({ reason }) }); await load(); setMessage("Attempt direset. Riwayat lama disimpan dan peserta dapat mengulang tahap tersebut."); setConfirmReset(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Attempt gagal direset."); }
  }

  if (error && !detail) return <p className="form-message is-error">{error}</p>;
  if (!detail) return <p className="muted">Memuat detail…</p>;
  return <><header className="admin-page-header"><div><Link className="back-link" to="/admin/hasil">← Hasil</Link><h1>{detail.participant.name}</h1><p>{detail.participant.training_name} · {detail.participant.batch_name}</p></div></header>
    {error && <p className="form-message is-error">{error}</p>}{message && <p className="form-message is-success">{message}</p>}
    <section className="panel participant-name-editor"><label>Perbaiki nama peserta<input value={name} onChange={(event) => setName(event.target.value)} /></label><button className="button button--secondary" onClick={() => void saveName()}>Simpan nama</button></section>
    <section className="attempt-details">{detail.attempts.map((attempt) => <article className="panel" key={attempt.id}><header><div><p className="section-label">{attempt.stage.replace("_", " ")}</p><h2>{attempt.status}</h2></div><strong className="attempt-score">{attempt.score ?? "—"}</strong></header><p>{attempt.correct_count ?? 0} benar · {attempt.wrong_count ?? 0} salah</p>{attempt.status !== "RESET" && (confirmReset === attempt.id ? <div className="reset-confirm"><p>Reset attempt ini agar peserta dapat mengulang?</p><button className="button button--secondary" onClick={() => setConfirmReset(null)}>Batal</button><button className="button danger-button" onClick={() => void resetAttempt(attempt.id)}>Reset attempt</button></div> : <button className="text-button is-danger" onClick={() => setConfirmReset(attempt.id)}>Reset attempt</button>)}
      <div className="answer-detail-list">{(answerGroups.get(attempt.id) ?? []).map((answer) => <div className={answer.is_correct === 1 ? "is-correct" : "is-wrong"} key={answer.question_id}><strong>{answer.display_position}. {answer.question_text}</strong><span>Jawaban peserta: {optionText(answer, answer.selected_original_option_key)}</span><span>Jawaban benar: {optionText(answer, answer.correct_option_key)}</span></div>)}</div></article>)}</section>
  </>;
}
