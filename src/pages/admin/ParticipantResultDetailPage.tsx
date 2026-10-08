import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminMutation, adminQuery } from "../../features/admin-auth/admin-api";
import { useAutoDismiss } from "../../components/ui/useAutoDismiss";
import { ActiveYearIndicator, useActiveYear, withActiveYear } from "../../features/active-year/ActiveYearProvider";

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
  const { activeYear } = useActiveYear();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [name, setName] = useState("");
  const [adjustedScore, setAdjustedScore] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useAutoDismiss(message, setMessage);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const load = () => adminQuery<Detail>(withActiveYear(`/api/admin/results/participants/${participantId}`, activeYear)).then((data) => { setDetail(data); setName(data.participant.name); setAdjustedScore(String(data.attempts.find((attempt) => attempt.stage === "REMEDIAL_2")?.score ?? "")); });
  useEffect(() => { setDetail(null); void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Detail peserta tidak dapat dimuat.")); }, [activeYear, participantId]);
  const visibleAttempts = useMemo(() => detail?.attempts.filter((attempt) => attempt.stage !== "REMEDIAL_3") ?? [], [detail]);
  const answerGroups = useMemo(() => new Map(visibleAttempts.map((attempt) => [attempt.id, detail?.answers.filter((answer) => answer.attempt_id === attempt.id) ?? []])), [detail, visibleAttempts]);

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
  async function saveAdjustedScore() {
    const score = Number(adjustedScore);
    if (!Number.isFinite(score) || score < 0 || score > 100) { setError("Nilai harus berada di antara 0 dan 100."); return; }
    setError(null); setMessage(null);
    try { await adminMutation(`/api/admin/results/participants/${participantId}/final-score`, { method: "PUT", body: JSON.stringify({ score }) }); await load(); setMessage("Nilai akhir berhasil disesuaikan dan tercatat di audit log."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Nilai akhir gagal disesuaikan."); }
  }

  if (error && !detail) return <p className="form-message is-error">{error}</p>;
  if (!detail) return <p className="muted">Memuat detail…</p>;
  const completedStages = new Set(detail.attempts.filter((attempt) => attempt.status === "SUBMITTED").map((attempt) => attempt.stage));
  const finalScores = detail.attempts.filter((attempt) => completedStages.has(attempt.stage) && ["POST", "REMEDIAL_1", "REMEDIAL_2"].includes(attempt.stage)).map((attempt) => Number(attempt.score ?? -1));
  const canAdjustScore = ["POST", "REMEDIAL_1", "REMEDIAL_2"].every((stage) => completedStages.has(stage)) && Math.max(...finalScores, -1) < detail.participant.passing_score;
  return <><header className="admin-page-header"><div><Link className="back-link" to="/admin/hasil">← Hasil</Link><h1>{detail.participant.name}</h1><p>{detail.participant.training_name} · {detail.participant.batch_name}</p><ActiveYearIndicator /></div></header>
    {error && <p className="form-message is-error">{error}</p>}{message && <p className="form-message is-success">{message}</p>}
    <section className="panel participant-name-editor"><label>Perbaiki nama peserta<input value={name} onChange={(event) => setName(event.target.value)} /></label><button className="button button--secondary" onClick={() => void saveName()}>Simpan nama</button></section>
    {canAdjustScore && <section className="panel score-adjustment-panel"><div><p className="section-label">Tindakan pengelola</p><h2>Koreksi nilai tersedia</h2><p>Post-Test, Remedial 1, dan Remedial 2 sudah tidak lulus. Gunakan hanya bila ada kendala jaringan atau waktu. Perubahan mengganti nilai Remedial 2 dan dicatat di audit log.</p></div><label>Nilai akhir<input type="number" min="0" max="100" step="0.01" value={adjustedScore} onChange={(event) => setAdjustedScore(event.target.value)} /></label><button className="button" onClick={() => void saveAdjustedScore()}>Simpan koreksi nilai</button></section>}
    <section className="attempt-details">{visibleAttempts.map((attempt) => <article className="panel" key={attempt.id}><header><div><p className="section-label">{attempt.stage.replace("_", " ")}</p><h2>{attempt.status}</h2></div><strong className="attempt-score">{attempt.score ?? "—"}</strong></header><p>{attempt.correct_count ?? 0} benar · {attempt.wrong_count ?? 0} salah</p>{attempt.status !== "RESET" && (confirmReset === attempt.id ? <div className="reset-confirm"><p>Reset attempt ini agar peserta dapat mengulang?</p><button className="button button--secondary" onClick={() => setConfirmReset(null)}>Batal</button><button className="button danger-button" onClick={() => void resetAttempt(attempt.id)}>Reset attempt</button></div> : <button className="text-button is-danger" onClick={() => setConfirmReset(attempt.id)}>Reset attempt</button>)}
      <div className="answer-detail-list">{(answerGroups.get(attempt.id) ?? []).map((answer) => <div className={answer.is_correct === 1 ? "is-correct" : "is-wrong"} key={answer.question_id}><strong>{answer.display_position}. {answer.question_text}</strong><span>Jawaban peserta: {optionText(answer, answer.selected_original_option_key)}</span><span>Jawaban benar: {optionText(answer, answer.correct_option_key)}</span></div>)}</div></article>)}</section>
  </>;
}
