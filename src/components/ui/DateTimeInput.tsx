import { useEffect, useState } from "react";
import { formatDateForDisplay, parseDisplayDateTime } from "../../features/dates/date-format";
import { DateInput } from "./DateInput";

export function DateTimeInput({ value, onValueChange, required, "aria-label": ariaLabel }: { value: string; onValueChange: (value: string) => void; required?: boolean; "aria-label"?: string }) {
  const initial = parseDisplayDateTime(value);
  const [date, setDate] = useState(initial?.date ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  useEffect(() => { const next = parseDisplayDateTime(value); setDate(next?.date ?? ""); setTime(next?.time ?? ""); }, [value]);
  const update = (nextDate: string, nextTime: string) => { if (nextDate && nextTime) onValueChange(`${formatDateForDisplay(nextDate)} ${nextTime}`); };
  return <div className="date-time-picker"><DateInput value={date} required={required} aria-label={ariaLabel} onValueChange={(nextDate) => { setDate(nextDate); update(nextDate, time); }} /><input type="time" aria-label={`${ariaLabel ?? "Tanggal"} waktu`} value={time} required={required} onChange={(event) => { setTime(event.target.value); update(date, event.target.value); }} /></div>;
}
