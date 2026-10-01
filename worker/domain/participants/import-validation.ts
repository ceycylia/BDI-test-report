import { normalizeNik } from "./normalize-nik";

export function parseImportedNik(value: unknown): { nik: string; error?: string } {
  if (typeof value === "number") {
    return { nik: String(value), error: "NIK harus diformat sebagai Teks di Excel" };
  }
  const raw = String(value ?? "").replace(/^'/u, "").trim();
  if (/^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/iu.test(raw)) {
    return { nik: raw, error: "NIK terbaca sebagai notasi ilmiah; ubah format sel menjadi Teks" };
  }
  if (raw && !/^\d+$/u.test(raw)) {
    return { nik: normalizeNik(raw), error: "NIK hanya boleh berisi angka" };
  }
  return { nik: normalizeNik(raw) };
}

export function duplicateNiks(values: string[], existing: Iterable<string> = []): Set<string> {
  const seen = new Set([...existing].map(normalizeNik));
  const duplicates = new Set<string>();
  for (const value of values) {
    const nik = normalizeNik(value);
    if (nik && seen.has(nik)) duplicates.add(nik);
    seen.add(nik);
  }
  return duplicates;
}
