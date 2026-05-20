export type AuthMode = "disabled" | "required" | "misconfigured";

export function getAuthMode(): AuthMode {
  const hash = process.env.AUTH_PASSWORD_HASH?.trim();
  const secret = process.env.AUTH_SECRET?.trim();

  if (!hash) {
    return process.env.NODE_ENV === "production" ? "misconfigured" : "disabled";
  }

  if (!secret || secret.length < 32) {
    return "misconfigured";
  }

  return "required";
}

export function authConfigMessage(): string {
  const mode = getAuthMode();
  if (mode === "misconfigured") {
    if (!process.env.AUTH_PASSWORD_HASH?.trim()) {
      return "Set AUTH_PASSWORD_HASH and AUTH_SECRET (32+ chars) in environment variables.";
    }
    return "AUTH_SECRET must be at least 32 characters.";
  }
  return "";
}

let devWarned = false;

export function warnAuthDisabledInDev(): void {
  if (devWarned || process.env.NODE_ENV === "production") return;
  if (getAuthMode() !== "disabled") return;
  devWarned = true;
  console.warn(
    "[auth] AUTH_PASSWORD_HASH not set — password protection disabled in development."
  );
}
