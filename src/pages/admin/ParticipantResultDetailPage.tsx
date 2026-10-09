import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { adminMutation, adminQuery } from "../../features/admin-auth/admin-api";
import { useAutoDismiss } from "../../components/ui/useAutoDismiss";
import { ActiveYearIndicator, useActiveYear, withActiveYear } from "../../features/active-year/ActiveYearProvider";
import { isManualScoreWithoutAnswers } from "../../../worker/domain/attempts/admin-attempt-management";

type Participant = { id: string; name: string; batch_id: string; training_session_id: string; batch_name: string; training_name: string; material_name: string; passing_score: number };
type Attempt = { id: string; batch_id: string; training_session_id: string; stage: "PRE" | "POST" | "REMEDIAL_1" | "REMEDIAL_2" | "REMEDIAL_3"; status: string; score: number | null; correct_count: number | null; wrong_count: number | null; started_at: string; submitted_at: string | null };
type Answer = { attempt_id: string; question_id: string; display_position: number; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option_key: string; selected_original_option_key: string | null; is_correct: number | null };
type Detail = { participant: Participant; attempts: Attempt[]; answers: Answer[] };

function optionText(answer: Answer, key: string | null) {
  if (!key) return "Tidak dijawab";
  return ({ A: answer.option_a, B: answer.option_b, C: answer.option_c, D: answer.option_d } as Record<string, string>)[key] ?? "—";
}

export function ParticipantResultDetailPage() {
  const { participantId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { activeYear } = useActiveYear();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useAutoDismiss(message, setMessage);
  useAutoDismiss(error, setError);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const batchId = searchParams.get("batchId") ?? "";
  const trainingSessionId = searchParams.get("trainingSessionId") ?? "";
  const load = () => {
    const query = new URLSearchParams();
    if (batchId) query.set("batchId", batchId);
    if (trainingSessionId) query.set("trainingSessionId", trainingSessionId);
    return adminQuery<Detail>(withActiveYear(`/api/admin/results/participants/${participantId}?${query}`, activeYear)).then((data) => { setDetail(data); });
  };
  useEffect(() => { setDetail(null); void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Detail peserta tidak dapat dimuat.")); }, [activeYear, participantId, batchId, trainingSessionId]);
  const visibleAttempts = useMemo(() => detail?.attempts.filter((attempt) => attempt.stage !== "REMEDIAL_3") ?? [], [detail]);
  const answerGroups = useMemo(() => new Map(visibleAttempts.map((attempt) => [attempt.id, detail?.answers.filter((answer) => answer.attempt_id === attempt.id) ?? []])), [detail, visibleAttempts]);

  async function resetAttempt(attempt: Attempt) {
    setError(null); setMessage(null);
    try {
      await adminMutation(`/api/admin/results/participants/${detail!.participant.id}/attempts/${attempt.id}/reset`, {
        method: "POST",
        body: JSON.stringify({
          batchId: detail!.participant.batch_id,
          trainingSessionId: detail!.participant.training_session_id,
          reason: null,
        }),
      });
      await load();
      setMessage(attempt.stage === "POST"
        ? "Nilai Post-Test dan seluruh nilai remedial berhasil direset."
        : "Nilai attempt berhasil direset.");
      setConfirmReset(null);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Attempt gagal direset."); }
  }

  function resetConfirmation(attempt: Attempt) {
    if (attempt.stage === "PRE") return "Reset nilai Pre-Test? Nilai Pre-Test peserta pada mata diklat ini akan dihapus dan peserta dapat mengikuti Pre-Test kembali.";
    if (attempt.stage === "POST") return "Reset nilai Post-Test? Nilai Post-Test serta seluruh nilai remedial peserta pada mata diklat ini akan dihapus dan peserta dapat mengikuti Post-Test kembali.";
    const label = attempt.stage === "REMEDIAL_1" ? "Remedial 1" : "Remedial 2";
    return `Reset nilai ${label}? Nilai ${label} peserta pada mata diklat ini akan dihapus dan peserta dapat mengikuti tahap tersebut kembali.`;
  }

  if (error && !detail) return <p className="form-message is-error" role="alert">{error}</p>;
  if (!detail) return <p className="muted">Memuat detail…</p>;
  return <><header className="admin-page-header"><div><Link className="back-link" to="/admin/hasil">← Hasil</Link><h1>{detail.participant.name}</h1><p>{detail.participant.training_name} · {detail.participant.material_name} · {detail.participant.batch_name}</p><ActiveYearIndicator /></div></header>
    {error && <p className="form-message is-error" role="alert">{error}</p>}{message && <p className="form-message is-success">{message}</p>}
    <section className="attempt-details">{visibleAttempts.map((attempt) => {
      const answers = answerGroups.get(attempt.id) ?? [];
      const hasRecordedAnswers = answers.some((answer) => answer.selected_original_option_key !== null);
      const manuallyEnteredWithoutAnswers = isManualScoreWithoutAnswers({
        status: attempt.status,
        correctCount: attempt.correct_count,
        wrongCount: attempt.wrong_count,
      }, hasRecordedAnswers);
      return <article className="panel" key={attempt.id}><header><div><p className="section-label">{attempt.stage.replace("_", " ")}</p><h2>{attempt.status}</h2></div><strong className="attempt-score">{attempt.score ?? "—"}</strong></header>
        {manuallyEnteredWithoutAnswers ? <p>Nilai diinput panitia</p> : attempt.correct_count !== null || attempt.wrong_count !== null ? <p>{attempt.correct_count ?? 0} benar · {attempt.wrong_count ?? 0} salah</p> : null}
        {attempt.status !== "RESET" && (confirmReset === attempt.id ? <div className="reset-confirm"><p>{resetConfirmation(attempt)}</p><button className="button button--secondary" onClick={() => setConfirmReset(null)}>Batal</button><button className="button danger-button" onClick={() => void resetAttempt(attempt)}>Reset attempt</button></div> : <button className="text-button is-danger" onClick={() => setConfirmReset(attempt.id)}>Reset attempt</button>)}
        {hasRecordedAnswers && <div className="answer-detail-list">{answers.map((answer) => <div className={answer.is_correct === 1 ? "is-correct" : "is-wrong"} key={answer.question_id}><strong>{answer.display_position}. {answer.question_text}</strong><span>Jawaban peserta: {optionText(answer, answer.selected_original_option_key)}</span><span>Jawaban benar: {optionText(answer, answer.correct_option_key)}</span></div>)}</div>}
      </article>;
    })}</section>
  </>;
}
