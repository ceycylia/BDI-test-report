export type ScheduleInput = {
  mode: "MANUAL" | "SCHEDULED";
  manualOpen: boolean;
  startAt: string | null;
  endAt: string | null;
};

export function isTestOpen(schedule: ScheduleInput, now = new Date()): boolean {
  if (schedule.mode === "MANUAL") return schedule.manualOpen;
  if (!schedule.startAt || !schedule.endAt) return false;
  const timestamp = now.getTime();
  return timestamp >= Date.parse(schedule.startAt) && timestamp <= Date.parse(schedule.endAt);
}

export type TestScheduleStatus = "NOT_OPEN" | "ONGOING" | "FINISHED";

function schedulePhase(schedule: ScheduleInput, now: number): "FUTURE" | "OPEN" | "CLOSED" {
  if (schedule.mode === "MANUAL") return schedule.manualOpen ? "OPEN" : "CLOSED";
  const start = Date.parse(schedule.startAt ?? "");
  const end = Date.parse(schedule.endAt ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "CLOSED";
  if (now < start) return "FUTURE";
  return now <= end ? "OPEN" : "CLOSED";
}

export function getTestScheduleStatus(
  internalStatus: "DRAFT" | "ACTIVE" | "COMPLETED",
  schedules: ScheduleInput[],
  now = new Date(),
): TestScheduleStatus {
  if (internalStatus === "DRAFT") return "NOT_OPEN";
  if (internalStatus === "COMPLETED") return "FINISHED";
  const phases = schedules.map((schedule) => schedulePhase(schedule, now.getTime()));
  if (phases.includes("OPEN")) return "ONGOING";
  if (phases.includes("FUTURE")) return "NOT_OPEN";
  return "FINISHED";
}
