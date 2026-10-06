import { describe, expect, it } from "vitest";
import { getTestScheduleStatus } from "../worker/domain/scheduling/test-availability";

const now = new Date("2026-10-06T05:00:00.000Z");

describe("test schedule status", () => {
  it("keeps a session without generated packages in not-open state", () => {
    expect(getTestScheduleStatus("DRAFT", [{
      mode: "MANUAL",
      manualOpen: true,
      startAt: null,
      endAt: null,
    }], now)).toBe("NOT_OPEN");
  });

  it("uses the current scheduled window for an active session", () => {
    expect(getTestScheduleStatus("ACTIVE", [{
      mode: "SCHEDULED",
      manualOpen: false,
      startAt: "2026-10-06T04:00:00.000Z",
      endAt: "2026-10-06T06:00:00.000Z",
    }], now)).toBe("ONGOING");
  });

  it("reports not open while a later test stage is still scheduled", () => {
    expect(getTestScheduleStatus("ACTIVE", [
      {
        mode: "SCHEDULED",
        manualOpen: false,
        startAt: "2026-10-06T01:00:00.000Z",
        endAt: "2026-10-06T02:00:00.000Z",
      },
      {
        mode: "SCHEDULED",
        manualOpen: false,
        startAt: "2026-10-06T07:00:00.000Z",
        endAt: "2026-10-06T08:00:00.000Z",
      },
    ], now)).toBe("NOT_OPEN");
  });

  it("reports finished after every stage is closed", () => {
    expect(getTestScheduleStatus("ACTIVE", [
      {
        mode: "SCHEDULED",
        manualOpen: false,
        startAt: "2026-10-06T01:00:00.000Z",
        endAt: "2026-10-06T02:00:00.000Z",
      },
      { mode: "MANUAL", manualOpen: false, startAt: null, endAt: null },
    ], now)).toBe("FINISHED");
  });
});
