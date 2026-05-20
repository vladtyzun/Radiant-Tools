import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a0a] px-4 text-white">
      <h1 className="text-lg font-medium">Page not found</h1>
      <p className="text-sm text-white/60">The page you requested does not exist.</p>
      <Link
        href="/"
        className="rounded-md bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
      >
        Back home
      </Link>
    </div>
  );
}
