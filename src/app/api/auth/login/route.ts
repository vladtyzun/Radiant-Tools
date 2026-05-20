import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getIronSession } from "iron-session";
import { authConfigMessage, getAuthMode } from "@/lib/auth/config";
import { getSessionOptions, type SessionData } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const mode = getAuthMode();

  if (mode === "misconfigured") {
    return NextResponse.json({ error: authConfigMessage() }, { status: 503 });
  }

  if (mode === "disabled") {
    return NextResponse.json({ ok: true });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const password = body.password?.trim();
  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  const hash = process.env.AUTH_PASSWORD_HASH!.trim();
  const valid = await bcrypt.compare(password, hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    getSessionOptions()
  );
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({ ok: true });
}
