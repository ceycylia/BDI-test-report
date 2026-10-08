import { Clock3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const VALID_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

type TimeInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
  "aria-label"?: string;
};

function cleanTimeInput(value: string) {
  const clean = value.replace(/[^\d:]/gu, "").slice(0, 5);
  if (!clean.includes(":")) {
    const digits = clean.slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
  }
  const [hour = "", minute = ""] = clean.split(":");
  return `${hour.slice(0, 2)}:${minute.slice(0, 2)}`;
}

export function TimeInput({ value, onValueChange, required, "aria-label": ariaLabel = "Waktu" }: TimeInputProps) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState(() => VALID_TIME.test(value) ? value.slice(0, 2) : "");
  const [position, setPosition] = useState({ top: 0, left: 12 });
  const controlRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(value);
    if (VALID_TIME.test(value)) setSelectedHour(value.slice(0, 2));
    else if (!value) setSelectedHour("");
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = controlRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(340, window.innerWidth - 24);
      const panelHeight = 330;
      const top = rect.bottom + panelHeight + 8 <= window.innerHeight
        ? rect.bottom + 8
        : Math.max(12, rect.top - panelHeight - 8);
      setPosition({ top, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) });
    };
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!controlRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  function updateDraft(nextValue: string) {
    const next = cleanTimeInput(nextValue);
    setDraft(next);
    if (VALID_TIME.test(next)) {
      setSelectedHour(next.slice(0, 2));
      onValueChange(next);
    } else {
      onValueChange("");
    }
  }

  function chooseMinute(minute: string) {
    if (!selectedHour) return;
    const next = `${selectedHour}:${minute}`;
    setDraft(next);
    onValueChange(next);
    setOpen(false);
  }

  const selectedMinute = VALID_TIME.test(draft) ? draft.slice(3, 5) : "";
  const popover = open ? createPortal(
    <div ref={popoverRef} className="time-picker-popover" style={{ top: position.top, left: position.left }} role="dialog" aria-label={`Pilih ${ariaLabel.toLocaleLowerCase("id")}`}>
      <div className="time-picker-popover__heading"><strong>Pilih waktu</strong><span>Format 24 jam</span></div>
      <div className="time-picker-popover__body">
        <section>
          <span>Jam</span>
          <div className="time-picker-popover__hours">
            {HOURS.map((hour) => <button key={hour} type="button" className={hour === selectedHour ? "is-selected" : ""} onClick={() => {
              setSelectedHour(hour);
              const minute = VALID_TIME.test(draft) ? draft.slice(3, 5) : "";
              setDraft(minute ? `${hour}:${minute}` : `${hour}:`);
              if (minute) onValueChange(`${hour}:${minute}`);
            }}>{hour}</button>)}
          </div>
        </section>
        <section>
          <span>Menit</span>
          <div className="time-picker-popover__minutes">
            {MINUTES.map((minute) => <button key={minute} type="button" className={minute === selectedMinute ? "is-selected" : ""} disabled={!selectedHour} onClick={() => chooseMinute(minute)}>{minute}</button>)}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  ) : null;

  return <div ref={controlRef} className="time-picker-24">
    <input type="text" inputMode="numeric" autoComplete="off" placeholder="HH:mm" maxLength={5} pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" required={required} aria-label={`${ariaLabel}, format 24 jam`} value={draft} onFocus={() => { focusedRef.current = true; }} onBlur={() => {
      focusedRef.current = false;
      if (!VALID_TIME.test(draft)) { setDraft(""); onValueChange(""); }
    }} onChange={(event) => updateDraft(event.target.value)} />
    <button type="button" className="time-picker-24__trigger" aria-label={`Buka pilihan ${ariaLabel.toLocaleLowerCase("id")}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((visible) => !visible)}><Clock3 aria-hidden="true" /></button>
    {popover}
  </div>;
}
