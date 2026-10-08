export type AttemptStage = "PRE" | "POST" | "REMEDIAL_1" | "REMEDIAL_2" | "REMEDIAL_3";

export type AttemptProgress = { stage: AttemptStage; status: string; score: number | null };

const POST_STAGES: AttemptStage[] = ["POST", "REMEDIAL_1", "REMEDIAL_2"];

export function nextPostStage(attempts: readonly AttemptProgress[], passingScore: number): AttemptStage | null {
  const current = POST_STAGES.map((stage) => attempts.find((attempt) => attempt.stage === stage));
  const inProgress = current.find((attempt) => attempt?.status === "IN_PROGRESS");
  if (inProgress) return inProgress.stage;
  const passed = current.some((attempt) => attempt?.status === "SUBMITTED" && (attempt.score ?? -1) >= passingScore);
  if (passed) return null;
  for (let index = 0; index < POST_STAGES.length; index += 1) {
    const attempt = current[index];
    if (!attempt) return POST_STAGES[index] ?? null;
    if (attempt.status !== "SUBMITTED") return null;
  }
  return null;
}

export function attemptNumberForStage(stage: AttemptStage): number {
  return { PRE: 1, POST: 1, REMEDIAL_1: 2, REMEDIAL_2: 3, REMEDIAL_3: 4 }[stage];
}
