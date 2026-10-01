const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function dateFromIso(value: string) {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day) ? date : null;
}

export function formatDateForDisplay(value: string | null | undefined) {
  if (!value) return "—";
  const date = dateFromIso(value);
  if (!date) return value;
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

export function parseDisplayDate(value: string) {
  const match = DISPLAY_DATE.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  return dateFromIso(iso) ? iso : null;
}

export function formatDateForApi(value: string) {
  return parseDisplayDate(value) ?? (dateFromIso(value) ? value : null);
}

export function formatDateTimeForDisplay(value: string | null | undefined) {
  if (!value) return "—";
  if (/^\d{2}\/\d{2}\/\d{4}\s(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
  const normalized = value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date)} ${new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date)}`;
}

export function parseDisplayDateTime(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})\s([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year, timeHour, timeMinute] = match;
  const date = parseDisplayDate(`${day}/${month}/${year}`);
  return date ? { date, time: `${timeHour}:${timeMinute}` } : null;
}

export function formatDateTimeForApi(value: string) {
  const parsed = parseDisplayDateTime(value);
  if (!parsed) return null;
  const [year, month, day] = parsed.date.split("-");
  const [hour, minute] = parsed.time.split(":");
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day) ? date.toISOString() : null;
}
