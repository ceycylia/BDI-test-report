import type { AttemptStage } from "../../../worker/domain/attempts/progression";
import { participantTestStatus, type EntryAttempt } from "./test-entry-status";

export type DashboardTest = {
  sessionId: string; slug: string; materialName: string; participantId: string; batchId: string;
  questionCount: number; durationMinutes: number; passingScore: number;
  attempts: EntryAttempt[]; preOpen: boolean; postOpen: boolean;
  postMode: "MANUAL" | "SCHEDULED"; postStartAt: string | null;
};

export type DashboardStageCard = {
  stage: AttemptStage;
  state: "ready" | "upcoming" | "done" | "remedial";
  label: "Harus dikerjakan" | "Akan datang" | "Sudah dikerjakan" | "Remedial";
};

const stages: AttemptStage[] = ["PRE", "POST", "REMEDIAL_1", "REMEDIAL_2"];

export function dashboardStageCards(test: DashboardTest): DashboardStageCard[] {
  const current = participantTestStatus(test);
  const completed = new Set(test.attempts.filter((attempt) => attempt.status === "SUBMITTED").map((attempt) => attempt.stage));
  const cards: DashboardStageCard[] = [];
  for (const stage of stages) {
    if (completed.has(stage)) {
      cards.push({ stage, state: "done", label: "Sudah dikerjakan" });
      continue;
    }
    if (current.stage !== stage && !(stage === "PRE" && current.kind === "PRE_NOT_OPEN")) continue;
    const available = ["PRE_START", "PRE_CONTINUE", "STAGE_START", "STAGE_CONTINUE"].includes(current.kind);
    const remedial = stage === "REMEDIAL_1" || stage === "REMEDIAL_2";
    cards.push(available
      ? { stage, state: remedial ? "remedial" : "ready", label: remedial ? "Remedial" : "Harus dikerjakan" }
      : { stage, state: "upcoming", label: "Akan datang" });
  }
  return cards;
}
