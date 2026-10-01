const baseUrl = process.env.BDI_BASE_URL ?? "http://127.0.0.1:5173";
const slug = process.env.BDI_TRAINING_SLUG ?? "forklift-uji-2026";
const concurrency = Number(process.argv[2] ?? process.env.BDI_CONCURRENCY ?? 50);
const maxParallel = Number(process.argv[3] ?? process.env.BDI_MAX_PARALLEL ?? 10);
const runId = Date.now().toString(36);
const headers = { Accept: "application/json", "Content-Type": "application/json", Origin: baseUrl };

async function json(path, init) {
  const response = await fetch(`${baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(300_000), headers: { ...headers, ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${body.error?.code ?? "ERROR"}: ${body.error?.message ?? ""}`);
  return body;
}

const entry = await json(`/api/public/training/${slug}`);
if (!entry.training.preOpen) throw new Error("Pre-Test harus dibuka sebelum load test.");

const startedAt = Date.now();
async function runParticipant(index) {
  const batch = entry.batches[index % entry.batches.length];
  const identity = await json(`/api/public/training/${slug}/identify`, {
    method: "POST", body: JSON.stringify({ name: `Peserta Beban ${runId} ${String(index + 1).padStart(3, "0")}`, batchId: batch.id }),
  });
  const started = await json(`/api/public/training/${slug}/attempts/start`, {
    method: "POST", body: JSON.stringify({ participantId: identity.participant.id, batchId: batch.id, stage: "PRE" }),
  });
  const attempt = await json(`/api/public/training/${slug}/attempts/${started.attempt.id}?participantId=${identity.participant.id}`);
  const answers = Object.fromEntries(attempt.questions.map((question) => [question.id, question.options[0].originalKey]));
  await json(`/api/public/training/${slug}/attempts/${attempt.attempt.id}/draft`, {
    method: "PUT", body: JSON.stringify({ participantId: identity.participant.id, revision: 1, answers }),
  });
  const submitted = await json(`/api/public/training/${slug}/attempts/${attempt.attempt.id}/submit`, {
    method: "POST", body: JSON.stringify({ participantId: identity.participant.id, mode: "NORMAL", answers }),
  });
  const duplicate = await json(`/api/public/training/${slug}/attempts/${attempt.attempt.id}/submit`, {
    method: "POST", body: JSON.stringify({ participantId: identity.participant.id, mode: "NORMAL", answers }),
  });
  if (submitted.attempt.status !== "SUBMITTED" || duplicate.attempt.score !== submitted.attempt.score) throw new Error(`Submit tidak idempoten untuk peserta ${index + 1}.`);
  return submitted.attempt.score;
}

const results = Array(concurrency);
let nextIndex = 0;
async function runWorker() {
  while (nextIndex < concurrency) {
    const index = nextIndex; nextIndex += 1;
    results[index] = await runParticipant(index);
  }
}
await Promise.all(Array.from({ length: Math.min(maxParallel, concurrency) }, () => runWorker()));

console.log(JSON.stringify({ participants: concurrency, maxParallel, completed: results.length, durationMs: Date.now() - startedAt, minScore: Math.min(...results), maxScore: Math.max(...results) }));
