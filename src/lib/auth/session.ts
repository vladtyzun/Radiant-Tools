import type { SessionOptions } from "iron-session";

export interface SessionData {
  isLoggedIn?: boolean;
}

export const SESSION_COOKIE = "pattern_auth";

export function getSessionOptions(): SessionOptions {
  const password = process.env.AUTH_SECRET?.trim();
  if (!password || password.length < 32) {
    return {
      password: "0".repeat(32),
      cookieName: SESSION_COOKIE,
      cookieOptions: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 3,
        sameSite: "lax",
        path: "/",
      },
    };
  }

  return {
    password,
    cookieName: SESSION_COOKIE,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 3,
      sameSite: "lax",
      path: "/",
    },
  };
}
