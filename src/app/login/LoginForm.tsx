"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  redirectTo: string;
};

export function LoginForm({ redirectTo }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error || "Sign in failed");
        return;
      }

      const target =
        redirectTo.startsWith("/") && !redirectTo.startsWith("//")
          ? redirectTo
          : "/";
      router.push(target);
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="password" className="mb-1.5 block text-[13px] text-muted">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 w-full rounded-lg border border-[#333] bg-panel px-3 text-[14px] text-white outline-none ring-white/20 focus:ring-2"
          disabled={loading}
        />
      </div>

      {error && (
        <p className="text-[12px] text-red-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex h-10 w-full items-center justify-center rounded-lg bg-white text-[14px] font-medium text-black hover:bg-neutral-200 disabled:opacity-60"
      >
        {loading ? "Checking…" : "Enter"}
      </button>
    </form>
  );
}
