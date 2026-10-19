import type { AttemptStage } from "./progression";

export type AdminAttemptSummary = {
  stage: string;
  status: string;
  score: string | number | null;
};

export type ManualScoreStage = "PRE" | "POST" | "REMEDIAL_1" | "REMEDIAL_2";

export type ManualScoreField = {
  stage: ManualScoreStage;
  label: string;
  score: number | null;
};

const labels: Record<ManualScoreStage, string> = {
  PRE: "Nilai Pre-Test",
  POST: "Nilai Post-Test",
  REMEDIAL_1: "Nilai Remedial 1",
  REMEDIAL_2: "Nilai Remedial 2",
};

export function manualScoreFields(attempts: AdminAttemptSummary[]): ManualScoreField[] {
  const currentByStage = new Map<string, AdminAttemptSummary>();
  for (const attempt of attempts) {
    if (attempt.status !== "RESET") currentByStage.set(attempt.stage, attempt);
  }

  const field = (stage: ManualScoreStage): ManualScoreField => {
    const attempt = currentByStage.get(stage);
    return {
      stage,
      label: labels[stage],
      score: attempt?.status === "SUBMITTED" && typeof attempt.score === "number"
        ? attempt.score
        : null,
    };
  };

  const stages: ManualScoreStage[] = ["PRE", "POST"];
  if (currentByStage.has("REMEDIAL_1")) stages.push("REMEDIAL_1");
  if (currentByStage.has("REMEDIAL_2")) stages.push("REMEDIAL_2");
  return stages.map(field);
}

export function resetStagesForAttempt(stage: AttemptStage): AttemptStage[] {
  return stage === "POST" ? ["POST", "REMEDIAL_1", "REMEDIAL_2"] : [stage];
}

export function isManualScoreWithoutAnswers(
  attempt: { status: string; correctCount: number | null; wrongCount: number | null },
  hasRecordedAnswers: boolean,
) {
  return attempt.status === "SUBMITTED"
    && !hasRecordedAnswers
    && attempt.correctCount === null
    && attempt.wrongCount === null;
}
