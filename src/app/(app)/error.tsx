"use client";

import { Button } from "@/components/ui/Button";

// Renders inside the (app) shell, so the sidebar stays up while the page
// content shows the error. error.message is never rendered — it can carry
// internal details; the digest is enough to find the server log line.
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-6 py-16 text-center [box-shadow:var(--sh)]">
      <div>
        <h1 className="text-[36px]">Something went wrong</h1>
        <p className="mt-2 max-w-[400px] text-[14px] text-[var(--muted)]">
          The page hit an unexpected error. Try again — if it keeps happening,
          tell us.
        </p>
      </div>
      <Button onClick={() => retry()}>Try again</Button>
      {error.digest && (
        <p className="text-[11px] text-[var(--muted)] font-[family-name:var(--font-mono)]">
          Ref: {error.digest}
        </p>
      )}
    </div>
  );
}
