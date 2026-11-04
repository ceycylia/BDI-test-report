import type { AdminUser, ApiErrorPayload } from "./types";
import { FUNDING_SOURCE_STORAGE_KEY, type FundingSource } from "../funding-source/funding-source";

export class AdminApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
  }
}

function fallbackMessage(status: number) {
  if (status === 401) return "Sesi Anda telah berakhir. Silakan masuk kembali.";
  if (status === 403) return "Anda tidak memiliki akses untuk melakukan tindakan ini.";
  if (status === 404) return "Data yang diminta tidak ditemukan.";
  if (status === 409) return "Data tidak dapat diproses karena konflik dengan data yang sudah ada.";
  if (status >= 500) return "Terjadi gangguan pada sistem. Silakan coba kembali.";
  return "Permintaan tidak dapat diproses.";
}

function readCookie(name: string): string | undefined {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
}

async function parseError(response: Response): Promise<AdminApiError> {
  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
  return new AdminApiError(
    payload.error?.message ?? fallbackMessage(response.status),
    response.status,
    payload.error?.code,
  );
}

function activeFundingSource(): FundingSource {
  return window.localStorage.getItem(FUNDING_SOURCE_STORAGE_KEY) === "PNBP" ? "PNBP" : "RUPIAH_MURNI";
}

function withFundingContext(path: string, override?: FundingSource) {
  if (!path.startsWith("/api/admin/")) return path;
  const url = new URL(path, window.location.origin);
  if (!url.searchParams.has("fundingSource")) url.searchParams.set("fundingSource", override ?? activeFundingSource());
  return `${url.pathname}${url.search}${url.hash}`;
}

function switchFundingContextFrom(error: AdminApiError) {
  const source = error.code?.replace("FUNDING_SOURCE_CONTEXT_", "");
  if (source !== "RUPIAH_MURNI" && source !== "PNBP") return null;
  window.localStorage.setItem(FUNDING_SOURCE_STORAGE_KEY, source);
  window.dispatchEvent(new CustomEvent("bdi:funding-source-change", { detail: source }));
  return source;
}

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const response = await fetch("/api/admin/me", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });

  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw await parseError(response);
  }

  const payload = (await response.json()) as { admin: AdminUser };
  return payload.admin;
}

export async function loginAdmin(input: {
  username: string;
  password: string;
}): Promise<AdminUser> {
  const response = await fetch("/api/admin/login", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await parseError(response);
    throw error;
  }

  const payload = (await response.json()) as { admin: AdminUser };
  return payload.admin;
}

export async function logoutAdmin(): Promise<void> {
  const csrfToken = readCookie("bdi_admin_csrf");
  const response = await fetch("/api/admin/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
  });

  if (!response.ok && response.status !== 401) {
    throw await parseError(response);
  }
}

export async function adminMutation<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const csrfToken = readCookie("bdi_admin_csrf");
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  if (csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  const response = await fetch(withFundingContext(path), {
    ...init,
    credentials: "same-origin",
    headers,
  });

  if (!response.ok) {
    const error = await parseError(response);
    switchFundingContextFrom(error);
    throw error;
  }

  return (await response.json()) as T;
}

export async function adminQuery<T>(path: string): Promise<T> {
  let response = await fetch(withFundingContext(path), {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const error = await parseError(response);
    const switched = switchFundingContextFrom(error);
    if (!switched) throw error;
    response = await fetch(withFundingContext(path, switched), {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw await parseError(response);
  }

  return (await response.json()) as T;
}

export async function adminUpload<T>(path: string, body: FormData): Promise<T> {
  const csrfToken = readCookie("bdi_admin_csrf");
  const headers = new Headers({ Accept: "application/json" });
  if (csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  const response = await fetch(withFundingContext(path), {
    method: "POST",
    credentials: "same-origin",
    headers,
    body,
  });

  if (!response.ok) {
    const error = await parseError(response);
    switchFundingContextFrom(error);
    throw error;
  }

  return (await response.json()) as T;
}

export async function adminDownload(path: string, init: RequestInit): Promise<Blob> {
  const csrfToken = readCookie("bdi_admin_csrf");
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/zip");
  headers.set("Content-Type", "application/json");
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(withFundingContext(path), { ...init, credentials: "same-origin", headers });
  if (!response.ok) {
    const error = await parseError(response);
    switchFundingContextFrom(error);
    throw error;
  }
  return response.blob();
}
