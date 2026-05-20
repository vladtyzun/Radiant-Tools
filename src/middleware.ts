import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfigMessage, getAuthMode, warnAuthDisabledInDev } from "@/lib/auth/config";
import { SESSION_COOKIE } from "@/lib/auth/session";

const PUBLIC_PATHS = new Set(["/login"]);

function isPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.(?:ico|png|jpg|jpeg|svg|gif|webp|css|js|woff2?|txt|map)$/i.test(pathname)
  );
}

function isAuthApi(pathname: string): boolean {
  return pathname === "/api/auth/login" || pathname === "/api/auth/logout";
}

/** Edge-safe gate: iron-session runs only in Node route handlers. */
function hasSessionCookie(request: NextRequest): boolean {
  return Boolean(request.cookies.get(SESSION_COOKIE)?.value);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicAsset(pathname) || isAuthApi(pathname)) {
    return NextResponse.next();
  }

  const mode = getAuthMode();

  if (mode === "disabled") {
    warnAuthDisabledInDev();
    return NextResponse.next();
  }

  const loggedIn = hasSessionCookie(request);

  if (mode === "misconfigured") {
    if (PUBLIC_PATHS.has(pathname)) {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: authConfigMessage() },
        { status: 503 }
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("error", "config");
    return NextResponse.redirect(loginUrl);
  }

  if (PUBLIC_PATHS.has(pathname)) {
    if (loggedIn) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!loggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
