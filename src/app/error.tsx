"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a0a] px-4 text-white">
      <h1 className="text-lg font-medium">Something went wrong</h1>
      <p className="max-w-md text-center text-sm text-white/60">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-md bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
      >
        Retry
      </button>
    </div>
  );
}
