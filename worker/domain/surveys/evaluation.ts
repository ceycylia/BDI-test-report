export type EvaluationMode = "MANUAL" | "SCHEDULED";
export type EvaluationStatus = "NOT_OPEN" | "OPEN" | "FINISHED";

export type EvaluationSchedule = {
  mode: EvaluationMode;
  manualOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  openedManuallyAt?: string | null;
  closedAt?: string | null;
};

export function evaluationStatus(
  schedule: EvaluationSchedule,
  timestamp = Date.now(),
): EvaluationStatus {
  if (schedule.mode === "MANUAL") {
    if (schedule.manualOpen) return "OPEN";
    return schedule.openedManuallyAt || schedule.closedAt ? "FINISHED" : "NOT_OPEN";
  }

  const opensAt = Date.parse(schedule.opensAt ?? "");
  const closesAt = Date.parse(schedule.closesAt ?? "");
  if (!Number.isFinite(opensAt) || !Number.isFinite(closesAt)) return "NOT_OPEN";
  if (timestamp < opensAt) return "NOT_OPEN";
  if (timestamp <= closesAt) return "OPEN";
  return "FINISHED";
}

export function isEvaluationOpen(schedule: EvaluationSchedule, timestamp = Date.now()) {
  return evaluationStatus(schedule, timestamp) === "OPEN";
}

export function indicatorPercentage(totalScore: number, responseCount: number, scaleMax: number) {
  if (responseCount <= 0 || scaleMax <= 0) return null;
  return (totalScore / (responseCount * scaleMax)) * 100;
}

export function sectionPercentage(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((total, value) => total + value, 0) / valid.length;
}
