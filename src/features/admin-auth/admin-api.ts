import type { AdminUser, ApiErrorPayload } from "./types";

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
    payload.error?.message ?? "Permintaan tidak dapat diproses.",
    response.status,
    payload.error?.code,
  );
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
    window.alert(error.message);
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

  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers,
  });

  if (!response.ok) {
    const error = await parseError(response);
    window.alert(error.message);
    throw error;
  }

  return (await response.json()) as T;
}

export async function adminQuery<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as T;
}

export async function adminUpload<T>(path: string, body: FormData): Promise<T> {
  const csrfToken = readCookie("bdi_admin_csrf");
  const headers = new Headers({ Accept: "application/json" });
  if (csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers,
    body,
  });

  if (!response.ok) {
    const error = await parseError(response);
    window.alert(error.message);
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
  const response = await fetch(path, { ...init, credentials: "same-origin", headers });
  if (!response.ok) {
    const error = await parseError(response);
    window.alert(error.message);
    throw error;
  }
  return response.blob();
}
