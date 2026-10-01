export function normalizeParticipantName(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("id-ID");
}

export function cleanParticipantName(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}
