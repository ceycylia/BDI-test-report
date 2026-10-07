import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ModalPortal } from "../../components/ui/ModalPortal";
import { PublicLayout } from "../../layouts/PublicLayout";

type Question = { id: string; text: string; type: "SINGLE_CHOICE" | "SCALE" | "LONG_TEXT"; required: boolean; helperText: string | null; scaleMin: number | null; scaleMax: number | null; scaleMinLabel: string | null; scaleMaxLabel: string | null; options: Array<{ id: string; label: string; allowsOtherText: boolean }> };
type Template = { id: string; name: string; description: string | null; sections: Array<{ id: string; code: string; title: string; description: string | null; questions: Question[] }> };
type Answer = { questionId: string; optionId?: string | null; otherText?: string | null; numericValue?: number | null; textValue?: string | null };
type FormPayload = { submitted: boolean; submittedAt: string | null; participant: { name: string; cohortName: string }; evaluation: { trainingName: string; template: Template }; answers: Answer[] };

async function publicJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { Accept: "application/json", "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json().catch(() => ({})) as T & { error?: { message?: string; code?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "Permintaan tidak dapat diproses.");
  return payload;
}

export function EvaluationParticipantPage() {
  const { slug = "" } = useParams();
  const storageKey = `bdi-evaluation-response:${slug}`;
  const [entry, setEntry] = useState<{ name: string; trainingName: string; cohortNames: string[]; open: boolean } | null>(null);
  const [form, setForm] = useState<FormPayload | null>(null);
  const [responseId, setResponseId] = useState(() => localStorage.getItem(storageKey) ?? "");
  const [name, setName] = useState("");
  const [nik, setNik] = useState("");
  const [needsNik, setNeedsNik] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questionRefs = useRef<Record<string, HTMLElement | null>>({});
  const draftSaveRef = useRef<Promise<unknown> | null>(null);

  async function loadForm(id: string) {
    const payload = await publicJson<FormPayload>(`/api/public/evaluations/${slug}/responses/${id}`);
    setForm(payload); setAlreadySubmitted(payload.submitted);
    setAnswers(Object.fromEntries(payload.answers.map((answer) => [answer.questionId, answer])));
    setReady(!payload.submitted);
  }

  useEffect(() => {
    setError(null);
    void publicJson<{ evaluation: { name: string; trainingName: string; cohortNames: string[]; open: boolean } }>(`/api/public/evaluations/${slug}`)
      .then((payload) => setEntry(payload.evaluation)).catch((reason) => setError(reason instanceof Error ? reason.message : "Evaluasi tidak dapat dimuat."));
    const stored = localStorage.getItem(storageKey);
    if (stored) void loadForm(stored).catch(() => { localStorage.removeItem(storageKey); setResponseId(""); });
  }, [slug, storageKey]);

  const answerList = useMemo(() => Object.values(answers), [answers]);
  useEffect(() => {
    if (!ready || !responseId || form?.submitted) return;
    setSaved(false);
    const timer = window.setTimeout(() => {
      setSaving(true);
      const request = publicJson(`/api/public/evaluations/${slug}/responses/${responseId}/draft`, { method: "PUT", body: JSON.stringify({ answers: answerList }) });
      draftSaveRef.current = request;
      void request
        .then(() => { setSaved(true); setError(null); })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Jawaban belum tersimpan."))
        .finally(() => { if (draftSaveRef.current === request) draftSaveRef.current = null; setSaving(false); });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [answerList, form?.submitted, ready, responseId, slug]);

  async function identify(event: FormEvent) {
    event.preventDefault(); setError(null); setSubmitting(true);
    try {
      const result = await publicJson<{ verificationRequired?: boolean; alreadySubmitted?: boolean; responseId?: string; participant?: { name: string; cohortName: string } }>(`/api/public/evaluations/${slug}/identify`, { method: "POST", body: JSON.stringify({ name, ...(needsNik || nik ? { nik } : {}) }) });
      if (result.verificationRequired) { setNeedsNik(true); return; }
      if (result.alreadySubmitted) { setAlreadySubmitted(true); setForm(result.participant ? { submitted: true, submittedAt: null, participant: result.participant, evaluation: { trainingName: entry?.trainingName ?? "", template: { id: "", name: entry?.name ?? "Evaluasi", description: null, sections: [] } }, answers: [] } : null); return; }
      if (result.responseId) { localStorage.setItem(storageKey, result.responseId); setResponseId(result.responseId); await loadForm(result.responseId); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Data peserta tidak dapat diperiksa."); }
    finally { setSubmitting(false); }
  }

  function updateAnswer(questionId: string, patch: Omit<Answer, "questionId">) {
    setAnswers((current) => ({ ...current, [questionId]: { questionId, ...current[questionId], ...patch } }));
  }

  function firstMissing() {
    if (!form) return null;
    for (const section of form.evaluation.template.sections) for (const question of section.questions) {
      if (!question.required) continue;
      const answer = answers[question.id];
      const missing = !answer || (question.type === "SCALE" && answer.numericValue == null) || (question.type === "SINGLE_CHOICE" && !answer.optionId) || (question.type === "LONG_TEXT" && !answer.textValue?.trim()) || (question.type === "SINGLE_CHOICE" && question.options.find((option) => option.id === answer.optionId)?.allowsOtherText && !answer.otherText?.trim());
      if (missing) return question.id;
    }
    return null;
  }

  function requestSubmit() {
    const missing = firstMissing();
    if (missing) { setError("Masih ada pertanyaan wajib yang belum dijawab."); questionRefs.current[missing]?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    setError(null); setConfirming(true);
  }

  async function submit() {
    setSubmitting(true); setReady(false); setError(null);
    try {
      await draftSaveRef.current?.catch(() => undefined);
      await publicJson(`/api/public/evaluations/${slug}/responses/${responseId}/submit`, { method: "POST", body: JSON.stringify({ answers: answerList }) });
      setConfirming(false); setAlreadySubmitted(true); setReady(false); setForm((current) => current ? { ...current, submitted: true } : current);
    } catch (reason) { setReady(true); setConfirming(false); setError(reason instanceof Error ? reason.message : "Evaluasi tidak dapat dikirim."); }
    finally { setSubmitting(false); }
  }

  return <PublicLayout><section className="evaluation-public-shell">
    {form && !form.submitted && <Link className="participant-home-back" to="/">← Kembali</Link>}
    {!entry && !error && <section className="entry-card"><Link className="participant-home-back" to="/">← Kembali</Link><p>Memuat Evaluasi…</p></section>}
    {error && <p className="form-message is-error" role="alert">{error}</p>}
    {alreadySubmitted ? <section className="entry-card evaluation-complete"><Link className="participant-home-back" to="/">← Kembali</Link><p className="section-label">Evaluasi Pelatihan</p><h1>Terima kasih</h1><p>Evaluasi sudah pernah Anda isi.</p>{form?.participant && <strong>{form.participant.name} · {form.participant.cohortName}</strong>}</section> : entry && !form ? <section className="entry-card"><Link className="participant-home-back" to="/">← Kembali</Link><p className="section-label">Evaluasi Pelatihan</p><h1>{entry.name}</h1><p className="entry-card__lead">{entry.trainingName}<br />{entry.cohortNames.join(" & ")}</p>{!entry.open ? <p className="availability-note">Evaluasi belum dibuka atau sudah ditutup.</p> : <form className="participant-entry-form" onSubmit={(event) => void identify(event)}><label>Nama Lengkap<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={150} autoComplete="name" placeholder="Masukkan nama lengkap" /></label>{needsNik && <label>NIK<input value={nik} onChange={(event) => setNik(event.target.value.replace(/\D/gu, "").slice(0, 40))} required inputMode="numeric" autoComplete="off" placeholder="Masukkan NIK untuk verifikasi" /><small>Ditemukan lebih dari satu peserta dengan nama yang sama.</small></label>}<button className="button participant-primary-button" disabled={submitting}>{submitting ? "Memeriksa…" : "Masuk"}</button></form>}</section> : null}
    {form && !form.submitted && <><header className="evaluation-public-header"><p className="section-label">Evaluasi Penyelenggaraan Pelatihan</p><h1>{form.evaluation.template.name}</h1><p>{form.evaluation.trainingName}</p><dl><div><dt>Nama</dt><dd>{form.participant.name}</dd></div><div><dt>Angkatan</dt><dd>{form.participant.cohortName}</dd></div></dl>{form.evaluation.template.description && <p>{form.evaluation.template.description}</p>}<span className="evaluation-save-state">{saving ? "Menyimpan…" : saved ? "Jawaban tersimpan" : "Jawaban disimpan otomatis"}</span></header><main className="evaluation-questionnaire">{form.evaluation.template.sections.map((section) => <section className="evaluation-section" key={section.id}><header><span>{section.code}</span><div><h2>{section.code}. {section.title}</h2>{section.description && <p>{section.description}</p>}</div></header>{section.questions.map((question, index) => <article className="evaluation-question" key={question.id} ref={(node) => { questionRefs.current[question.id] = node; }}><h3><span>{index + 1}.</span> {question.text}{question.required && <sup>*</sup>}</h3>{question.helperText && <p className="muted">{question.helperText}</p>}{question.type === "SCALE" && <div className="evaluation-scale"><div className="evaluation-scale__labels"><span>{question.scaleMinLabel}</span><span>{question.scaleMaxLabel}</span></div><div className="evaluation-scale__options">{Array.from({ length: Number(question.scaleMax) - Number(question.scaleMin) + 1 }, (_, offset) => Number(question.scaleMin) + offset).map((value) => <label key={value}><input type="radio" name={question.id} checked={answers[question.id]?.numericValue === value} onChange={() => updateAnswer(question.id, { numericValue: value })} /><span>{value}</span></label>)}</div></div>}{question.type === "SINGLE_CHOICE" && <div className="evaluation-radio-list">{question.options.map((option) => <div key={option.id}><label><input type="radio" name={question.id} checked={answers[question.id]?.optionId === option.id} onChange={() => updateAnswer(question.id, { optionId: option.id, otherText: option.allowsOtherText ? answers[question.id]?.otherText ?? "" : null })} /><span>{option.label}</span></label>{option.allowsOtherText && answers[question.id]?.optionId === option.id && <input value={answers[question.id]?.otherText ?? ""} onChange={(event) => updateAnswer(question.id, { optionId: option.id, otherText: event.target.value })} placeholder="Tuliskan jawaban lainnya" />}</div>)}</div>}{question.type === "LONG_TEXT" && <textarea rows={5} value={answers[question.id]?.textValue ?? ""} onChange={(event) => updateAnswer(question.id, { textValue: event.target.value })} placeholder="Tuliskan komentar atau saran Anda" />}</article>)}</section>)}</main><section className="evaluation-submit"><div><strong>Pastikan seluruh jawaban sudah benar.</strong><span>Jawaban tidak dapat diubah setelah dikirim.</span></div><button className="button" disabled={submitting} onClick={requestSubmit}>Kirim Evaluasi</button></section></>}
    {confirming && <ModalPortal onClose={() => setConfirming(false)} blocked={submitting}><section className="participant-modal evaluation-submit-modal" role="dialog" aria-modal="true" aria-labelledby="submit-evaluation-title"><header className="participant-modal__header"><div><p className="section-label">Konfirmasi</p><h2 id="submit-evaluation-title">Kirim Evaluasi?</h2><p>Setelah dikirim, jawaban tidak dapat diubah.</p></div></header><footer className="participant-modal__actions"><button className="button button--secondary" disabled={submitting} onClick={() => setConfirming(false)}>Batal</button><button className="button" disabled={submitting} onClick={() => void submit()}>{submitting ? "Mengirim…" : "Kirim"}</button></footer></section></ModalPortal>}
  </section></PublicLayout>;
}
