import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { authConfigMessage, getAuthMode } from "@/lib/auth/config";

type Props = {
  searchParams: Promise<{ error?: string; from?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const mode = getAuthMode();
  const configError =
    params.error === "config" || mode === "misconfigured"
      ? authConfigMessage()
      : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm rounded-xl border border-[#1f1f1f] bg-sidebar p-6 shadow-xl">
        <p className="text-[10px] text-muted">Pattern generator</p>
        <h1 className="mt-0.5 text-xl font-bold text-white">Sign in</h1>
        <p className="mt-2 text-[13px] text-muted">
          Enter the password to use Radiant Pattern.
        </p>

        {configError && (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] leading-snug text-amber-200">
            {configError}
          </p>
        )}

        {mode === "disabled" ? (
          <p className="mt-4 text-[13px] text-muted">
            Auth is disabled in development (no AUTH_PASSWORD_HASH).{" "}
            <Link href="/" className="text-white underline">
              Continue to app
            </Link>
          </p>
        ) : (
          <LoginForm redirectTo={params.from || "/"} />
        )}
      </div>
    </main>
  );
}
