"use client";

import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/Button";

// Safety net for errors thrown outside the (app) shell — the (app) layout's
// auth queries or the login page. No shell exists here, so it carries Brand.
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-7 bg-[var(--canvas)] px-6">
      <Brand />
      <div className="text-center">
        <h1 className="text-[44px]">Something went wrong</h1>
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
