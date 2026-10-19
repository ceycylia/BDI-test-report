import { nextPostStage, type AttemptStage } from "../../../worker/domain/attempts/progression";

export type EntryAttempt = {
  stage: AttemptStage;
  status: string;
  score: number | null;
};

export type ParticipantTestStatus = {
  kind:
    | "PRE_START"
    | "PRE_CONTINUE"
    | "PRE_NOT_OPEN"
    | "POST_SCHEDULED"
    | "POST_NOT_OPEN"
    | "STAGE_START"
    | "STAGE_CONTINUE"
    | "PASSED"
    | "FAILED";
  stage: AttemptStage | null;
};

const POST_STAGES: AttemptStage[] = ["POST", "REMEDIAL_1", "REMEDIAL_2"];

export function participantTestStatus(input: {
  attempts: readonly EntryAttempt[];
  passingScore: number;
  preOpen: boolean;
  postOpen: boolean;
  postMode: "MANUAL" | "SCHEDULED";
  postStartAt: string | null;
  now?: Date;
}): ParticipantTestStatus {
  const pre = input.attempts.find((attempt) => attempt.stage === "PRE");
  if (!pre) {
    return input.preOpen
      ? { kind: "PRE_START", stage: "PRE" }
      : { kind: "PRE_NOT_OPEN", stage: null };
  }
  if (pre.status === "IN_PROGRESS") return { kind: "PRE_CONTINUE", stage: "PRE" };
  if (pre.status !== "SUBMITTED") return { kind: "PRE_NOT_OPEN", stage: null };

  const postAttempts = input.attempts.filter((attempt) => POST_STAGES.includes(attempt.stage));
  const passed = postAttempts.some(
    (attempt) => attempt.status === "SUBMITTED" && (attempt.score ?? -1) >= input.passingScore,
  );
  if (passed) return { kind: "PASSED", stage: null };

  const stage = nextPostStage(postAttempts, input.passingScore);
  if (!stage) return { kind: "FAILED", stage: null };
  const current = postAttempts.find((attempt) => attempt.stage === stage);
  if (current?.status === "IN_PROGRESS") return { kind: "STAGE_CONTINUE", stage };
  if (input.postOpen) return { kind: "STAGE_START", stage };

  const startsAt = input.postStartAt ? Date.parse(input.postStartAt) : Number.NaN;
  const now = (input.now ?? new Date()).getTime();
  if (stage === "POST" && input.postMode === "SCHEDULED" && Number.isFinite(startsAt) && now < startsAt) {
    return { kind: "POST_SCHEDULED", stage };
  }
  return { kind: "POST_NOT_OPEN", stage };
}
