import { normalizeNik } from "../../../worker/domain/participants/normalize-nik";

export const REMEMBERED_PARTICIPANT_KEY = "bdi-remembered-participant-v1";

export type RememberedParticipant = {
  name: string;
  nik: string;
  cohortId: string;
};

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

function validRememberedParticipant(value: unknown): value is RememberedParticipant {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RememberedParticipant>;
  return typeof candidate.name === "string"
    && candidate.name.trim().length > 0
    && typeof candidate.nik === "string"
    && /^\d{3,40}$/u.test(normalizeNik(candidate.nik))
    && typeof candidate.cohortId === "string"
    && candidate.cohortId.length > 0;
}

export function readRememberedParticipant(storage: KeyValueStorage): RememberedParticipant | null {
  try {
    const raw = storage.getItem(REMEMBERED_PARTICIPANT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!validRememberedParticipant(parsed)) return null;
    return {
      name: parsed.name.trim(),
      nik: normalizeNik(parsed.nik),
      cohortId: parsed.cohortId,
    };
  } catch {
    return null;
  }
}

export function rememberParticipant(storage: KeyValueStorage, participant: RememberedParticipant) {
  const normalized = {
    name: participant.name.trim(),
    nik: normalizeNik(participant.nik),
    cohortId: participant.cohortId,
  };
  if (!validRememberedParticipant(normalized)) return false;
  try {
    storage.setItem(REMEMBERED_PARTICIPANT_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function rememberedBatchId(
  batches: ReadonlyArray<{ id: string; cohortId: string | null }>,
  remembered: RememberedParticipant | null,
) {
  if (!remembered) return null;
  return batches.find((batch) => batch.cohortId === remembered.cohortId)?.id ?? null;
}
