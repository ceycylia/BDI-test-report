import { Search, X } from "lucide-react";
import type { InputHTMLAttributes } from "react";

type SearchInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "type" | "value"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function SearchInput({
  value,
  onValueChange,
  className = "",
  ...inputProps
}: SearchInputProps) {
  return <span className={`search-input${className ? ` ${className}` : ""}`}>
    <Search className="search-input__icon" aria-hidden="true" />
    <input
      {...inputProps}
      type="text"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    />
    {value && <button
      type="button"
      className="search-input__clear"
      aria-label="Hapus pencarian"
      title="Hapus pencarian"
      onClick={() => onValueChange("")}
    >
      <X aria-hidden="true" />
    </button>}
  </span>;
}
