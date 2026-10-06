import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchableOption = { value: string; label: string };

type SearchableSelectProps = {
  options: SearchableOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
  emptyText?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  allowCustomValue?: boolean;
};

export function SearchableSelect({
  options,
  value,
  defaultValue = "",
  onValueChange,
  name,
  placeholder = "Ketik atau pilih",
  emptyText = "Tidak ada pilihan yang cocok.",
  required = false,
  disabled = false,
  autoFocus = false,
  allowCustomValue = false,
}: SearchableSelectProps) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = controlled ? value : internalValue;
  const selected = options.find((option) => option.value === selectedValue);
  const selectedLabel = selected?.label ?? "";
  const [query, setQuery] = useState(allowCustomValue ? selectedValue : selectedLabel);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (open && document.activeElement === inputRef.current) return;
    setQuery(allowCustomValue ? selectedValue : selectedLabel);
  }, [allowCustomValue, open, selectedLabel, selectedValue]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(
      required && !selectedValue ? "Pilih salah satu pilihan dari daftar." : ""
    );
  }, [required, selectedValue]);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form || controlled) return;

    function handleReset() {
      setInternalValue(defaultValue);
      const defaultLabel = options.find((option) => option.value === defaultValue)?.label ?? "";
      setQuery(allowCustomValue ? defaultValue : defaultLabel);
      setOpen(false);
    }

    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [allowCustomValue, controlled, defaultValue, options]);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("id");
    if (!needle || selectedLabel === query) return options;
    return options.filter((option) => option.label.toLocaleLowerCase("id").includes(needle));
  }, [options, query, selectedLabel]);

  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      return;
    }
    const selectedIndex = filtered.findIndex((option) => option.value === selectedValue);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : filtered.length ? 0 : -1);
  }, [filtered, open, selectedValue]);

  useEffect(() => {
    if (activeIndex < 0 || !menuRef.current) return;
    const option = menuRef.current.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`);
    if (!option) return;
    const optionTop = option.offsetTop;
    const optionBottom = optionTop + option.offsetHeight;
    const visibleTop = menuRef.current.scrollTop;
    const visibleBottom = visibleTop + menuRef.current.clientHeight;
    if (optionTop < visibleTop) menuRef.current.scrollTop = optionTop;
    if (optionBottom > visibleBottom) menuRef.current.scrollTop = optionBottom - menuRef.current.clientHeight;
  }, [activeIndex]);

  function commit(nextValue: string) {
    if (!controlled) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  }

  function choose(option: SearchableOption) {
    commit(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  return <div ref={rootRef} className={`searchable-select${disabled ? " is-disabled" : ""}`}>
    <input
      ref={inputRef}
      type="text"
      role="combobox"
      aria-autocomplete="list"
      aria-controls={listId}
      aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
      aria-expanded={open}
      autoComplete="off"
      autoFocus={autoFocus}
      disabled={disabled}
      required={required}
      value={query}
      placeholder={placeholder}
      onFocus={(event) => { setOpen(true); event.currentTarget.select(); }}
      onClick={() => setOpen(true)}
      onChange={(event) => {
        const nextQuery = event.target.value;
        setQuery(nextQuery);
        commit(allowCustomValue ? nextQuery : "");
        setOpen(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          setQuery(allowCustomValue ? selectedValue : selectedLabel);
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setOpen(true);
          const direction = event.key === "ArrowDown" ? 1 : -1;
          setActiveIndex((current) => {
            if (!filtered.length) return -1;
            if (current < 0) return direction > 0 ? 0 : filtered.length - 1;
            return (current + direction + filtered.length) % filtered.length;
          });
          return;
        }
        if (event.key === "Enter" && open && activeIndex >= 0) {
          event.preventDefault();
          choose(filtered[activeIndex]!);
        }
      }}
      onBlur={() => {
        setOpen(false);
        if (!allowCustomValue) setQuery(selectedLabel);
      }}
    />
    {query && !disabled && <button
      type="button"
      className="searchable-select__clear"
      aria-label="Hapus pilihan"
      title="Hapus pilihan"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        setQuery("");
        commit("");
        setOpen(true);
        inputRef.current?.focus();
      }}
    ><X aria-hidden="true" /></button>}
    <ChevronDown className={`searchable-select__chevron${open ? " is-open" : ""}`} aria-hidden="true" />
    {name && <input type="hidden" name={name} value={selectedValue} />}
    {open && !disabled && <div ref={menuRef} className="searchable-select__menu" id={listId} role="listbox">
      {filtered.map((option, index) => <button
        type="button"
        role="option"
        id={`${listId}-option-${index}`}
        data-option-index={index}
        aria-selected={option.value === selectedValue}
        className={`searchable-select__option${option.value === selectedValue ? " is-selected" : ""}${index === activeIndex ? " is-active" : ""}`}
        key={option.value}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(option)}
      ><span>{option.label}</span>{option.value === selectedValue && <Check aria-hidden="true" />}</button>)}
      {!filtered.length && <p className="searchable-select__empty">{emptyText}</p>}
    </div>}
  </div>;
}
