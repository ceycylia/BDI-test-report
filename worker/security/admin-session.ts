import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnvironment } from "../types";

export const ADMIN_SESSION_COOKIE = "bdi_admin_session";
export const ADMIN_CSRF_COOKIE = "bdi_admin_csrf";
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

const commonCookieOptions = {
  path: "/",
  sameSite: "Strict" as const,
};

export function readAdminSessionToken(
  context: Context<AppEnvironment>,
): string | undefined {
  return getCookie(context, ADMIN_SESSION_COOKIE);
}

export function readCsrfCookie(
  context: Context<AppEnvironment>,
): string | undefined {
  return getCookie(context, ADMIN_CSRF_COOKIE);
}

export function setAdminCookies(
  context: Context<AppEnvironment>,
  sessionToken: string,
  csrfToken: string,
): void {
  const secure = context.env.APP_ENV === "production";

  setCookie(context, ADMIN_SESSION_COOKIE, sessionToken, {
    ...commonCookieOptions,
    httpOnly: true,
    secure,
    maxAge: ADMIN_SESSION_SECONDS,
  });
  setCookie(context, ADMIN_CSRF_COOKIE, csrfToken, {
    ...commonCookieOptions,
    httpOnly: false,
    secure,
    maxAge: ADMIN_SESSION_SECONDS,
  });
}

export function clearAdminCookies(context: Context<AppEnvironment>): void {
  const secure = context.env.APP_ENV === "production";

  deleteCookie(context, ADMIN_SESSION_COOKIE, {
    ...commonCookieOptions,
    secure,
  });
  deleteCookie(context, ADMIN_CSRF_COOKIE, {
    ...commonCookieOptions,
    secure,
  });
}
