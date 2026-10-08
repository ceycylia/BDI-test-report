export type GeneratedCohort = {
  clientId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "INACTIVE" | "COMPLETED";
};

type GenerateCohortsInput = {
  startNumber: number;
  count: number;
  firstStartDate: string;
  durationDays: number;
};

function parseDate(value: string) {
  const [year = 1970, month = 1, day = 1] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function generateCohorts(input: GenerateCohortsInput): GeneratedCohort[] {
  return Array.from({ length: input.count }, (_, index) => {
    const startDate = addDays(input.firstStartDate, index * input.durationDays);
    return {
      clientId: crypto.randomUUID(),
      name: `Angkatan ${input.startNumber + index}`,
      startDate,
      endDate: addDays(startDate, input.durationDays - 1),
      status: "ACTIVE",
    };
  });
}

export { formatDateForDisplay as formatCohortDate } from "../dates/date-format";
