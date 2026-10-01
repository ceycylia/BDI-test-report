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
