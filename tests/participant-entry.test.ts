import { describe, expect, it } from "vitest";
import { cleanParticipantName, normalizeParticipantName } from "../worker/domain/participants/normalize-name";
import { isTestOpen } from "../worker/domain/scheduling/test-availability";

describe("identitas peserta", () => {
  it("mencocokkan nama tanpa membedakan kapital dan spasi berulang", () => {
    expect(normalizeParticipantName(" Siti   Aminah ")).toBe(normalizeParticipantName("siti aminah"));
    expect(cleanParticipantName(" Siti   Aminah ")).toBe("Siti Aminah");
  });
});

describe("jadwal tes dari server", () => {
  const now = new Date("2026-09-29T02:00:00.000Z");
  it("mengikuti kontrol manual", () => {
    expect(isTestOpen({ mode: "MANUAL", manualOpen: true, startAt: null, endAt: null }, now)).toBe(true);
    expect(isTestOpen({ mode: "MANUAL", manualOpen: false, startAt: null, endAt: null }, now)).toBe(false);
  });
  it("hanya membuka jadwal di dalam rentang server", () => {
    const schedule = { mode: "SCHEDULED" as const, manualOpen: false, startAt: "2026-09-29T01:00:00.000Z", endAt: "2026-09-29T03:00:00.000Z" };
    expect(isTestOpen(schedule, now)).toBe(true);
    expect(isTestOpen(schedule, new Date("2026-09-29T04:00:00.000Z"))).toBe(false);
  });
});
