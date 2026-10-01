export function normalizeNik(value: string): string {
  return value.replace(/\s+/gu, "").trim();
}

export function maskNik(value: string): string {
  const nik = normalizeNik(value);
  if (nik.length <= 6) return `${nik.slice(0, 2)}${"*".repeat(Math.max(0, nik.length - 2))}`;
  return `${nik.slice(0, 6)}${"*".repeat(Math.max(4, nik.length - 8))}${nik.slice(-2)}`;
}

export function participantIdentityMatches(
  registered: { normalizedName: string; nik: string },
  input: { normalizedName: string; nik: string },
): boolean {
  return registered.normalizedName === input.normalizedName && normalizeNik(registered.nik) === normalizeNik(input.nik);
}
