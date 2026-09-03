"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * The number is already in the server-rendered payload for every signed-in
 * user — this click gate is UX friction against casual scraping-by-eye, not
 * a security boundary (documented in CLAUDE.md).
 */
export function RevealWhatsApp({ number }: { number: string }) {
  const [revealed, setRevealed] = useState(false);

  if (!revealed) {
    return (
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => setRevealed(true)}
      >
        Show WhatsApp
      </Button>
    );
  }

  // wa.me wants the full international number as bare digits (no +).
  return (
    <a
      href={`https://wa.me/${number.replace(/\D/g, "")}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-10 w-full items-center justify-center rounded-[var(--rs)] border border-[var(--accent-200)] bg-[var(--accent-50)] px-[15px] text-[13.5px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-100)]"
    >
      Open WhatsApp
    </a>
  );
}
