const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

type TimeInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
  "aria-label"?: string;
};

export function TimeInput({ value, onValueChange, required, "aria-label": ariaLabel = "Waktu" }: TimeInputProps) {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(value);
  const [hour = "", minute = ""] = match ? value.split(":") : [];
  const update = (nextHour: string, nextMinute: string) => {
    onValueChange(nextHour && nextMinute ? `${nextHour}:${nextMinute}` : "");
  };

  return <div className="time-picker-24" aria-label={`${ariaLabel}, format 24 jam`}>
    <select aria-label={`${ariaLabel}, jam`} required={required} value={hour} onChange={(event) => update(event.target.value, minute)}>
      <option value="">Jam</option>
      {HOURS.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
    <span aria-hidden="true">:</span>
    <select aria-label={`${ariaLabel}, menit`} required={required} value={minute} onChange={(event) => update(hour, event.target.value)}>
      <option value="">Menit</option>
      {MINUTES.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  </div>;
}
